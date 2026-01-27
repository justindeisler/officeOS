/**
 * Dashboard Mock Factory
 *
 * Mock data generators for accounting dashboard and reports testing.
 */

import type { DashboardStats } from '@/features/accounting/types'

/**
 * Create a mock DashboardStats object
 */
export function createMockDashboardStats(
  overrides: Partial<DashboardStats> = {}
): DashboardStats {
  return {
    totalIncome: 15000,
    totalExpenses: 5000,
    profit: 10000,
    pendingInvoices: 3,
    pendingAmount: 4500,
    currentQuarterVat: 1900,
    ...overrides,
  }
}

/**
 * Create mock dashboard stats with no activity
 */
export function createEmptyDashboardStats(): DashboardStats {
  return {
    totalIncome: 0,
    totalExpenses: 0,
    profit: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    currentQuarterVat: 0,
  }
}

/**
 * Create mock dashboard stats with high activity
 */
export function createHighActivityDashboardStats(): DashboardStats {
  return {
    totalIncome: 150000,
    totalExpenses: 45000,
    profit: 105000,
    pendingInvoices: 12,
    pendingAmount: 35000,
    currentQuarterVat: 19500,
  }
}

/**
 * Create mock dashboard stats with loss
 */
export function createLossDashboardStats(): DashboardStats {
  return {
    totalIncome: 5000,
    totalExpenses: 8000,
    profit: -3000,
    pendingInvoices: 0,
    pendingAmount: 0,
    currentQuarterVat: 950,
  }
}

/**
 * Monthly report data structure
 */
export interface MonthlyReportData {
  month: string
  year: number
  income: number
  expenses: number
  profit: number
  vatCollected: number
  vatPaid: number
  netVat: number
}

/**
 * Create mock monthly report data
 */
export function createMockMonthlyReport(
  overrides: Partial<MonthlyReportData> = {}
): MonthlyReportData {
  return {
    month: 'January',
    year: 2024,
    income: 5000,
    expenses: 1500,
    profit: 3500,
    vatCollected: 950,
    vatPaid: 285,
    netVat: 665,
    ...overrides,
  }
}

/**
 * Create mock monthly reports for a full year
 */
export function createMockYearlyReports(year: number = 2024): MonthlyReportData[] {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return months.map((month, index) => ({
    month,
    year,
    income: 4000 + (index * 200),
    expenses: 1200 + (index * 50),
    profit: 2800 + (index * 150),
    vatCollected: 760 + (index * 38),
    vatPaid: 228 + (index * 9.5),
    netVat: 532 + (index * 28.5),
  }))
}

/**
 * Quarterly summary data
 */
export interface QuarterlySummary {
  quarter: 1 | 2 | 3 | 4
  year: number
  totalIncome: number
  totalExpenses: number
  profit: number
  ustVoranmeldung: number
  vorsteuer: number
  zahllast: number
}

/**
 * Create mock quarterly summary
 */
export function createMockQuarterlySummary(
  overrides: Partial<QuarterlySummary> = {}
): QuarterlySummary {
  return {
    quarter: 1,
    year: 2024,
    totalIncome: 15000,
    totalExpenses: 4500,
    profit: 10500,
    ustVoranmeldung: 2850,
    vorsteuer: 855,
    zahllast: 1995,
    ...overrides,
  }
}
