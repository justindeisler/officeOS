/**
 * BWA (Betriebswirtschaftliche Auswertung) Calculation Service
 *
 * Generates monthly P&L reports by aggregating income and expenses
 * from the database. This is the most requested report format by
 * German tax advisors and business owners.
 *
 * Key design decisions:
 * - Aggregates from existing income/expenses tables (no separate storage)
 * - Excludes soft-deleted records
 * - Groups by category, VAT rate, and EÜR line
 * - Calculates VAT liability per month (output VAT - input VAT)
 */

import type Database from 'better-sqlite3';
import type { MonthlyAggregate, BWAReport } from '../types/reports.js';
import { EXPENSE_CATEGORY_MAP } from '../constants/expense-categories.js';

// ============================================================================
// Database Row Types
// ============================================================================

interface IncomeRow {
  date: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  euer_category: string | null;
  client_id: string | null;
}

interface ExpenseRow {
  date: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  category: string;
  euer_line: number;
  deductible_percent: number;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a full-year BWA report with 12 monthly aggregates.
 */
export function generateBWA(db: Database.Database, year: number): BWAReport {
  const months: MonthlyAggregate[] = [];

  for (let month = 1; month <= 12; month++) {
    months.push(generateMonthlyAggregate(db, year, month));
  }

  const totalIncome = months.reduce((sum, m) => sum + m.income.total, 0);
  const totalExpenses = months.reduce((sum, m) => sum + m.expenses.total, 0);
  const totalProfit = round(totalIncome - totalExpenses);

  return {
    year,
    months,
    totals: {
      income: round(totalIncome),
      expenses: round(totalExpenses),
      profit: totalProfit,
      profit_margin_percent: calculateProfitMargin(totalIncome, totalExpenses),
    },
  };
}

/**
 * Generate a single month's aggregate data.
 */
export function generateMonthlyAggregate(
  db: Database.Database,
  year: number,
  month: number
): MonthlyAggregate {
  const startDate = `${year}-${pad(month)}-01`;
  const endDate = getMonthEndDate(year, month);

  // Query income for the month
  const incomeRows = db.prepare(
    `SELECT date, net_amount, vat_rate, vat_amount, euer_category, client_id
     FROM income
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     ORDER BY date`
  ).all(startDate, endDate) as IncomeRow[];

  // Query expenses for the month
  const expenseRows = db.prepare(
    `SELECT date, net_amount, vat_rate, vat_amount, category, euer_line, deductible_percent
     FROM expenses
     WHERE date >= ? AND date <= ?
       AND (is_deleted IS NULL OR is_deleted = 0)
     ORDER BY date`
  ).all(startDate, endDate) as ExpenseRow[];

  // Aggregate income
  const incomeByCategory: Record<string, number> = {};
  const incomeByVatRate: Record<number, number> = {};
  let totalIncome = 0;
  let totalOutputVat = 0;

  for (const row of incomeRows) {
    const category = row.euer_category || 'uncategorized';
    incomeByCategory[category] = round((incomeByCategory[category] || 0) + row.net_amount);
    incomeByVatRate[row.vat_rate] = round((incomeByVatRate[row.vat_rate] || 0) + row.net_amount);
    totalIncome += row.net_amount;
    totalOutputVat += row.vat_amount;
  }

  // Aggregate expenses
  const expensesByCategory: Record<string, number> = {};
  const expensesByEuerLine: Record<number, number> = {};
  let totalExpenses = 0;
  let totalInputVat = 0;

  for (const row of expenseRows) {
    const deductibleFraction = (row.deductible_percent ?? 100) / 100;
    const deductibleAmount = round(row.net_amount * deductibleFraction);

    expensesByCategory[row.category] = round(
      (expensesByCategory[row.category] || 0) + deductibleAmount
    );
    expensesByEuerLine[row.euer_line] = round(
      (expensesByEuerLine[row.euer_line] || 0) + deductibleAmount
    );
    totalExpenses += deductibleAmount;

    // Input VAT: only for Vorsteuer-eligible categories
    const categoryInfo = EXPENSE_CATEGORY_MAP.get(row.category);
    if (!categoryInfo || categoryInfo.vorsteuer) {
      totalInputVat += row.vat_amount * deductibleFraction;
    }
  }

  totalIncome = round(totalIncome);
  totalExpenses = round(totalExpenses);
  const profit = round(totalIncome - totalExpenses);
  const vatLiability = round(totalOutputVat - totalInputVat);

  return {
    year,
    month,
    income: {
      total: totalIncome,
      by_category: incomeByCategory,
      by_vat_rate: incomeByVatRate,
    },
    expenses: {
      total: totalExpenses,
      by_category: expensesByCategory,
      by_euer_line: expensesByEuerLine,
    },
    profit,
    vat_liability: vatLiability,
  };
}

/**
 * Calculate profit margin as a percentage.
 * Returns 0 if income is 0 (avoid division by zero).
 */
export function calculateProfitMargin(income: number, expenses: number): number {
  if (income === 0) return 0;
  const profit = income - expenses;
  return round((profit / income) * 100);
}

// ============================================================================
// Helpers
// ============================================================================

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function getMonthEndDate(year: number, month: number): string {
  // Day 0 of next month = last day of current month
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad(month)}-${pad(lastDay)}`;
}
