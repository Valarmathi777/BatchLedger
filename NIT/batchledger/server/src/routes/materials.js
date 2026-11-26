import express from 'express';
import prisma from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const list = await prisma.material.findMany({ orderBy: { name: 'asc' } });
    res.json(list);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const m = await prisma.material.findUnique({ where: { id: Number(req.params.id) } });
    if (!m) return res.status(404).json({ error: 'Material not found' });
    res.json(m);
  } catch (err) { next(err); }
});

router.post('/', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const m = await prisma.material.create({ data: req.body });
    res.status(201).json(m);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('ADMIN', 'PRODUCTION_SUPERVISOR'), async (req, res, next) => {
  try {
    const m = await prisma.material.update({ where: { id: Number(req.params.id) }, data: req.body });
    res.json(m);
  } catch (err) { next(err); }
});

export default router;
