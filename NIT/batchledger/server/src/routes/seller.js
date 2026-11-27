import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { updateSellerOrderStatus } from '../utils/marketplace.js';
import { moveMaterialStock } from '../utils/stock.js';

const router = express.Router();
router.use(authenticate, authorize('SELLER'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const [products, totalOrders, pendingOrders, revenue, productionExpenses, materialCosts, recentOrders] = await Promise.all([
      prisma.product.findMany({
        where: { sellerId },
        include: { stockLedger: true },
        orderBy: { name: 'asc' },
      }),
      prisma.order.count({ where: { sellerId, status: { not: 'REJECTED' } } }),
      prisma.order.count({ where: { sellerId, status: { in: ['ORDER_RECEIVED', 'PENDING_APPROVAL'] } } }),
      prisma.invoice.aggregate({ where: { order: { sellerId }, status: 'POSTED' }, _sum: { taxableAmount: true } }),
      prisma.productionExpense.aggregate({ where: { productionRun: { product: { sellerId } } }, _sum: { amount: true } }),
      prisma.productionIssue.aggregate({ where: { productionRun: { product: { sellerId } } }, _sum: { totalCost: true } }),
      prisma.order.findMany({
        where: { sellerId },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, phone: true, address: true } }, items: { include: { product: true } } },
      }),
    ]);

    res.json({
      seller: { id: req.user.id, name: req.user.name },
      products,
      totalOrders,
      pendingOrders,
      revenue: revenue._sum.taxableAmount || 0,
      expenses: (productionExpenses._sum.amount || 0) + (materialCosts._sum.totalCost || 0),
      profit: (revenue._sum.taxableAmount || 0) - (productionExpenses._sum.amount || 0) - (materialCosts._sum.totalCost || 0),
      recentOrders,
    });
  } catch (err) { next(err); }
});

router.get('/products', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { sellerId: req.user.id },
      include: { stockLedger: true, boms: { where: { isActive: true }, select: { id: true, version: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/products', async (req, res, next) => {
  try {
    const { name, category, unit, sellingPrice, gstRate = 5, description, preparationMinutes = 60, imageUrl } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100
      || typeof unit !== 'string' || !unit.trim() || unit.trim().length > 30
      || !Number.isFinite(Number(sellingPrice)) || Number(sellingPrice) < 0
      || !Number.isFinite(Number(gstRate)) || Number(gstRate) < 0 || Number(gstRate) > 100
      || !Number.isInteger(Number(preparationMinutes)) || Number(preparationMinutes) < 0) {
      return res.status(400).json({ error: 'Enter a valid product name, unit, price, GST rate, and preparation time.' });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          code: `PROD-${Date.now().toString().slice(-8)}-${req.user.id}`,
          name: name.trim(),
          category: typeof category === 'string' && category.trim() ? category.trim() : null,
          unit: unit.trim(),
          sellingPrice: Number(sellingPrice),
          gstRate: Number(gstRate),
          description: typeof description === 'string' ? description.trim() || null : null,
          preparationMinutes: Number(preparationMinutes),
          imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() || null : null,
          sellerId: req.user.id,
        },
      });
      await tx.stockLedger.create({ data: { productId: created.id, currentQty: 0, avgCost: 0 } });
      return created;
    });
    res.status(201).json(product);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A product code or name conflict occurred.' });
    next(err);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: 'Invalid product ID.' });
    const allowed = ['name', 'sellingPrice', 'gstRate', 'category', 'imageUrl', 'preparationMinutes', 'isAvailable', 'description'];
    const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(data).length || Object.keys(data).length !== Object.keys(req.body).length) {
      return res.status(400).json({ error: 'Only product name, price, GST rate, category, image, preparation time, availability, and description may be updated.' });
    }
    if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 100)) {
      return res.status(400).json({ error: 'Product name must be between 1 and 100 characters.' });
    }
    if (data.sellingPrice !== undefined && (!Number.isFinite(Number(data.sellingPrice)) || Number(data.sellingPrice) < 0)) {
      return res.status(400).json({ error: 'Selling price must be a non-negative number.' });
    }
    if (data.gstRate !== undefined && (!Number.isFinite(Number(data.gstRate)) || Number(data.gstRate) < 0 || Number(data.gstRate) > 100)) {
      return res.status(400).json({ error: 'GST rate must be between 0 and 100 percent.' });
    }
    if (data.category !== undefined && (typeof data.category !== 'string' || data.category.length > 80)) {
      return res.status(400).json({ error: 'Category must be a string of at most 80 characters.' });
    }
    if (data.description !== undefined && (typeof data.description !== 'string' || data.description.length > 1000)) {
      return res.status(400).json({ error: 'Description must be a string of at most 1000 characters.' });
    }
    if (data.imageUrl !== undefined && (typeof data.imageUrl !== 'string' || data.imageUrl.length > 2048)) {
      return res.status(400).json({ error: 'Image URL must be a string of at most 2048 characters.' });
    }
    if (data.preparationMinutes !== undefined && (!Number.isInteger(Number(data.preparationMinutes)) || Number(data.preparationMinutes) < 0)) {
      return res.status(400).json({ error: 'Preparation time must be a non-negative whole number of minutes.' });
    }
    if (data.isAvailable !== undefined && typeof data.isAvailable !== 'boolean') {
      return res.status(400).json({ error: 'Availability must be a boolean.' });
    }
    if (data.name !== undefined) data.name = data.name.trim();
    if (data.category !== undefined) data.category = data.category.trim() || null;
    if (data.description !== undefined) data.description = data.description.trim() || null;
    if (data.imageUrl !== undefined) data.imageUrl = data.imageUrl.trim() || null;
    if (data.sellingPrice !== undefined) data.sellingPrice = Number(data.sellingPrice);
    if (data.gstRate !== undefined) data.gstRate = Number(data.gstRate);
    if (data.preparationMinutes !== undefined) data.preparationMinutes = Number(data.preparationMinutes);
    const result = await prisma.product.updateMany({ where: { id: productId, sellerId: req.user.id }, data });
    if (!result.count) return res.status(404).json({ error: 'Product not found.' });
    const product = await prisma.product.findUnique({ where: { id: productId }, include: { stockLedger: true } });
    res.json(product);
  } catch (err) { next(err); }
});

