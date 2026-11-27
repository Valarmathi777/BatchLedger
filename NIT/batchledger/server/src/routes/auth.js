import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import prisma from '../utils/prisma.js';
import { generateToken, authenticate, setSessionCookie, clearSessionCookie } from '../middleware/auth.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();
const loginAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
});

const legacyDemoEmails = [
  'admin@batchledger.com',
  'salesman@batchledger.com',
  'supervisor@batchledger.com',
  'auditor@batchledger.com',
];

// GET /api/auth/setup-status
router.get('/setup-status', async (req, res, next) => {
  try {
    const hasConfiguredAdmin = await prisma.user.count({
      where: { role: 'ADMIN', isActive: true, email: { notIn: legacyDemoEmails } },
    }) > 0;
    res.json({ hasAdmin: hasConfiguredAdmin });
  } catch (err) {
    next(err);
  }
});

// Public producer/seller account registration.
router.post('/register-seller',
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('businessState').trim().notEmpty().isLength({ max: 100 }),
  body('businessStateCode').matches(/^\d{2}$/),
  body('products').isArray({ min: 1, max: 20 }),
  body('products.*.name').trim().notEmpty().isLength({ max: 100 }),
  body('products.*.category').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('products.*.unit').trim().notEmpty().isLength({ max: 30 }),
  body('products.*.sellingPrice').isFloat({ min: 0 }),
  body('products.*.gstRate').optional().isFloat({ min: 0, max: 100 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password, businessState, businessStateCode, products } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name, email, passwordHash, role: 'SELLER', businessState, businessStateCode },
        });
        for (const [index, product] of products.entries()) {
          const code = `PROD-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
          const createdProduct = await tx.product.create({
            data: {
              code,
              name: product.name.trim(),
              description: product.description?.trim() || null,
              unit: product.unit.trim(),
              gstRate: Number(product.gstRate ?? 5),
              sellingPrice: Number(product.sellingPrice),
              sellerId: created.id,
              category: product.category?.trim() || null,
              preparationMinutes: Number(product.preparationMinutes ?? 60),
              isAvailable: true,
              isActive: true,
            },
          });
          await tx.stockLedger.create({ data: { productId: createdProduct.id, currentQty: 0, avgCost: 0 } });
        }
        return created;
      });

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        sessionVersion: user.sessionVersion,
      });
      setSessionCookie(res, token);
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'An account already uses that email.' });
      next(err);
    }
  }
);

// Public one-time initial administrator setup. Once an active admin exists, setup is closed.
router.post('/register-admin',
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 12 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const existingAdmin = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, email: { notIn: legacyDemoEmails } },
      });
      if (existingAdmin > 0) {
        return res.status(409).json({ error: 'Administrator setup is closed. Sign in with an existing administrator account.' });
      }

      const { name, email, password } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { role: 'ADMIN', isActive: true, email: { in: legacyDemoEmails } },
          data: { isActive: false },
        });
        return tx.user.create({
          data: { name, email, passwordHash, role: 'ADMIN' },
        });
      });

      await audit({
        userId: user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        newValues: JSON.stringify({ role: 'ADMIN', setup: 'initial-admin' }),
      });

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        sessionVersion: user.sessionVersion,
      });
      setSessionCookie(res, token);
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'An account already uses that email.' });
      next(err);
    }
  }
);

// POST /api/auth/register-customer
router.post('/register-customer',
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('state').trim().notEmpty(),
  body('stateCode').matches(/^\d{2}$/),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('address').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password, state, stateCode, phone, address } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.$transaction(async (tx) => {
        const customer = await tx.customer.create({
          data: {
            code: `PORTAL-${randomUUID()}`,
            name,
            email,
            state,
            stateCode,
            phone: phone || null,
            address: address || null,
          },
        });
        return tx.user.create({
          data: { name, email, passwordHash, role: 'CUSTOMER', customerId: customer.id },
        });
      });

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        sessionVersion: user.sessionVersion,
      });
      setSessionCookie(res, token);
      res.status(201).json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId },
      });
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'An account already uses that email.' });
      next(err);
    }
  }
);

// POST /api/auth/login
router.post('/login',
  loginAttemptLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('portal').optional().isIn(['owner', 'producer', 'customer']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password, portal } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const roleMatchesPortal =
        !portal
        || (portal === 'customer' && user.role === 'CUSTOMER')
        || (portal === 'owner' && ['ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR'].includes(user.role))
        || (portal === 'producer' && user.role === 'SELLER');
      if (!roleMatchesPortal) {
        return res.status(403).json({ error: `This account cannot sign in to the ${portal} portal.` });
      }

      const token = generateToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        customerId: user.customerId,
        sessionVersion: user.sessionVersion,
      });

      await audit({
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
      });

      setSessionCookie(res, token);
      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, customerId: true, isActive: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout invalidates the current session and clears its cookie.
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.$transaction(async tx => {
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id, ipAddress: req.ip },
      });
      await tx.user.update({
        where: { id: req.user.id },
        data: { sessionVersion: { increment: 1 } },
      });
    });
    clearSessionCookie(res);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

export default router;
