/**
 * Admin Routes — API Key Management
 *
 * Protected by JWT authMiddleware (same as other admin routes).
 * Allows generating, listing, and revoking API keys.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../database.js';
import { generateApiKey, listApiKeys, revokeApiKey } from '../../services/apiKeyService.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';

const router = Router();

/**
 * POST /api/admin/api-keys — Generate a new API key
 *
 * Body: { name, scopes?, rate_limit?, expires_in_days? }
 * Response includes the full key ONCE — store it securely.
 */
router.post('/', (req: Request, res: Response) => {
  const { name, scopes, rate_limit, expires_in_days } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return sendError(res, 'Name is required', 'VALIDATION_ERROR', 400);
  }

  const validScopes = ['read', 'write', 'admin'];
  const requestedScopes = Array.isArray(scopes) ? scopes : ['read', 'write'];
  for (const scope of requestedScopes) {
    if (!validScopes.includes(scope)) {
      return sendError(res, `Invalid scope: ${scope}`, 'VALIDATION_ERROR', 400, {
        valid_scopes: validScopes,
      });
    }
  }

  const db = getDb();
  const { key, apiKey } = generateApiKey(
    db,
    name.trim(),
    requestedScopes,
    typeof rate_limit === 'number' ? rate_limit : 100,
    typeof expires_in_days === 'number' ? expires_in_days : undefined,
  );

  sendSuccess(res, {
    key, // ONLY show full key here — never again
    api_key: {
      id: apiKey.id,
      key_prefix: apiKey.key_prefix,
      name: apiKey.name,
      scopes: apiKey.scopes,
      rate_limit: apiKey.rate_limit,
      created_at: apiKey.created_at,
      expires_at: apiKey.expires_at,
    },
  }, 201);
});

/**
 * GET /api/admin/api-keys — List all API keys
 *
 * Never returns the full key — only the prefix.
 */
router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const keys = listApiKeys(db);

  // Strip key_hash for safety
  const sanitized = keys.map(k => ({
    id: k.id,
    key_prefix: k.key_prefix,
    name: k.name,
    scopes: k.scopes,
    rate_limit: k.rate_limit,
    last_used_at: k.last_used_at,
    created_at: k.created_at,
    expires_at: k.expires_at,
    is_active: k.is_active,
  }));

  sendSuccess(res, sanitized);
});

/**
 * DELETE /api/admin/api-keys/:id — Revoke an API key
 */
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  revokeApiKey(db, req.params.id);
  sendSuccess(res, { revoked: true });
});

export default router;
