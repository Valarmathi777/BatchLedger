import express from 'express';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { moveMaterialStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.purchase.findMany({
      include: { supplier: true, items: { include: { material: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const p = await prisma.purchase.findUnique({
      where: { id: Number(req.params.id) },
      include: { supplier: true, items: { include: { material: true } }, createdBy: { select: { name: true } } },
    });
    if (!p) return res.status(404).json({ error: 'Purchase not found' });
    res.json(p);
  } catch (err) { next(err); }
});

// Create purchase and update stock atomically
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { purchaseNo, supplierId, purchaseDate, items, notes } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Purchase must have at least one item' });

    const totalAmount = items.reduce((sum, i) => new Decimal(sum).plus(new Decimal(i.unitPrice).times(i.quantity)).toNumber(), 0);

    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          purchaseNo,
          supplierId,
          purchaseDate: new Date(purchaseDate),
          totalAmount,
          notes,
          createdById: req.user.id,
          status: 'POSTED',
          items: {
            create: items.map(i => ({
              materialId: i.materialId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: new Decimal(i.unitPrice).times(i.quantity).toNumber(),
            })),
          },
        },
        include: { items: { include: { material: true } }, supplier: true },
      });

      // Update stock for each item
      for (const item of items) {
        await moveMaterialStock({
          materialId: item.materialId,
          qty: item.quantity,
          unitCost: item.unitPrice,
          movementType: 'PURCHASE',
          referenceId: p.id,
          referenceType: 'Purchase',
          notes: `Purchase ${purchaseNo}`,
        }, tx);
      }

      return p;
    });

    await audit({ userId: req.user.id, action: 'CREATE', entity: 'Purchase', entityId: purchase.id, newValues: { purchaseNo, totalAmount }, ipAddress: req.ip });
    res.status(201).json(purchase);
  } catch (err) { next(err); }
});

export default router;
