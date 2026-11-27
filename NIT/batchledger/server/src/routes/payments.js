import express from 'express';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'SALESMAN'));

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.payment.findMany({
      include: { customer: true, invoice: true, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

// Record a payment against an invoice
router.post('/', authorize('ADMIN', 'SALESMAN'), async (req, res, next) => {
  try {
    const { paymentNo, invoiceId, paymentDate, amount, mode, referenceNo, notes } = req.body;

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot record payment against a cancelled invoice' });

    const payAmt = new Decimal(amount);
    const newAmountPaid = new Decimal(invoice.amountPaid).plus(payAmt);
    const newAmountDue = new Decimal(invoice.grandTotal).minus(newAmountPaid);

    if (newAmountPaid.gt(invoice.grandTotal)) {
      return res.status(400).json({ error: `Payment exceeds invoice total. Max payable: ₹${new Decimal(invoice.grandTotal).minus(invoice.amountPaid).toFixed(2)}` });
    }

    const paymentStatus = newAmountDue.lte(0) ? 'PAID' : 'PARTIAL';

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          paymentNo,
          invoiceId,
          customerId: invoice.customerId,
          paymentDate: new Date(paymentDate),
          amount: payAmt.toNumber(),
          mode,
          referenceNo,
          notes,
          createdById: req.user.id,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid.toNumber(),
          amountDue: newAmountDue.toNumber(),
          paymentStatus,
        },
      });

      return payment;
    });

    await audit({ userId: req.user.id, action: 'CREATE', entity: 'Payment', entityId: result.id, newValues: { paymentNo, amount, invoiceId }, ipAddress: req.ip });
    res.status(201).json({ payment: result, invoice: { amountPaid: newAmountPaid.toNumber(), amountDue: newAmountDue.toNumber(), paymentStatus } });
  } catch (err) { next(err); }
});

export default router;
