/**
 * BatchLedger – Stage 1 Tests
 * Tests: auth, stock math, BOM, purchases, production variances, GST, invoice, payment
 */

import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/index.js';
import prisma from '../src/utils/prisma.js';

let adminCookie, salesCookie, supervisorCookie, auditorCookie;
let portalUserId, portalCustomerId, portalOrderId;
const staffUserIds = [];
const staffUserIdsByRole = {};
const managedUserIds = [];
const marketplaceUserIds = [];
const marketplaceProductIds = [];
const marketplaceMaterialIds = [];
const marketplaceBomIds = [];
const marketplaceReferences = [];
const portalEmail = `portal-${Date.now()}@example.com`;
const adminEmail = `auth-admin-${Date.now()}@example.com`;

beforeAll(async () => {
  const password = 'TestAccount@123';
  const passwordHash = await bcrypt.hash(password, 4);
  const suffix = Date.now();
  const accounts = [
    ['ADMIN', adminEmail],
    ['SALESMAN', `auth-sales-${suffix}@example.com`],
    ['PRODUCTION_SUPERVISOR', `auth-supervisor-${suffix}@example.com`],
    ['AUDITOR', `auth-auditor-${suffix}@example.com`],
  ];
  const login = async (email) => {
    const r = await request(app).post('/api/auth/login').send({ email, password });
    expect(r.status).toBe(200);
    expect(r.body).not.toHaveProperty('token');
    return r.headers['set-cookie'][0].split(';')[0];
  };
  const cookies = {};
  for (const [role, email] of accounts) {
    const user = await prisma.user.create({
      data: { name: `Test ${role}`, email, passwordHash, role },
    });
    staffUserIds.push(user.id);
    staffUserIdsByRole[role] = user.id;
    cookies[role] = await login(email);
  }
  adminCookie = cookies.ADMIN;
  salesCookie = cookies.SALESMAN;
  supervisorCookie = cookies.PRODUCTION_SUPERVISOR;
  auditorCookie = cookies.AUDITOR;
});

afterAll(async () => {
  const marketplaceOrders = marketplaceReferences.length
    ? await prisma.order.findMany({ where: { marketplaceOrderId: { in: marketplaceReferences } }, select: { id: true } })
    : [];
  const marketplaceOrderIds = marketplaceOrders.map(order => order.id);
  if (marketplaceOrderIds.length) {
    const dispatches = await prisma.dispatch.findMany({ where: { orderId: { in: marketplaceOrderIds } }, select: { id: true } });
    const dispatchIds = dispatches.map(dispatch => dispatch.id);
    if (dispatchIds.length) {
      await prisma.dispatchItem.deleteMany({ where: { dispatchId: { in: dispatchIds } } });
      await prisma.dispatch.deleteMany({ where: { id: { in: dispatchIds } } });
    }
    const invoices = await prisma.invoice.findMany({ where: { orderId: { in: marketplaceOrderIds } }, select: { id: true } });
    const invoiceIds = invoices.map(invoice => invoice.id);
    if (invoiceIds.length) {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }
    const runs = await prisma.productionRun.findMany({ where: { orderId: { in: marketplaceOrderIds } }, select: { id: true } });
    const runIds = runs.map(run => run.id);
    if (runIds.length) {
      await prisma.productionIssue.deleteMany({ where: { productionRunId: { in: runIds } } });
      await prisma.productionExpense.deleteMany({ where: { productionRunId: { in: runIds } } });
      await prisma.productionVariance.deleteMany({ where: { productionRunId: { in: runIds } } });
      await prisma.productionRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await prisma.notification.deleteMany({ where: { orderId: { in: marketplaceOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: marketplaceOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: marketplaceOrderIds } } });
    await prisma.marketplaceOrder.deleteMany({ where: { reference: { in: marketplaceReferences } } });
  }
  if (marketplaceBomIds.length) {
    await prisma.bomItem.deleteMany({ where: { bomId: { in: marketplaceBomIds } } });
    await prisma.bom.deleteMany({ where: { id: { in: marketplaceBomIds } } });
  }
  if (marketplaceProductIds.length || marketplaceMaterialIds.length) {
    await prisma.stockMovement.deleteMany({
      where: { OR: [
        { productId: { in: marketplaceProductIds } },
        { materialId: { in: marketplaceMaterialIds } },
      ] },
    });
    await prisma.stockLedger.deleteMany({
      where: { OR: [
        { productId: { in: marketplaceProductIds } },
        { materialId: { in: marketplaceMaterialIds } },
      ] },
    });
  }
  if (marketplaceProductIds.length) await prisma.product.deleteMany({ where: { id: { in: marketplaceProductIds } } });
  if (marketplaceMaterialIds.length) await prisma.material.deleteMany({ where: { id: { in: marketplaceMaterialIds } } });
  const cleanupUserIds = [...marketplaceUserIds, ...(portalUserId ? [portalUserId] : [])];
  if (cleanupUserIds.length) {
    await prisma.notification.deleteMany({ where: { userId: { in: cleanupUserIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: cleanupUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  }
  if (portalCustomerId) await prisma.customer.deleteMany({ where: { id: portalCustomerId } });
  if (portalOrderId) {
    await prisma.orderItem.deleteMany({ where: { orderId: portalOrderId } });
    await prisma.order.deleteMany({ where: { id: portalOrderId } });
  }
  if (staffUserIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: staffUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: staffUserIds } } });
  }
  if (managedUserIds.length) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: managedUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: managedUserIds } } });
  }
  await prisma.$disconnect();
});

