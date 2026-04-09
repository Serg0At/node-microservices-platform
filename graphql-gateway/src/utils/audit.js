import { logger } from './logger.js';

/**
 * Log an audit event as structured JSON.
 * Designed for Filebeat ingestion — filter by type: "audit" in Kibana.
 */
export function audit(action, { user, resourceType, resourceId, resourceTitle, ip, userAgent, meta } = {}) {
  logger.info({
    type: 'audit',
    action,
    actor_id: user?.id || null,
    actor_email: user?.email || null,
    actor_role: user?.role ?? null,
    resource_type: resourceType || null,
    resource_id: resourceId || null,
    resource_title: resourceTitle || null,
    ip_address: ip || null,
    user_agent: userAgent || null,
    ...meta,
  });
}
