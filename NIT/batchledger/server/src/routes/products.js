import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const where = req.user.role === 'CUSTOMER' ? { isActive: true } : {};
    const list = await prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', authorize('ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR'), async (req, res, next) => {
  try {
    const p = await prisma.product.findUnique({ where: { id: Number(req.params.id) }, include: { boms: { include: { items: { include: { material: true } } } } } });
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(p);
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const p = await prisma.product.create({ data: req.body });
    res.status(201).json(p);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const p = await prisma.product.update({ where: { id: Number(req.params.id) }, data: req.body });
    res.json(p);
  } catch (err) { next(err); }
});

export default router;
