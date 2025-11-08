const express = require('express');
const { body, param } = require('express-validator');
const supabase = require('../db/supabaseClient');
const { authRequired, adminRequired } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Public: validate coupon
router.post('/validate', authRequired, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Código do cupom é obrigatório.' });

  const now = new Date().toISOString();
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code)
    .gte('expires_at', now)
    .single();

  if (error || !coupon) return res.status(404).json({ error: 'Cupom inválido ou expirado.' });
  res.json({ coupon });
});

// Admin: list coupons
router.get('/', adminRequired, async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ coupons: data });
});

// Validation rules for creating/updating coupons
const couponValidators = [
  body('code')
    .exists().withMessage('Código é obrigatório')
    .isAlphanumeric().withMessage('Código deve ser alfanumérico')
    .isLength({ min: 3, max: 30 }).withMessage('Código deve ter entre 3 e 30 caracteres')
    .custom(async (value, { req }) => {
      // For creation: ensure unique code. For update: allow same code for the same id
      const q = supabase.from('coupons').select('id, code').eq('code', value);
      const { data, error } = await q;
      if (error) throw new Error('Erro ao verificar código');
      if (data && data.length) {
        // If updating, it's okay if the found id equals params.id
        if (req.params && req.params.id) {
          const existing = data.find(d => String(d.id) === String(req.params.id));
          if (existing) return true;
        }
        throw new Error('Código já existe');
      }
      return true;
    }),
  body('type')
    .exists().withMessage('Tipo é obrigatório')
    .isIn(['percentage', 'fixed']).withMessage('Tipo inválido'),
  body('value')
    .exists().withMessage('Valor é obrigatório')
    .isFloat({ gt: 0 }).withMessage('Valor deve ser maior que 0'),
  body('expires_at')
    .exists().withMessage('Data de expiração é obrigatória')
    .isISO8601().withMessage('Data inválida')
    .custom(value => {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new Error('Data inválida');
      if (date <= new Date()) throw new Error('Data de expiração deve ser no futuro');
      return true;
    }),
  body('usage_limit')
    .optional()
    .isInt({ min: 0 }).withMessage('usage_limit deve ser inteiro >= 0')
];

// Admin: create coupon
router.post('/', adminRequired, validate(couponValidators), async (req, res) => {
  const { code, type, value, expires_at, usage_limit } = req.body;

  const payload = { code, type, value, expires_at };
  if (typeof usage_limit !== 'undefined') payload.usage_limit = Number(usage_limit);

  const { data, error } = await supabase
    .from('coupons')
    .insert([payload])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ coupon: data });
});

// Admin: update coupon
router.put('/:id', adminRequired, validate([
  param('id').exists().withMessage('ID obrigatório'),
  // reuse validators but code should be optional on update
  body('code').optional().isAlphanumeric().withMessage('Código deve ser alfanumérico'),
  body('type').optional().isIn(['percentage', 'fixed']).withMessage('Tipo inválido'),
  body('value').optional().isFloat({ gt: 0 }).withMessage('Valor deve ser maior que 0'),
  body('expires_at').optional().isISO8601().withMessage('Data inválida'),
  body('usage_limit').optional().isInt({ min: 0 }).withMessage('usage_limit deve ser inteiro >= 0')
]), async (req, res) => {
  const { id } = req.params;
  const changes = req.body;
  if (typeof changes.usage_limit !== 'undefined') changes.usage_limit = Number(changes.usage_limit);

  const { data, error } = await supabase
    .from('coupons')
    .update(changes)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ coupon: data });
});

// Admin: delete coupon
router.delete('/:id', adminRequired, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;