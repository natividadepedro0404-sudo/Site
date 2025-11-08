const express = require('express');
const multer = require('multer');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 5 } });

// Public: list products
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ products: data });
});

// Admin: create product with up to 5 images
router.post('/', adminRequired, upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price, stock } = req.body;
    const productInsert = { name, description, price: Number(price || 0), stock: Number(stock || 0) };
    const { data: prod, error: prodErr } = await supabase.from('products').insert([productInsert]).select().single();
    if (prodErr) return res.status(400).json({ error: prodErr.message });

    const files = req.files || [];
    const imageUrls = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const key = `products/${prod.id}/${Date.now()}_${i}.jpg`;
      const result = await supabase.storage.from('product_images').upload(key, f.buffer, { contentType: f.mimetype });
      if (result.error) continue;
      const { publicURL } = supabase.storage.from('product_images').getPublicUrl(key);
      imageUrls.push(publicURL);
    }

    await supabase.from('products').update({ images: imageUrls }).eq('id', prod.id);
    const { data: updated } = await supabase.from('products').select().eq('id', prod.id).single();
    res.json({ product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: update product
router.put('/:id', adminRequired, async (req, res) => {
  const id = req.params.id;
  const changes = req.body;
  const { data, error } = await supabase.from('products').update(changes).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ product: data });
});

// Admin: delete product
router.delete('/:id', adminRequired, async (req, res) => {
  const id = req.params.id;
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;