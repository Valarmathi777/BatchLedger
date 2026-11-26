import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/users  – Admin only
router.get('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
});

// POST /api/users – Admin only
router.post('/', authorize('ADMIN'),
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['ADMIN', 'SALESMAN', 'PRODUCTION_SUPERVISOR', 'AUDITOR']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password, role } = req.body;
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      res.status(201).json(user);
    } catch (err) { next(err); }
  }
);

// PATCH /api/users/:id – Admin only
router.patch('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, role, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) { next(err); }
});

export default router;
