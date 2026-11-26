import express from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { audit } from '../utils/auditLog.js';

const router = express.Router();

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
      });
      res.status(201).json({
        token,
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
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = generateToken({ id: user.id, name: user.name, email: user.email, role: user.role, customerId: user.customerId });

      await audit({
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
      });

      res.json({
        token,
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

// POST /api/auth/logout  (client just drops token; this logs the event)
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await audit({ userId: req.user.id, action: 'LOGOUT', entity: 'User', entityId: req.user.id, ipAddress: req.ip });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

export default router;
