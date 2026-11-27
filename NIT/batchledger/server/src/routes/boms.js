import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'PRODUCTION_SUPERVISOR'));

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.bom.findMany({
      include: { product: true, items: { include: { material: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const bom = await prisma.bom.findUnique({
      where: { id: Number(req.params.id) },
      include: { product: true, items: { include: { material: true } } },
    });
    if (!bom) return res.status(404).json({ error: 'BOM not found' });
    res.json(bom);
  } catch (err) { next(err); }
});

// Create BOM with items
router.post('/', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const { productId, batchSize, version, items } = req.body;
    const bom = await prisma.bom.create({
      data: {
        productId,
        batchSize,
        version: version || 1,
        items: { create: items.map(i => ({ materialId: i.materialId, quantity: i.quantity, unit: i.unit })) },
      },
      include: { product: true, items: { include: { material: true } } },
    });
    res.status(201).json(bom);
  } catch (err) { next(err); }
});

export default router;
