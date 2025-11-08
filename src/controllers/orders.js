const express = require('express');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');

const router = express.Router();

// Create checkout: expects user token, items [{product_id, qty, checked}], address optionally
router.post('/checkout', authRequired, async (req, res) => {
  try {
    const { items, address, coupon_code } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Itens inválidos' });
    const selected = items.filter(i => i.checked);
    if (!selected.length) return res.status(400).json({ error: 'Selecione ao menos um item para pagar' });

    // Load product details and calculate total
    const productIds = selected.map(s => s.product_id);
    const { data: products } = await supabase.from('products').select('*').in('id', productIds);
    let total = 0;
    const orderItems = selected.map(s => {
      const p = products.find(x => x.id === s.product_id);
      const qty = Number(s.qty || 1);
      const subtotal = (p?.price || 0) * qty;
      total += subtotal;
      return { product_id: s.product_id, name: p?.name || 'Produto', qty, price: p?.price || 0 };
    });

    // TODO: apply coupon validation

    // Create order in DB with status 'pedido feito'
    const { data: order, error } = await supabase.from('orders').insert([{ user_id: req.user.id, items: orderItems, total, address, status: 'pedido feito' }]).select().single();
    if (error) return res.status(400).json({ error: error.message });

    // Initiate PIX payment with Efí Bank (exemplificativo)
    const efibase = process.env.EFIBANK_API_URL;
    const efikey = process.env.EFIBANK_API_KEY;
    let payment = { status: 'pending' };
    try {
      const resp = await fetch(`${efibase}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${efikey}` },
        body: JSON.stringify({ amount: total, currency: 'BRL', method: 'pix', metadata: { order_id: order.id } })
      });
      payment = await resp.json();
    } catch (e) {
      // fallback: create a local payment object
      payment = { id: `local_${order.id}`, status: 'pending', pix_qr: null, payment_url: null };
    }

    // save payment meta to order
    await supabase.from('orders').update({ payment }).eq('id', order.id);

    res.json({ order, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list orders
router.get('/', adminRequired, async (req, res) => {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data });
});

// User: get current user's orders
router.get('/mine', authRequired, async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ orders: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update order status and delivery estimate
router.put('/:id/status', adminRequired, async (req, res) => {
  const id = req.params.id;
  const { status, delivery_estimate } = req.body;
  const { data, error } = await supabase.from('orders').update({ status, delivery_estimate }).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ order: data });
});

module.exports = router;