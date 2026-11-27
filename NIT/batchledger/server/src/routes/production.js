import express from 'express';
import Decimal from 'decimal.js';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { moveMaterialStock, moveProductStock, getMaterialStock } from '../utils/stock.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
router.use(authenticate, authorize('ADMIN', 'PRODUCTION_SUPERVISOR', 'SELLER'));

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.productionRun.findMany({
      where: req.user.role === 'SELLER' ? { product: { sellerId: req.user.id }, orderId: { not: null } } : {},
      include: { product: true, bom: true, supervisor: { select: { name: true } }, issues: { include: { material: true } }, expenses: true, variances: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const run = await prisma.productionRun.findFirst({
      where: {
        id: Number(req.params.id),
        ...(req.user.role === 'SELLER' ? { product: { sellerId: req.user.id }, orderId: { not: null } } : {}),
      },
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
router.post('/:id/complete', authorize('ADMIN', 'PRODUCTION_SUPERVISOR', 'SELLER'), async (req, res, next) => {
  try {
    const runId = Number(req.params.id);
    const { actualOutput: rawActualOutput, damagedQty: rawDamagedQty = 0, issues, expenses = [] } = req.body;
    const actualOutput = Number(rawActualOutput);
    const damagedQty = Number(rawDamagedQty);
    // issues: [{ materialId, actualQty, returnedQty }]
    if (!Number.isInteger(runId) || runId < 1
      || !Number.isFinite(actualOutput) || actualOutput < 0
      || !Number.isFinite(damagedQty) || damagedQty < 0
      || !Array.isArray(issues) || !Array.isArray(expenses)) {
      return res.status(400).json({ error: 'Production output, damaged quantity, issues, and expenses must be valid.' });
    }
    if (issues.some(issue => !issue || typeof issue !== 'object'
      || !Number.isInteger(Number(issue.materialId))
      || !Number.isFinite(Number(issue.actualQty)) || Number(issue.actualQty) < 0
      || !Number.isFinite(Number(issue.returnedQty || 0)) || Number(issue.returnedQty || 0) < 0
      || Number(issue.returnedQty || 0) > Number(issue.actualQty))) {
      return res.status(400).json({ error: 'Material issue and return quantities must be valid and returns cannot exceed usage.' });
    }
    if (expenses.some(expense => !expense || typeof expense !== 'object'
      || !['LABOUR', 'POWER', 'GAS', 'OTHER'].includes(expense.expenseType)
      || !Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0
      || (expense.description !== undefined && (typeof expense.description !== 'string' || expense.description.length > 200)))) {
      return res.status(400).json({ error: 'Production expenses must have a valid type and non-negative amount.' });
    }

    const existingRun = await prisma.productionRun.findUnique({
      where: { id: runId },
      include: { product: true, bom: { include: { items: { include: { material: true } } } } },
    });
    if (!existingRun) return res.status(404).json({ error: 'Production run not found' });
    if (req.user.role === 'SELLER') {
      if (existingRun.orderId === null || existingRun.product.sellerId !== req.user.id) {
        return res.status(404).json({ error: 'Production run not found' });
      }
      const allowedMaterials = new Set(existingRun.bom.items
        .filter(item => item.material.sellerId === req.user.id)
        .map(item => item.materialId));
      if (issues.some(issue => !allowedMaterials.has(Number(issue.materialId)))) {
        return res.status(400).json({ error: 'Production issues must use materials assigned to this seller and the run BOM.' });
      }
    }
    if (existingRun.status === 'COMPLETED') return res.status(400).json({ error: 'Production run already completed' });

    const result = await prisma.$transaction(async (tx) => {
      let totalMaterialCost = new Decimal(0);
      const issueRecords = [];
      const varianceRecords = [];

      for (const issue of issues) {
        const materialId = Number(issue.materialId);
        const actualQty = Number(issue.actualQty);
        const returnedQty = Number(issue.returnedQty || 0);
        const matLedger = await getMaterialStock(materialId, tx);
        const netQty = new Decimal(actualQty).minus(returnedQty);
        const totalCost = netQty.times(matLedger.avgCost);
        totalMaterialCost = totalMaterialCost.plus(totalCost);

        // Issue materials from stock
        await moveMaterialStock({
          materialId,
          qty: -netQty.toNumber(),
          unitCost: matLedger.avgCost,
          movementType: 'PRODUCTION_ISSUE',
          referenceId: runId,
          referenceType: 'ProductionRun',
          notes: `Batch ${existingRun.batchNo}`,
        }, tx);

        const bomItem = existingRun.bom.items.find(b => b.materialId === materialId);
        const standardQty = bomItem && existingRun.bom.batchSize > 0
          ? bomItem.quantity * existingRun.plannedOutput / existingRun.bom.batchSize
          : 0;
        const variancePct = standardQty > 0 ? ((netQty.toNumber() - standardQty) / standardQty) * 100 : 0;

        issueRecords.push({
          productionRunId: runId,
          materialId,
          standardQty,
          actualQty,
          returnedQty,
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
          data: { productionRunId: runId, expenseType: exp.expenseType, description: exp.description, amount: Number(exp.amount), createdById: req.user.id },
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
