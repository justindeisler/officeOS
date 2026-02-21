/**
 * Per-API-Key Rate Limiting Middleware
 *
 * Tracks requests in the api_requests table and enforces per-key rate limits.
 * Sets standard X-RateLimit-* headers on every response.
 */

import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../database.js';
import { sendError } from './responseFormatter.js';
import { nanoid } from 'nanoid';

/**
 * Rate limiter middleware.
 * Must be applied AFTER apiAuthMiddleware (requires req.apiKey).
 */
export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.apiKey;
  if (!apiKey) return next(); // No API key = no rate limit (backward compat)

  const db = getDb();

  const windowMinutes = 1;
  const limit = apiKey.rate_limit;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Count requests in window
  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM api_requests
    WHERE api_key_id = ? AND created_at > ?
  `).get(apiKey.id, windowStart) as { count: number };

  const count = result.count;

  if (count >= limit) {
    // Set rate limit headers even on rejection
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMinutes * 60 * 1000).toISOString());

    return sendError(res, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, {
      limit,
      window_minutes: windowMinutes,
      retry_after: 60,
    });
  }

  // Log this request — capture the full path before sub-routers change req.path
  const requestId = nanoid();
  const startTime = Date.now();
  const endpoint = req.originalUrl || req.path;

  // Capture response to log status code and response time
  const originalSend = res.send;
  res.send = function (data: any) {
    const responseTime = Date.now() - startTime;

    try {
      db.prepare(`
        INSERT INTO api_requests (id, api_key_id, endpoint, method, status_code, response_time_ms, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        requestId,
        apiKey.id,
        endpoint,
        req.method,
        res.statusCode,
        responseTime,
        req.ip || null,
        req.headers['user-agent'] || null,
        new Date().toISOString(),
      );
    } catch {
      // Don't break the response if logging fails
    }

    return originalSend.call(this, data);
  };

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count - 1)));
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMinutes * 60 * 1000).toISOString());

  next();
}
