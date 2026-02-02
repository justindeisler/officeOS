/**
 * Web-based Income Service using REST API
 */

import { api } from "@/lib/api";
import type { Income } from "@/types";

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

class IncomeService {
  async getAll(filters?: { startDate?: string; endDate?: string; clientId?: string; ustPeriod?: string }): Promise<Income[]> {
    const snakeFilters = filters ? {
      start_date: filters.startDate,
      end_date: filters.endDate,
      client_id: filters.clientId,
      ust_period: filters.ustPeriod,
    } : undefined;
    const income = await api.getIncome(snakeFilters);
    return income.map(i => toCamelCase(i as Record<string, unknown>) as unknown as Income);
  }

  async getById(id: string): Promise<Income | null> {
    try {
      const income = await api.getIncomeById(id);
      return toCamelCase(income as Record<string, unknown>) as unknown as Income;
    } catch {
      return null;
    }
  }

  async create(item: Omit<Income, "id" | "createdAt" | "vatAmount" | "grossAmount">): Promise<Income> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const income = await api.createIncome(snakeItem);
    return toCamelCase(income as Record<string, unknown>) as unknown as Income;
  }

  async update(id: string, updates: Partial<Income>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateIncome(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteIncome(id);
  }

  async markReported(ids: string[], ustPeriod?: string): Promise<void> {
    await api.markIncomeReported(ids, ustPeriod);
  }
}

export const incomeService = new IncomeService();
