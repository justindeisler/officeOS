/**
 * useReportData Hook
 *
 * Provides aggregated data for dashboard charts and reports.
 * Uses report-aggregation utilities to transform raw data into chart-ready formats.
 */

import { useMemo } from 'react'
import type {
  PLChartDataPoint,
  ProfitTrendDataPoint,
  ExpenseDonutDataPoint,
  CategoryAggregate,
  TaxForecast,
  YearComparison,
} from '../types/reports'
import {
  aggregateByMonth,
  aggregateByCategory,
  preparePLChartData,
  prepareProfitTrendData,
  prepareExpenseDonutData,
  calculateYoYComparison,
} from '../utils/report-aggregation'
import { calculateForecast, getCurrentQuarter } from '../utils/tax-forecast'
import { useIncome } from './useIncome'
import { useExpenses } from './useExpenses'

export interface UseReportDataOptions {
  /** Year to generate reports for */
  year: number
  /** Previous year for comparison */
  previousYear?: number
  /** Whether user has Dauerfrist extension */
  hasDauerfrist?: boolean
}

export interface UseReportDataReturn {
  /** Monthly P&L data for bar chart */
  plChartData: PLChartDataPoint[]
  /** Profit trend data for line chart */
  profitTrendData: ProfitTrendDataPoint[]
  /** Expense category data for donut chart */
  expenseDonutData: ExpenseDonutDataPoint[]
  /** Category breakdown */
  categoryBreakdown: CategoryAggregate[]
  /** Tax forecast for next quarter */
  taxForecast: TaxForecast | null
  /** Year-over-year comparisons */
  yearComparison: YearComparison[]
  /** Current year */
  currentYear: number
  /** Previous year */
  previousYear: number
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
}

/**
 * Hook to provide report data for dashboard charts
 */
export function useReportData(options: UseReportDataOptions): UseReportDataReturn {
  const {
    year,
    previousYear: prevYear = year - 1,
    hasDauerfrist = false,
  } = options

  // Fetch real data from hooks
  const { income, isLoading: incomeLoading, error: incomeError } = useIncome({ autoFetch: true })
  const { expenses, isLoading: expensesLoading, error: expensesError } = useExpenses({ autoFetch: true })

  // Combined loading and error states
  const isLoading = incomeLoading || expensesLoading
  const error = incomeError || expensesError

  // Filter income by current year
  const currentYearIncomes = useMemo(
    () => income.filter(i => i.date.getFullYear() === year),
    [income, year]
  )

  // Filter expenses by current year
  const currentYearExpenses = useMemo(
    () => expenses.filter(e => e.date.getFullYear() === year),
    [expenses, year]
  )

  // Filter income by previous year
  const previousYearIncomes = useMemo(
    () => income.filter(i => i.date.getFullYear() === prevYear),
    [income, prevYear]
  )

  // Filter expenses by previous year
  const previousYearExpenses = useMemo(
    () => expenses.filter(e => e.date.getFullYear() === prevYear),
    [expenses, prevYear]
  )

  // Aggregate monthly data
  const currentMonthly = useMemo(
    () => aggregateByMonth(currentYearIncomes, currentYearExpenses, year),
    [currentYearIncomes, currentYearExpenses, year]
  )

  const previousMonthly = useMemo(
    () => aggregateByMonth(previousYearIncomes, previousYearExpenses, prevYear),
    [previousYearIncomes, previousYearExpenses, prevYear]
  )

  // P&L Chart data
  const plChartData = useMemo(
    () => preparePLChartData(currentMonthly),
    [currentMonthly]
  )

  // Profit trend data
  const profitTrendData = useMemo(
    () => prepareProfitTrendData(currentMonthly),
    [currentMonthly]
  )

  // Category breakdown
  const categoryBreakdown = useMemo(
    () => aggregateByCategory(currentYearExpenses),
    [currentYearExpenses]
  )

  // Expense donut data
  const expenseDonutData = useMemo(
    () => prepareExpenseDonutData(categoryBreakdown),
    [categoryBreakdown]
  )

  // Tax forecast
  const taxForecast = useMemo(() => {
    const monthsWithData = currentMonthly.filter((m) => m.income > 0 || m.expenses > 0)

    // Return null if no data to forecast from
    if (monthsWithData.length === 0) {
      return null
    }

    const currentQuarter = getCurrentQuarter()
    const nextQuarter = currentQuarter === 4 ? 1 : (currentQuarter + 1) as 1 | 2 | 3 | 4
    const forecastYear = currentQuarter === 4 ? year + 1 : year

    return calculateForecast(
      monthsWithData,
      forecastYear,
      nextQuarter,
      hasDauerfrist
    )
  }, [currentMonthly, year, hasDauerfrist])

  // Year-over-year comparison
  const yearComparison = useMemo(() => {
    const currentTotals = {
      totalIncome: currentMonthly.reduce((sum, m) => sum + m.income, 0),
      totalExpenses: currentMonthly.reduce((sum, m) => sum + m.expenses, 0),
      profit: currentMonthly.reduce((sum, m) => sum + m.profit, 0),
    }

    const previousTotals = {
      totalIncome: previousMonthly.reduce((sum, m) => sum + m.income, 0),
      totalExpenses: previousMonthly.reduce((sum, m) => sum + m.expenses, 0),
      profit: previousMonthly.reduce((sum, m) => sum + m.profit, 0),
    }

    return calculateYoYComparison(currentTotals, previousTotals, year)
  }, [currentMonthly, previousMonthly, year])

  return {
    plChartData,
    profitTrendData,
    expenseDonutData,
    categoryBreakdown,
    taxForecast,
    yearComparison,
    currentYear: year,
    previousYear: prevYear,
    isLoading,
    error,
  }
}

export default useReportData
