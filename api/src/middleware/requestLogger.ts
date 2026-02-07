/**
 * Request/response logging middleware.
 *
 * Logs every incoming request and its response status + duration.
 * Skips noisy endpoints (health checks) at info level.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger.js';

const log = createLogger('http');

// Paths that should only log at debug level to reduce noise
const QUIET_PATHS = new Set(['/health']);

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Log when the response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };

    if (QUIET_PATHS.has(req.path)) {
      log.debug(logData, 'request');
      return;
    }

    if (res.statusCode >= 500) {
      log.error(logData, 'request');
    } else if (res.statusCode >= 400) {
      log.warn(logData, 'request');
    } else {
      log.info(logData, 'request');
    }
  });

  next();
}
