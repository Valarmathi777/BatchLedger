import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/audit – Admin and Auditor only
router.get('/', authorize('ADMIN', 'AUDITOR'), async (req, res, next) => {
  try {
    const { entity, userId, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (entity) where.entity = entity;
    if (userId) where.userId = Number(userId);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) { next(err); }
});

export default router;
