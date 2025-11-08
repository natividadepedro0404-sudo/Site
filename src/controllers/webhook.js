const express = require('express');
const supabase = require('../db/supabaseClient');
const nodemailer = require('nodemailer');

const router = express.Router();

// Efí Bank webhook endpoint sample
router.post('/efibank', express.json(), async (req, res) => {
  // Validate webhook secret if provided
  const secret = process.env.EFIBANK_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers['x-efibank-signature'];
    if (!sig || sig !== secret) return res.status(403).json({ error: 'Invalid webhook signature' });
  }

  const payload = req.body;
  // Expected payload example: { event: 'payment.succeeded', data: { payment_id, metadata: { order_id } } }
  try {
    if (payload?.event === 'payment.succeeded') {
      const orderId = payload.data?.metadata?.order_id;
      if (!orderId) return res.status(400).json({ error: 'order_id missing' });

      // Update order status
      await supabase.from('orders').update({ status: 'em separação', payment_confirmed_at: new Date().toISOString() }).eq('id', orderId);

      // Fetch order details to email admin
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();

      // Send email to admin with order info
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });

      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const text = `Novo pedido #${order.id}\nCliente: ${order.user_id}\nEndereço: ${order.address || '—'}\nItens:\n` +
          order.items.map(i => `- ${i.name} x${i.qty}`).join('\n');
        await transporter.sendMail({ from: process.env.SMTP_USER, to: adminEmail, subject: `Novo pedido #${order.id}`, text, html: `<pre>${text}</pre>` });
      }

      return res.json({ ok: true });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('webhook error', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;