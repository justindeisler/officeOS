/**
 * GitHub Rate Limit Manager
 *
 * Tracks GitHub API rate limit state from gh CLI responses,
 * provides cached execution of gh CLI commands, and exposes
 * rate-limit metadata for API responses.
 *
 * The gh CLI uses the GitHub REST API under the hood. Rate limit
 * info is extracted by calling the /rate_limit endpoint or by
 * parsing error messages from gh CLI failures.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { cache, cacheKey, TTL } from "../cache.js";
import { createLogger } from "../logger.js";

const execFileAsync = promisify(execFile);
const log = createLogger("github-rate-limit");

// ============================================================================
// Types
// ============================================================================

export interface RateLimitInfo {
  /** Total requests allowed per window */
  limit: number;
  /** Requests remaining in current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  resetAt: number;
  /** Seconds until reset */
  resetInSeconds: number;
  /** Human-readable time until reset */
  resetInHuman: string;
  /** Whether we're currently rate-limited (remaining === 0) */
  isLimited: boolean;
  /** Whether we're approaching the limit (<10% remaining) */
  isLow: boolean;
  /** When this info was last fetched */
  fetchedAt: string;
}

export interface CachedGhResult<T = unknown> {
  data: T;
  cached: boolean;
  rateLimit?: Partial<RateLimitInfo>;
}

export interface GhExecOptions {
  timeout?: number;
  maxBuffer?: number;
}

// ============================================================================
// Rate Limit State (module-level singleton)
// ============================================================================

let _rateLimitState: RateLimitInfo | null = null;

const GH_EXEC_OPTS = {
  timeout: 30000,
  maxBuffer: 10 * 1024 * 1024,
  env: {
    ...process.env,
    HOME: "/home/jd-server-admin",
    PATH: process.env.PATH,
  },
};

// ============================================================================
// Rate Limit Detection
// ============================================================================

/**
 * Fetch current rate limit info from the GitHub API via gh CLI.
 * Result is cached for 60 seconds to avoid wasting a request.
 */
export async function fetchRateLimitInfo(): Promise<RateLimitInfo> {
  const ck = "github:rate-limit";
  const cached = cache.get<RateLimitInfo>(ck);
  if (cached) return cached;

  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["api", "rate_limit", "--jq", ".resources.core"],
      { ...GH_EXEC_OPTS, timeout: 10000 }
    );

    const raw = JSON.parse(stdout.trim());
    const now = Math.floor(Date.now() / 1000);
    const resetInSeconds = Math.max(0, (raw.reset || 0) - now);

    const info: RateLimitInfo = {
      limit: raw.limit ?? 0,
      remaining: raw.remaining ?? 0,
      resetAt: raw.reset ?? 0,
      resetInSeconds,
      resetInHuman: formatDuration(resetInSeconds),
      isLimited: (raw.remaining ?? 0) === 0,
      isLow: (raw.remaining ?? 0) < (raw.limit ?? 0) * 0.1,
      fetchedAt: new Date().toISOString(),
    };

    _rateLimitState = info;
    cache.set(ck, info, 60_000); // cache for 1 minute
    return info;
  } catch (error) {
    log.warn({ error }, "Failed to fetch rate limit info");
    // Return stale state if available
    if (_rateLimitState) return _rateLimitState;
    return makeUnknownRateLimitInfo();
  }
}

/**
 * Parse rate limit info from a gh CLI error message.
 * GitHub returns a specific error format when rate-limited:
 *   "API rate limit exceeded ... rate limit will reset at ..."
 */
export function parseRateLimitError(errorMessage: string): RateLimitInfo | null {
  // GitHub rate limit error patterns
  const rateLimitPattern = /API rate limit exceeded/i;
  const secondaryPattern = /rate limit/i;
  const resetPattern = /rate limit will reset.*?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[Z]?)/i;
  const resetEpochPattern = /x-ratelimit-reset:\s*(\d+)/i;

  if (!rateLimitPattern.test(errorMessage) && !secondaryPattern.test(errorMessage)) {
    return null;
  }

  let resetAt = 0;
  const resetMatch = errorMessage.match(resetPattern);
  if (resetMatch) {
    resetAt = Math.floor(new Date(resetMatch[1]).getTime() / 1000);
  }

  const epochMatch = errorMessage.match(resetEpochPattern);
  if (epochMatch) {
    resetAt = parseInt(epochMatch[1], 10);
  }

  const now = Math.floor(Date.now() / 1000);
  if (!resetAt) {
    // Default: assume ~1 hour reset
    resetAt = now + 3600;
  }

  const resetInSeconds = Math.max(0, resetAt - now);

  const info: RateLimitInfo = {
    limit: 5000,
    remaining: 0,
    resetAt,
    resetInSeconds,
    resetInHuman: formatDuration(resetInSeconds),
    isLimited: true,
    isLow: true,
    fetchedAt: new Date().toISOString(),
  };

  _rateLimitState = info;
  return info;
}

/**
 * Get the most recently known rate limit state (without making an API call).
 */
export function getRateLimitState(): RateLimitInfo | null {
  return _rateLimitState;
}

/**
 * Update rate limit state from observed data.
 * Called after successful API calls if we can extract headers.
 */
