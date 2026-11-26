import Decimal from 'decimal.js';
import prisma from './prisma.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Get or create a StockLedger entry for a material.
 */
export async function getMaterialStock(materialId, tx = prisma) {
  let ledger = await tx.stockLedger.findUnique({ where: { materialId } });
  if (!ledger) {
    ledger = await tx.stockLedger.create({ data: { materialId, currentQty: 0, avgCost: 0 } });
  }
  return ledger;
}

/**
 * Get or create a StockLedger entry for a finished product.
 */
export async function getProductStock(productId, tx = prisma) {
  let ledger = await tx.stockLedger.findUnique({ where: { productId } });
  if (!ledger) {
    ledger = await tx.stockLedger.create({ data: { productId, currentQty: 0, avgCost: 0 } });
  }
  return ledger;
}

/**
 * Update material stock using weighted-average cost method.
 * For IN movements: recalculate avgCost.
 * For OUT movements: use current avgCost, reduce quantity.
 *
 * @param {object} params
 * @param {number} params.materialId
 * @param {number} params.qty         - positive for IN, negative for OUT
 * @param {number} params.unitCost    - cost per unit (for IN movements)
 * @param {string} params.movementType
 * @param {number|null} params.referenceId
 * @param {string|null} params.referenceType
 * @param {string|null} params.notes
 * @param {object} tx - Prisma transaction client
 */
export async function moveMaterialStock({ materialId, qty, unitCost = 0, movementType, referenceId = null, referenceType = null, notes = null }, tx = prisma) {
  const ledger = await getMaterialStock(materialId, tx);

  const currentQty = new Decimal(ledger.currentQty);
  const currentAvg = new Decimal(ledger.avgCost);
  const inQty = new Decimal(qty);
  const inCost = new Decimal(unitCost);

  let newAvg = currentAvg;
  let newQty = currentQty.plus(inQty);

  if (inQty.gt(0)) {
    // Weighted average: (currentQty * currentAvg + inQty * inCost) / newQty
    if (newQty.gt(0)) {
      newAvg = currentQty.times(currentAvg).plus(inQty.times(inCost)).dividedBy(newQty);
    }
  }

  if (newQty.lt(0)) {
    throw new Error(`Insufficient stock for material ID ${materialId}. Available: ${currentQty.toFixed(3)}, Requested: ${inQty.abs().toFixed(3)}`);
  }

  const totalCost = inQty.abs().times(inQty.lt(0) ? currentAvg : inCost);

  // Update ledger
  await tx.stockLedger.update({
    where: { materialId },
    data: {
      currentQty: newQty.toNumber(),
      avgCost: newAvg.toNumber(),
    },
  });

  // Record movement
  const movement = await tx.stockMovement.create({
    data: {
      movementType,
      referenceId,
      referenceType,
      materialId,
      quantity: inQty.toNumber(),
      unitCost: inQty.lt(0) ? currentAvg.toNumber() : inCost.toNumber(),
      totalCost: totalCost.toNumber(),
      balanceQty: newQty.toNumber(),
      notes,
    },
  });

  return { ledger: { currentQty: newQty.toNumber(), avgCost: newAvg.toNumber() }, movement };
}

/**
 * Update finished-goods stock (product).
 */
export async function moveProductStock({ productId, qty, unitCost = 0, movementType, referenceId = null, referenceType = null, notes = null }, tx = prisma) {
  const ledger = await getProductStock(productId, tx);

  const currentQty = new Decimal(ledger.currentQty);
  const currentAvg = new Decimal(ledger.avgCost);
  const inQty = new Decimal(qty);
  const inCost = new Decimal(unitCost);

  let newAvg = currentAvg;
  let newQty = currentQty.plus(inQty);

  if (inQty.gt(0) && newQty.gt(0)) {
    newAvg = currentQty.times(currentAvg).plus(inQty.times(inCost)).dividedBy(newQty);
  }

  if (newQty.lt(0)) {
    throw new Error(`Insufficient finished goods stock for product ID ${productId}. Available: ${currentQty.toFixed(0)}, Requested: ${inQty.abs().toFixed(0)}`);
  }

  const totalCost = inQty.abs().times(inQty.lt(0) ? currentAvg : inCost);

  await tx.stockLedger.update({
    where: { productId },
    data: { currentQty: newQty.toNumber(), avgCost: newAvg.toNumber() },
  });

  const movement = await tx.stockMovement.create({
    data: {
      movementType,
      referenceId,
      referenceType,
      productId,
      quantity: inQty.toNumber(),
      unitCost: inQty.lt(0) ? currentAvg.toNumber() : inCost.toNumber(),
      totalCost: totalCost.toNumber(),
      balanceQty: newQty.toNumber(),
      notes,
    },
  });

  return { ledger: { currentQty: newQty.toNumber(), avgCost: newAvg.toNumber() }, movement };
}
