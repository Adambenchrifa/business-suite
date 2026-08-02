export abstract class AppError extends Error {
  public abstract readonly statusCode: number;
  public readonly isOperational: boolean = true;

  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly statusCode = 400;
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class UnauthorizedError extends AppError {
  public readonly statusCode = 401;
  constructor(message: string = 'Unauthorized access', context?: Record<string, any>) {
    super(message, context);
  }
}

export class ForbiddenError extends AppError {
  public readonly statusCode = 403;
  constructor(message: string = 'Access forbidden', context?: Record<string, any>) {
    super(message, context);
  }
}

export class NotFoundError extends AppError {
  public readonly statusCode = 404;
  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, context);
  }
}

export class ConflictError extends AppError {
  public readonly statusCode = 409;
  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

export class InternalServerError extends AppError {
  public readonly statusCode = 500;
  public readonly isOperational = false;
  constructor(message: string = 'Internal server error', context?: Record<string, any>) {
    super(message, context);
  }
}
