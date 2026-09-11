import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { Logger } from '../utils/logger';

const logger = new Logger('RateLimiter');

interface RequestRecord {
  timestamps: number[];
}

/**
 * Simple, efficient in-process sliding-window rate limiter for Express endpoints.
 * Note: For multi-instance horizontal scaling, replace or back with shared cache (e.g. Redis).
 */
export function createRateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) {
  const windowMs = options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options?.maxRequests ?? env.RATE_LIMIT_MAX_REQUESTS;
  const message = options?.message ?? 'Too many requests, please try again later.';

  const ipStore = new Map<string, RequestRecord>();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        ipStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Allow unref so cleanup interval does not prevent node process exit in tests
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine client identifier (IP address or fallback header)
    const clientIp = (
      (req.headers['x-forwarded-for'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();

    const now = Date.now();
    let record = ipStore.get(clientIp);

    if (!record) {
      record = { timestamps: [] };
      ipStore.set(clientIp, record);
    }

    // Filter out timestamps older than current sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.timestamps.length - 1));

    if (record.timestamps.length >= maxRequests) {
      const oldestTs = record.timestamps[0];
      const retryAfterSec = Math.ceil((oldestTs + windowMs - now) / 1000);

      res.setHeader('Retry-After', retryAfterSec);
      logger.warn(`Rate limit exceeded for client IP [${clientIp}] on endpoint [${req.path}]`);

      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message,
          retryAfter: retryAfterSec,
        },
      });
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

export const authRateLimiter = createRateLimiter();
