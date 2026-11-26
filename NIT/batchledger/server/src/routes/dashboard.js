import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/summary
router.get('/summary', async (req, res, next) => {
  try {
    const [
      totalOrders,
      totalInvoices,
      totalRevenue,
      totalDue,
      lowStockMaterials,
      recentOrders,
      productionRuns,
      pendingPayments,
    ] = await Promise.all([
      prisma.order.count({ where: { status: { not: 'CANCELLED' } } }),
      prisma.invoice.count({ where: { status: 'POSTED' } }),
      prisma.invoice.aggregate({ where: { status: 'POSTED' }, _sum: { grandTotal: true } }),
      prisma.invoice.aggregate({ where: { status: 'POSTED', paymentStatus: { not: 'PAID' } }, _sum: { amountDue: true } }),
      prisma.stockLedger.findMany({
        where: { materialId: { not: null } },
        include: { material: true },
      }),
      prisma.order.findMany({ take: 5, orderBy: { createdAt: 'desc' }, include: { customer: true } }),
      prisma.productionRun.count({ where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
      prisma.invoice.findMany({ where: { paymentStatus: { not: 'PAID' }, status: 'POSTED' }, include: { customer: true }, orderBy: { createdAt: 'asc' }, take: 5 }),
    ]);

    const lowStock = lowStockMaterials.filter(l => l.material && l.currentQty <= l.material.reorderLevel);

    res.json({
      totalOrders,
      totalInvoices,
      totalRevenue: totalRevenue._sum.grandTotal || 0,
      totalDue: totalDue._sum.amountDue || 0,
      lowStockCount: lowStock.length,
      activeProductionRuns: productionRuns,
      recentOrders,
      pendingPayments,
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/charts – for Recharts
router.get('/charts', async (req, res, next) => {
  try {
    // Revenue last 6 months
    const invoices = await prisma.invoice.findMany({
      where: { status: 'POSTED', invoiceDate: { gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) } },
      select: { invoiceDate: true, grandTotal: true, taxableAmount: true, totalGst: true },
      orderBy: { invoiceDate: 'asc' },
    });

    // Group by month
    const byMonth = {};
    for (const inv of invoices) {
      const key = inv.invoiceDate.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[key]) byMonth[key] = { month: key, revenue: 0, gst: 0, taxable: 0 };
      byMonth[key].revenue += inv.grandTotal;
      byMonth[key].gst += inv.totalGst;
      byMonth[key].taxable += inv.taxableAmount;
    }

    // Stock summary
    const stockSummary = await prisma.stockLedger.findMany({
      include: { material: { select: { name: true } }, product: { select: { name: true } } },
    });

    // Production variance summary
    const variances = await prisma.productionVariance.findMany({
      where: { isFlagged: true },
      include: { productionRun: { select: { batchNo: true } } },
      orderBy: { productionRunId: 'desc' },
      take: 10,
    });

    res.json({
      revenueByMonth: Object.values(byMonth),
      stockSummary: stockSummary.map(s => ({
        name: s.material?.name || s.product?.name || 'Unknown',
        qty: s.currentQty,
        value: +(s.currentQty * s.avgCost).toFixed(2),
        type: s.materialId ? 'material' : 'product',
      })),
      flaggedVariances: variances,
    });
  } catch (err) { next(err); }
});

export default router;
