/**
 * Pagination Helper Tests
 */

import { describe, it, expect } from 'vitest';
import { paginate } from '../../../utils/pagination.js';

describe('paginate()', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('returns first page with default params', () => {
    const result = paginate(items, {});
    expect(result.items).toHaveLength(20);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(20);
    expect(result.meta.total).toBe(25);
    expect(result.meta.totalPages).toBe(2);
  });

  it('returns specified page and limit', () => {
    const result = paginate(items, { page: 2, limit: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.items[0].id).toBe(11);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.totalPages).toBe(3);
  });

  it('returns empty items for page beyond total', () => {
    const result = paginate(items, { page: 100, limit: 10 });
    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(25);
  });

  it('clamps limit to max 100', () => {
    const result = paginate(items, { limit: 500 });
    expect(result.meta.limit).toBe(100);
  });

  it('clamps limit to min 1', () => {
    const result = paginate(items, { limit: 0 });
    expect(result.meta.limit).toBe(1);
  });

  it('clamps page to min 1', () => {
    const result = paginate(items, { page: -5 });
    expect(result.meta.page).toBe(1);
  });

  it('handles string params (from query strings)', () => {
    const result = paginate(items, { page: '2' as any, limit: '5' as any });
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(5);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe(6);
  });

  it('handles empty array', () => {
    const result = paginate([], { page: 1, limit: 10 });
    expect(result.items).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(1);
  });

  it('returns last partial page correctly', () => {
    const result = paginate(items, { page: 3, limit: 10 });
    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe(21);
  });
});
