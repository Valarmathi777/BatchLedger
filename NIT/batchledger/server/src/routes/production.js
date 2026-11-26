import express from 'express';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { moveMaterialStock, moveProductStock, getMaterialStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.productionRun.findMany({
      include: { product: true, bom: true, supervisor: { select: { name: true } }, issues: { include: { material: true } }, expenses: true, variances: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const run = await prisma.productionRun.findUnique({
      where: { id: Number(req.params.id) },
      include: { product: true, bom: { include: { items: { include: { material: true } } } }, supervisor: { select: { name: true } }, issues: { include: { material: true } }, expenses: true, variances: true },
    });
    if (!run) return res.status(404).json({ error: 'Production run not found' });
    res.json(run);
  } catch (err) { next(err); }
});

// Create production run (PLANNED)
router.post('/', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const { batchNo, bomId, productId, plannedOutput, productionDate, notes } = req.body;
    const run = await prisma.productionRun.create({
      data: { batchNo, bomId, productId, plannedOutput, productionDate: new Date(productionDate), notes, supervisorId: req.user.id, status: 'PLANNED' },
    });
    res.status(201).json(run);
  } catch (err) { next(err); }
});

// Complete a production run – issues materials, adds finished goods, computes variances
router.post('/:id/complete', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const runId = Number(req.params.id);
    const { actualOutput, damagedQty = 0, issues, expenses = [] } = req.body;
    // issues: [{ materialId, actualQty, returnedQty }]

    const existingRun = await prisma.productionRun.findUnique({
      where: { id: runId },
      include: { bom: { include: { items: { include: { material: true } } } } },
    });
    if (!existingRun) return res.status(404).json({ error: 'Production run not found' });
    if (existingRun.status === 'COMPLETED') return res.status(400).json({ error: 'Production run already completed' });

    const result = await prisma.$transaction(async (tx) => {
      let totalMaterialCost = new Decimal(0);
      const issueRecords = [];
      const varianceRecords = [];

      for (const issue of issues) {
        const matLedger = await getMaterialStock(issue.materialId, tx);
        const netQty = new Decimal(issue.actualQty).minus(issue.returnedQty || 0);
        const totalCost = netQty.times(matLedger.avgCost);
        totalMaterialCost = totalMaterialCost.plus(totalCost);

        // Issue materials from stock
        await moveMaterialStock({
          materialId: issue.materialId,
          qty: -netQty.toNumber(),
          unitCost: matLedger.avgCost,
          movementType: 'PRODUCTION_ISSUE',
          referenceId: runId,
          referenceType: 'ProductionRun',
          notes: `Batch ${existingRun.batchNo}`,
        }, tx);

        const bomItem = existingRun.bom.items.find(b => b.materialId === issue.materialId);
        const standardQty = bomItem ? bomItem.quantity : 0;
        const variancePct = standardQty > 0 ? ((netQty.toNumber() - standardQty) / standardQty) * 100 : 0;

        issueRecords.push({
          productionRunId: runId,
          materialId: issue.materialId,
          standardQty,
          actualQty: issue.actualQty,
          returnedQty: issue.returnedQty || 0,
          netQty: netQty.toNumber(),
          unitCost: matLedger.avgCost,
          totalCost: totalCost.toNumber(),
        });

        varianceRecords.push({
          productionRunId: runId,
          varianceType: 'MATERIAL',
          materialId: issue.materialId,
          standardQty,
          actualQty: netQty.toNumber(),
          variancePct: +variancePct.toFixed(4),
          isFlagged: Math.abs(variancePct) > 3,
          notes: bomItem?.material?.name,
        });
      }

      // Create issue records
      await tx.productionIssue.createMany({ data: issueRecords });

      // Create expense records
      let totalExpenseCost = new Decimal(0);
      for (const exp of expenses) {
        totalExpenseCost = totalExpenseCost.plus(exp.amount);
        await tx.productionExpense.create({
          data: { productionRunId: runId, expenseType: exp.expenseType, description: exp.description, amount: exp.amount, createdById: req.user.id },
        });
      }

      // Yield variance
      const yieldVariancePct = existingRun.plannedOutput > 0
        ? ((actualOutput - existingRun.plannedOutput) / existingRun.plannedOutput) * 100
        : 0;
      varianceRecords.push({
        productionRunId: runId,
        varianceType: 'YIELD',
        standardQty: existingRun.plannedOutput,
        actualQty: actualOutput,
        variancePct: +yieldVariancePct.toFixed(4),
        isFlagged: Math.abs(yieldVariancePct) > 3,
        notes: 'Output yield',
      });

      await tx.productionVariance.createMany({ data: varianceRecords });

      // Cost per good packet (weighted average material + overhead)
      const totalCostAll = totalMaterialCost.plus(totalExpenseCost);
      const costPerPacket = actualOutput > 0 ? totalCostAll.dividedBy(actualOutput) : new Decimal(0);

      // Add finished goods to stock
      await moveProductStock({
        productId: existingRun.productId,
        qty: actualOutput,
        unitCost: costPerPacket.toNumber(),
        movementType: 'PRODUCTION_ISSUE',
        referenceId: runId,
        referenceType: 'ProductionRun',
        notes: `Batch ${existingRun.batchNo} – ${actualOutput} good packets`,
      }, tx);

      // Mark run complete
      const updatedRun = await tx.productionRun.update({
        where: { id: runId },
        data: { actualOutput, damagedQty, status: 'COMPLETED', completedAt: new Date() },
      });

      return { run: updatedRun, costPerPacket: costPerPacket.toFixed(4), totalMaterialCost: totalMaterialCost.toFixed(2), totalExpenseCost: totalExpenseCost.toFixed(2) };
    });

    await audit({ userId: req.user.id, action: 'UPDATE', entity: 'ProductionRun', entityId: runId, newValues: { status: 'COMPLETED', actualOutput }, ipAddress: req.ip });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
