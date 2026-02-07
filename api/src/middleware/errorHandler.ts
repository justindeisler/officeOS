/**
 * Global Express error handling middleware.
 *
 * Catches all errors thrown from route handlers and returns a
 * standardized JSON response. Operational errors (AppError) are
 * logged at warn level; unexpected errors at error level.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { createLogger } from '../logger.js';

const log = createLogger('error-handler');

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Determine if this is a known operational error
  if (err instanceof AppError) {
    // Operational errors are expected (validation, not found, etc.)
    if (err.statusCode >= 500) {
      log.error({ err, method: req.method, path: req.path }, err.message);
    } else {
      log.warn(
        { code: err.code, statusCode: err.statusCode, method: req.method, path: req.path },
        err.message
      );
    }

    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
      },
    };

    // Include field-level validation details if present
    if ('fields' in err && (err as { fields?: Record<string, string> }).fields) {
      body.error.fields = (err as { fields: Record<string, string> }).fields;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unexpected / programmer errors — log the full stack
  log.error(
    { err, method: req.method, path: req.path, stack: err.stack },
    'Unhandled error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  } satisfies ErrorResponse);
}

/**
 * 404 handler for routes that don't match any endpoint.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    },
  } satisfies ErrorResponse);
}
