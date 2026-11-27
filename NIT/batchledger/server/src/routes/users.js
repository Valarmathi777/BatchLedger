import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);
const STAFF_ROLES = ['ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR', 'SELLER'];

// GET /api/users  – Admin only
router.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
        businessState: true, businessStateCode: true,
        sellerProducts: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/users – Admin only
router.post('/', authorize('ADMIN'),
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(STAFF_ROLES),
  body('productIds').optional().isArray(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password, role, productIds = [], businessState, businessStateCode } = req.body;
      if (role !== 'SELLER' && productIds.length) {
        return res.status(400).json({ error: 'Products can only be assigned to seller accounts.' });
      }
      if ((businessState !== undefined || businessStateCode !== undefined)
        && (role !== 'SELLER'
          || typeof businessState !== 'string' || !businessState.trim() || businessState.trim().length > 100
          || typeof businessStateCode !== 'string' || !/^\d{2}$/.test(businessStateCode))) {
        return res.status(400).json({ error: 'Seller business state and a valid two-digit state code are required.' });
      }
      if (new Set(productIds).size !== productIds.length || productIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
        return res.status(400).json({ error: 'Product assignments must contain unique valid product IDs.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.$transaction(async tx => {
        const products = productIds.length
          ? await tx.product.findMany({ where: { id: { in: productIds.map(Number) }, sellerId: null }, select: { id: true } })
          : [];
        if (products.length !== productIds.length) {
          const error = new Error('One or more products are already assigned or do not exist.');
          error.status = 409;
          throw error;
        }
        const created = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role,
            ...(role === 'SELLER' && businessState !== undefined
              ? { businessState: businessState.trim(), businessStateCode }
              : {}),
          },
          select: { id: true, name: true, email: true, role: true, createdAt: true, businessState: true, businessStateCode: true },
        });
        if (role === 'SELLER' && productIds.length) {
          await tx.product.updateMany({ where: { id: { in: productIds.map(Number) } }, data: { sellerId: created.id } });
        }
        return created;
      });
      res.status(201).json(user);
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'An account already uses that email.' });
      if (err.status) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  }
);

// PATCH /api/users/:id – Admin only
router.patch('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, role, isActive, productIds, businessState, businessStateCode } = req.body;
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID.' });
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 100)) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
    }
    if (role !== undefined && !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role.' });
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean.' });
    }
    if ((businessState !== undefined || businessStateCode !== undefined)
      && (typeof businessState !== 'string' || !businessState.trim() || businessState.trim().length > 100
        || typeof businessStateCode !== 'string' || !/^\d{2}$/.test(businessStateCode))) {
      return res.status(400).json({ error: 'Seller business state and a valid two-digit state code are required.' });
    }
    if (productIds !== undefined && (!Array.isArray(productIds) || new Set(productIds).size !== productIds.length
      || productIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1))) {
      return res.status(400).json({ error: 'Product assignments must contain unique valid product IDs.' });
    }
    if (name === undefined && role === undefined && isActive === undefined && productIds === undefined
      && businessState === undefined && businessStateCode === undefined) {
      return res.status(400).json({ error: 'Provide a name, role, business state, product assignment, or active status to update.' });
    }
    if (userId === req.user.id && (role !== undefined && role !== 'ADMIN' || isActive === false)) {
      return res.status(400).json({ error: 'You cannot remove your own administrator access.' });
    }

    const result = await prisma.$transaction(async tx => {
      const current = await tx.user.findFirst({
        where: { id: userId, role: { in: STAFF_ROLES } },
      });
      if (!current) return { error: 'User not found.', status: 404 };
      if (businessState !== undefined && role !== 'SELLER' && current.role !== 'SELLER') {
        return { error: 'Business state can only be set for seller accounts.', status: 400 };
      }
      if (productIds !== undefined && role !== 'SELLER' && current.role !== 'SELLER') {
        return { error: 'Only seller accounts can be assigned products.', status: 400 };
      }
      if (productIds !== undefined) {
        const products = productIds.length
          ? await tx.product.findMany({
            where: { id: { in: productIds.map(Number) }, OR: [{ sellerId: null }, { sellerId: userId }] },
            select: { id: true },
          })
          : [];
        if (products.length !== productIds.length) {
          return { error: 'One or more products are assigned to another seller or do not exist.', status: 409 };
        }
        await tx.product.updateMany({ where: { sellerId: userId }, data: { sellerId: null } });
        if (productIds.length) {
          await tx.product.updateMany({ where: { id: { in: productIds.map(Number) } }, data: { sellerId: userId } });
        }
      }
      if (role !== undefined && role !== 'SELLER' && current.role === 'SELLER') {
        await tx.product.updateMany({ where: { sellerId: userId }, data: { sellerId: null } });
      }

      const losingAdminAccess = current.role === 'ADMIN'
        && current.isActive
        && (role !== undefined && role !== 'ADMIN' || isActive === false);
      if (losingAdminAccess) {
        const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', isActive: true } });
        if (activeAdmins <= 1) {
          return { error: 'At least one active administrator must remain.', status: 409 };
        }
      }

      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (role !== undefined) data.role = role;
      if (isActive !== undefined) data.isActive = isActive;
      if (businessState !== undefined) {
        data.businessState = businessState.trim();
        data.businessStateCode = businessStateCode;
      }
      if ((role !== undefined && role !== current.role) || (isActive !== undefined && isActive !== current.isActive)) {
        data.sessionVersion = { increment: 1 };
      }

      const user = await tx.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true, businessState: true, businessStateCode: true },
      });
      const sellerProducts = await tx.product.findMany({
        where: { sellerId: userId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return { user: { ...user, sellerProducts } };
    });
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.json(result.user);
  } catch (err) { next(err); }
});

export default router;