describe('Authentication', () => {
  test('Login stores the session in an HttpOnly cookie instead of JSON', async () => {
    const response = await request(app).post('/api/auth/login')
      .send({ email: adminEmail, password: 'TestAccount@123' });
    expect(adminCookie).toMatch(/^bl_session=/);
    expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Lax/i);
    expect(response.body).not.toHaveProperty('token');
  });

  test('Invalid credentials rejected', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'wrong' });
    expect(r.status).toBe(401);
  });

  test('GET /api/auth/me returns user info', async () => {
    const r = await request(app).get('/api/auth/me').set('Cookie', adminCookie);
    expect(r.status).toBe(200);
    expect(r.body.role).toBe('ADMIN');
  });

  test('Producer portal rejects staff accounts that belong in the owner portal', async () => {
    const supervisor = await prisma.user.findUnique({
      where: { id: staffUserIdsByRole.PRODUCTION_SUPERVISOR },
      select: { email: true },
    });
    const response = await request(app).post('/api/auth/login')
      .send({ email: supervisor.email, password: 'TestAccount@123', portal: 'producer' });
    expect(response.status).toBe(403);
  });

  test('Unauthenticated request blocked', async () => {
    const r = await request(app).get('/api/users');
    expect(r.status).toBe(401);
  });
});

describe('Role-Based Access Control', () => {
  test('Salesman cannot access user management', async () => {
    const r = await request(app).get('/api/users').set('Cookie', salesCookie);
    expect(r.status).toBe(403);
  });

  test('Salesman cannot read auditor-only reports', async () => {
    const r = await request(app).get('/api/reports/stock').set('Cookie', salesCookie);
    expect(r.status).toBe(403);
  });

  test('Auditor can read reports', async () => {
    const r = await request(app).get('/api/reports/sales').set('Cookie', auditorCookie);
    expect(r.status).toBe(200);
  });

  test('Auditor cannot create orders', async () => {
    const r = await request(app).post('/api/orders').set('Cookie', auditorCookie).send({});
    expect(r.status).toBe(403);
  });

  test('Supervisor cannot create invoices', async () => {
    const r = await request(app).post('/api/invoices').set('Cookie', supervisorCookie).send({});
    expect(r.status).toBe(403);
  });
});

