/**
 * Response Formatter for Public REST API v1
 *
 * Provides consistent response formatting with success/error envelopes
 * and pagination metadata.
 */

import type { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Send a success response with consistent formatting.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: ApiMeta): void {
  const response: ApiResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  res.status(statusCode).json(response);
}

/**
 * Send an error response with consistent formatting.
 */
export function sendError(
  res: Response,
  message: string,
  code: string,
  statusCode = 400,
  details?: unknown
): void {
  const response: ApiResponse<never> = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) {
    response.error!.details = details;
  }
  res.status(statusCode).json(response);
}
