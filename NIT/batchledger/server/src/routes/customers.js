import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

const select = { id: true, code: true, name: true, gstNumber: true, state: true, stateCode: true, address: true, phone: true, email: true, creditLimit: true, isActive: true };

router.get('/', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({ select, orderBy: { name: 'asc' } });
    res.json(customers);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const c = await prisma.customer.findUnique({ where: { id: Number(req.params.id) }, select });
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    res.json(c);
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN', 'SALESMAN'), async (req, res, next) => {
  try {
    const c = await prisma.customer.create({ data: req.body, select });
    res.status(201).json(c);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN', 'SALESMAN'), async (req, res, next) => {
  try {
    const c = await prisma.customer.update({ where: { id: Number(req.params.id) }, data: req.body, select });
    res.json(c);
  } catch (err) { next(err); }
});

export default router;
