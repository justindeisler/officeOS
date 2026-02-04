/**
 * Web-based Income Service using REST API
 */

import { api } from "@/lib/api";
import type { Income } from "@/features/accounting/types";

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
    // Handle Date objects - convert to ISO string date
    if (value instanceof Date) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value.toISOString().split('T')[0];
    } else {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Sanitize API response to Income type with proper types
 */
function sanitizeIncome(raw: Record<string, unknown>): Income {
  const camel = toCamelCase(raw);
  return {
    id: String(camel.id ?? ''),
    date: new Date(camel.date as string),
    clientId: camel.clientId as string | undefined,
    invoiceId: camel.invoiceId as string | undefined,
    description: String(camel.description ?? ''),
    netAmount: Number(camel.netAmount) || 0,
    vatRate: (Number(camel.vatRate) || 0) as 0 | 7 | 19,
    vatAmount: Number(camel.vatAmount) || 0,
    grossAmount: Number(camel.grossAmount) || 0,
    euerLine: Number(camel.euerLine) || 14,
    euerCategory: String(camel.euerCategory ?? 'Betriebseinnahmen'),
    paymentMethod: camel.paymentMethod as Income['paymentMethod'],
    bankReference: camel.bankReference as string | undefined,
    ustPeriod: camel.ustPeriod as string | undefined,
    ustReported: Boolean(camel.ustReported),
    createdAt: new Date(camel.createdAt as string),
  };
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
    return income.map(i => sanitizeIncome(i as Record<string, unknown>));
  }

  async getById(id: string): Promise<Income | null> {
    try {
      const income = await api.getIncomeById(id);
      return sanitizeIncome(income as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async create(item: Omit<Income, "id" | "createdAt" | "vatAmount" | "grossAmount">): Promise<Income> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const income = await api.createIncome(snakeItem);
    return sanitizeIncome(income as Record<string, unknown>);
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