router.get('/orders', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { sellerId: req.user.id, marketplaceOrderId: { not: null } },
      include: {
        customer: { select: { name: true, email: true, phone: true, address: true } },
        items: { include: { product: true } },
        statusEvents: { orderBy: { createdAt: 'asc' } },
        invoices: { select: { id: true, invoiceNo: true, grandTotal: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (err) { next(err); }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'Invalid order ID.' });
    const order = await prisma.order.findFirst({
      where: { id: orderId, sellerId: req.user.id, marketplaceOrderId: { not: null } },
      include: {
        customer: true,
        items: { include: { product: true } },
        statusEvents: { orderBy: { createdAt: 'asc' } },
        invoices: { include: { items: { include: { product: true } } } },
        productionRuns: { include: { product: true, issues: { include: { material: true } }, expenses: true } },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const orderId = Number(req.params.id);
    const { status, note, trackingReference, deliveryMethod } = req.body;
    if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: 'Invalid order ID.' });
    if (typeof status !== 'string' || (note !== undefined && (typeof note !== 'string' || note.length > 1000))
      || (trackingReference !== undefined && (typeof trackingReference !== 'string' || trackingReference.length > 120))
      || (deliveryMethod !== undefined && (typeof deliveryMethod !== 'string' || deliveryMethod.length > 80))) {
      return res.status(400).json({ error: 'A valid status and optional delivery details are required.' });
    }
    const result = await updateSellerOrderStatus(req.user, orderId, status, note, { trackingReference, deliveryMethod });
    if (!result) return res.status(404).json({ error: 'Order not found.' });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const [materials, products] = await Promise.all([
      prisma.material.findMany({
        where: { sellerId: req.user.id },
        include: { stockLedger: true },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { sellerId: req.user.id },
        include: { stockLedger: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({
      materials: materials.map(material => ({
        id: material.id,
        material,
        currentQty: material.stockLedger?.currentQty || 0,
        avgCost: material.stockLedger?.avgCost || 0,
      })),
      products: products.map(product => ({
        id: product.id,
        product,
        currentQty: product.stockLedger?.currentQty || 0,
        avgCost: product.stockLedger?.avgCost || 0,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/materials', async (req, res, next) => {
  try {
    const materials = await prisma.material.findMany({
      where: { sellerId: req.user.id, isActive: true },
      include: { stockLedger: true },
      orderBy: { name: 'asc' },
    });
    res.json(materials);
  } catch (err) { next(err); }
});

router.post('/materials', async (req, res, next) => {
  try {
    const { name, unit, reorderLevel = 0 } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100
      || typeof unit !== 'string' || !unit.trim() || unit.trim().length > 30
      || !Number.isFinite(Number(reorderLevel)) || Number(reorderLevel) < 0) {
      return res.status(400).json({ error: 'Enter a valid material name, unit, and non-negative reorder level.' });
    }
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({
        data: {
          code: `MAT-${Date.now().toString().slice(-8)}-${req.user.id}`,
          name: name.trim(),
          unit: unit.trim(),
          reorderLevel: Number(reorderLevel),
          sellerId: req.user.id,
        },
      });
      await tx.stockLedger.create({ data: { materialId: created.id, currentQty: 0, avgCost: 0 } });
      return created;
    });
    res.status(201).json(material);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A material code conflict occurred.' });
    next(err);
  }
});

router.post('/materials/:id/receipts', async (req, res, next) => {
  try {
    const materialId = Number(req.params.id);
    const quantity = Number(req.body.quantity);
    const unitCost = Number(req.body.unitCost);
    const { notes } = req.body;
    if (!Number.isInteger(materialId) || materialId < 1
      || !Number.isFinite(quantity) || quantity <= 0
      || !Number.isFinite(unitCost) || unitCost < 0
      || (notes !== undefined && (typeof notes !== 'string' || notes.length > 200))) {
      return res.status(400).json({ error: 'Enter a valid material, positive receipt quantity, non-negative unit cost, and optional note.' });
    }
    const material = await prisma.material.findFirst({
      where: { id: materialId, sellerId: req.user.id, isActive: true },
    });
    if (!material) return res.status(404).json({ error: 'Material not found.' });

    const receipt = await prisma.$transaction(tx => moveMaterialStock({
      materialId,
      qty: quantity,
      unitCost,
      movementType: 'PURCHASE',
      referenceType: 'SellerStockReceipt',
      notes: notes?.trim() || null,
    }, tx));
    res.status(201).json({ materialId, ...receipt });
  } catch (err) { next(err); }
});

router.get('/boms', async (req, res, next) => {
  try {
    const boms = await prisma.bom.findMany({
      where: { product: { sellerId: req.user.id } },
      include: { product: true, items: { include: { material: true } } },
      orderBy: [{ product: { name: 'asc' } }, { version: 'desc' }],
    });
    res.json(boms);
  } catch (err) { next(err); }
});

router.post('/boms', async (req, res, next) => {
  try {
    const { productId, batchSize, items } = req.body;
    const normalizedProductId = Number(productId);
    const normalizedBatchSize = Number(batchSize);
    if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1
      || !Number.isFinite(normalizedBatchSize) || normalizedBatchSize <= 0
      || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Select a product, enter a positive batch size, and add at least one BOM item.' });
    }
    const product = await prisma.product.findFirst({
      where: { id: normalizedProductId, sellerId: req.user.id },
    });
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const normalizedItems = [];
    const materialIds = new Set();
    for (const item of items) {
      const materialId = Number(item?.materialId);
      const quantity = Number(item?.quantity);
      const unit = typeof item?.unit === 'string' ? item.unit.trim() : '';
      if (!Number.isInteger(materialId) || materialId < 1
        || !Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'Each BOM material must have a valid ID and positive quantity.' });
      }
      if (materialIds.has(materialId)) {
        return res.status(400).json({ error: 'List each raw material only once per BOM.' });
      }
      const material = await prisma.material.findFirst({
        where: { id: materialId, sellerId: req.user.id, isActive: true },
      });
      if (!material) return res.status(400).json({ error: 'Every BOM material must belong to this producer.' });
      if (unit !== material.unit) {
        return res.status(400).json({ error: `Use the stock unit (${material.unit}) for ${material.name}.` });
      }
      materialIds.add(materialId);
      normalizedItems.push({ materialId, quantity, unit });
    }

    const bom = await prisma.$transaction(async tx => {
      const latest = await tx.bom.findFirst({
        where: { productId: product.id },
        orderBy: { version: 'desc' },
      });
      await tx.bom.updateMany({ where: { productId: product.id }, data: { isActive: false } });
      return tx.bom.create({
        data: {
          productId: product.id,
          batchSize: normalizedBatchSize,
          version: (latest?.version || 0) + 1,
          items: { create: normalizedItems },
        },
        include: { product: true, items: { include: { material: true } } },
      });
    });
    res.status(201).json(bom);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A BOM version conflict occurred. Please try again.' });
    next(err);
  }
});

router.get('/production', async (req, res, next) => {
  try {
    const runs = await prisma.productionRun.findMany({
      where: { product: { sellerId: req.user.id } },
      include: {
        product: true,
        bom: { include: { items: { include: { material: true } } } },
        order: { select: { id: true, orderNo: true, marketplaceOrderId: true, status: true } },
        issues: { include: { material: true } },
        expenses: true,
        variances: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(runs);
  } catch (err) { next(err); }
});

router.get('/invoices', async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: { order: { sellerId: req.user.id } },
      include: { customer: true, order: { select: { orderNo: true, marketplaceOrderId: true } }, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) { next(err); }
});

export default router;
