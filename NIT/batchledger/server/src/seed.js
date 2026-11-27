/**
 * BatchLedger Seed Script
 * ======================
 * Implements the EXACT benchmark scenario from the prompt:
 *
 * Product: Murukku 200g, standard batch 200 packets
 * BOM: Flour 40kg, oil 10L, spice 1.2kg, pouches 200, cartons 10
 * Opening stock as specified
 * Purchase 60kg flour @₹45
 * Production run with actual values
 * Sales: Retailer A (TN) 150 packets, Distributor B (KA) 120 packets (shortage!)
 * Payment: Retailer A pays ₹4,000
 *
 * All calculations done through actual DB transactions.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import Decimal from 'decimal.js';
import { moveMaterialStock, moveProductStock, getMaterialStock } from './utils/stock.js';

const prisma = new PrismaClient();

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

async function main() {
  console.log('🌱 Seeding BatchLedger database...\n');

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  console.log('Ensuring an initial administrator exists...');
  const hash = async (pw) => bcrypt.hash(pw, 12);
  const legacyDemoEmails = [
    'admin@batchledger.com',
    'salesman@batchledger.com',
    'supervisor@batchledger.com',
    'auditor@batchledger.com',
  ];
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true, email: { notIn: legacyDemoEmails } },
  });
  let admin = existingAdmin;

  if (!admin) {
    const adminName = process.env.INITIAL_ADMIN_NAME?.trim();
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!adminName || adminName.length > 100 || !adminEmail
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
      || !adminPassword || adminPassword.length < 12) {
      throw new Error(
        'No active administrator is configured. Set INITIAL_ADMIN_NAME (up to 100 characters), INITIAL_ADMIN_EMAIL (valid email), and INITIAL_ADMIN_PASSWORD (at least 12 characters), then run the seed again.'
      );
    }
    if (legacyDemoEmails.includes(adminEmail)) {
      throw new Error('INITIAL_ADMIN_EMAIL must not use a legacy demo account address.');
    }

    const existingAccount = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingAccount && existingAccount.role !== 'ADMIN') {
      throw new Error('INITIAL_ADMIN_EMAIL is already assigned to a non-admin account.');
    }

    const passwordHash = await hash(adminPassword);
    admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        passwordHash,
        isActive: true,
        sessionVersion: { increment: 1 },
      },
      create: { name: adminName, email: adminEmail, passwordHash, role: 'ADMIN' },
    });
  }

  await prisma.$transaction(async tx => {
    const migration = await tx.systemConfig.findUnique({ where: { key: 'LEGACY_DEMO_USERS_DISABLED' } });
    if (migration) return;
    await tx.user.updateMany({
      where: { email: { in: legacyDemoEmails }, isActive: true },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    await tx.systemConfig.create({
      data: { key: 'LEGACY_DEMO_USERS_DISABLED', value: 'true' },
    });
  });
  console.log(`✓ Administrator ready: ${admin.email}; legacy demo account migration complete.\n`);

  // ── 2. SYSTEM CONFIG ────────────────────────────────────────────────────────
  await prisma.systemConfig.upsert({ where: { key: 'BUSINESS_NAME' }, update: {}, create: { key: 'BUSINESS_NAME', value: 'Sri Murugan Snacks Pvt Ltd' } });
  await prisma.systemConfig.upsert({ where: { key: 'BUSINESS_STATE' }, update: {}, create: { key: 'BUSINESS_STATE', value: 'Tamil Nadu' } });
  await prisma.systemConfig.upsert({ where: { key: 'BUSINESS_GSTIN' }, update: {}, create: { key: 'BUSINESS_GSTIN', value: '33AABCS1429B1ZB' } });
  await prisma.systemConfig.upsert({ where: { key: 'BUSINESS_STATE_CODE' }, update: {}, create: { key: 'BUSINESS_STATE_CODE', value: '33' } });
  await prisma.systemConfig.upsert({ where: { key: 'INVOICE_PREFIX' }, update: {}, create: { key: 'INVOICE_PREFIX', value: 'BL' } });

  // ── 3. CUSTOMERS ─────────────────────────────────────────────────────────────
  console.log('Creating customers...');
  const retailerA = await prisma.customer.upsert({
    where: { code: 'CUST-001' },
    update: {},
    create: { code: 'CUST-001', name: 'Retailer A (Coimbatore)', gstNumber: '33AACFR1234A1Z5', state: 'Tamil Nadu', stateCode: '33', address: '12 Gandhi Road, Coimbatore, TN 641001', phone: '9876543210', creditLimit: 25000 },
  });

  const distributorB = await prisma.customer.upsert({
    where: { code: 'CUST-002' },
    update: {},
    create: { code: 'CUST-002', name: 'Distributor B (Bangalore)', gstNumber: '29AACFD5678B1Z2', state: 'Karnataka', stateCode: '29', address: '45 MG Road, Bengaluru, KA 560001', phone: '9123456780', creditLimit: 50000 },
  });

  console.log('✓ Customers: Retailer A (TN), Distributor B (KA)\n');

  // ── 4. SUPPLIER ──────────────────────────────────────────────────────────────
  const supplier = await prisma.supplier.upsert({
    where: { code: 'SUPP-001' },
    update: {},
    create: { code: 'SUPP-001', name: 'Annamalai Traders', gstNumber: '33AABCA9876C1Z1', state: 'Tamil Nadu', address: 'Koyambedu Market, Chennai' },
  });

  // ── 5. MATERIALS ─────────────────────────────────────────────────────────────
  console.log('Creating materials...');
  const flour = await prisma.material.upsert({ where: { code: 'MAT-001' }, update: {}, create: { code: 'MAT-001', name: 'Rice Flour', unit: 'kg', reorderLevel: 20 } });
  const oil = await prisma.material.upsert({ where: { code: 'MAT-002' }, update: {}, create: { code: 'MAT-002', name: 'Refined Oil', unit: 'L', reorderLevel: 5 } });
  const spice = await prisma.material.upsert({ where: { code: 'MAT-003' }, update: {}, create: { code: 'MAT-003', name: 'Spice Mix', unit: 'kg', reorderLevel: 1 } });
  const pouches = await prisma.material.upsert({ where: { code: 'MAT-004' }, update: {}, create: { code: 'MAT-004', name: 'Pouches 200g', unit: 'pcs', reorderLevel: 100 } });
  const cartons = await prisma.material.upsert({ where: { code: 'MAT-005' }, update: {}, create: { code: 'MAT-005', name: 'Cartons', unit: 'pcs', reorderLevel: 10 } });

  // ── 6. PRODUCT ───────────────────────────────────────────────────────────────
  const murukku = await prisma.product.upsert({
    where: { code: 'PROD-001' },
    update: {},
    create: { code: 'PROD-001', name: 'Murukku 200g', unit: 'packet', gstRate: 5, hsnCode: '1905', sellingPrice: 50 },
  });

  // ── 7. BOM ───────────────────────────────────────────────────────────────────
  console.log('Creating BOM...');
  let bom = await prisma.bom.findFirst({ where: { productId: murukku.id, version: 1 } });
  if (!bom) {
    bom = await prisma.bom.create({
      data: {
        productId: murukku.id,
        batchSize: 200,
        version: 1,
        items: {
          create: [
            { materialId: flour.id, quantity: 40, unit: 'kg' },
            { materialId: oil.id, quantity: 10, unit: 'L' },
            { materialId: spice.id, quantity: 1.2, unit: 'kg' },
            { materialId: pouches.id, quantity: 200, unit: 'pcs' },
            { materialId: cartons.id, quantity: 10, unit: 'pcs' },
          ],
        },
      },
    });
  }
  console.log('✓ BOM: Murukku 200g – 200 packets/batch\n');

  // ── 8. OPENING STOCK ─────────────────────────────────────────────────────────
  console.log('Loading opening stock...');

  // Helper: set opening stock (only if stock ledger is at zero)
  async function setOpening(materialId, qty, cost, name) {
    const existing = await prisma.stockLedger.findUnique({ where: { materialId } });
    if (existing && existing.currentQty > 0) {
      console.log(`  ↳ ${name}: already has stock (${existing.currentQty}), skipping`);
      return;
    }
    await moveMaterialStock({ materialId, qty, unitCost: cost, movementType: 'OPENING', notes: 'Opening balance' });
    console.log(`  ↳ ${name}: ${qty} @ ₹${cost}`);
  }

  async function setOpeningProduct(productId, qty, cost, name) {
    const existing = await prisma.stockLedger.findUnique({ where: { productId } });
    if (existing && existing.currentQty > 0) {
      console.log(`  ↳ ${name}: already has stock (${existing.currentQty}), skipping`);
      return;
    }
    await moveProductStock({ productId, qty, unitCost: cost, movementType: 'OPENING', notes: 'Opening balance – finished goods' });
    console.log(`  ↳ ${name}: ${qty} packets @ ₹${cost}`);
  }

  await setOpening(flour.id, 100, 42, 'Rice Flour');
  await setOpening(oil.id, 30, 140, 'Refined Oil');
  await setOpening(spice.id, 5, 200, 'Spice Mix');
  await setOpening(pouches.id, 500, 2.5, 'Pouches');
  await setOpening(cartons.id, 30, 15, 'Cartons');
  await setOpeningProduct(murukku.id, 50, 40, 'Murukku 200g (finished goods)');

  // ── 9. PURCHASE ──────────────────────────────────────────────────────────────
  console.log('\nRecording purchase: 60 kg flour @ ₹45...');

  let purchase = await prisma.purchase.findFirst({ where: { purchaseNo: 'PO-2024-001' } });
  if (!purchase) {
    purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          purchaseNo: 'PO-2024-001',
          supplierId: supplier.id,
          purchaseDate: new Date('2024-01-10'),
          totalAmount: 60 * 45,
          createdById: admin.id,
          status: 'POSTED',
          items: { create: [{ materialId: flour.id, quantity: 60, unitPrice: 45, totalPrice: 60 * 45 }] },
        },
      });
      await moveMaterialStock({ materialId: flour.id, qty: 60, unitCost: 45, movementType: 'PURCHASE', referenceId: p.id, referenceType: 'Purchase', notes: 'PO-2024-001' }, tx);
      return p;
    });
  }

  // Verify flour stock after purchase
  const flourLedger = await prisma.stockLedger.findUnique({ where: { materialId: flour.id } });
  const flourAvgCost = new Decimal(flourLedger.avgCost);
  console.log(`✓ Flour stock after purchase: ${flourLedger.currentQty} kg @ ₹${flourAvgCost.toFixed(4)}/kg`);
  console.log(`  Expected: 160 kg @ ₹${new Decimal(100 * 42 + 60 * 45).dividedBy(160).toFixed(4)}/kg (weighted avg)\n`);

  // ── 10. PRODUCTION RUN ───────────────────────────────────────────────────────
  console.log('Running production batch MK-0001...');

  let prodRun = await prisma.productionRun.findFirst({ where: { batchNo: 'MK-0001' } });
  if (!prodRun) {
    prodRun = await prisma.productionRun.create({
      data: {
        batchNo: 'MK-0001',
        bomId: bom.id,
        productId: murukku.id,
        plannedOutput: 200,
        productionDate: new Date('2024-01-11'),
        supervisorId: admin.id,
        status: 'PLANNED',
      },
    });

    // Complete the production run with ACTUAL values
    const actualOutput = 188;
    const damagedQty = 6;

    // Issues: flour 40kg, oil 10.5L (overconsumption!), spice 1.2kg, pouches 194 (188+6 damaged), cartons 9
    const issues = [
      { materialId: flour.id, actualQty: 40, returnedQty: 0 },
      { materialId: oil.id, actualQty: 10.5, returnedQty: 0 },
      { materialId: spice.id, actualQty: 1.2, returnedQty: 0 },
      { materialId: pouches.id, actualQty: 194, returnedQty: 0 },   // 188 good + 6 damaged
      { materialId: cartons.id, actualQty: 9, returnedQty: 0 },
    ];

    const expenses = [
      { expenseType: 'LABOUR', description: 'Labour cost', amount: 1200 },
      { expenseType: 'GAS', description: 'Gas and power', amount: 600 },
    ];

    await prisma.$transaction(async (tx) => {
      let totalMaterialCost = new Decimal(0);
      const issueRecords = [];
      const varianceRecords = [];
      const bomItems = await tx.bomItem.findMany({ where: { bomId: bom.id } });

      for (const issue of issues) {
        const matLedger = await getMaterialStock(issue.materialId, tx);
        const netQty = new Decimal(issue.actualQty).minus(issue.returnedQty);
        const totalCost = netQty.times(matLedger.avgCost);
        totalMaterialCost = totalMaterialCost.plus(totalCost);

        await moveMaterialStock({ materialId: issue.materialId, qty: -netQty.toNumber(), unitCost: matLedger.avgCost, movementType: 'PRODUCTION_ISSUE', referenceId: prodRun.id, referenceType: 'ProductionRun', notes: `Batch MK-0001` }, tx);

        const bomItem = bomItems.find(b => b.materialId === issue.materialId);
        const standardQty = bomItem ? bomItem.quantity : 0;
        const variancePct = standardQty > 0 ? ((netQty.toNumber() - standardQty) / standardQty) * 100 : 0;

        issueRecords.push({ productionRunId: prodRun.id, materialId: issue.materialId, standardQty, actualQty: issue.actualQty, returnedQty: issue.returnedQty, netQty: netQty.toNumber(), unitCost: matLedger.avgCost, totalCost: totalCost.toNumber() });
        varianceRecords.push({ productionRunId: prodRun.id, varianceType: 'MATERIAL', materialId: issue.materialId, standardQty, actualQty: netQty.toNumber(), variancePct: +variancePct.toFixed(4), isFlagged: Math.abs(variancePct) > 3 });
      }

      await tx.productionIssue.createMany({ data: issueRecords });

      let totalExpenseCost = new Decimal(0);
      for (const exp of expenses) {
        totalExpenseCost = totalExpenseCost.plus(exp.amount);
        await tx.productionExpense.create({ data: { productionRunId: prodRun.id, expenseType: exp.expenseType, description: exp.description, amount: exp.amount, createdById: admin.id } });
      }

      // Yield variance
      const yieldVariancePct = ((actualOutput - 200) / 200) * 100; // -6%
      varianceRecords.push({ productionRunId: prodRun.id, varianceType: 'YIELD', standardQty: 200, actualQty: actualOutput, variancePct: +yieldVariancePct.toFixed(4), isFlagged: Math.abs(yieldVariancePct) > 3, notes: 'Output yield variance' });
      await tx.productionVariance.createMany({ data: varianceRecords });

      const totalCostAll = totalMaterialCost.plus(totalExpenseCost);
      const costPerPacket = totalCostAll.dividedBy(actualOutput);

      // Add finished goods
      await moveProductStock({ productId: murukku.id, qty: actualOutput, unitCost: costPerPacket.toNumber(), movementType: 'PRODUCTION_ISSUE', referenceId: prodRun.id, referenceType: 'ProductionRun', notes: `Batch MK-0001 – ${actualOutput} good packets` }, tx);

      await tx.productionRun.update({ where: { id: prodRun.id }, data: { actualOutput, damagedQty, status: 'COMPLETED', completedAt: new Date('2024-01-11') } });

      console.log(`✓ Production completed: ${actualOutput} good packets`);
      console.log(`  Material cost: ₹${totalMaterialCost.toFixed(2)}`);
      console.log(`  Expense cost:  ₹${totalExpenseCost.toFixed(2)}`);
      console.log(`  Total cost:    ₹${totalCostAll.toFixed(2)}`);
      console.log(`  Cost/packet:   ₹${costPerPacket.toFixed(4)}`);
    });
  }

  // ── 11. SALES ORDER – RETAILER A (Tamil Nadu) ────────────────────────────────
  console.log('\nCreating sales order for Retailer A...');
  const fgStock = await prisma.stockLedger.findUnique({ where: { productId: murukku.id } });
  console.log(`  Finished goods before order: ${fgStock.currentQty} packets (50 opening + 188 produced = 238 expected)`);

  let orderA = await prisma.order.findFirst({ where: { orderNo: 'SO-2024-001' } });
  if (!orderA) {
    const availableA = Math.min(fgStock.currentQty, 150);
    const shortageA = Math.max(0, 150 - fgStock.currentQty);

    orderA = await prisma.order.create({
      data: {
        orderNo: 'SO-2024-001',
        customerId: retailerA.id,
        orderDate: new Date('2024-01-12'),
        requiredDate: new Date('2024-01-13'),
        totalAmount: 150 * 50,
        createdById: admin.id,
        status: 'PENDING_APPROVAL',
        items: { create: [{ productId: murukku.id, orderedQty: 150, availableQty: availableA, shortageQty: shortageA, unitPrice: 50, totalPrice: 150 * 50 }] },
      },
    });

    // Approve (no shortage)
    await prisma.order.update({ where: { id: orderA.id }, data: { status: 'APPROVED', approvedById: admin.id, approvedAt: new Date('2024-01-12') } });
    console.log(`✓ Order SO-2024-001 approved (no shortage, available: ${availableA})`);
  }

  // ── 12. GST INVOICE – RETAILER A (Intra-state: CGST+SGST) ──────────────────
  let invoiceA = await prisma.invoice.findFirst({ where: { invoiceNo: 'BL-2024-001' } });
  if (!invoiceA) {
    // TN customer → intra-state → CGST 2.5% + SGST 2.5%
    const taxable = 150 * 50; // ₹7,500
    const cgst = taxable * 0.025;   // ₹187.50
    const sgst = taxable * 0.025;   // ₹187.50
    const grandTotal = taxable + cgst + sgst; // ₹7,875

    invoiceA = await prisma.invoice.create({
      data: {
        invoiceNo: 'BL-2024-001',
        orderId: orderA.id,
        customerId: retailerA.id,
        invoiceDate: new Date('2024-01-12'),
        status: 'POSTED',
        taxableAmount: taxable,
        cgst,
        sgst,
        igst: 0,
        totalGst: cgst + sgst,
        grandTotal,
        isInterState: false,
        amountPaid: 0,
        amountDue: grandTotal,
        paymentStatus: 'UNPAID',
        createdById: admin.id,
        items: {
          create: [{
            productId: murukku.id, quantity: 150, unitPrice: 50,
            taxableAmount: taxable, gstRate: 5,
            cgst, sgst, igst: 0, totalAmount: grandTotal,
          }],
        },
      },
    });

    console.log(`\n✓ Invoice BL-2024-001:`);
    console.log(`  Taxable:  ₹${taxable.toFixed(2)}`);
    console.log(`  CGST 2.5%: ₹${cgst.toFixed(2)}`);
    console.log(`  SGST 2.5%: ₹${sgst.toFixed(2)}`);
    console.log(`  Grand total: ₹${grandTotal.toFixed(2)}`);
  }

  // ── 13. DISPATCH – RETAILER A ────────────────────────────────────────────────
  let dispatchA = await prisma.dispatch.findFirst({ where: { dispatchNo: 'DS-2024-001' } });
  if (!dispatchA) {
    dispatchA = await prisma.$transaction(async (tx) => {
      const d = await tx.dispatch.create({
        data: {
          dispatchNo: 'DS-2024-001',
          orderId: orderA.id,
          invoiceId: invoiceA.id,
          dispatchDate: new Date('2024-01-13'),
          vehicleNo: 'TN38 AB 1234',
          notes: 'Dispatched all 150 packets to Retailer A',
          items: { create: [{ productId: murukku.id, quantity: 150 }] },
        },
      });
      await moveProductStock({ productId: murukku.id, qty: -150, movementType: 'SALE', referenceId: invoiceA.id, referenceType: 'Invoice', notes: 'Dispatch DS-2024-001' }, tx);
      await tx.order.update({ where: { id: orderA.id }, data: { status: 'DISPATCHED' } });
      return d;
    });
    console.log(`✓ Dispatched 150 packets to Retailer A`);
  }

  // ── 14. SALES ORDER – DISTRIBUTOR B (Karnataka – shortage!) ─────────────────
  console.log('\nCreating order for Distributor B (Karnataka)...');
  const fgStockAfterDispatch = await prisma.stockLedger.findUnique({ where: { productId: murukku.id } });
  console.log(`  Finished goods after Retailer A dispatch: ${fgStockAfterDispatch.currentQty} packets`);
  console.log(`  Distributor B orders 120 packets – shortage of ${Math.max(0, 120 - fgStockAfterDispatch.currentQty)} packets`);

  let orderB = await prisma.order.findFirst({ where: { orderNo: 'SO-2024-002' } });
  if (!orderB) {
    const currentFG = fgStockAfterDispatch.currentQty;
    const availableB = Math.min(currentFG, 120);
    const shortageB = Math.max(0, 120 - currentFG);

    orderB = await prisma.order.create({
      data: {
        orderNo: 'SO-2024-002',
        customerId: distributorB.id,
        orderDate: new Date('2024-01-14'),
        requiredDate: new Date('2024-01-15'),
        totalAmount: 120 * 50,
        createdById: admin.id,
        status: 'PENDING_APPROVAL',
        notes: `Stock shortage: only ${availableB} available of 120 ordered`,
        items: {
          create: [{
            productId: murukku.id,
            orderedQty: 120,
            availableQty: availableB,
            shortageQty: shortageB,
            unitPrice: 50,
            totalPrice: 120 * 50,
          }],
        },
      },
      include: { items: true },
    });

    console.log(`✓ Order SO-2024-002 created: PENDING_APPROVAL`);
    console.log(`  Available: ${availableB} packets, Shortage: ${shortageB} packets`);
    console.log(`  ⚠ This order CANNOT be approved or invoiced until stock is replenished.`);
  }

  // ── 15. PAYMENT – RETAILER A pays ₹4,000 ────────────────────────────────────
  console.log('\nRecording partial payment from Retailer A...');
  let payment = await prisma.payment.findFirst({ where: { paymentNo: 'PAY-2024-001' } });
  if (!payment) {
    const payAmt = new Decimal(4000);
    const newPaid = new Decimal(invoiceA.amountPaid).plus(payAmt);
    const newDue = new Decimal(invoiceA.grandTotal).minus(newPaid);

    await prisma.$transaction(async (tx) => {
      payment = await tx.payment.create({
        data: {
          paymentNo: 'PAY-2024-001',
          invoiceId: invoiceA.id,
          customerId: retailerA.id,
          paymentDate: new Date('2024-01-15'),
          amount: payAmt.toNumber(),
          mode: 'BANK_TRANSFER',
          referenceNo: 'NEFT/2024/00123',
          notes: 'Partial payment from Retailer A',
          createdById: admin.id,
        },
      });

      await tx.invoice.update({
        where: { id: invoiceA.id },
        data: { amountPaid: newPaid.toNumber(), amountDue: newDue.toNumber(), paymentStatus: 'PARTIAL' },
      });
    });

    console.log(`✓ Payment PAY-2024-001: ₹4,000 received`);
    console.log(`  Outstanding balance: ₹${new Decimal(invoiceA.grandTotal).minus(4000).toFixed(2)}`);
  }

  // ── 16. AUDIT LOG for seed ───────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: { userId: admin.id, action: 'CREATE', entity: 'System', newValues: JSON.stringify({ notes: 'Database seeded with benchmark scenario' }), ipAddress: '127.0.0.1' },
  });

  // ── 17. FINAL STOCK VERIFICATION ─────────────────────────────────────────────
  console.log('\n📊 FINAL STOCK VERIFICATION (Expected values from benchmark):');
  console.log('─'.repeat(70));

  const flourFinal = await prisma.stockLedger.findUnique({ where: { materialId: flour.id } });
  const oilFinal = await prisma.stockLedger.findUnique({ where: { materialId: oil.id } });
  const spiceFinal = await prisma.stockLedger.findUnique({ where: { materialId: spice.id } });
  const pouchesFinal = await prisma.stockLedger.findUnique({ where: { materialId: pouches.id } });
  const cartonsFinal = await prisma.stockLedger.findUnique({ where: { materialId: cartons.id } });
  const fgFinal = await prisma.stockLedger.findUnique({ where: { productId: murukku.id } });

  console.log(`Rice Flour:   ${flourFinal.currentQty.toFixed(2)} kg   (Expected: 120 kg)`);
  console.log(`Refined Oil:  ${oilFinal.currentQty.toFixed(2)} L    (Expected: 19.5 L)`);
  console.log(`Spice Mix:    ${spiceFinal.currentQty.toFixed(2)} kg   (Expected: 3.8 kg)`);
  console.log(`Pouches:      ${pouchesFinal.currentQty.toFixed(0)} pcs  (Expected: 306)`);
  console.log(`Cartons:      ${cartonsFinal.currentQty.toFixed(0)} pcs  (Expected: 21)`);
  console.log(`Finished Goods: ${fgFinal.currentQty.toFixed(0)} packets (Expected: 88 after dispatch)`);

  // Variances
  const variances = await prisma.productionVariance.findMany({ where: { productionRunId: prodRun.id } });
  const yieldVar = variances.find(v => v.varianceType === 'YIELD');
  const oilVar = variances.find(v => v.materialId === oil.id);

  console.log(`\n📈 VARIANCE INTELLIGENCE:`);
  console.log(`Yield variance: ${yieldVar?.variancePct?.toFixed(1)}%  (Expected: -6%)  ${yieldVar?.isFlagged ? '🚨 FLAGGED' : '✓ OK'}`);
  console.log(`Oil variance:   +${oilVar?.variancePct?.toFixed(1)}%   (Expected: +5%)  ${oilVar?.isFlagged ? '🚨 FLAGGED' : '✓ OK'}`);

  console.log('\n✅ Seed complete! BatchLedger benchmark scenario loaded.\n');
  console.log(`Log in with the configured administrator account: ${admin.email}`);
}

// Patch AuditLog model for seed (add notes field workaround)
async function patchAuditForSeed() {
  // The auditLog model doesn't have 'notes' field – we use newValues instead
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
