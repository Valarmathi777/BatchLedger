import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createMarketplaceOrder, getCustomerMarketplaceOrders } from '../utils/marketplace.js';

const router = express.Router();

router.get('/delivery-charge', async (_req, res, next) => {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: 'marketplace_delivery_charge' } });
    const amount = Number(config?.value ?? process.env.MARKETPLACE_DELIVERY_CHARGE ?? 0);
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Marketplace delivery charge configuration is invalid.');
    res.json({ amount });
  } catch (err) { next(err); }
});

router.get('/producers', async (_req, res, next) => {
  try {
    const producers = await prisma.user.findMany({
      where: {
        role: 'SELLER',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sellerProducts: {
          where: { isActive: true, isAvailable: true },
          select: { id: true, name: true, category: true, imageUrl: true, sellingPrice: true, unit: true, preparationMinutes: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(producers.map(({ sellerProducts, ...producer }) => ({ ...producer, products: sellerProducts })));
  } catch (err) { next(err); }
});

router.get('/products', async (req, res, next) => {
  try {
    const sellerId = req.query.sellerId === undefined ? undefined : Number(req.query.sellerId);
    if (sellerId !== undefined && (!Number.isInteger(sellerId) || sellerId < 1)) {
      return res.status(400).json({ error: 'Invalid producer filter.' });
    }
    const where = {
      isActive: true,
      isAvailable: true,
      sellerId,
      seller: { role: 'SELLER', isActive: true },
      ...(req.query.category ? { category: String(req.query.category) } : {}),
      ...(req.query.search ? { name: { contains: String(req.query.search) } } : {}),
    };
    const products = await prisma.product.findMany({
      where,
      include: { seller: { select: { id: true, name: true } } },
      orderBy: [{ seller: { name: 'asc' } }, { name: 'asc' }],
    });
    res.json(products);
  } catch (err) { next(err); }
});

router.post('/orders', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    if (!req.user.customerId) return res.status(403).json({ error: 'Customer account is not linked to a customer record.' });
    const order = await createMarketplaceOrder(req.user, req.body);
    res.status(201).json(order);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.get('/orders', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    res.json(await getCustomerMarketplaceOrders(req.user.id));
  } catch (err) { next(err); }
});

router.get('/orders/:reference', authenticate, authorize('CUSTOMER'), async (req, res, next) => {
  try {
    const orders = await getCustomerMarketplaceOrders(req.user.id);
    const order = orders.find(item => item.reference === req.params.reference);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  } catch (err) { next(err); }
});

export default router;
