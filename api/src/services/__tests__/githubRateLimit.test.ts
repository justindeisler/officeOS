/**
 * GitHub Rate Limit Service Tests
 *
 * Unit tests for rate limit parsing, caching, throttling,
 * and error handling in the githubRateLimit module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock child_process and util before importing the module
const mockExecFile = vi.fn();
vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

vi.mock('util', () => ({
  promisify: () => {
    return (...args: unknown[]) => mockExecFile(...args);
  },
}));

// Mock database (required by cache.ts imports)
vi.mock('../../database.js', () => ({
  getDb: vi.fn(),
  generateId: () => 'test-id',
  getCurrentTimestamp: () => new Date().toISOString(),
}));

import {
  parseRateLimitError,
  GitHubRateLimitError,
  buildRateLimitMeta,
  cachedGhExec,
  __resetForTesting,
  throttledDelay,
  resetSyncQueue,
  setSyncQueueActive,
  isSyncActive,
  updateRateLimitState,
  getRateLimitState,
} from '../githubRateLimit.js';
import { cache } from '../../cache.js';

describe('GitHub Rate Limit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
    __resetForTesting();
  });

  // ==========================================================================
  // parseRateLimitError
  // ==========================================================================

  describe('parseRateLimitError', () => {
    it('returns null for non-rate-limit errors', () => {
      expect(parseRateLimitError('not logged in')).toBeNull();
      expect(parseRateLimitError('network timeout')).toBeNull();
      expect(parseRateLimitError('')).toBeNull();
    });

    it('detects "API rate limit exceeded" messages', () => {
      const result = parseRateLimitError(
        'API rate limit exceeded for user. rate limit will reset at 2025-01-15T10:00:00Z'
      );
      expect(result).not.toBeNull();
      expect(result!.isLimited).toBe(true);
      expect(result!.remaining).toBe(0);
      expect(result!.resetAt).toBeGreaterThan(0);
    });

    it('parses reset time from error message', () => {
      const futureDate = new Date(Date.now() + 3600_000);
      // Use ISO format with T and Z suffix so Date parsing is unambiguous
      const formatted = futureDate.toISOString().replace(/\.\d+Z$/, 'Z');
      const result = parseRateLimitError(
        `API rate limit exceeded. rate limit will reset at ${formatted}`
      );
      expect(result).not.toBeNull();
      expect(result!.resetInSeconds).toBeGreaterThan(0);
      expect(result!.resetInSeconds).toBeLessThanOrEqual(3601);
    });

    it('handles "rate limit" in various forms', () => {
      const result = parseRateLimitError('You have exceeded a secondary rate limit');
      expect(result).not.toBeNull();
      expect(result!.isLimited).toBe(true);
    });

    it('provides a default reset time when not parseable', () => {
      const result = parseRateLimitError('API rate limit exceeded');
      expect(result).not.toBeNull();
      expect(result!.resetInSeconds).toBeGreaterThan(0);
    });

    it('sets isLimited and isLow to true', () => {
      const result = parseRateLimitError('API rate limit exceeded');
      expect(result!.isLimited).toBe(true);
      expect(result!.isLow).toBe(true);
    });
  });

  // ==========================================================================
  // GitHubRateLimitError
  // ==========================================================================

  describe('GitHubRateLimitError', () => {
    it('creates error with rateLimit info', () => {
      const rateLimit = {
        limit: 5000,
        remaining: 0,
        resetAt: Math.floor(Date.now() / 1000) + 3600,
        resetInSeconds: 3600,
        resetInHuman: '1h',
        isLimited: true,
        isLow: true,
        fetchedAt: new Date().toISOString(),
      };

      const error = new GitHubRateLimitError('Rate limit exceeded', rateLimit);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GitHubRateLimitError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.name).toBe('GitHubRateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.rateLimit.remaining).toBe(0);
      expect(error.rateLimit.resetInHuman).toBe('1h');
    });
  });

  // ==========================================================================
  // buildRateLimitMeta
  // ==========================================================================

  describe('buildRateLimitMeta', () => {
    it('returns cached status when no rate limit state', () => {
      const meta = buildRateLimitMeta(true);
      expect(meta.cached).toBe(true);
    });

    it('returns cached=false when not cached', () => {
      const meta = buildRateLimitMeta(false);
      expect(meta.cached).toBe(false);
    });

    it('includes rate limit info when state is known', () => {
      updateRateLimitState(4500, 5000, Math.floor(Date.now() / 1000) + 3600);
      const meta = buildRateLimitMeta(false);
      expect(meta.cached).toBe(false);
      expect(meta.rateLimit).toBeDefined();
      const rl = meta.rateLimit as any;
      expect(rl.remaining).toBe(4500);
      expect(rl.limit).toBe(5000);
    });
  });

  // ==========================================================================
  // updateRateLimitState / getRateLimitState
  // ==========================================================================

  describe('updateRateLimitState', () => {
    it('updates and retrieves state', () => {
      expect(getRateLimitState()).toBeNull();

      const resetAt = Math.floor(Date.now() / 1000) + 1800;
      updateRateLimitState(2500, 5000, resetAt); // 50% remaining — not low

      const state = getRateLimitState();
      expect(state).not.toBeNull();
      expect(state!.remaining).toBe(2500);
      expect(state!.limit).toBe(5000);
      expect(state!.isLimited).toBe(false);
      expect(state!.isLow).toBe(false);
    });

    it('detects low remaining quota', () => {
      const resetAt = Math.floor(Date.now() / 1000) + 1800;
      updateRateLimitState(400, 5000, resetAt); // 8% remaining
      const state = getRateLimitState();
      expect(state!.isLow).toBe(true);
    });

    it('detects rate limited state', () => {
      const resetAt = Math.floor(Date.now() / 1000) + 1800;
      updateRateLimitState(0, 5000, resetAt);
      const state = getRateLimitState();
      expect(state!.isLimited).toBe(true);
      expect(state!.isLow).toBe(true);
    });
  });

  // ==========================================================================
  // cachedGhExec
  // ==========================================================================

  describe('cachedGhExec', () => {
    it('returns data from gh CLI on cache miss', async () => {
      mockExecFile.mockResolvedValue({ stdout: JSON.stringify([{ name: 'repo1' }]) });

      const result = await cachedGhExec<{ name: string }[]>(
        ['repo', 'list'],
        'test:repos',
        60000
      );

      expect(result.data).toEqual([{ name: 'repo1' }]);
      expect(result.cached).toBe(false);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('returns cached data on cache hit', async () => {
      mockExecFile.mockResolvedValue({ stdout: JSON.stringify([{ name: 'repo1' }]) });

      // First call (populates cache)
      await cachedGhExec(['repo', 'list'], 'test:repos', 60000);

      // Second call (should use cache)
      mockExecFile.mockClear();
      const result = await cachedGhExec<{ name: string }[]>(
        ['repo', 'list'],
        'test:repos',
        60000
      );

      expect(result.data).toEqual([{ name: 'repo1' }]);
      expect(result.cached).toBe(true);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('handles empty stdout', async () => {
      mockExecFile.mockResolvedValue({ stdout: '  \n  ' });

      const result = await cachedGhExec<unknown[]>(
        ['repo', 'list'],
        'test:empty',
        60000
      );

      expect(result.data).toEqual([]);
      expect(result.cached).toBe(false);
    });

    it('throws GitHubRateLimitError when rate limited', async () => {
      mockExecFile.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        cachedGhExec(['repo', 'list'], 'test:limited', 60000)
      ).rejects.toThrow(GitHubRateLimitError);
    });

    it('throws GitHubRateLimitError if already known to be limited', async () => {
      // Set rate limit state to limited
      const resetAt = Math.floor(Date.now() / 1000) + 1800;
      updateRateLimitState(0, 5000, resetAt);

      await expect(
        cachedGhExec(['repo', 'list'], 'test:known-limited', 60000)
      ).rejects.toThrow(GitHubRateLimitError);

      // Should not have called gh CLI
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('re-throws non-rate-limit errors', async () => {
      mockExecFile.mockRejectedValue(new Error('network error'));

      await expect(
        cachedGhExec(['repo', 'list'], 'test:network', 60000)
      ).rejects.toThrow('network error');
    });
  });

  // ==========================================================================
  // Sync Queue / Throttling
  // ==========================================================================

  describe('Sync Queue', () => {
    it('tracks active state', () => {
      expect(isSyncActive()).toBe(false);
      setSyncQueueActive(true);
      expect(isSyncActive()).toBe(true);
      setSyncQueueActive(false);
      expect(isSyncActive()).toBe(false);
    });

    it('resets queue position', () => {
      resetSyncQueue();
      // No error means success
      expect(isSyncActive()).toBe(false);
    });

    it('throttledDelay resolves', async () => {
      resetSyncQueue();
      // First call should be instant
      const start = Date.now();
      await throttledDelay();
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100);
    });

    it('throttledDelay adds delay on subsequent calls', async () => {
      resetSyncQueue();
      await throttledDelay(); // position 1 - no delay
      const start = Date.now();
      await throttledDelay(); // position 2 - should delay
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(400); // ~500ms delay
    });
  });

  // ==========================================================================
  // __resetForTesting
  // ==========================================================================

  describe('__resetForTesting', () => {
    it('clears all module state', () => {
      updateRateLimitState(0, 5000, Math.floor(Date.now() / 1000) + 1800);
      setSyncQueueActive(true);

      __resetForTesting();

      expect(getRateLimitState()).toBeNull();
      expect(isSyncActive()).toBe(false);
    });
  });
});