describe('Benchmark: Stock Verification', () => {
  test('Flour: 120 kg after purchase and production', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    expect(r.status).toBe(200);
    const flour = r.body.find(m => m.material?.name === 'Rice Flour');
    expect(flour).toBeDefined();
    expect(flour.currentQty).toBeCloseTo(120, 1);
  });

  test('Oil: 19.5 L after production (10.5L used from 30L)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    const oil = r.body.find(m => m.material?.name === 'Refined Oil');
    expect(oil.currentQty).toBeCloseTo(19.5, 1);
  });

  test('Spice: 3.8 kg (5 - 1.2 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    const spice = r.body.find(m => m.material?.name === 'Spice Mix');
    expect(spice.currentQty).toBeCloseTo(3.8, 1);
  });

  test('Pouches: 306 (500 opening - 194 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    const pouches = r.body.find(m => m.material?.name === 'Pouches 200g');
    expect(pouches.currentQty).toBeCloseTo(306, 0);
  });

  test('Cartons: 21 (30 - 9 used)', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    const cartons = r.body.find(m => m.material?.name === 'Cartons');
    expect(cartons.currentQty).toBeCloseTo(21, 0);
  });

  test('Finished goods: 88 after dispatch (50 + 188 - 150)', async () => {
    const r = await request(app).get('/api/stock/products').set('Cookie', adminCookie);
    const fg = r.body.find(p => p.product?.name === 'Murukku 200g');
    expect(fg.currentQty).toBeCloseTo(88, 0);
  });
});

describe('Benchmark: Weighted-Average Cost', () => {
  test('Flour avg cost = (100×42 + 60×45)/160 = ₹43.125', async () => {
    const r = await request(app).get('/api/stock/materials').set('Cookie', adminCookie);
    const flour = r.body.find(m => m.material?.name === 'Rice Flour');
    // After production issues 40kg, remaining 120kg should still reflect the weighted avg
    expect(flour.avgCost).toBeCloseTo(43.125, 2);
  });
});

describe('Benchmark: GST Invoice Verification', () => {
  test('Invoice BL-2024-001: taxable ₹7500, CGST ₹187.50, SGST ₹187.50, total ₹7875', async () => {
    const r = await request(app).get('/api/invoices').set('Cookie', adminCookie);
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
    const r = await request(app).get('/api/invoices').set('Cookie', adminCookie);
    const inv = r.body.find(i => i.invoiceNo === 'BL-2024-001');
    expect(inv.amountPaid).toBeCloseTo(4000, 2);
    expect(inv.amountDue).toBeCloseTo(3875, 2);
    expect(inv.paymentStatus).toBe('PARTIAL');
  });
});

describe('Benchmark: Stock Shortage Prevention', () => {
  test('Distributor B order shows shortage of 32 packets', async () => {
    const r = await request(app).get('/api/orders').set('Cookie', adminCookie);
    const orderB = r.body.find(o => o.orderNo === 'SO-2024-002');
    expect(orderB).toBeDefined();
    const item = orderB.items[0];
    expect(item.shortageQty).toBeCloseTo(32, 0);
    expect(item.availableQty).toBeCloseTo(88, 0);
  });

  test('Distributor B order cannot be approved due to shortage', async () => {
    const orderR = await request(app).get('/api/orders').set('Cookie', adminCookie);
    const orderB = orderR.body.find(o => o.orderNo === 'SO-2024-002');
    const r = await request(app).post(`/api/orders/${orderB.id}/approve`).set('Cookie', adminCookie);
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
    const r = await request(app).get('/api/dashboard/summary').set('Cookie', adminCookie);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('totalRevenue');
    expect(r.body.totalRevenue).toBeGreaterThan(0);
  });
});

