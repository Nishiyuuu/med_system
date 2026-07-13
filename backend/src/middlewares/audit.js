import AuditLog from '../models/AuditLog.js';

export function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

export async function writeAudit({ req, action, entity, entityId, targetPatientId }) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    entity,
    entityId,
    targetPatientId,
    ipAddress: getClientIp(req)
  });
}
