/**
 * API Key Service Tests
 *
 * Tests key generation, validation, revocation, and listing.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { createTestDb, resetIdCounter } from '../../test/setup.js';
import {
  generateApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeys,
} from '../apiKeyService.js';

let testDb: Database.Database;

describe('API Key Service', () => {
  beforeEach(() => {
    testDb = createTestDb();
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
  });

  // ========== generateApiKey ==========

  describe('generateApiKey', () => {
    it('generates a key with pk_test_ prefix in non-production', () => {
      const { key, apiKey } = generateApiKey(testDb, 'Test Key');
      expect(key).toMatch(/^pk_test_/);
      expect(apiKey.key_prefix).toMatch(/^pk_test_/);
      expect(apiKey.key_prefix.length).toBe(12);
    });

    it('stores key as SHA-256 hash, not plaintext', () => {
      const { key, apiKey } = generateApiKey(testDb, 'Hashed Key');
      const expectedHash = crypto.createHash('sha256').update(key).digest('hex');
      expect(apiKey.key_hash).toBe(expectedHash);

      // Verify key is NOT stored in plaintext anywhere
      const row = testDb.prepare('SELECT * FROM api_keys WHERE id = ?').get(apiKey.id) as any;
      expect(row.key_hash).toBe(expectedHash);
      expect(JSON.stringify(row)).not.toContain(key);
    });

    it('stores correct metadata', () => {
      const { apiKey } = generateApiKey(testDb, 'Meta Key', ['read', 'write'], 50);
      expect(apiKey.name).toBe('Meta Key');
      expect(apiKey.scopes).toEqual(['read', 'write']);
      expect(apiKey.rate_limit).toBe(50);
      expect(apiKey.is_active).toBeTruthy();
      expect(apiKey.created_at).toBeDefined();
      expect(apiKey.expires_at).toBeNull();
    });

    it('generates unique keys', () => {
      const key1 = generateApiKey(testDb, 'Key 1');
      const key2 = generateApiKey(testDb, 'Key 2');
      expect(key1.key).not.toBe(key2.key);
      expect(key1.apiKey.id).not.toBe(key2.apiKey.id);
    });

    it('sets expiration when expiresInDays is provided', () => {
      const { apiKey } = generateApiKey(testDb, 'Expiring Key', ['read'], 100, 30);
      expect(apiKey.expires_at).not.toBeNull();
      const expiresAt = new Date(apiKey.expires_at!);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('defaults scopes to [read, write]', () => {
      const { apiKey } = generateApiKey(testDb, 'Default Scopes');
      expect(apiKey.scopes).toEqual(['read', 'write']);
    });

    it('defaults rate_limit to 100', () => {
      const { apiKey } = generateApiKey(testDb, 'Default Rate');
      expect(apiKey.rate_limit).toBe(100);
    });
  });

  // ========== validateApiKey ==========

  describe('validateApiKey', () => {
    it('validates a valid key', () => {
      const { key } = generateApiKey(testDb, 'Valid Key');
      const validated = validateApiKey(testDb, key);
      expect(validated).not.toBeNull();
      expect(validated!.name).toBe('Valid Key');
      expect(validated!.scopes).toEqual(['read', 'write']);
    });

    it('returns null for invalid key', () => {
      const validated = validateApiKey(testDb, 'pk_test_definitely_not_real');
      expect(validated).toBeNull();
    });

    it('returns null for revoked key', () => {
      const { key, apiKey } = generateApiKey(testDb, 'Revoked Key');
      revokeApiKey(testDb, apiKey.id);
      const validated = validateApiKey(testDb, key);
      expect(validated).toBeNull();
    });

    it('returns null for expired key', () => {
      const { key, apiKey } = generateApiKey(testDb, 'Expired Key');
      testDb.prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?')
        .run('2020-01-01T00:00:00.000Z', apiKey.id);
      const validated = validateApiKey(testDb, key);
      expect(validated).toBeNull();
    });

    it('updates last_used_at on validation', () => {
      const { key, apiKey } = generateApiKey(testDb, 'Timestamp Key');
      expect(apiKey.last_used_at).toBeNull();

      validateApiKey(testDb, key);

      const row = testDb.prepare('SELECT last_used_at FROM api_keys WHERE id = ?').get(apiKey.id) as any;
      expect(row.last_used_at).not.toBeNull();
    });

    it('returns parsed scopes array', () => {
      const { key } = generateApiKey(testDb, 'Scopes Key', ['read', 'admin']);
      const validated = validateApiKey(testDb, key);
      expect(validated!.scopes).toEqual(['read', 'admin']);
      expect(Array.isArray(validated!.scopes)).toBe(true);
    });
  });

  // ========== revokeApiKey ==========

  describe('revokeApiKey', () => {
    it('sets is_active to 0', () => {
      const { apiKey } = generateApiKey(testDb, 'To Revoke');
      revokeApiKey(testDb, apiKey.id);
      const row = testDb.prepare('SELECT is_active FROM api_keys WHERE id = ?').get(apiKey.id) as any;
      expect(row.is_active).toBe(0);
    });
  });

  // ========== listApiKeys ==========

  describe('listApiKeys', () => {
    it('lists all keys', () => {
      generateApiKey(testDb, 'First');
      generateApiKey(testDb, 'Second');
      generateApiKey(testDb, 'Third');

      const keys = listApiKeys(testDb);
      expect(keys).toHaveLength(3);
      const names = keys.map(k => k.name).sort();
      expect(names).toEqual(['First', 'Second', 'Third']);
    });

    it('returns parsed scopes for each key', () => {
      generateApiKey(testDb, 'Key A', ['read']);
      generateApiKey(testDb, 'Key B', ['read', 'write', 'admin']);

      const keys = listApiKeys(testDb);
      expect(Array.isArray(keys[0].scopes)).toBe(true);
      expect(Array.isArray(keys[1].scopes)).toBe(true);
    });

    it('returns empty array when no keys exist', () => {
      const keys = listApiKeys(testDb);
      expect(keys).toEqual([]);
    });
  });
});
