import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/threads', async (req, res, next) => {
  try {
    await prisma.message.updateMany({
      where: { receiverId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
        product: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const threads = new Map();
    for (const message of messages) {
      const counterpart = message.senderId === req.user.id ? message.receiver : message.sender;
      const key = `${counterpart.id}:${message.productId || 0}`;
      if (!threads.has(key)) threads.set(key, { user: counterpart, product: message.product, messages: [] });
      threads.get(key).messages.push(message);
    }
    res.json([...threads.values()]);
  } catch (err) { next(err); }
});

router.post('/',
  body('receiverId').isInt({ min: 1 }),
  body('body').trim().notEmpty().isLength({ max: 2000 }),
  body('productId').optional({ checkFalsy: true }).isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const receiverId = Number(req.body.receiverId);
      const productId = req.body.productId ? Number(req.body.productId) : null;
      const allowed = req.user.role === 'CUSTOMER'
        ? await prisma.user.findFirst({ where: { id: receiverId, role: 'SELLER', isActive: true } })
        : req.user.role === 'SELLER'
          ? await prisma.user.findFirst({ where: { id: receiverId, role: 'CUSTOMER', isActive: true } })
          : null;
      if (!allowed) return res.status(403).json({ error: 'You cannot message this account.' });
      if (productId) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true } });
        if (!product || (req.user.role === 'SELLER' && product.sellerId !== req.user.id)
          || (req.user.role === 'CUSTOMER' && product.sellerId !== receiverId)) {
          return res.status(400).json({ error: 'The selected product is not associated with this producer.' });
        }
      }
      const message = await prisma.message.create({
        data: { senderId: req.user.id, receiverId, productId, body: req.body.body.trim() },
        include: {
          sender: { select: { id: true, name: true, role: true } },
          receiver: { select: { id: true, name: true, role: true } },
          product: { select: { id: true, name: true } },
        },
      });
      res.status(201).json(message);
    } catch (err) { next(err); }
  }
);

export default router;
