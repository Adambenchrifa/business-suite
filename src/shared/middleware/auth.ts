import { Request, Response, NextFunction } from 'express';
import { JwtProvider } from '../../modules/core_erp/domain/user';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = new Logger('AuthMiddleware');

// Extend Express Request interface to hold authenticated user details
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId: string;
      };
    }
  }
}

/**
 * Global authentication enforcement middleware.
 * Verifies JWT session token and ensures cross-tenant queries are blocked.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // 1. Extract Bearer token from authorization headers or cookies
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    next(new UnauthorizedError('Access token is missing or invalid'));
    return;
  }

  try {
    // 2. Verify asymmetric signature and parse claims
    const decoded = JwtProvider.verifyAccessToken(token);

    // 3. SECURE CROSS-TENANT CHECK: 
    // If we have a resolved tenant schema, ensure this token was actually provisioned for it.
    // Prevent Tenant B users from using active tokens to scrape Tenant A data.
    if (req.tenantId && decoded.tenantId !== req.tenantId) {
      logger.warn(`Potential cross-tenant breach detected: User [${decoded.id}] with token tenant [${decoded.tenantId}] attempted to access workspace [${req.tenantId}]`);
      next(new ForbiddenError('Access to this workspace domain is forbidden with your current credentials'));
      return;
    }

    // 4. Bind auth credentials onto the active request thread
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Failed to verify session token', { error: error instanceof Error ? error.message : String(error) });
    next(new UnauthorizedError('Your session has expired. Please log in again.'));
  }
}

/**
 * Role checking helper factory.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication is required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('You do not have permission to execute this operation'));
      return;
    }

    next();
  };
}
