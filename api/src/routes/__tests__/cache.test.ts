/**
 * Cache Module Tests
 *
 * Tests the in-memory cache: get/set, TTL expiration,
 * pattern invalidation, stats tracking, and cache key builder.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to test the MemoryCache class directly, but it's exported as a singleton.
// We'll test through the singleton + reset between tests.

// Mock environment before importing
vi.stubEnv("CACHE_ENABLED", "true");
vi.stubEnv("CACHE_DEFAULT_TTL", "300000");

import { cache, cacheKey, TTL } from "../../cache.js";

describe("Cache Module", () => {
  beforeEach(() => {
    cache.clear();
  });

  // ==========================================================================
  // cacheKey builder
  // ==========================================================================

  describe("cacheKey()", () => {
    it("joins parts with colons", () => {
      expect(cacheKey("tasks", "list", "freelance", "backlog")).toBe(
        "tasks:list:freelance:backlog"
      );
    });

    it("converts undefined/null to empty strings", () => {
      expect(cacheKey("tasks", "list", undefined, null, "10")).toBe(
        "tasks:list:::10"
      );
    });

    it("converts numbers to strings", () => {
      expect(cacheKey("tasks", "list", 42)).toBe("tasks:list:42");
    });
  });

  // ==========================================================================
  // TTL constants
  // ==========================================================================

  describe("TTL constants", () => {
    it("has expected TTL values", () => {
      expect(TTL.TASKS).toBe(300000);
      expect(TTL.PROJECTS).toBe(300000);
      expect(TTL.CLIENTS).toBe(600000);
      expect(TTL.EXPENSES).toBe(300000);
      expect(TTL.INCOME).toBe(300000);
      expect(TTL.DASHBOARD).toBe(300000);
    });
  });

  // ==========================================================================
  // get / set
  // ==========================================================================

  describe("get/set", () => {
    it("returns null for missing keys", () => {
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("stores and retrieves values", () => {
      cache.set("test:key", { hello: "world" });
      expect(cache.get("test:key")).toEqual({ hello: "world" });
    });

    it("stores arrays", () => {
      const data = [{ id: "1" }, { id: "2" }];
      cache.set("tasks:list", data);
      expect(cache.get("tasks:list")).toEqual(data);
    });

    it("stores primitive values", () => {
      cache.set("count", 42);
      expect(cache.get("count")).toBe(42);

      cache.set("flag", true);
      expect(cache.get("flag")).toBe(true);

      cache.set("name", "test");
      expect(cache.get("name")).toBe("test");
    });

    it("overwrites existing values", () => {
      cache.set("key", "first");
      cache.set("key", "second");
      expect(cache.get("key")).toBe("second");
    });
  });

  // ==========================================================================
  // TTL expiration
  // ==========================================================================

  describe("TTL expiration", () => {
    it("returns null for expired entries", async () => {
      // Set with 1ms TTL
      cache.set("short-lived", "data", 1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cache.get("short-lived")).toBeNull();
    });

    it("returns value within TTL window", () => {
      cache.set("long-lived", "data", 60000);
      expect(cache.get("long-lived")).toBe("data");
    });
  });

  // ==========================================================================
  // invalidate
  // ==========================================================================

  describe("invalidate()", () => {
    it("clears keys matching a wildcard pattern", () => {
      cache.set("tasks:list:a", "data1");
      cache.set("tasks:list:b", "data2");
      cache.set("projects:list", "data3");

      const count = cache.invalidate("tasks:*");

      expect(count).toBe(2);
      expect(cache.get("tasks:list:a")).toBeNull();
      expect(cache.get("tasks:list:b")).toBeNull();
      expect(cache.get("projects:list")).toBe("data3");
    });

    it("clears exact key match", () => {
      cache.set("tasks:list:a", "data1");
      cache.set("tasks:list:b", "data2");

      const count = cache.invalidate("tasks:list:a");

      expect(count).toBe(1);
      expect(cache.get("tasks:list:a")).toBeNull();
      expect(cache.get("tasks:list:b")).toBe("data2");
    });

    it("returns 0 when no keys match", () => {
      cache.set("tasks:list", "data");
      const count = cache.invalidate("nonexistent:*");
      expect(count).toBe(0);
    });

    it("handles empty cache gracefully", () => {
      const count = cache.invalidate("anything:*");
      expect(count).toBe(0);
    });

    it("supports narrow prefix patterns", () => {
      cache.set("tasks:list:freelance:backlog", "a");
      cache.set("tasks:list:freelance:done", "b");
      cache.set("tasks:list:personal:backlog", "c");

      const count = cache.invalidate("tasks:list:freelance:*");

      expect(count).toBe(2);
      expect(cache.get("tasks:list:freelance:backlog")).toBeNull();
      expect(cache.get("tasks:list:freelance:done")).toBeNull();
      expect(cache.get("tasks:list:personal:backlog")).toBe("c");
    });
  });

  // ==========================================================================
  // clear
  // ==========================================================================

  describe("clear()", () => {
    it("removes all entries", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      cache.clear();

      expect(cache.get("a")).toBeNull();
      expect(cache.get("b")).toBeNull();
      expect(cache.get("c")).toBeNull();
    });

    it("handles empty cache", () => {
      cache.clear(); // should not throw
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe("getStats()", () => {
    it("tracks size correctly", () => {
      cache.set("a", 1);
      cache.set("b", 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.enabled).toBe(true);
    });

    it("tracks hits and misses", () => {
      cache.set("exists", "data");

      cache.get("exists"); // hit
      cache.get("exists"); // hit
      cache.get("missing"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThanOrEqual(2);
      expect(stats.misses).toBeGreaterThanOrEqual(1);
    });

    it("calculates hit rate", () => {
      // Start fresh - clear and note current stats won't reset hit/miss counters
      // but the hit rate formula is consistent
      const stats = cache.getStats();
      expect(stats.hitRate).toMatch(/^\d+\.\d+%$/);
    });

    it("tracks invalidations", () => {
      cache.set("tasks:a", 1);
      cache.set("tasks:b", 2);
      cache.invalidate("tasks:*");

      const stats = cache.getStats();
      expect(stats.invalidations).toBeGreaterThanOrEqual(2);
    });

    it("lists current keys", () => {
      cache.set("alpha", 1);
      cache.set("beta", 2);

      const stats = cache.getStats();
      expect(stats.keys).toContain("alpha");
      expect(stats.keys).toContain("beta");
    });

    it("includes uptime", () => {
      const stats = cache.getStats();
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it("includes config values", () => {
      const stats = cache.getStats();
      expect(stats.defaultTtlMs).toBe(300000);
    });
  });
});

// ==========================================================================
// Cache integration patterns (simulates route usage)
// ==========================================================================

describe("Cache integration patterns", () => {
  beforeEach(() => {
    cache.clear();
  });

  it("simulates task list caching flow", () => {
    const key = cacheKey("tasks", "list", "freelance", "backlog", "", "10");

    // First request: cache miss → query DB → cache result
    expect(cache.get(key)).toBeNull();
    const dbResult = [{ id: "1", title: "Task 1" }];
    cache.set(key, dbResult, TTL.TASKS);

    // Second request: cache hit
    expect(cache.get(key)).toEqual(dbResult);

    // After mutation: invalidate → next request misses
    cache.invalidate("tasks:*");
    expect(cache.get(key)).toBeNull();
  });

  it("simulates cross-entity independence", () => {
    cache.set("tasks:list", [{ id: "t1" }], TTL.TASKS);
    cache.set("projects:list", [{ id: "p1" }], TTL.PROJECTS);
    cache.set("clients:list", [{ id: "c1" }], TTL.CLIENTS);

    // Invalidate tasks only
    cache.invalidate("tasks:*");

    expect(cache.get("tasks:list")).toBeNull();
    expect(cache.get("projects:list")).toEqual([{ id: "p1" }]);
    expect(cache.get("clients:list")).toEqual([{ id: "c1" }]);
  });

  it("handles different query parameter combinations", () => {
    const key1 = cacheKey("tasks", "list", "freelance", "backlog", "", "");
    const key2 = cacheKey("tasks", "list", "personal", "", "", "5");
    const key3 = cacheKey("tasks", "list", "", "", "", "");

    cache.set(key1, ["result1"], TTL.TASKS);
    cache.set(key2, ["result2"], TTL.TASKS);
    cache.set(key3, ["result3"], TTL.TASKS);

    expect(cache.get(key1)).toEqual(["result1"]);
    expect(cache.get(key2)).toEqual(["result2"]);
    expect(cache.get(key3)).toEqual(["result3"]);

    // All are different keys
    expect(key1).not.toBe(key2);
    expect(key2).not.toBe(key3);
  });
});