export function updateRateLimitState(remaining: number, limit: number, resetAt: number): void {
  const now = Math.floor(Date.now() / 1000);
  const resetInSeconds = Math.max(0, resetAt - now);

  _rateLimitState = {
    limit,
    remaining,
    resetAt,
    resetInSeconds,
    resetInHuman: formatDuration(resetInSeconds),
    isLimited: remaining === 0,
    isLow: remaining < limit * 0.1,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Cached gh CLI Execution
// ============================================================================

/**
 * Execute a gh CLI command with caching.
 * Returns cached result if available, otherwise runs the command
 * and caches the parsed output.
 *
 * @param args - Arguments to pass to `gh`
 * @param cacheKeyStr - Cache key for this request
 * @param ttlMs - TTL for the cache entry
 * @param opts - Optional execution options
 * @returns Parsed JSON output and cache metadata
 */
export async function cachedGhExec<T = unknown>(
  args: string[],
  cacheKeyStr: string,
  ttlMs: number,
  opts?: GhExecOptions
): Promise<CachedGhResult<T>> {
  // Check cache first
  const cachedData = cache.get<T>(cacheKeyStr);
  if (cachedData !== null) {
    return {
      data: cachedData,
      cached: true,
      rateLimit: _rateLimitState ? { remaining: _rateLimitState.remaining, limit: _rateLimitState.limit } : undefined,
    };
  }

  // Check if we're rate-limited before making the call
  if (_rateLimitState?.isLimited) {
    const now = Math.floor(Date.now() / 1000);
    const resetInSeconds = Math.max(0, _rateLimitState.resetAt - now);

    if (resetInSeconds > 0) {
      throw new GitHubRateLimitError(
        `GitHub API rate limit exceeded. Resets in ${formatDuration(resetInSeconds)}.`,
        {
          ..._rateLimitState,
          resetInSeconds,
          resetInHuman: formatDuration(resetInSeconds),
        }
      );
    } else {
      // Reset time has passed, clear the state
      _rateLimitState = null;
    }
  }

  // Execute gh CLI
  try {
    const execOpts = {
      ...GH_EXEC_OPTS,
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
      ...(opts?.maxBuffer ? { maxBuffer: opts.maxBuffer } : {}),
    };

    const { stdout } = await execFileAsync("gh", args, execOpts);

    if (!stdout.trim()) {
      const emptyResult = [] as unknown as T;
      cache.set(cacheKeyStr, emptyResult, ttlMs);
      return { data: emptyResult, cached: false, rateLimit: _rateLimitState ? { remaining: _rateLimitState.remaining, limit: _rateLimitState.limit } : undefined };
    }

    const data = JSON.parse(stdout) as T;
    cache.set(cacheKeyStr, data, ttlMs);

    return {
      data,
      cached: false,
      rateLimit: _rateLimitState ? { remaining: _rateLimitState.remaining, limit: _rateLimitState.limit } : undefined,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);

    // Check if this is a rate limit error
    const rateLimitInfo = parseRateLimitError(errMsg);
    if (rateLimitInfo) {
      throw new GitHubRateLimitError(
        `GitHub API rate limit exceeded. Resets in ${rateLimitInfo.resetInHuman}.`,
        rateLimitInfo
      );
    }

    // Re-throw other errors
    throw error;
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class GitHubRateLimitError extends Error {
  public readonly rateLimit: RateLimitInfo;
  public readonly statusCode = 429;

  constructor(message: string, rateLimit: RateLimitInfo) {
    super(message);
    this.name = "GitHubRateLimitError";
    this.rateLimit = rateLimit;
  }
}

// ============================================================================
// Sync Queue (simple delay-based throttling)
// ============================================================================

let _syncQueueActive = false;
let _syncQueuePosition = 0;

const DELAY_BETWEEN_REQUESTS_MS = 500; // 500ms between bulk API calls

/**
 * Delay execution for rate-limit-friendly bulk operations.
 * Each call increments a position counter and waits proportionally.
 */
export async function throttledDelay(): Promise<void> {
  _syncQueuePosition++;
  if (_syncQueuePosition > 1) {
    const delayMs = DELAY_BETWEEN_REQUESTS_MS;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

/**
 * Reset the sync queue position counter.
 * Call at the start of a bulk sync operation.
 */
export function resetSyncQueue(): void {
  _syncQueuePosition = 0;
  _syncQueueActive = false;
}

/**
 * Mark sync queue as active/inactive.
 */
export function setSyncQueueActive(active: boolean): void {
  _syncQueueActive = active;
  if (!active) _syncQueuePosition = 0;
}

/**
 * Check if a sync is currently in progress.
 */
export function isSyncActive(): boolean {
  return _syncQueueActive;
}

// ============================================================================
// Response Metadata Builder
// ============================================================================

/**
 * Build rate limit metadata to include in API responses.
 */
export function buildRateLimitMeta(cached: boolean): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    cached,
  };

  if (_rateLimitState) {
    meta.rateLimit = {
      remaining: _rateLimitState.remaining,
      limit: _rateLimitState.limit,
      resetInSeconds: _rateLimitState.resetInSeconds,
      isLow: _rateLimitState.isLow,
    };
  }

  return meta;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function makeUnknownRateLimitInfo(): RateLimitInfo {
  return {
    limit: 0,
    remaining: 0,
    resetAt: 0,
    resetInSeconds: 0,
    resetInHuman: "unknown",
    isLimited: false,
    isLow: false,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// For testing: allow resetting module state
// ============================================================================

export function __resetForTesting(): void {
  _rateLimitState = null;
  _syncQueuePosition = 0;
  _syncQueueActive = false;
}
