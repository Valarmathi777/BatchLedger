import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';
const SESSION_COOKIE = 'bl_session';
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api',
  maxAge: 8 * 60 * 60 * 1000,
};

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
  throw new Error('JWT_SECRET must be set to a random value of at least 32 bytes.');
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export function clearSessionCookie(res) {
  const options = { ...SESSION_COOKIE_OPTIONS };
  delete options.maxAge;
  res.clearCookie(SESSION_COOKIE, options);
}

export async function authenticate(req, res, next) {
  const sessionCookie = req.headers.cookie
    ?.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(`${SESSION_COOKIE}=`));
  const token = sessionCookie?.slice(SESSION_COOKIE.length + 1);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    logger.warn(`JWT verify failed: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.id) },
      select: { id: true, name: true, email: true, role: true, customerId: true, isActive: true, sessionVersion: true },
    });
    if (!user || !user.isActive || user.sessionVersion !== decoded.sessionVersion) {
      return res.status(401).json({ error: 'Unauthorized: Session is no longer active' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Authorize specific roles.
 * Usage: authorize('ADMIN', 'SALESMAN')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires one of [${roles.join(', ')}], got ${req.user.role}`,
      });
    }
    next();
  };
}
