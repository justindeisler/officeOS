/**
 * Async route handler wrapper.
 *
 * Wraps Express route handlers so that rejected promises / thrown errors
 * are forwarded to Express error-handling middleware automatically.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => { ... }));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
