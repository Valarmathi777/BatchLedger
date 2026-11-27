import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR', 'CUSTOMER'), async (req, res, next) => {
  try {
    const where = req.user.role === 'CUSTOMER'
      ? { isActive: true, isAvailable: true, sellerId: { not: null }, seller: { role: 'SELLER', isActive: true } }
      : {};
    const list = await prisma.product.findMany({
      where,
      include: { seller: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
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
    const { sellerId, ...body } = req.body;
    if (sellerId !== undefined && sellerId !== null) {
      const seller = await prisma.user.findFirst({ where: { id: Number(sellerId), role: 'SELLER', isActive: true } });
      if (!seller) return res.status(400).json({ error: 'Product seller must be an active seller account.' });
    }
    const p = await prisma.product.create({ data: { ...body, sellerId: sellerId ? Number(sellerId) : null } });
    res.status(201).json(p);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { sellerId, ...body } = req.body;
    if (sellerId !== undefined && sellerId !== null) {
      const seller = await prisma.user.findFirst({ where: { id: Number(sellerId), role: 'SELLER', isActive: true } });
      if (!seller) return res.status(400).json({ error: 'Product seller must be an active seller account.' });
    }
    const data = { ...body };
    if (sellerId !== undefined) data.sellerId = sellerId ? Number(sellerId) : null;
    const p = await prisma.product.update({ where: { id: Number(req.params.id) }, data });
    res.json(p);
  } catch (err) { next(err); }
});

export default router;
