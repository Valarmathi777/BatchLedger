import express from 'express';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getProductStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'SALESMAN', 'CUSTOMER'), async (req, res, next) => {
  try {
    if (req.user.role === 'CUSTOMER' && !req.user.customerId) {
      return res.status(403).json({ error: 'Customer account is not linked to a customer record.' });
    }
    const where = req.user.role === 'CUSTOMER' ? { customerId: req.user.customerId } : {};
    const list = await prisma.order.findMany({
      where,
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', authorize('ADMIN', 'SALESMAN', 'CUSTOMER'), async (req, res, next) => {
  try {
    const o = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { name: true } }, approvedBy: { select: { name: true } }, invoices: true, dispatches: { include: { items: true } } },
    });
    if (!o) return res.status(404).json({ error: 'Order not found' });
    if (req.user.role === 'CUSTOMER' && o.customerId !== req.user.customerId) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(o);
  } catch (err) { next(err); }
});

// Create order – check stock availability
router.post('/', authorize('ADMIN', 'SALESMAN', 'CUSTOMER'), async (req, res, next) => {
  try {
    const { orderNo, customerId: requestedCustomerId, orderDate, requiredDate, items, notes } = req.body;
    const isCustomer = req.user.role === 'CUSTOMER';
    const linkedCustomerId = isCustomer ? req.user.customerId : requestedCustomerId;
    if (isCustomer && !linkedCustomerId) return res.status(403).json({ error: 'Customer account is not linked to a customer record.' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Add at least one product to the order.' });

    // Check availability for each product
    const enrichedItems = [];
    for (const item of items) {
      const productId = Number(item.productId);
      const orderedQty = Number(item.orderedQty);
      if (!Number.isInteger(productId) || !Number.isFinite(orderedQty) || orderedQty <= 0) {
        return res.status(400).json({ error: 'Each order item must have a valid product and quantity.' });
      }

      const product = isCustomer
        ? await prisma.product.findFirst({ where: { id: productId, isActive: true } })
        : null;
      if (isCustomer && !product) return res.status(400).json({ error: 'One or more selected products are unavailable.' });

      const unitPrice = isCustomer ? product.sellingPrice : Number(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ error: 'Each order item must have a valid unit price.' });
      }

      const stock = await getProductStock(productId);
      const available = Math.min(stock.currentQty, orderedQty);
      const shortage = Math.max(0, orderedQty - stock.currentQty);
      enrichedItems.push({
        productId,
        orderedQty,
        unitPrice,
        availableQty: available,
        shortageQty: shortage,
        totalPrice: new Decimal(unitPrice).times(orderedQty).toNumber(),
      });
    }

    const totalAmount = enrichedItems.reduce((s, i) => s + i.totalPrice, 0);

    const order = await prisma.order.create({
      data: {
        orderNo: isCustomer ? `PORTAL-${req.user.id}-${randomUUID()}` : orderNo,
        customerId: linkedCustomerId,
        orderDate: isCustomer ? new Date() : new Date(orderDate),
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        totalAmount,
        notes,
        createdById: req.user.id,
        status: 'PENDING_APPROVAL',
        items: {
          create: enrichedItems.map(i => ({
            productId: i.productId,
            orderedQty: i.orderedQty,
            availableQty: i.availableQty,
            shortageQty: i.shortageQty,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
          })),
        },
      },
      include: { customer: true, items: { include: { product: true } } },
    });

    await audit({ userId: req.user.id, action: 'CREATE', entity: 'Order', entityId: order.id, newValues: { orderNo }, ipAddress: req.ip });
    res.status(201).json(order);
  } catch (err) { next(err); }
});

// Approve order
router.post('/:id/approve', authorize('ADMIN'), async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Block approval if any item has shortage
    const hasShortage = order.items.some(i => i.shortageQty > 0);
    if (hasShortage) {
      return res.status(400).json({ error: 'Cannot approve order: stock shortage exists. Reduce order quantity or wait for stock.', items: order.items.filter(i => i.shortageQty > 0) });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
    });
    await audit({ userId: req.user.id, action: 'APPROVE', entity: 'Order', entityId: orderId, ipAddress: req.ip });
    res.json(updated);
  } catch (err) { next(err); }
});

// Cancel order
router.post('/:id/cancel', authorize('ADMIN'), async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const updated = await prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await audit({ userId: req.user.id, action: 'CANCEL', entity: 'Order', entityId: orderId, ipAddress: req.ip });
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
