/**
 * Report Aggregation Utilities
 *
 * Functions for aggregating financial data for reporting and visualization.
 * Supports monthly, quarterly, and categorical aggregations for German freelancer accounting.
 */

import type { Income, Expense } from '../types'
import type {
  MonthlyAggregate,
  QuarterlyAggregate,
  CategoryAggregate,
  VendorAggregate,
  YearComparison,
  TrendDirection,
  PLChartDataPoint,
  ProfitTrendDataPoint,
  ExpenseDonutDataPoint,
  ENGLISH_MONTHS,
  GERMAN_MONTHS,
  CHART_COLORS,
} from '../types/reports'
import { EXPENSE_CATEGORIES } from '../types'

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

/**
 * Aggregate income and expenses by month for a given year
 * Returns 12 months with totals for income, expenses, profit, and VAT
 */
export function aggregateByMonth(
  incomes: Income[],
  expenses: Expense[],
  year: number
): MonthlyAggregate[] {
  // Initialize all 12 months
  const monthlyData: MonthlyAggregate[] = Array.from({ length: 12 }, (_, index) => ({
    year,
    month: index + 1,
    income: 0,
    expenses: 0,
    profit: 0,
    vatCollected: 0,
    vatPaid: 0,
    transactionCount: 0,
  }))

  // Aggregate incomes
  incomes
    .filter((inc) => inc.date.getFullYear() === year)
    .forEach((inc) => {
      const month = inc.date.getMonth() // 0-indexed
      monthlyData[month].income += inc.netAmount
      monthlyData[month].vatCollected += inc.vatAmount
      monthlyData[month].transactionCount += 1
    })

  // Aggregate expenses
  expenses
    .filter((exp) => exp.date.getFullYear() === year)
    .forEach((exp) => {
      const month = exp.date.getMonth() // 0-indexed
      monthlyData[month].expenses += exp.netAmount
      monthlyData[month].vatPaid += exp.vatAmount
      monthlyData[month].transactionCount += 1
    })

  // Calculate profit for each month
  monthlyData.forEach((m) => {
    m.profit = m.income - m.expenses
  })

  return monthlyData
}

// ============================================================================
// QUARTERLY AGGREGATION
// ============================================================================

/**
 * Aggregate monthly data into quarterly summaries
 */
export function aggregateByQuarter(monthly: MonthlyAggregate[]): QuarterlyAggregate[] {
  if (monthly.length === 0) return []

  const year = monthly[0]?.year ?? new Date().getFullYear()

  // Group months into quarters
  const quarters: QuarterlyAggregate[] = [1, 2, 3, 4].map((quarter) => {
    const startMonth = (quarter - 1) * 3 + 1 // 1, 4, 7, 10
    const quarterMonths = monthly.filter(
      (m) => m.month >= startMonth && m.month < startMonth + 3
    )

    const income = sumByField(quarterMonths, 'income')
    const expenses = sumByField(quarterMonths, 'expenses')
    const vatCollected = sumByField(quarterMonths, 'vatCollected')
    const vatPaid = sumByField(quarterMonths, 'vatPaid')

    return {
      year,
      quarter: quarter as 1 | 2 | 3 | 4,
      income,
      expenses,
      profit: income - expenses,
      vatCollected,
      vatPaid,
      netVat: vatCollected - vatPaid,
      transactionCount: sumByField(quarterMonths, 'transactionCount'),
    }
  })

  return quarters
}

/**
 * Calculate totals from monthly data (for a quarter or any period)
 */
export function calculateQuarterlyTotals(monthly: MonthlyAggregate[]): {
  income: number
  expenses: number
  profit: number
  vatCollected: number
  vatPaid: number
  netVat: number
} {
  const income = sumByField(monthly, 'income')
  const expenses = sumByField(monthly, 'expenses')
  const vatCollected = sumByField(monthly, 'vatCollected')
  const vatPaid = sumByField(monthly, 'vatPaid')

  return {
    income,
    expenses,
    profit: income - expenses,
    vatCollected,
    vatPaid,
    netVat: vatCollected - vatPaid,
  }
}

