import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { tenants } from '../../modules/core_erp/infrastructure/db-schemas';
import { getTenantDrizzleClient, publicDb } from '../../config/database';
import { NotFoundError, ForbiddenError, InternalServerError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = new Logger('TenantResolverMiddleware');

// Extend Express Request interface to hold tenant information
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      tenantDomain?: string;
      tenantSchema?: string;
      db?: any; // Dynamic Drizzle client bound to schema
      dbRelease?: () => void;
    }
  }
}

/**
 * Extracts the tenant identifier from the request headers, host, or query string.
 */
function extractTenantKey(req: Request): string | null {
  // 1. Check custom header (industry standard for API Gateways/proxies)
  const headerKey = req.headers['x-tenant-domain'] || req.headers['x-tenant-id'];
  if (headerKey && typeof headerKey === 'string') {
    return headerKey;
  }

  // 2. Check query string (extremely useful for debugging / dev environments)
  const queryKey = req.query['tenant'];
  if (queryKey && typeof queryKey === 'string') {
    return queryKey;
  }

  // 3. Extract from host subdomain (e.g. "tenant1.apps.com" -> "tenant1")
  const host = req.headers.host || '';
  const parts = host.split('.');
  if (parts.length > 2) {
    const subdomain = parts[0];
    // Ignore common generic prefixes
    if (subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'dev') {
      return subdomain;
    }
  }

  return null;
}

export async function tenantResolver(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isPublicRoute = 
    req.path.startsWith('/api/v1/auth/register') || 
    req.path.startsWith('/api/v1/auth/login') ||
    req.path.startsWith('/api/v1/auth/refresh') ||
    req.path.startsWith('/api/v1/auth/forgot-password') ||
    req.path.startsWith('/api/v1/auth/reset-password') ||
    req.path.startsWith('/api/v1/auth/verify-email') ||
    req.path.startsWith('/api/v1/auth/logout') ||
    req.path === '/api/health' || 
    !req.path.startsWith('/api/');

  const tenantKey = extractTenantKey(req);

  if (!tenantKey) {
    if (isPublicRoute) {
      // Public routes can bypass tenant database resolution
      req.db = publicDb;
      next();
      return;
    }
    next(new ForbiddenError('Tenant domain or header is required to access this resource'));
    return;
  }

  try {
    // 1. Query the global public registry for tenant metadata
    const registeredTenants = await publicDb
      .select()
      .from(tenants)
      .where(eq(tenants.domain, tenantKey.toLowerCase()))
      .limit(1);

    const activeTenant = registeredTenants[0];

    if (!activeTenant) {
      next(new NotFoundError('Tenant workspace not found or inaccessible'));
      return;
    }

    if (activeTenant.status === 'suspended') {
      next(new ForbiddenError('Tenant workspace is suspended'));
      return;
    }

    // 2. Configure request-scoped tenant information
    req.tenantId = activeTenant.id;
    req.tenantDomain = activeTenant.domain;
    req.tenantSchema = activeTenant.schema;

    // 3. Check out connection client bound to tenant schema
    const tenantDbInfo = await getTenantDrizzleClient(activeTenant.schema);
    req.db = tenantDbInfo.db;
    req.dbRelease = tenantDbInfo.release;

    // 4. Ensure we safely release the checked-out database client back to pool on request completion
    let released = false;
    const safeRelease = () => {
      if (!released) {
        released = true;
        if (req.dbRelease) {
          req.dbRelease();
          logger.debug(`Released database client back to pool for tenant schema [${activeTenant.schema}]`);
        }
      }
    };

    res.on('finish', safeRelease);
    res.on('close', safeRelease);

    next();
  } catch (error) {
    logger.error(`Error resolving tenant schema for domain [${tenantKey}]`, error);
    next(new InternalServerError('System failed to resolve tenant database schema'));
  }
}
