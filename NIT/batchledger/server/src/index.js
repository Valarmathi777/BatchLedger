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
  authenticate(req, res, () => {
    if (req.user.role !== 'CUSTOMER') return next();
    const path = req.path.replace(/\/$/, '');
    if ((req.method === 'GET' && path === '/products') || /^\/orders(?:\/\d+)?$/.test(path)) return next();
    return res.status(403).json({ error: 'Customer accounts can only access the product catalog and their own orders.' });
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

// ── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`BatchLedger API running on http://localhost:${PORT}`);
});

export default app;