describe('Customer portal', () => {
  let customerCookie;
  let sellerOneCookie;
  let sellerTwoCookie;
  let sellerOneProduct;
  let sellerTwoProduct;
  let sellerOneMaterial;
  let sellerOneOrder;
  let sellerTwoOrder;
  let commonReference;

  test('customer can sign up and receives a customer account', async () => {
    const response = await request(app).post('/api/auth/register-customer').send({
      name: 'Portal Test Customer',
      email: portalEmail,
      password: 'Customer@123',
      state: 'Tamil Nadu',
      stateCode: '33',
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('token');
    expect(response.body.user.role).toBe('CUSTOMER');
    expect(response.body.user.customerId).toBeDefined();
    customerCookie = response.headers['set-cookie'][0].split(';')[0];
    portalUserId = response.body.user.id;
    portalCustomerId = response.body.user.customerId;
  });

  test('producer registration saves its business state for marketplace GST', async () => {
    const suffix = Date.now();
    const response = await request(app).post('/api/auth/register-seller').send({
      name: 'State Test Producer',
      email: `state-producer-${suffix}@example.com`,
      password: 'Producer@123',
      businessState: 'Karnataka',
      businessStateCode: '29',
      products: [{ name: 'State Test Product', unit: 'packet', sellingPrice: 20 }],
    });
    expect(response.status).toBe(201);
    marketplaceUserIds.push(response.body.user.id);

    const registeredUser = await prisma.user.findUnique({ where: { id: response.body.user.id } });
    const registeredProducts = await prisma.product.findMany({ where: { sellerId: response.body.user.id }, select: { id: true } });
    expect(registeredUser.businessState).toBe('Karnataka');
    expect(registeredUser.businessStateCode).toBe('29');
    marketplaceProductIds.push(...registeredProducts.map(product => product.id));
  });

  test('admin creates independent sellers with assigned products and credentials', async () => {
    const suffix = Date.now();
    const [productOne, productTwo] = await Promise.all([
      prisma.product.create({ data: { code: `MP-${suffix}-1`, name: 'Test Murukku', unit: 'kg', gstRate: 5, sellingPrice: 100, category: 'Snacks' } }),
      prisma.product.create({ data: { code: `MP-${suffix}-2`, name: 'Test Ladoo', unit: 'packet', gstRate: 5, sellingPrice: 50, category: 'Sweets' } }),
    ]);
    marketplaceProductIds.push(productOne.id, productTwo.id);
    const one = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      name: 'Seller One',
      email: `seller-one-${suffix}@example.com`,
      password: 'SellerOne@123',
      role: 'SELLER',
      productIds: [productOne.id],
    });
    const two = await request(app).post('/api/users').set('Cookie', adminCookie).send({
      name: 'Seller Two',
      email: `seller-two-${suffix}@example.com`,
      password: 'SellerTwo@123',
      role: 'SELLER',
      productIds: [productTwo.id],
      businessState: 'Karnataka',
      businessStateCode: '29',
    });
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
    expect(two.body).toEqual(expect.objectContaining({ businessState: 'Karnataka', businessStateCode: '29' }));
    expect(one.body).not.toHaveProperty('passwordHash');
    managedUserIds.push(one.body.id, two.body.id);
    marketplaceUserIds.push(one.body.id, two.body.id);
    const updatedState = await request(app).patch(`/api/users/${one.body.id}`).set('Cookie', adminCookie)
      .send({ businessState: 'Tamil Nadu', businessStateCode: '33' });
    expect(updatedState.status).toBe(200);
    expect(updatedState.body).toEqual(expect.objectContaining({ businessState: 'Tamil Nadu', businessStateCode: '33' }));
    sellerOneProduct = productOne;
    sellerTwoProduct = productTwo;
    const loginOne = await request(app).post('/api/auth/login').send({ email: one.body.email, password: 'SellerOne@123' });
    const loginTwo = await request(app).post('/api/auth/login').send({ email: two.body.email, password: 'SellerTwo@123' });
    sellerOneCookie = loginOne.headers['set-cookie'][0].split(';')[0];
    sellerTwoCookie = loginTwo.headers['set-cookie'][0].split(';')[0];
  });

  test('Customer and seller sessions cannot cross into other role APIs', async () => {
    const customerSellerAccess = await request(app).get('/api/seller/dashboard').set('Cookie', customerCookie);
    const customerStaffAccess = await request(app).get('/api/users').set('Cookie', customerCookie);
    const sellerStaffAccess = await request(app).get('/api/users').set('Cookie', sellerOneCookie);
    const sellerCustomerAccess = await request(app).post('/api/marketplace/orders')
      .set('Cookie', sellerOneCookie)
      .send({});

    expect(customerSellerAccess.status).toBe(403);
    expect(customerStaffAccess.status).toBe(403);
    expect(sellerStaffAccess.status).toBe(403);
    expect(sellerCustomerAccess.status).toBe(403);
  });

  test('producer can add a priced product and update the public catalog price', async () => {
    const suffix = Date.now();
    const created = await request(app).post('/api/seller/products').set('Cookie', sellerOneCookie).send({
      name: `Producer Snack ${suffix}`,
      category: 'Snacks',
      unit: 'packet',
      sellingPrice: 42.5,
      gstRate: 5,
    });
    expect(created.status).toBe(201);
    expect(created.body.sellingPrice).toBe(42.5);
    marketplaceProductIds.push(created.body.id);

    const updatedName = `Producer Snack Updated ${suffix}`;
    const updated = await request(app).patch(`/api/seller/products/${created.body.id}`)
      .set('Cookie', sellerOneCookie)
      .send({ name: updatedName, category: 'Baked goods', description: 'Updated producer details', sellingPrice: 48, gstRate: 12, preparationMinutes: 45 });
    expect(updated.status).toBe(200);
    expect(updated.body.sellingPrice).toBe(48);
    expect(updated.body).toEqual(expect.objectContaining({
      name: updatedName,
      category: 'Baked goods',
      description: 'Updated producer details',
      gstRate: 12,
      preparationMinutes: 45,
    }));

    const catalog = await request(app).get(`/api/marketplace/products?search=${encodeURIComponent(updatedName)}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.body.id, sellingPrice: 48, sellerId: expect.any(Number) }),
    ]));
  });

  test('customer marketplace shows active producers and splits a cross-seller cart', async () => {
    const catalog = await request(app).get('/api/products').set('Cookie', customerCookie);
    expect(catalog.status).toBe(200);
    expect(catalog.body.map(product => product.id)).toEqual(expect.arrayContaining([sellerOneProduct.id, sellerTwoProduct.id]));
    const producers = await request(app).get('/api/marketplace/producers');
    expect(producers.status).toBe(200);
    expect(producers.body.map(producer => producer.name)).toEqual(expect.arrayContaining(['Seller One', 'Seller Two']));

    const invalidUnit = await request(app).post('/api/marketplace/orders')
      .set('Cookie', customerCookie)
      .send({ items: [{ productId: sellerOneProduct.id, quantity: 1, unit: 'packet' }], deliveryAddress: 'Test address' });
    expect(invalidUnit.status).toBe(400);

    const created = await request(app).post('/api/marketplace/orders')
      .set('Cookie', customerCookie)
      .send({
        items: [
          { productId: sellerOneProduct.id, quantity: 2.5, unit: 'kg' },
          { productId: sellerTwoProduct.id, quantity: 2, unit: 'packet' },
        ],
        deliveryAddress: 'Test delivery address',
        deliveryMethod: 'Standard delivery',
        specialInstructions: 'No peanuts',
      });
    expect(created.status).toBe(201);
    expect(created.body.customerId).toBe(portalCustomerId);
    expect(created.body.subtotal).toBe(350);
    expect(created.body.orders).toHaveLength(2);
    expect(new Set(created.body.orders.map(order => order.sellerId)).size).toBe(2);
    expect(created.body.orders.every(order => order.items.every(item => item.product.sellerId === order.sellerId))).toBe(true);
    commonReference = created.body.reference;
    marketplaceReferences.push(commonReference);
    [sellerOneOrder, sellerTwoOrder] = created.body.orders;

    const ownOrders = await request(app).get('/api/marketplace/orders').set('Cookie', customerCookie);
    expect(ownOrders.status).toBe(200);
    expect(ownOrders.body.map(order => order.reference)).toEqual([commonReference]);
    expect(ownOrders.body[0].orders).toHaveLength(2);

    const producerOrders = await request(app).get('/api/orders').set('Cookie', adminCookie);
    expect(producerOrders.body.some(order => order.id === sellerOneOrder.id)).toBe(true);

    const sellerOneOrders = await request(app).get('/api/seller/orders').set('Cookie', sellerOneCookie);
    const sellerTwoOrders = await request(app).get('/api/seller/orders').set('Cookie', sellerTwoCookie);
    expect(sellerOneOrders.body.map(order => order.id)).toEqual([sellerOneOrder.id]);
    expect(sellerTwoOrders.body.map(order => order.id)).toEqual([sellerTwoOrder.id]);
    const sellerOneCatalog = await request(app).get('/api/seller/products').set('Cookie', sellerOneCookie);
    expect(sellerOneCatalog.body.map(product => product.id)).toEqual(expect.arrayContaining([sellerOneProduct.id]));
    const crossSellerOrder = await request(app).get(`/api/seller/orders/${sellerOneOrder.id}`).set('Cookie', sellerTwoCookie);
    expect(crossSellerOrder.status).toBe(404);
    const blockedERP = await request(app).get('/api/dashboard/summary').set('Cookie', sellerOneCookie);
    expect(blockedERP.status).toBe(403);
    const blockedProducts = await request(app).get('/api/products').set('Cookie', sellerOneCookie);
    const blockedMaterials = await request(app).get('/api/materials').set('Cookie', sellerOneCookie);
    expect(blockedProducts.status).toBe(403);
    expect(blockedMaterials.status).toBe(403);

    const sellerNotifications = await request(app).get('/api/notifications').set('Cookie', sellerOneCookie);
    expect(sellerNotifications.body.some(notification => notification.orderId === sellerOneOrder.id)).toBe(true);
    const legacyPost = await request(app).post('/api/orders').set('Cookie', customerCookie).send({ items: [] });
    expect(legacyPost.status).toBe(403);

    const otherOrder = await prisma.order.findUnique({ where: { orderNo: 'SO-2024-001' } });
    const hiddenOrder = await request(app).get(`/api/orders/${otherOrder.id}`).set('Cookie', customerCookie);
    expect(hiddenOrder.status).toBe(404);

    const staffData = await request(app).get('/api/dashboard/summary').set('Cookie', customerCookie);
    expect(staffData.status).toBe(403);
  });

  test('seller inventory and versioned BOM endpoints are available before invoices and enforce ownership', async () => {
    const [materials, boms] = await Promise.all([
      request(app).get('/api/seller/materials').set('Cookie', sellerOneCookie),
      request(app).get('/api/seller/boms').set('Cookie', sellerOneCookie),
    ]);
    expect(materials.status).toBe(200);
    expect(boms.status).toBe(200);

    const createdMaterial = await request(app).post('/api/seller/materials')
      .set('Cookie', sellerOneCookie)
      .send({ name: 'Producer One Flour', unit: 'kg', reorderLevel: 2 });
    expect(createdMaterial.status).toBe(201);
    sellerOneMaterial = createdMaterial.body;
    marketplaceMaterialIds.push(sellerOneMaterial.id);

    const receipt = await request(app).post(`/api/seller/materials/${sellerOneMaterial.id}/receipts`)
      .set('Cookie', sellerOneCookie)
      .send({ quantity: 10, unitCost: 2, notes: 'Opening stock' });
    expect(receipt.status).toBe(201);
    expect(receipt.body.ledger).toEqual({ currentQty: 10, avgCost: 2 });

    const invalidReceipt = await request(app).post(`/api/seller/materials/${sellerOneMaterial.id}/receipts`)
      .set('Cookie', sellerOneCookie)
      .send({ quantity: 0, unitCost: 2 });
    expect(invalidReceipt.status).toBe(400);

    const crossSellerReceipt = await request(app).post(`/api/seller/materials/${sellerOneMaterial.id}/receipts`)
      .set('Cookie', sellerTwoCookie)
      .send({ quantity: 5, unitCost: 2 });
    expect(crossSellerReceipt.status).toBe(404);

    const firstBom = await request(app).post('/api/seller/boms')
      .set('Cookie', sellerOneCookie)
      .send({
        productId: sellerOneProduct.id,
        batchSize: 2,
        items: [{ materialId: sellerOneMaterial.id, quantity: 1, unit: 'kg' }],
      });
    expect(firstBom.status).toBe(201);
    expect(firstBom.body.version).toBe(1);

    const secondBom = await request(app).post('/api/seller/boms')
      .set('Cookie', sellerOneCookie)
      .send({
        productId: sellerOneProduct.id,
        batchSize: 2,
        items: [{ materialId: sellerOneMaterial.id, quantity: 1.2, unit: 'kg' }],
      });
    expect(secondBom.status).toBe(201);
    expect(secondBom.body.version).toBe(2);
    expect(secondBom.body.isActive).toBe(true);
    marketplaceBomIds.push(firstBom.body.id, secondBom.body.id);

    const archivedBoms = await request(app).get('/api/seller/boms').set('Cookie', sellerOneCookie);
    expect(archivedBoms.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstBom.body.id, isActive: false }),
      expect.objectContaining({ id: secondBom.body.id, isActive: true }),
    ]));

    const crossSellerProductBom = await request(app).post('/api/seller/boms')
      .set('Cookie', sellerTwoCookie)
      .send({
        productId: sellerOneProduct.id,
        batchSize: 1,
        items: [{ materialId: sellerOneMaterial.id, quantity: 1, unit: 'kg' }],
      });
    expect(crossSellerProductBom.status).toBe(404);

    const crossSellerMaterialBom = await request(app).post('/api/seller/boms')
      .set('Cookie', sellerTwoCookie)
      .send({
        productId: sellerTwoProduct.id,
        batchSize: 1,
        items: [{ materialId: sellerOneMaterial.id, quantity: 1, unit: 'kg' }],
      });
    expect(crossSellerMaterialBom.status).toBe(400);
  });

  test('seller production completion creates ERP records and invoices; dispatch updates stock and tracking', async () => {
    const accepted = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie).send({ status: 'ORDER_ACCEPTED' });
    expect(accepted.status).toBe(200);
    const started = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie).send({ status: 'PRODUCTION_STARTED' });
    expect(started.status).toBe(200);

    const run = await prisma.productionRun.findFirst({ where: { orderId: sellerOneOrder.id } });
    expect(run).toBeDefined();
    expect(run.productId).toBe(sellerOneProduct.id);
    for (const status of ['PRODUCTION_IN_PROGRESS', 'QUALITY_CHECK']) {
      const response = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
        .set('Cookie', sellerOneCookie).send({ status });
      expect(response.status).toBe(200);
    }
    const earlyCompletion = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie).send({ status: 'PRODUCTION_COMPLETED' });
    expect(earlyCompletion.status).toBe(409);

    const inaccessibleRun = await request(app).post(`/api/production/${run.id}/complete`)
      .set('Cookie', sellerTwoCookie)
      .send({ actualOutput: 2, issues: [], expenses: [] });
    expect(inaccessibleRun.status).toBe(404);
    const completeProduction = await request(app).post(`/api/production/${run.id}/complete`)
      .set('Cookie', sellerOneCookie)
      .send({
        actualOutput: 2.5,
        issues: [{ materialId: sellerOneMaterial.id, actualQty: 2, returnedQty: 0 }],
        expenses: [{ expenseType: 'LABOUR', amount: 3, description: 'Marketplace order' }],
      });
    expect(completeProduction.status).toBe(200);
    expect(Number(completeProduction.body.costPerPacket)).toBeCloseTo(2.8, 2);
    const productionIssue = await prisma.productionIssue.findFirst({ where: { productionRunId: run.id } });
    expect(productionIssue.standardQty).toBeCloseTo(1.5, 5);
    const materialVariance = await prisma.productionVariance.findFirst({
      where: { productionRunId: run.id, varianceType: 'MATERIAL' },
    });
    expect(materialVariance.variancePct).toBeCloseTo(33.3333, 3);
    await prisma.user.update({
      where: { id: sellerOneOrder.sellerId },
      data: { businessState: 'Karnataka', businessStateCode: '29' },
    });
    const productionComplete = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie).send({ status: 'PRODUCTION_COMPLETED' });
    expect(productionComplete.status).toBe(200);
    const customerOrders = await request(app).get('/api/marketplace/orders').set('Cookie', customerCookie);
    const sellerInvoice = customerOrders.body[0].orders.find(order => order.id === sellerOneOrder.id).invoices[0];
    expect(sellerInvoice.status).toBe('POSTED');
    expect(sellerInvoice.taxableAmount).toBeCloseTo(250, 2);
    expect(sellerInvoice.cgst).toBe(0);
    expect(sellerInvoice.sgst).toBe(0);
    expect(sellerInvoice.igst).toBeCloseTo(12.5, 2);
    expect(sellerInvoice.isInterState).toBe(true);
    expect(sellerInvoice.grandTotal).toBeCloseTo(262.5, 2);
    expect(sellerInvoice.items[0].unit).toBe('kg');
    const producerInvoices = await request(app).get('/api/seller/invoices').set('Cookie', sellerOneCookie);
    expect(producerInvoices.status).toBe(200);
    expect(producerInvoices.body[0]).toEqual(expect.objectContaining({
      id: sellerInvoice.id,
      cgst: 0,
      sgst: 0,
      igst: 12.5,
    }));

    for (const status of ['READY_FOR_PACKAGING', 'READY_FOR_DISPATCH']) {
      const response = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
        .set('Cookie', sellerOneCookie).send({ status });
      expect(response.status).toBe(200);
    }
    const dispatched = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie)
      .send({ status: 'DISPATCHED', trackingReference: 'TRACK-123' });
    expect(dispatched.status).toBe(200);
    const dispatch = await prisma.dispatch.findFirst({ where: { orderId: sellerOneOrder.id } });
    expect(dispatch.trackingReference).toBe('TRACK-123');
    const stock = await prisma.stockLedger.findUnique({ where: { productId: sellerOneProduct.id } });
    expect(stock.currentQty).toBeCloseTo(0, 3);

    const delivered = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerOneCookie).send({ status: 'DELIVERED' });
    expect(delivered.status).toBe(200);
    const customerNotifications = await request(app).get('/api/notifications').set('Cookie', customerCookie);
    expect(customerNotifications.body.map(notification => notification.type)).toEqual(expect.arrayContaining([
      'ORDER_PLACED', 'ORDER_ACCEPTED', 'PRODUCTION_STARTED', 'PRODUCTION_IN_PROGRESS', 'QUALITY_CHECK',
      'PRODUCTION_COMPLETED', 'DISPATCHED', 'DELIVERED',
    ]));
  });

  test('seller can reject only their own new seller orders', async () => {
    const response = await request(app).patch(`/api/seller/orders/${sellerTwoOrder.id}/status`)
      .set('Cookie', sellerTwoCookie).send({ status: 'REJECTED', note: 'Unavailable today' });
    expect(response.status).toBe(200);
    const forgedStatus = await request(app).patch(`/api/seller/orders/${sellerOneOrder.id}/status`)
      .set('Cookie', sellerTwoCookie).send({ status: 'REJECTED' });
    expect(forgedStatus.status).toBe(404);
  });
});

describe('Admin-managed staff accounts', () => {
  test('Admin creates a staff user and role changes revoke their existing session', async () => {
    const email = `managed-${Date.now()}@example.com`;
    const created = await request(app).post('/api/users')
      .set('Cookie', adminCookie)
      .send({ name: 'Managed User', email, password: 'Managed@123', role: 'SALESMAN' });
    expect(created.status).toBe(201);
    managedUserIds.push(created.body.id);

    const login = await request(app).post('/api/auth/login')
      .send({ email, password: 'Managed@123' });
    expect(login.status).toBe(200);
    const sessionCookie = login.headers['set-cookie'][0].split(';')[0];

    const changed = await request(app).patch(`/api/users/${created.body.id}`)
      .set('Cookie', adminCookie)
      .send({ role: 'AUDITOR' });
    expect(changed.status).toBe(200);
    expect(changed.body.role).toBe('AUDITOR');

    const staleSession = await request(app).get('/api/auth/me').set('Cookie', sessionCookie);
    expect(staleSession.status).toBe(401);

    const newRoleLogin = await request(app).post('/api/auth/login')
      .send({ email, password: 'Managed@123' });
    const activeCookie = newRoleLogin.headers['set-cookie'][0].split(';')[0];
    const logout = await request(app).post('/api/auth/logout').set('Cookie', activeCookie);
    expect(logout.status).toBe(200);
    const loggedOut = await request(app).get('/api/auth/me').set('Cookie', activeCookie);
    expect(loggedOut.status).toBe(401);
  });

  test('Admin cannot deactivate the last active administrator', async () => {
    const response = await request(app).patch(`/api/users/${staffUserIdsByRole.ADMIN}`)
      .set('Cookie', adminCookie)
      .send({ isActive: false });
    expect(response.status).toBe(400);
  });

  test('Repeated failed sign-ins are rate limited', async () => {
    let response;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      response = await request(app).post('/api/auth/login')
        .send({ email: adminEmail, password: `incorrect-${attempt}` });
      if (response.status === 429) break;
      expect(response.status).toBe(401);
    }
    expect(response.status).toBe(429);
  });
});
