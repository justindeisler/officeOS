/**
 * API Key Generation & Validation Service
 *
 * Generates, validates, revokes, and lists API keys.
 * Keys are stored as SHA-256 hashes — the plaintext key is shown only once at creation.
 */

import crypto from 'crypto';
import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';

export interface ApiKey {
  id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean | number;
}

export interface GeneratedKey {
  key: string;       // Full key to show user ONCE (e.g., "pk_live_abc123...")
  apiKey: ApiKey;    // DB record (with scopes parsed)
}

/**
 * Generate a new API key and store it in the database.
 */
export function generateApiKey(
  db: Database.Database,
  name: string,
  scopes: string[] = ['read', 'write'],
  rateLimit = 100,
  expiresInDays?: number,
): GeneratedKey {
  const prefix = process.env.NODE_ENV === 'production' ? 'pk_live_' : 'pk_test_';
  const randomPart = nanoid(32);
  const fullKey = prefix + randomPart;

  // Hash for storage — never store plaintext
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
  const keyPrefix = fullKey.substring(0, 12); // "pk_test_abc1"

  const id = nanoid();
  const createdAt = new Date().toISOString();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  db.prepare(`
    INSERT INTO api_keys (id, key_hash, key_prefix, name, scopes, rate_limit, created_at, expires_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, keyHash, keyPrefix, name, JSON.stringify(scopes), rateLimit, createdAt, expiresAt, 1);

  const row = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id) as any;
  const apiKey: ApiKey = { ...row, scopes: JSON.parse(row.scopes) };

  return { key: fullKey, apiKey };
}

/**
 * Validate an API key against the database.
 * Returns the key record with parsed scopes, or null if invalid/expired/revoked.
 */
export function validateApiKey(db: Database.Database, key: string): ApiKey | null {
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const row = db.prepare(`
    SELECT * FROM api_keys
    WHERE key_hash = ?
      AND is_active = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
  `).get(keyHash) as any;

  if (!row) return null;

  // Update last_used_at
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .run(new Date().toISOString(), row.id);

  return { ...row, scopes: JSON.parse(row.scopes) };
}

/**
 * Revoke an API key (soft-delete).
 */
export function revokeApiKey(db: Database.Database, keyId: string): void {
  db.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(keyId);
}

/**
 * List all API keys (with parsed scopes).
 */
export function listApiKeys(db: Database.Database): ApiKey[] {
  const keys = db.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all() as any[];
  return keys.map(k => ({ ...k, scopes: JSON.parse(k.scopes) }));
}
