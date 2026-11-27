import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'PRODUCTION_SUPERVISOR'));

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.material.findMany({
      include: { seller: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
    if (!m) return res.status(404).json({ error: 'Material not found' });
    res.json(m);
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const { sellerId, ...body } = req.body;
    if (sellerId !== undefined && sellerId !== null) {
      if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only administrators can assign material ownership.' });
      const seller = await prisma.user.findFirst({ where: { id: Number(sellerId), role: 'SELLER', isActive: true } });
      if (!seller) return res.status(400).json({ error: 'Material owner must be an active seller account.' });
    }
    const m = await prisma.material.create({ data: { ...body, sellerId: sellerId ? Number(sellerId) : null } });
    res.status(201).json(m);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const { sellerId, ...body } = req.body;
    if (sellerId !== undefined) {
      if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only administrators can assign material ownership.' });
      if (sellerId !== null) {
        const seller = await prisma.user.findFirst({ where: { id: Number(sellerId), role: 'SELLER', isActive: true } });
        if (!seller) return res.status(400).json({ error: 'Material owner must be an active seller account.' });
      }
    }
    const data = { ...body };
    if (sellerId !== undefined) data.sellerId = sellerId ? Number(sellerId) : null;
    const m = await prisma.material.update({ where: { id: Number(req.params.id) }, data });
    res.json(m);
  } catch (err) { next(err); }
});

export default router;
