/**
 * Structured logging with pino
 * 
 * Usage:
 *   import { logger } from './logger.js';
 *   logger.info('Server started');
 *   logger.info({ port: 3005 }, 'Server started on port');
 *   logger.error({ err }, 'Failed to process request');
 */

import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  } : undefined,
  // In production, output JSON for log aggregation
  ...(isDev ? {} : {
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  }),
});

// Child loggers for different modules
export const createLogger = (module: string) => logger.child({ module });
