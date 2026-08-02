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

  // Handle unhandled errors (native errors, database crashes, etc.)
  logger.error('Unhandled System Exception caught', err, reqMeta);

  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: {
      message: 'An unexpected internal server error occurred.',
      code: 'InternalServerError',
      stack: isDev && err instanceof Error ? err.stack : undefined,
    },
  });
}