// ============================================================================
// CATEGORY AGGREGATION
// ============================================================================

/**
 * Aggregate expenses by EÜR category
 * Returns categories sorted by amount (descending)
 */
export function aggregateByCategory(expenses: Expense[]): CategoryAggregate[] {
  if (expenses.length === 0) return []

  const grouped = groupByCategory(expenses)
  const totalExpenses = sumByField(expenses, 'netAmount')

  const categories: CategoryAggregate[] = Object.entries(grouped).map(
    ([category, categoryExpenses]) => {
      const amount = sumByField(categoryExpenses, 'netAmount')
      const count = categoryExpenses.length

      // Get label from EXPENSE_CATEGORIES or use category name
      const categoryConfig = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES]
      const label = categoryConfig?.label ?? category

      return {
        category,
        label,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        transactionCount: count,
        averageTransaction: count > 0 ? amount / count : 0,
      }
    }
  )

  // Sort by amount descending
  return categories.sort((a, b) => b.amount - a.amount)
}

/**
 * Aggregate expenses by vendor
 * Returns top N vendors sorted by amount (descending)
 */
export function aggregateByVendor(expenses: Expense[], limit?: number): VendorAggregate[] {
  if (expenses.length === 0) return []

  const grouped: Record<string, Expense[]> = {}
  expenses.forEach((exp) => {
    const vendor = exp.vendor
    if (!grouped[vendor]) grouped[vendor] = []
    grouped[vendor].push(exp)
  })

  const totalExpenses = sumByField(expenses, 'netAmount')

  const vendors: VendorAggregate[] = Object.entries(grouped).map(
    ([vendor, vendorExpenses]) => {
      const amount = sumByField(vendorExpenses, 'netAmount')

      return {
        vendor,
        amount,
        transactionCount: vendorExpenses.length,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }
    }
  )

  // Sort by amount descending
  const sorted = vendors.sort((a, b) => b.amount - a.amount)

  // Apply limit if specified
  return limit ? sorted.slice(0, limit) : sorted
}

// ============================================================================
// YEAR-OVER-YEAR COMPARISON
// ============================================================================

interface YearTotals {
  totalIncome: number
  totalExpenses: number
  profit: number
}

/**
 * Calculate year-over-year comparison metrics
 */
export function calculateYoYComparison(
  currentYear: YearTotals,
  previousYear: YearTotals,
  year: number
): YearComparison[] {
  const comparisons: YearComparison[] = []

  // Income comparison
  comparisons.push(createComparison(
    'totalIncome',
    'Total Income',
    currentYear.totalIncome,
    previousYear.totalIncome,
    'currency'
  ))

  // Expenses comparison
  comparisons.push(createComparison(
    'totalExpenses',
    'Total Expenses',
    currentYear.totalExpenses,
    previousYear.totalExpenses,
    'currency'
  ))

  // Profit comparison
  comparisons.push(createComparison(
    'profit',
    'Net Profit',
    currentYear.profit,
    previousYear.profit,
    'currency'
  ))

  // Profit margin comparison (if income > 0)
  if (currentYear.totalIncome > 0 || previousYear.totalIncome > 0) {
    const currentMargin = currentYear.totalIncome > 0
      ? (currentYear.profit / currentYear.totalIncome) * 100
      : 0
    const previousMargin = previousYear.totalIncome > 0
      ? (previousYear.profit / previousYear.totalIncome) * 100
      : 0

    comparisons.push(createComparison(
      'profitMargin',
      'Profit Margin',
      currentMargin,
      previousMargin,
      'percent'
    ))
  }

  return comparisons
}

