/**
 * BWA & SuSa Reports API Client
 *
 * Frontend API methods for:
 * - BWA (Betriebswirtschaftliche Auswertung) — monthly P&L overview
 * - SuSa (Summen- und Saldenliste) — trial balance
 * - Profitability reports — by client and by category
 *
 * Uses REST API via the shared accountingClient (web mode).
 */

import { accountingClient } from '@/api'

// ============================================================================
// Types (matching backend api/src/types/reports.ts)
// ============================================================================

export interface MonthlyAggregate {
  year: number
  month: number
  income: {
    total: number
    by_category: Record<string, number>
    by_vat_rate: Record<number, number>
  }
  expenses: {
    total: number
    by_category: Record<string, number>
    by_euer_line: Record<number, number>
  }
  profit: number
  vat_liability: number
}

export interface BWAReport {
  year: number
  months: MonthlyAggregate[]
  totals: {
    income: number
    expenses: number
    profit: number
    profit_margin_percent: number
  }
}

export interface SuSaAccount {
  account_number: string
  account_name: string
  debit: number
  credit: number
  balance: number
}

export interface SuSaReport {
  year: number
  accounts: SuSaAccount[]
}

export interface ClientProfitability {
  client_id: string
  client_name: string
  income: number
  expenses: number
  profit: number
  profit_margin_percent: number
}

export interface ProfitabilityByClientReport {
  year: number
  clients: ClientProfitability[]
  unassigned: {
    income: number
    expenses: number
    profit: number
  }
}

export interface CategoryProfitabilityItem {
  category: string
  total: number
}

export interface ExpenseCategoryItem {
  category: string
  category_name: string
  total: number
}

export interface ProfitabilityByCategoryReport {
  year: number
  income_categories: CategoryProfitabilityItem[]
  expense_categories: ExpenseCategoryItem[]
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Get full-year BWA report (12 monthly aggregates).
 * GET /api/reports/bwa/:year
 */
export async function getBWA(year: number): Promise<BWAReport> {
  return accountingClient.get<BWAReport>(`/reports/bwa/${year}`)
}

/**
 * Get a single month BWA aggregate.
 * GET /api/reports/bwa/:year/:month
 */
export async function getMonthlyBWA(
  year: number,
  month: number
): Promise<MonthlyAggregate> {
  const response = await accountingClient.get<{
    year: number
    month: number
    aggregate: MonthlyAggregate
    totals: {
      income: number
      expenses: number
      profit: number
      profit_margin_percent: number
    }
  }>(`/reports/bwa/${year}/${month}`)
  return response.aggregate
}

/**
 * Get SuSa (Summen- und Saldenliste / trial balance) for a year.
 * GET /api/reports/susa/:year
 */
export async function getSuSa(year: number): Promise<SuSaReport> {
  return accountingClient.get<SuSaReport>(`/reports/susa/${year}`)
}

/**
 * Get profitability report grouped by client.
 * GET /api/reports/profitability/by-client/:year
 */
export async function getClientProfitability(
  year: number
): Promise<ProfitabilityByClientReport> {
  return accountingClient.get<ProfitabilityByClientReport>(
    `/reports/profitability/by-client/${year}`
  )
}

/**
 * Get profitability report grouped by category.
 * GET /api/reports/profitability/by-category/:year
 */
export async function getCategoryProfitability(
  year: number
): Promise<ProfitabilityByCategoryReport> {
  return accountingClient.get<ProfitabilityByCategoryReport>(
    `/reports/profitability/by-category/${year}`
  )
}
