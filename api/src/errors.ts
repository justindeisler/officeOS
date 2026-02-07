/**
 * Custom error classes for standardized API error handling.
 *
 * Usage:
 *   throw new NotFoundError('Task not found');
 *   throw new ValidationError('Title is required');
 *   throw new AuthError('Invalid token');
 */

/**
 * Base API error with HTTP status code and error code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 400 - Validation errors (bad input, missing required fields)
 */
export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

/**
 * 401 - Authentication errors (missing or invalid credentials)
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
  }
}

/**
 * 403 - Authorization errors (insufficient permissions)
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 404 - Resource not found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', id?: string) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 409 - Conflict (duplicate resource, state conflict)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 429 - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(message, 429, 'RATE_LIMITED');
  }
}

/**
 * 502 - Bad gateway (upstream service failure)
 */
export class BadGatewayError extends AppError {
  constructor(message: string = 'Upstream service error') {
    super(message, 502, 'BAD_GATEWAY');
  }
}

/**
 * 504 - Gateway timeout
 */
export class GatewayTimeoutError extends AppError {
  constructor(message: string = 'Upstream service timed out') {
    super(message, 504, 'GATEWAY_TIMEOUT');
  }
}

/**
 * Database errors
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR', false);
  }
}
