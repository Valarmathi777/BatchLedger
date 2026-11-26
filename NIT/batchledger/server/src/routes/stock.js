import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/stock/materials – current raw material stock
router.get('/materials', async (req, res, next) => {
  try {
    const ledgers = await prisma.stockLedger.findMany({
      where: { materialId: { not: null } },
      include: { material: true },
    });
    // Enrich with material info
    res.json(ledgers.map(l => ({
      materialId: l.materialId,
      material: l.material,
      currentQty: l.currentQty,
      avgCost: l.avgCost,
      totalValue: +(l.currentQty * l.avgCost).toFixed(2),
    })));
  } catch (err) { next(err); }
});

// GET /api/stock/products – current finished goods stock
router.get('/products', async (req, res, next) => {
  try {
    const ledgers = await prisma.stockLedger.findMany({
      where: { productId: { not: null } },
      include: { product: true },
    });
    res.json(ledgers.map(l => ({
      productId: l.productId,
      product: l.product,
      currentQty: l.currentQty,
      avgCost: l.avgCost,
      totalValue: +(l.currentQty * l.avgCost).toFixed(2),
    })));
  } catch (err) { next(err); }
});

// GET /api/stock/movements?materialId=&productId=&limit=100
router.get('/movements', async (req, res, next) => {
  try {
    const { materialId, productId, limit = 100 } = req.query;
    const where = {};
    if (materialId) where.materialId = Number(materialId);
    if (productId) where.productId = Number(productId);

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        material: { select: { name: true, unit: true } },
        product: { select: { name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
    res.json(movements);
  } catch (err) { next(err); }
});

export default router;
