import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { moveProductStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.dispatch.findMany({
      include: { order: true, invoice: { include: { customer: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

// Create dispatch – deducts finished goods stock
router.post('/', authorize('ADMIN', 'SALESMAN'), async (req, res, next) => {
  try {
    const { dispatchNo, orderId, invoiceId, dispatchDate, vehicleNo, items, notes } = req.body;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: { include: { product: true } } } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status !== 'POSTED') return res.status(400).json({ error: 'Can only dispatch against a POSTED invoice' });

    const dispatch = await prisma.$transaction(async (tx) => {
      const d = await tx.dispatch.create({
        data: {
          dispatchNo,
          orderId,
          invoiceId,
          dispatchDate: new Date(dispatchDate),
          vehicleNo,
          notes,
          items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
        },
        include: { items: true },
      });

      // Deduct finished goods
      for (const item of items) {
        await moveProductStock({
          productId: item.productId,
          qty: -item.quantity,
          movementType: 'SALE',
          referenceId: invoiceId,
          referenceType: 'Invoice',
          notes: `Dispatch ${dispatchNo}`,
        }, tx);
      }

      // Mark order dispatched
      await tx.order.update({ where: { id: orderId }, data: { status: 'DISPATCHED' } });

      return d;
    });

    await audit({ userId: req.user.id, action: 'CREATE', entity: 'Dispatch', entityId: dispatch.id, newValues: { dispatchNo }, ipAddress: req.ip });
    res.status(201).json(dispatch);
  } catch (err) { next(err); }
});

export default router;
