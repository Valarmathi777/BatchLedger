import prisma from './prisma.js';

/**
 * Write an audit log entry.
 * @param {object} opts
 * @param {number|null} opts.userId
 * @param {string} opts.action  - CREATE | UPDATE | DELETE | LOGIN | APPROVE | CANCEL
 * @param {string} opts.entity  - Model name, e.g. "Order"
 * @param {number|null} opts.entityId
 * @param {object|null} opts.oldValues
 * @param {object|null} opts.newValues
 * @param {string|null} opts.ipAddress
 */
export async function audit({ userId = null, action, entity, entityId = null, oldValues = null, newValues = null, ipAddress = null }) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      ipAddress,
    },
  });
}
