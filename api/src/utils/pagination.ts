/**
 * Pagination Helper for Public REST API v1
 *
 * Provides in-memory pagination with metadata for paginated list endpoints.
 */

export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Paginate an array of items.
 *
 * - `page` defaults to 1, min 1
 * - `limit` defaults to 20, min 1, max 100
 */
export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const rawPage = params.page !== undefined && params.page !== null ? Number(params.page) : NaN;
  const rawLimit = params.limit !== undefined && params.limit !== null ? Number(params.limit) : NaN;
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(100, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
  const offset = (page - 1) * limit;

  const paginatedItems = items.slice(offset, offset + limit);
  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    items: paginatedItems,
    meta: { page, limit, total, totalPages },
  };
}
