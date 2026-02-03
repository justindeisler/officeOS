/**
 * useAccountingStats Hook
 *
 * Aggregates statistics from income, expenses, and invoices for dashboard display.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DashboardStats, Income, Expense, Invoice } from '../types'
import * as incomeApi from '../api/income'
import * as expensesApi from '../api/expenses'
import * as invoicesApi from '../api/invoices'

export interface UseAccountingStatsOptions {
  /** Year to calculate stats for */
  year?: number
  /** Quarter to calculate stats for (1-4) */
  quarter?: 1 | 2 | 3 | 4
  /** Auto-fetch on mount */
  autoFetch?: boolean
}

export interface UseAccountingStatsReturn {
  /** Dashboard statistics */
  stats: DashboardStats | null
  /** Loading state */
  isLoading: boolean
  /** Error message */
  error: string | null
  /** Refresh stats */
  refresh: () => Promise<void>
  /** Current year */
  year: number
  /** Current quarter */
  quarter: 1 | 2 | 3 | 4
  /** Set year filter */
  setYear: (year: number) => void
  /** Set quarter filter */
  setQuarter: (quarter: 1 | 2 | 3 | 4) => void
}

/**
 * Calculate current quarter from date
 */
function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth()
  if (month < 3) return 1
  if (month < 6) return 2
  if (month < 9) return 3
  return 4
}

/**
 * Hook to fetch and aggregate accounting statistics
 */
export function useAccountingStats(
  options: UseAccountingStatsOptions = {}
): UseAccountingStatsReturn {
  const {
    year: initialYear = new Date().getFullYear(),
    quarter: initialQuarter = getCurrentQuarter(),
    autoFetch = true,
  } = options

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(initialYear)
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(initialQuarter)

  /**
   * Calculate stats from raw data
   */
  const calculateStats = useCallback(
    (
      incomes: Income[],
      expenses: Expense[],
      invoices: Invoice[]
    ): DashboardStats => {
      // Filter by year
      const yearIncomes = incomes.filter(
        (i) => i.date.getFullYear() === year
      )
      const yearExpenses = expenses.filter(
        (e) => e.date.getFullYear() === year
      )

      // Calculate totals
      const totalIncome = yearIncomes.reduce(
        (sum, i) => sum + i.grossAmount,
        0
      )
      const totalExpenses = yearExpenses.reduce(
        (sum, e) => sum + e.grossAmount,
        0
      )
      const profit = totalIncome - totalExpenses

      // Pending invoices (sent but not paid)
      const pendingInvoices = invoices.filter(
        (inv) => inv.status === 'sent' || inv.status === 'overdue'
      )
      const pendingCount = pendingInvoices.length
      const pendingAmount = pendingInvoices.reduce(
        (sum, inv) => sum + inv.total,
        0
      )

      // Current quarter VAT calculation
      const quarterStart = new Date(year, (quarter - 1) * 3, 1)
      const quarterEnd = new Date(year, quarter * 3, 0)

      const quarterIncomes = yearIncomes.filter(
        (i) => i.date >= quarterStart && i.date <= quarterEnd
      )
      const currentQuarterVat = quarterIncomes.reduce(
        (sum, i) => sum + i.vatAmount,
        0
      )

      return {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        pendingInvoices: pendingCount,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        currentQuarterVat: Math.round(currentQuarterVat * 100) / 100,
      }
    },
    [year, quarter]
  )

  /**
   * Fetch and calculate stats
   */
  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch data from APIs in parallel
      const [incomes, expenses, invoices] = await Promise.all([
        incomeApi.getAllIncome(),
        expensesApi.getAllExpenses(),
        invoicesApi.getAllInvoices(),
      ])

      const calculatedStats = calculateStats(incomes, expenses, invoices)
      setStats(calculatedStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats')
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [calculateStats])

  /**
   * Refresh stats
   */
  const refresh = useCallback(async () => {
    await fetchStats()
  }, [fetchStats])

  // Auto-fetch on mount and when filters change
  useEffect(() => {
    if (autoFetch) {
      fetchStats()
    }
  }, [autoFetch, fetchStats])

  return {
    stats,
    isLoading,
    error,
    refresh,
    year,
    quarter,
    setYear,
    setQuarter,
  }
}

export default useAccountingStats
