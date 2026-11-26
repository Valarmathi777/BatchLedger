/**
 * BatchLedger – Stage 1 Tests
 * Tests: auth, stock math, BOM, purchases, production variances, GST, invoice, payment
 */

import request from 'supertest';
import app from '../src/index.js';
import prisma from '../src/utils/prisma.js';

let adminToken, salesToken, supervisorToken, auditorToken;
let portalUserId, portalCustomerId, portalOrderId;
const portalEmail = `portal-${Date.now()}@example.com`;

beforeAll(async () => {
  // Get tokens for all roles
  const login = async (email, password) => {
    const r = await request(app).post('/api/auth/login').send({ email, password });
    return r.body.token;
  };
  adminToken = await login('admin@batchledger.com', 'Admin@123');
  salesToken = await login('salesman@batchledger.com', 'Sales@123');
  supervisorToken = await login('supervisor@batchledger.com', 'Prod@123');
  auditorToken = await login('auditor@batchledger.com', 'Audit@123');
});

afterAll(async () => {
  if (portalOrderId) {
    await prisma.orderItem.deleteMany({ where: { orderId: portalOrderId } });
    await prisma.order.deleteMany({ where: { id: portalOrderId } });
  }
  if (portalUserId) {
    await prisma.auditLog.deleteMany({ where: { userId: portalUserId } });
    await prisma.user.deleteMany({ where: { id: portalUserId } });
  }
  if (portalCustomerId) {
    await prisma.customer.deleteMany({ where: { id: portalCustomerId } });
  }
  await prisma.$disconnect();
});

describe('Authentication', () => {
  test('Admin login returns token', () => {
    expect(adminToken).toBeDefined();
    expect(typeof adminToken).toBe('string');
  });

  test('Invalid credentials rejected', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'admin@batchledger.com', password: 'wrong' });
    expect(r.status).toBe(401);
  });

  test('GET /api/auth/me returns user info', async () => {
    const r = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('ADMIN');
  });

  test('Unauthenticated request blocked', async () => {
    const r = await request(app).get('/api/users');
    expect(r.status).toBe(401);
  });
});

describe('Role-Based Access Control', () => {
  test('Salesman cannot access user management', async () => {
    const r = await request(app).get('/api/users').set('Authorization', `Bearer ${salesToken}`);
    expect(r.status).toBe(403);
  });

  test('Auditor can read reports', async () => {
    const r = await request(app).get('/api/reports/stock').set('Authorization', `Bearer ${auditorToken}`);
    expect(r.status).toBe(200);
  });

  test('Auditor cannot create orders', async () => {
    const r = await request(app).post('/api/orders').set('Authorization', `Bearer ${auditorToken}`).send({});
    expect(r.status).toBe(403);
  });

  test('Supervisor cannot create invoices', async () => {
    const r = await request(app).post('/api/invoices').set('Authorization', `Bearer ${supervisorToken}`).send({});
    expect(r.status).toBe(403);
  });
});

describe('Benchmark: Stock Verification', () => {
  test('Flour: 120 kg after purchase and production', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const flour = r.body.find(m => m.material?.name === 'Rice Flour');
    expect(flour).toBeDefined();
    expect(flour.currentQty).toBeCloseTo(120, 1);
  });

  test('Oil: 19.5 L after production (10.5L used from 30L)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    const oil = r.body.find(m => m.material?.name === 'Refined Oil');
    expect(oil.currentQty).toBeCloseTo(19.5, 1);
  });

  test('Spice: 3.8 kg (5 - 1.2 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    const spice = r.body.find(m => m.material?.name === 'Spice Mix');
    expect(spice.currentQty).toBeCloseTo(3.8, 1);
  });

  test('Pouches: 306 (500 opening - 194 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    const pouches = r.body.find(m => m.material?.name === 'Pouches 200g');
    expect(pouches.currentQty).toBeCloseTo(306, 0);
  });

  test('Cartons: 21 (30 - 9 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    const cartons = r.body.find(m => m.material?.name === 'Cartons');
    expect(cartons.currentQty).toBeCloseTo(21, 0);
  });

  test('Finished goods: 88 after dispatch (50 + 188 - 150)', async () => {
    const r = await request(app).get('/api/stock/products').set('Authorization', `Bearer ${adminToken}`);
    const fg = r.body.find(p => p.product?.name === 'Murukku 200g');
    expect(fg.currentQty).toBeCloseTo(88, 0);
  });
});

describe('Benchmark: Weighted-Average Cost', () => {
  test('Flour avg cost = (100×42 + 60×45)/160 = ₹43.125', async () => {
    const r = await request(app).get('/api/stock/materials').set('Authorization', `Bearer ${adminToken}`);
    const flour = r.body.find(m => m.material?.name === 'Rice Flour');
    // After production issues 40kg, remaining 120kg should still reflect the weighted avg
    expect(flour.avgCost).toBeCloseTo(43.125, 2);
  });
});

