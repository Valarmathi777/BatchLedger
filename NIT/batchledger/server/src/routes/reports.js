import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/reports/sales?from=&to=
router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'POSTED' };
    if (from || to) {
      where.invoiceDate = {};
      if (from) where.invoiceDate.gte = new Date(from);
      if (to) where.invoiceDate.lte = new Date(to);
    }
    const invoices = await prisma.invoice.findMany({
      where,
      include: { customer: true, items: { include: { product: true } }, payments: true },
      orderBy: { invoiceDate: 'asc' },
    });
    res.json(invoices);
  } catch (err) { next(err); }
});

// GET /api/reports/gst?from=&to=
router.get('/gst', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const where = { status: 'POSTED' };
    if (from || to) { where.invoiceDate = {}; if (from) where.invoiceDate.gte = new Date(from); if (to) where.invoiceDate.lte = new Date(to); }
    const invoices = await prisma.invoice.findMany({ where, include: { customer: true }, orderBy: { invoiceDate: 'asc' } });
    const totals = invoices.reduce((acc, inv) => ({
      taxable: acc.taxable + inv.taxableAmount,
      cgst: acc.cgst + inv.cgst,
      sgst: acc.sgst + inv.sgst,
      igst: acc.igst + inv.igst,
      total: acc.total + inv.grandTotal,
    }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    res.json({ invoices, totals });
  } catch (err) { next(err); }
});

// GET /api/reports/stock
router.get('/stock', async (req, res, next) => {
  try {
    const [materials, products] = await Promise.all([
      prisma.stockLedger.findMany({ where: { materialId: { not: null } }, include: { material: true } }),
      prisma.stockLedger.findMany({ where: { productId: { not: null } }, include: { product: true } }),
    ]);
    res.json({
      rawMaterials: materials.map(m => ({ name: m.material?.name, unit: m.material?.unit, qty: m.currentQty, avgCost: m.avgCost, totalValue: +(m.currentQty * m.avgCost).toFixed(2) })),
      finishedGoods: products.map(p => ({ name: p.product?.name, unit: p.product?.unit, qty: p.currentQty, avgCost: p.avgCost, totalValue: +(p.currentQty * p.avgCost).toFixed(2) })),
    });
  } catch (err) { next(err); }
});

// GET /api/reports/production?runId=
router.get('/production', async (req, res, next) => {
  try {
    const where = req.query.runId ? { id: Number(req.query.runId) } : {};
    const runs = await prisma.productionRun.findMany({
      where,
      include: { product: true, issues: { include: { material: true } }, expenses: true, variances: true, supervisor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(runs);
  } catch (err) { next(err); }
});

// GET /api/reports/costing/:runId – Batch DNA
router.get('/costing/:runId', async (req, res, next) => {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: Number(req.params.runId) },
      include: { product: true, issues: { include: { material: true } }, expenses: true, variances: true },
    });
    if (!run) return res.status(404).json({ error: 'Production run not found' });

    const materialCost = run.issues.reduce((s, i) => s + i.totalCost, 0);
    const expenseCost = run.expenses.reduce((s, e) => s + e.amount, 0);
    const totalCost = materialCost + expenseCost;
    const costPerPacket = run.actualOutput > 0 ? totalCost / run.actualOutput : 0;

    res.json({
      run,
      costing: {
        materialCost: +materialCost.toFixed(2),
        expenseCost: +expenseCost.toFixed(2),
        totalCost: +totalCost.toFixed(2),
        costPerPacket: +costPerPacket.toFixed(4),
        assumptions: [
          'Material cost uses weighted-average cost at time of issue from stock ledger.',
          'Labour and overhead (gas/power) added as direct production expenses.',
          'Damaged/rejected packets included in total cost but not in per-packet divisor (cost borne by good output).',
          'Wastage material cost is embedded in total material issue cost.',
        ],
      },
    });
  } catch (err) { next(err); }
});

// GET /api/reports/collections – outstanding dues
router.get('/collections', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { status: 'POSTED', paymentStatus: { not: 'PAID' } },
      include: { customer: true, payments: true },
      orderBy: { invoiceDate: 'asc' },
    });
    const totals = invoices.reduce((acc, inv) => ({ totalDue: acc.totalDue + inv.amountDue, totalPaid: acc.totalPaid + inv.amountPaid }), { totalDue: 0, totalPaid: 0 });
    res.json({ invoices, totals });
  } catch (err) { next(err); }
});

// GET /api/reports/audit-explorer/:invoiceId – trace invoice backwards
router.get('/audit-explorer/:invoiceId', async (req, res, next) => {
  try {
    const invId = Number(req.params.invoiceId);
    const invoice = await prisma.invoice.findUnique({
      where: { id: invId },
      include: {
        customer: true,
        items: { include: { product: true } },
        dispatches: { include: { items: true } },
        payments: true,
        order: true,
      },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Find production runs that produced the product
    const productIds = invoice.items.map(i => i.productId);
    const productionRuns = await prisma.productionRun.findMany({
      where: { productId: { in: productIds }, status: 'COMPLETED' },
      include: { issues: { include: { material: true } }, expenses: true, variances: true },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    // Find purchases for materials used in those runs
    const materialIds = [...new Set(productionRuns.flatMap(r => r.issues.map(i => i.materialId)))];
    const purchases = await prisma.purchaseItem.findMany({
      where: { materialId: { in: materialIds } },
      include: { purchase: { include: { supplier: true } }, material: true },
      orderBy: { purchase: { purchaseDate: 'desc' } },
      take: 10,
    });

    res.json({ invoice, productionRuns, rawMaterialPurchases: purchases });
  } catch (err) { next(err); }
});

export default router;
