/**
 * API Key Authentication Middleware for Public REST API v1
 *
 * Validates Bearer token API keys and checks required scopes.
 * Returns consistent error responses via the response formatter.
 */

import type { Request, Response, NextFunction } from 'express';
import { validateApiKey, type ApiKey } from '../services/apiKeyService.js';
import { getDb } from '../database.js';
import { sendError } from './responseFormatter.js';

// Extend Express Request to include apiKey
declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKey;
    }
  }
}

/**
 * Middleware factory for API key authentication.
 *
 * @param requiredScopes - If non-empty, at least one scope must match.
 *                         Empty array = just validate the key exists.
 */
export function apiAuthMiddleware(requiredScopes: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Missing or invalid Authorization header', 'UNAUTHORIZED', 401);
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "

    if (!apiKey || apiKey.trim() === '') {
      return sendError(res, 'Missing or invalid Authorization header', 'UNAUTHORIZED', 401);
    }

    const db = getDb();
    const validatedKey = validateApiKey(db, apiKey);

    if (!validatedKey) {
      return sendError(res, 'Invalid or expired API key', 'INVALID_API_KEY', 401);
    }

    // Check scopes
    if (requiredScopes.length > 0) {
      const hasScope = requiredScopes.some(scope => validatedKey.scopes.includes(scope));
      if (!hasScope) {
        return sendError(res, 'Insufficient permissions', 'FORBIDDEN', 403, {
          required: requiredScopes,
          provided: validatedKey.scopes,
        });
      }
    }

    // Attach to request
    req.apiKey = validatedKey;
    next();
  };
}
