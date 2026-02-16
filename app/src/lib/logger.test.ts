/**
 * Tests for the centralized logger utility.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module in isolation, so we use dynamic imports
// after mocking import.meta.env

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    trace: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logger module exports', () => {
    it('exports logger and createLogger', async () => {
      const mod = await import('./logger');
      expect(mod.logger).toBeDefined();
      expect(mod.createLogger).toBeDefined();
      expect(typeof mod.createLogger).toBe('function');
    });

    it('logger has standard log methods', async () => {
      const { logger } = await import('./logger');
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });
  });

  describe('createLogger', () => {
    it('creates a named child logger', async () => {
      const { createLogger } = await import('./logger');
      const log = createLogger('TestModule');
      expect(log).toBeDefined();
      expect(typeof log.info).toBe('function');
      expect(typeof log.error).toBe('function');
    });

    it('child logger prefixes messages with module name', async () => {
      const { createLogger } = await import('./logger');
      const log = createLogger('DB');
      log.setLevel('trace');
      log.warn('test message');

      expect(consoleSpy.warn).toHaveBeenCalled();
      const allArgs = consoleSpy.warn.mock.calls[0];
      const output = allArgs.join(' ');
      expect(output).toContain('[DB]');
      expect(output).toContain('test message');
    });
  });

  describe('sensitive data redaction', () => {
    it('redacts password patterns', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('trace');
      logger.warn('password=secret123');

      const args = consoleSpy.warn.mock.calls[0];
      const output = args.join(' ');
      expect(output).not.toContain('secret123');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts token patterns', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('trace');
      logger.warn('token: eyJhbGciOiJIUzI1NiJ9.payload.sig');

      const args = consoleSpy.warn.mock.calls[0];
      const output = args.join(' ');
      expect(output).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(output).toContain('[REDACTED]');
    });

    it('redacts api_key patterns', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('trace');
      logger.warn('api_key=sk-abc123def456'); // gitleaks:allow - mock key for redaction test

      const args = consoleSpy.warn.mock.calls[0];
      const output = args.join(' ');
      expect(output).not.toContain('sk-abc123def456'); // gitleaks:allow
      expect(output).toContain('[REDACTED]');
    });

    it('does not redact normal messages', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('trace');
      logger.warn('Database initialized successfully');

      const args = consoleSpy.warn.mock.calls[0];
      const output = args.join(' ');
      expect(output).toContain('Database initialized successfully');
      expect(output).not.toContain('[REDACTED]');
    });

    it('handles non-string arguments without error', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('trace');
      const obj = { key: 'value' };
      logger.warn('object:', obj);

      expect(consoleSpy.warn).toHaveBeenCalled();
      const args = consoleSpy.warn.mock.calls[0];
      // Non-string objects should pass through unchanged (somewhere in the args)
      expect(args).toContainEqual(obj);
      // String args should also be present
      expect(args.some((a: unknown) => typeof a === 'string' && a.includes('object:'))).toBe(true);
    });
  });

  describe('log levels', () => {
    it('setLevel controls which messages appear', async () => {
      const { logger } = await import('./logger');
      logger.setLevel('error');

      logger.debug('debug msg');
      logger.info('info msg');
      logger.warn('warn msg');
      logger.error('error msg');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      // info uses console.log internally in loglevel
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();

      // Reset for other tests
      logger.setLevel('trace');
    });
  });
});
