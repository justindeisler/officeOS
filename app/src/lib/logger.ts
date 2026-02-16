/**
 * Centralized logging utility for the officeOS app.
 *
 * Uses `loglevel` under the hood — a minimal, zero-dependency library
 * that mirrors the console API but adds configurable log levels.
 *
 * In production builds, debug and trace logs are silenced automatically.
 * Named child loggers can be created for specific modules via `logger.getLogger(name)`.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('[App] Starting...');
 *   logger.error('Something broke:', error);
 *
 *   // Scoped logger:
 *   import { createLogger } from '@/lib/logger';
 *   const log = createLogger('DB');
 *   log.info('Connected');      // → "[DB] Connected"
 *   log.debug('Query:', sql);   // silenced in production
 */

import log from 'loglevel';

// ── Configuration ─────────────────────────────────────────

const IS_PRODUCTION = import.meta.env.PROD;

// Set root level: production only shows warnings+errors;
// development shows everything.
log.setLevel(IS_PRODUCTION ? 'warn' : 'trace');

// ── Sensitive-data guard ──────────────────────────────────

/**
 * Patterns that should NEVER appear in log output, even in dev mode.
 * We redact them in the prefix plugin below.
 */
const SENSITIVE_PATTERNS = [
  /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
  /(?:token|jwt|bearer)\s*[:=]\s*\S+/gi,
  /(?:api[_-]?key|apikey|secret)\s*[:=]\s*\S+/gi,
  /(?:authorization)\s*[:=]\s*\S+/gi,
];

/**
 * Redact known sensitive patterns from a string.
 * Only applied to string arguments — objects are left to the caller
 * to sanitize before logging.
 */
function redact(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const eqIdx = match.search(/[:=]/);
      if (eqIdx === -1) return '[REDACTED]';
      return match.slice(0, eqIdx + 1) + ' [REDACTED]';
    });
  }
  return result;
}

// ── Custom prefix plugin ──────────────────────────────────

const originalFactory = log.methodFactory;

log.methodFactory = function (methodName, logLevel, loggerName) {
  const rawMethod = originalFactory(methodName, logLevel, loggerName);
  return function (...args: unknown[]) {
    const sanitized = args.map(redact);
    if (loggerName) {
      rawMethod(`[${String(loggerName)}]`, ...sanitized);
    } else {
      rawMethod(...sanitized);
    }
  };
};

// Apply the plugin
log.setLevel(log.getLevel());

// ── Public API ────────────────────────────────────────────

/**
 * Root logger instance. Use this for general-purpose logging.
 */
export const logger = log;

/**
 * Create a named child logger with its own level control.
 * The name is automatically prefixed to every message: `[name] ...`
 *
 * @example
 *   const log = createLogger('DB');
 *   log.info('Migrating...');  // → "[DB] Migrating..."
 */
export function createLogger(name: string): log.Logger {
  const child = log.getLogger(name);
  // Inherit the root level unless explicitly overridden
  child.setLevel(IS_PRODUCTION ? 'warn' : 'trace');

  // Apply the same prefix plugin to the child
  const childOriginalFactory = child.methodFactory;
  child.methodFactory = function (methodName, logLevel, loggerName) {
    const rawMethod = childOriginalFactory(methodName, logLevel, loggerName);
    return function (...args: unknown[]) {
      const sanitized = args.map(redact);
      if (loggerName) {
        rawMethod(`[${String(loggerName)}]`, ...sanitized);
      } else {
        rawMethod(...sanitized);
      }
    };
  };
  child.setLevel(child.getLevel());

  return child;
}

export default logger;
