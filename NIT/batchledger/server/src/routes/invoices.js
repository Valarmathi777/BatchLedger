import express from 'express';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getProductStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'SALESMAN'));

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.invoice.findMany({
      include: { customer: true, items: { include: { product: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const inv = await prisma.invoice.findUnique({
      where: { id: Number(req.params.id) },
      include: { customer: true, order: true, items: { include: { product: true } }, payments: true, dispatches: { include: { items: true } }, createdBy: { select: { name: true } } },
    });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    res.json(inv);
  } catch (err) { next(err); }
});

// Create GST invoice from approved order
router.post('/', authorize('ADMIN', 'SALESMAN'), async (req, res, next) => {
  try {
    const { invoiceNo, orderId, invoiceDate, notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: { include: { product: true } } },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'APPROVED') return res.status(400).json({ error: 'Order must be APPROVED before invoicing' });

    // Check no existing posted invoice for this order
    const existingInvoice = await prisma.invoice.findFirst({ where: { orderId, status: 'POSTED' } });
    if (existingInvoice) return res.status(409).json({ error: 'An invoice already exists for this order' });

    // Check stock availability at invoice time
    for (const item of order.items) {
      const stock = await getProductStock(item.productId);
      if (stock.currentQty < item.orderedQty) {
        return res.status(400).json({
          error: `Insufficient stock to invoice. Product: ${item.product.name}, Available: ${stock.currentQty}, Required: ${item.orderedQty}`,
        });
      }
    }

    // Determine intra/inter-state (compare customer state with business state TN)
    const BUSINESS_STATE = 'Tamil Nadu';
    const isInterState = order.customer.state !== BUSINESS_STATE;

    // Calculate GST
    let taxableAmount = new Decimal(0);
    const invoiceItems = [];

    for (const item of order.items) {
      const lineTotal = new Decimal(item.unitPrice).times(item.orderedQty);
      const gstRate = item.product.gstRate;
      let cgst = new Decimal(0), sgst = new Decimal(0), igst = new Decimal(0);

      if (isInterState) {
        igst = lineTotal.times(gstRate / 100);
      } else {
        cgst = lineTotal.times(gstRate / 200);
        sgst = lineTotal.times(gstRate / 200);
      }

      taxableAmount = taxableAmount.plus(lineTotal);
      invoiceItems.push({
        productId: item.productId,
        quantity: item.orderedQty,
        unitPrice: item.unitPrice,
        taxableAmount: lineTotal.toNumber(),
        gstRate,
        cgst: cgst.toNumber(),
        sgst: sgst.toNumber(),
        igst: igst.toNumber(),
        totalAmount: lineTotal.plus(cgst).plus(sgst).plus(igst).toNumber(),
      });
    }

    const totalGst = invoiceItems.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0);
    const grandTotal = taxableAmount.toNumber() + totalGst;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        orderId,
        customerId: order.customerId,
        invoiceDate: new Date(invoiceDate),
        status: 'POSTED',
        taxableAmount: taxableAmount.toNumber(),
        cgst: invoiceItems.reduce((s, i) => s + i.cgst, 0),
        sgst: invoiceItems.reduce((s, i) => s + i.sgst, 0),
        igst: invoiceItems.reduce((s, i) => s + i.igst, 0),
        totalGst,
        grandTotal,
        isInterState,
        amountPaid: 0,
        amountDue: grandTotal,
        paymentStatus: 'UNPAID',
        notes,
        createdById: req.user.id,
        items: { create: invoiceItems },
      },
      include: { customer: true, items: { include: { product: true } } },
    });

    await audit({ userId: req.user.id, action: 'CREATE', entity: 'Invoice', entityId: invoice.id, newValues: { invoiceNo, grandTotal }, ipAddress: req.ip });
    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

// Cancel invoice (never delete – mark cancelled and create credit note reference)
router.post('/:id/cancel', authorize('ADMIN'), async (req, res, next) => {
  try {
    const invId = Number(req.params.id);
    const { cancelReason, creditNoteRef } = req.body;
    const inv = await prisma.invoice.findUnique({ where: { id: invId } });
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (inv.status === 'CANCELLED') return res.status(400).json({ error: 'Invoice already cancelled' });
    if (inv.amountPaid > 0) return res.status(400).json({ error: 'Cannot cancel invoice with payments. Issue a credit note instead.' });

    const updated = await prisma.invoice.update({
      where: { id: invId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason, creditNoteRef },
    });
    await audit({ userId: req.user.id, action: 'CANCEL', entity: 'Invoice', entityId: invId, ipAddress: req.ip });
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
