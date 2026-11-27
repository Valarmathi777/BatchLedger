import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import customersRouter from './routes/customers.js';
import suppliersRouter from './routes/suppliers.js';
import productsRouter from './routes/products.js';
import materialsRouter from './routes/materials.js';
import bomsRouter from './routes/boms.js';
import purchasesRouter from './routes/purchases.js';
import stockRouter from './routes/stock.js';
import productionRouter from './routes/production.js';
import ordersRouter from './routes/orders.js';
import invoicesRouter from './routes/invoices.js';
import dispatchRouter from './routes/dispatch.js';
import paymentsRouter from './routes/payments.js';
import reportsRouter from './routes/reports.js';
import dashboardRouter from './routes/dashboard.js';
import auditRouter from './routes/audit.js';
import marketplaceRouter from './routes/marketplace.js';
import sellerRouter from './routes/seller.js';
import notificationsRouter from './routes/notifications.js';
import messagesRouter from './routes/messages.js';

import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.http(msg.trim()) } }));

// ── Rate limiting ───────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use(limiter);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'BatchLedger' }));

// Customers can only access the product catalog and their own order endpoints.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  if (req.method === 'GET' && /^\/marketplace\/(producers|products|delivery-charge)$/.test(req.path)) return next();
  authenticate(req, res, () => {
    const path = req.path.replace(/\/$/, '');
    if (req.user.role === 'CUSTOMER') {
      const allowed = (req.method === 'GET' && (
        path === '/products'
        || path === '/orders'
        || /^\/orders\/\d+$/.test(path)
        || path === '/marketplace/producers'
        || path === '/marketplace/products'
        || path === '/marketplace/orders'
        || /^\/marketplace\/orders\/[^/]+$/.test(path)
        || path === '/notifications'
        || path === '/messages/threads'
      )) || (req.method === 'POST' && path === '/marketplace/orders')
        || (req.method === 'POST' && path === '/messages')
        || (req.method === 'PATCH' && /^\/notifications\/(?:read-all|\d+\/read)$/.test(path));
      if (allowed) return next();
      return res.status(403).json({ error: 'Customer accounts can only access the marketplace, their own orders, and notifications.' });
    }
    if (req.user.role === 'SELLER') {
      const allowed = path === '/notifications' && req.method === 'GET'
        || /^\/notifications\/(?:read-all|\d+\/read)$/.test(path) && req.method === 'PATCH'
        || path === '/messages/threads' && req.method === 'GET'
        || path === '/messages' && req.method === 'POST'
        || /^\/seller\/(?:dashboard|products|orders|inventory|production|invoices)$/.test(path) && req.method === 'GET'
        || /^\/seller\/(?:materials|boms)$/.test(path) && (req.method === 'GET' || req.method === 'POST')
        || /^\/seller\/materials\/\d+\/receipts$/.test(path) && req.method === 'POST'
        || /^\/seller\/orders\/\d+$/.test(path) && req.method === 'GET'
        || /^\/seller\/products\/\d+$/.test(path) && req.method === 'PATCH'
        || path === '/seller/products' && req.method === 'POST'
        || /^\/seller\/orders\/\d+\/status$/.test(path) && req.method === 'PATCH'
        || path === '/production' && req.method === 'GET'
        || /^\/production\/\d+$/.test(path) && req.method === 'GET'
        || /^\/production\/\d+\/complete$/.test(path) && req.method === 'POST'
        || /^\/marketplace\/(?:producers|products)$/.test(path) && req.method === 'GET';
      if (allowed) return next();
      return res.status(403).json({ error: 'Seller accounts can only access their own seller workspace and notifications.' });
    }
    next();
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/suppliers', suppliersRouter);
app.use('/api/products', productsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/boms', bomsRouter);
app.use('/api/purchases', purchasesRouter);
app.use('/api/stock', stockRouter);
app.use('/api/production', productionRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/dispatch', dispatchRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/messages', messagesRouter);

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`BatchLedger API running on http://localhost:${PORT}`);
});

export default app;
