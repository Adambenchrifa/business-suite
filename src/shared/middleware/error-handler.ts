import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';

const logger = new Logger('ErrorHandlerMiddleware');

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Extract route/request metadata
  const reqMeta = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    tenantId: (req as any).tenantId || null,
    userId: (req as any).user?.id || null,
  };

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`Server Error: ${err.message}`, err, reqMeta);
    } else {
      logger.warn(`Operational Warning: ${err.message}`, { ...reqMeta, context: err.context });
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.constructor.name,
        context: err.context || null,
      },
    });
    return;
  }

  // Handle Zod validation errors cleanly
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'ZodError') {
    const zodErr = err as any;
    logger.warn('API Validation Error', { ...reqMeta, errors: zodErr.errors });
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid request payload parameters',
        code: 'ValidationError',
        details: zodErr.errors,
      },
    });
    return;
  }

  // Handle unhandled errors (native errors, database crashes, etc.)
  logger.error('Unhandled System Exception caught', err, reqMeta);

  const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
  const pgErr = err && typeof err === 'object' ? (err as any) : null;

  res.status(500).json({
    success: false,
    error: {
      message: isDevOrTest && err instanceof Error ? err.message : 'An unexpected internal server error occurred.',
      code: 'InternalServerError',
      ...(isDevOrTest && pgErr?.code ? { dbCode: pgErr.code, dbTable: pgErr.table, dbDetail: pgErr.detail } : {}),
      endpoint: req.originalUrl || req.url,
      method: req.method,
      stack: isDevOrTest && err instanceof Error ? err.stack : undefined,
    },
  });
}
