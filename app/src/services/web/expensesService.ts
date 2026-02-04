/**
 * Web-based Expenses Service using REST API
 */

import { api } from "@/lib/api";
import type { Expense, ExpenseCategory, NewExpense } from "@/features/accounting/types";

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
 * Convert API response to Expense type with proper types
 */
function toExpense(obj: Record<string, unknown>): Expense {
  const camelCase = toCamelCase(obj);
  return {
    id: String(camelCase.id ?? ''),
    date: new Date(camelCase.date as string),
    vendor: String(camelCase.vendor ?? ''),
    description: String(camelCase.description ?? ''),
    netAmount: Number(camelCase.netAmount) || 0,
    vatRate: (Number(camelCase.vatRate) || 0) as 0 | 7 | 19,
    vatAmount: Number(camelCase.vatAmount) || 0,
    grossAmount: Number(camelCase.grossAmount) || 0,
    euerLine: Number(camelCase.euerLine) || 34,
    euerCategory: String(camelCase.euerCategory ?? 'Sonstige Aufwendungen'),
    deductiblePercent: Number(camelCase.deductiblePercent) || 100,
    paymentMethod: camelCase.paymentMethod as Expense['paymentMethod'],
    receiptPath: camelCase.receiptPath as string | undefined,
    isRecurring: Boolean(camelCase.isRecurring),
    recurringFrequency: camelCase.recurringFrequency as Expense['recurringFrequency'],
    ustPeriod: camelCase.ustPeriod as string | undefined,
    vorsteuerClaimed: Boolean(camelCase.vorsteuerClaimed || camelCase.ustReported),
    isGwg: Boolean(camelCase.isGwg),
    assetId: camelCase.assetId as string | undefined,
    createdAt: new Date(camelCase.createdAt as string),
  };
}

class ExpensesService {
  async getAll(filters?: { startDate?: string; endDate?: string; category?: string; vendor?: string }): Promise<Expense[]> {
    const snakeFilters = filters ? {
      start_date: filters.startDate,
      end_date: filters.endDate,
      category: filters.category,
      vendor: filters.vendor,
    } : undefined;
    const expenses = await api.getExpenses(snakeFilters);
    return expenses.map(e => toExpense(e as Record<string, unknown>));
  }

  async getById(id: string): Promise<Expense | null> {
    try {
      const expense = await api.getExpenseById(id);
      return toExpense(expense as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async create(item: NewExpense): Promise<Expense> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const expense = await api.createExpense(snakeItem);
    return toExpense(expense as Record<string, unknown>);
  }

  async update(id: string, updates: Partial<NewExpense>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateExpense(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteExpense(id);
  }

  async getCategories(): Promise<ExpenseCategory[]> {
    const categories = await api.getExpenseCategories();
    return categories.map(c => toCamelCase(c as Record<string, unknown>) as unknown as ExpenseCategory);
  }

  async markReported(ids: string[], ustPeriod?: string): Promise<void> {
    await api.markExpensesReported(ids, ustPeriod);
  }
}

export const expensesService = new ExpensesService();
