import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const s = await prisma.supplier.create({ data: req.body });
    res.status(201).json(s);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN'), async (req, res, next) => {
  try {
    const s = await prisma.supplier.update({ where: { id: Number(req.params.id) }, data: req.body });
    res.json(s);
  } catch (err) { next(err); }
});

export default router;