function createComparison(
  metric: string,
  label: string,
  current: number,
  previous: number,
  format: 'currency' | 'percent' | 'number'
): YearComparison {
  const change = current - previous
  const changePercent = calculatePercentageChange(current, previous)

  return {
    metric,
    label,
    currentYear: current,
    previousYear: previous,
    change,
    changePercent,
    trend: getTrendDirection(change),
    format,
  }
}

// ============================================================================
// CHART DATA PREPARATION
// ============================================================================

/**
 * Prepare monthly aggregate data for P&L bar chart
 */
export function preparePLChartData(monthly: MonthlyAggregate[]): PLChartDataPoint[] {
  return monthly.map((m) => ({
    month: getMonthName(m.month),
    monthIndex: m.month,
    income: m.income,
    expenses: m.expenses,
    profit: m.profit,
  }))
}

/**
 * Prepare monthly aggregate data for profit trend line chart
 * Includes cumulative profit calculation
 */
export function prepareProfitTrendData(monthly: MonthlyAggregate[]): ProfitTrendDataPoint[] {
  let cumulativeProfit = 0

  return monthly.map((m) => {
    cumulativeProfit += m.profit

    return {
      month: getMonthName(m.month),
      monthIndex: m.month,
      profit: m.profit,
      cumulativeProfit,
    }
  })
}

/**
 * Prepare category aggregate data for expense donut chart
 */
export function prepareExpenseDonutData(categories: CategoryAggregate[]): ExpenseDonutDataPoint[] {
  const colors = [
    'hsl(222.2, 47.4%, 11.2%)', // primary
    'hsl(142, 76%, 36%)', // success
    'hsl(38, 92%, 50%)', // warning
    'hsl(199, 89%, 48%)', // info
    'hsl(0, 84.2%, 60.2%)', // destructive
    'hsl(280, 65%, 60%)', // purple
    'hsl(180, 60%, 45%)', // teal
    'hsl(30, 80%, 55%)', // orange
  ]

  return categories.map((cat, index) => ({
    name: cat.label,
    value: cat.amount,
    percentage: cat.percentage,
    color: colors[index % colors.length],
  }))
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const ENGLISH_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const GERMAN_MONTH_NAMES = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

/**
 * Get month name by number (1-12)
 */
export function getMonthName(month: number, locale: 'en' | 'de' = 'en'): string {
  // Clamp month to valid range
  const validMonth = Math.max(1, Math.min(12, month))
  const index = validMonth - 1

  return locale === 'de' ? GERMAN_MONTH_NAMES[index] : ENGLISH_MONTH_NAMES[index]
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100 // New value from nothing = 100% growth

  return ((current - previous) / previous) * 100
}

/**
 * Get trend direction based on change value
 */
export function getTrendDirection(change: number): TrendDirection {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'neutral'
}

/**
 * Sum a numeric field across an array of objects
 */
export function sumByField<T extends Record<string, unknown>>(
  items: T[],
  field: keyof T
): number {
  return items.reduce((sum, item) => {
    const value = item[field]
    return sum + (typeof value === 'number' ? value : 0)
  }, 0)
}

/**
 * Group items by month (returns object with month number as key)
 */
export function groupByMonth<T extends { date: Date }>(
  items: T[],
  year: number
): Record<number, T[]> {
  const grouped: Record<number, T[]> = {}

  items
    .filter((item) => item.date.getFullYear() === year)
    .forEach((item) => {
      const month = item.date.getMonth() + 1 // 1-indexed
      if (!grouped[month]) grouped[month] = []
      grouped[month].push(item)
    })

  return grouped
}

/**
 * Group expenses by category
 */
export function groupByCategory(expenses: Expense[]): Record<string, Expense[]> {
  const grouped: Record<string, Expense[]> = {}

  expenses.forEach((exp) => {
    const category = exp.euerCategory
    if (!grouped[category]) grouped[category] = []
    grouped[category].push(exp)
  })

  return grouped
}