describe('Benchmark: GST Invoice Verification', () => {
  test('Invoice BL-2024-001: taxable ₹7500, CGST ₹187.50, SGST ₹187.50, total ₹7875', async () => {
    const r = await request(app).get('/api/invoices').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const inv = r.body.find(i => i.invoiceNo === 'BL-2024-001');
    expect(inv).toBeDefined();
    expect(inv.taxableAmount).toBeCloseTo(7500, 2);
    expect(inv.cgst).toBeCloseTo(187.5, 2);
    expect(inv.sgst).toBeCloseTo(187.5, 2);
    expect(inv.igst).toBeCloseTo(0, 2);
    expect(inv.grandTotal).toBeCloseTo(7875, 2);
    expect(inv.isInterState).toBe(false);
  });
});

describe('Benchmark: Partial Payment', () => {
  test('Invoice has ₹4000 paid, ₹3875 outstanding', async () => {
    const r = await request(app).get('/api/invoices').set('Authorization', `Bearer ${adminToken}`);
    const inv = r.body.find(i => i.invoiceNo === 'BL-2024-001');
    expect(inv.amountPaid).toBeCloseTo(4000, 2);
    expect(inv.amountDue).toBeCloseTo(3875, 2);
    expect(inv.paymentStatus).toBe('PARTIAL');
  });
});

describe('Benchmark: Stock Shortage Prevention', () => {
  test('Distributor B order shows shortage of 32 packets', async () => {
    const r = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    const orderB = r.body.find(o => o.orderNo === 'SO-2024-002');
    expect(orderB).toBeDefined();
    const item = orderB.items[0];
    expect(item.shortageQty).toBeCloseTo(32, 0);
    expect(item.availableQty).toBeCloseTo(88, 0);
  });

  test('Distributor B order cannot be approved due to shortage', async () => {
    const orderR = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    const orderB = orderR.body.find(o => o.orderNo === 'SO-2024-002');
    const r = await request(app).post(`/api/orders/${orderB.id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/shortage/i);
  });
});

describe('Benchmark: Production Variances', () => {
  test('Yield variance is -6% and flagged', async () => {
    const run = await prisma.productionRun.findFirst({ where: { batchNo: 'MK-0001' }, include: { variances: true } });
    const yieldVar = run.variances.find(v => v.varianceType === 'YIELD');
    expect(yieldVar).toBeDefined();
    expect(yieldVar.variancePct).toBeCloseTo(-6, 1);
    expect(yieldVar.isFlagged).toBe(true);
  });

  test('Oil variance is +5% and flagged', async () => {
    const oilMat = await prisma.material.findUnique({ where: { code: 'MAT-002' } });
    const run = await prisma.productionRun.findFirst({ where: { batchNo: 'MK-0001' }, include: { variances: true } });
    const oilVar = run.variances.find(v => v.varianceType === 'MATERIAL' && v.materialId === oilMat.id);
    expect(oilVar).toBeDefined();
    expect(oilVar.variancePct).toBeCloseTo(5, 1);
    expect(oilVar.isFlagged).toBe(true);
  });
});

describe('API Health', () => {
  test('Health endpoint returns ok', async () => {
    const r = await request(app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });

  test('Dashboard summary returns data', async () => {
    const r = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('totalRevenue');
    expect(r.body.totalRevenue).toBeGreaterThan(0);
  });
});

describe('Customer portal', () => {
  let customerToken;

  test('customer can sign up and receives a customer account', async () => {
    const response = await request(app).post('/api/auth/register-customer').send({
      name: 'Portal Test Customer',
      email: portalEmail,
      password: 'Customer@123',
      state: 'Tamil Nadu',
      stateCode: '33',
    });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('CUSTOMER');
    expect(response.body.user.customerId).toBeDefined();
    customerToken = response.body.token;
    portalUserId = response.body.user.id;
    portalCustomerId = response.body.user.customerId;
  });

  test('customer can order products, view only their orders, and cannot access staff data', async () => {
    const catalog = await request(app).get('/api/products').set('Authorization', `Bearer ${customerToken}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.length).toBeGreaterThan(0);
    const product = catalog.body[0];

    const created = await request(app).post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: 1,
        items: [{ productId: product.id, orderedQty: 2, unitPrice: 1 }],
      });
    expect(created.status).toBe(201);
    expect(created.body.customerId).toBe(portalCustomerId);
    expect(created.body.status).toBe('PENDING_APPROVAL');
    expect(created.body.items[0].unitPrice).toBe(product.sellingPrice);
    portalOrderId = created.body.id;

    const ownOrders = await request(app).get('/api/orders').set('Authorization', `Bearer ${customerToken}`);
    expect(ownOrders.status).toBe(200);
    expect(ownOrders.body.map(order => order.id)).toEqual([portalOrderId]);

    const producerOrders = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`);
    expect(producerOrders.body.some(order => order.id === portalOrderId)).toBe(true);

    const otherOrder = await prisma.order.findUnique({ where: { orderNo: 'SO-2024-001' } });
    const hiddenOrder = await request(app).get(`/api/orders/${otherOrder.id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(hiddenOrder.status).toBe(404);

    const staffData = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${customerToken}`);
    expect(staffData.status).toBe(403);
  });
});
