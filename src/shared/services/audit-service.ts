import { Request } from 'express';
import { activityLogs } from '../../modules/core_erp/infrastructure/db-schemas';
import { Logger } from '../utils/logger';

const logger = new Logger('AuditService');

export interface AuditContext {
  userId?: string | null;
  userName?: string | null;
  tenantId?: string | null;
  tenantDomain?: string | null;
  action: string;
  module: string;
  details?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Enterprise Audit Trail Service
 * Records security and business critical actions into permanent audit log.
 * Credential fields (passwords, JWT secrets, reset tokens) are strictly filtered out.
 */
export class AuditService {
  private static sanitizeMetadata(meta: any): any {
    if (!meta || typeof meta !== 'object') return meta;
    const sanitized = { ...meta };
    const sensitiveKeys = ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'resetToken', 'secret'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
        sanitized[key] = '[REDACTED_SECRET]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = AuditService.sanitizeMetadata(sanitized[key]);
      }
    }
    return sanitized;
  }

  private static isValidUuid(id: string | null | undefined): boolean {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  static async log(db: any, req: Request, ctx: Omit<AuditContext, 'ipAddress'>): Promise<void> {
    try {
      const rawUserId = ctx.userId || req.user?.id || null;
      const userId = AuditService.isValidUuid(rawUserId) ? rawUserId : null;
      const userName = ctx.userName || req.user?.email || (rawUserId && !userId ? `User(${rawUserId})` : 'System');
      const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string) || null;
      const sanitizedMeta = ctx.metadata ? AuditService.sanitizeMetadata(ctx.metadata) : null;

      const logDetails = ctx.details
        ? `${ctx.details}${sanitizedMeta ? ` | Meta: ${JSON.stringify(sanitizedMeta)}` : ''}`
        : (sanitizedMeta ? `Meta: ${JSON.stringify(sanitizedMeta)}` : '');

      await db.insert(activityLogs).values({
        userId,
        userName,
        action: ctx.action,
        module: ctx.module,
        details: logDetails,
        ipAddress,
      });

      logger.info(`Audit Log: [${ctx.module}] ${ctx.action} by User [${userName}]`);
    } catch (err) {
      logger.error('Failed to write permanent audit log entry', err);
    }
  }
}
