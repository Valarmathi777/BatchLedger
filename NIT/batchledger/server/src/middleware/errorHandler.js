import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  logger.error(`${err.message}`, { stack: err.stack, url: req.url, method: req.method });

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate entry: a record with this value already exists.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found.' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
