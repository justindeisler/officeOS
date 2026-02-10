/**
 * In-memory cache with TTL support
 *
 * Simple Map-based caching layer for API responses.
 * Designed to reduce database query load for frequently-accessed list endpoints.
 *
 * Features:
 * - Per-key TTL (time-to-live)
 * - Pattern-based invalidation (e.g., "tasks:*" clears all task caches)
 * - Hit/miss statistics tracking
 * - Environment-configurable (CACHE_ENABLED, CACHE_DEFAULT_TTL)
 * - Periodic cleanup of expired entries
 *
 * Cache key convention:
 *   {entity}:list:{param1}:{param2}:...
 *   e.g. tasks:list:freelance:backlog::10
 *
 * Can be upgraded to Redis later without changing the API surface.
 */

import { createLogger } from "./logger.js";

const log = createLogger("cache");

// ============================================================================
// Types
// ============================================================================

interface CacheEntry<T = unknown> {
  data: T;
  expires: number; // Unix timestamp in ms
  createdAt: number;
}

interface CacheStats {
  enabled: boolean;
  size: number;
  hits: number;
  misses: number;
  hitRate: string; // e.g. "72.5%"
  invalidations: number;
  keys: string[];
  defaultTtlMs: number;
  uptimeMs: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CACHE_ENABLED = process.env.CACHE_ENABLED !== "false"; // enabled by default
const DEFAULT_TTL_MS = parseInt(process.env.CACHE_DEFAULT_TTL || "300000", 10); // 5 minutes
const CLEANUP_INTERVAL_MS = 60_000; // Cleanup expired entries every 60s

// ============================================================================
// MemoryCache
// ============================================================================

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private invalidations = 0;
  private startedAt = Date.now();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start periodic cleanup of expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    // Don't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Get a cached value by key. Returns null if not found or expired.
   */
  get<T = unknown>(key: string): T | null {
    if (!CACHE_ENABLED) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Store a value in the cache with a TTL.
   */
  set<T = unknown>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    if (!CACHE_ENABLED) return;

    const now = Date.now();
    this.cache.set(key, {
      data,
      expires: now + ttlMs,
      createdAt: now,
    });
  }

  /**
   * Invalidate (delete) all cache keys matching a pattern.
   * Pattern uses simple prefix matching with "*" wildcard at the end.
   *
   * Examples:
   *   invalidate("tasks:*")    → clears all keys starting with "tasks:"
   *   invalidate("projects:*") → clears all keys starting with "projects:"
   *   invalidate("tasks:list:freelance:*") → clears a subset
   */
  invalidate(pattern: string): number {
    if (!CACHE_ENABLED) return 0;

    let count = 0;

    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
          count++;
        }
      }
    } else {
      // Exact match
      if (this.cache.delete(pattern)) {
        count = 1;
      }
    }

    if (count > 0) {
      this.invalidations += count;
      log.debug({ pattern, count }, "Cache invalidated");
    }

    return count;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (size > 0) {
      log.info({ cleared: size }, "Cache cleared");
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "0.0%";

    return {
      enabled: CACHE_ENABLED,
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      invalidations: this.invalidations,
      keys: Array.from(this.cache.keys()),
      defaultTtlMs: DEFAULT_TTL_MS,
      uptimeMs: Date.now() - this.startedAt,
    };
  }

  /**
   * Remove expired entries. Called periodically by the cleanup timer.
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug({ cleaned, remaining: this.cache.size }, "Cache cleanup");
    }
  }

  /**
   * Stop the cleanup timer (for graceful shutdown / tests).
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global cache instance */
export const cache = new MemoryCache();

// ============================================================================
// Cache Key Builders
// ============================================================================

/**
 * Build a cache key from parts. Empty/undefined values become empty strings.
 *
 * Example: cacheKey("tasks", "list", area, status) → "tasks:list:freelance:backlog"
 */
export function cacheKey(...parts: (string | number | undefined | null)[]): string {
  return parts.map((p) => (p != null ? String(p) : "")).join(":");
}

// ============================================================================
// TTL Constants (entity-specific)
// ============================================================================

export const TTL = {
  TASKS: 5 * 60 * 1000,       // 5 minutes
  PROJECTS: 5 * 60 * 1000,    // 5 minutes
  CLIENTS: 10 * 60 * 1000,    // 10 minutes
  EXPENSES: 5 * 60 * 1000,    // 5 minutes
  INCOME: 5 * 60 * 1000,      // 5 minutes
  DASHBOARD: 5 * 60 * 1000,   // 5 minutes
} as const;
