/**
 * Report Aggregation Tests
 *
 * Comprehensive tests for financial data aggregation functions.
 * Target: 40+ tests with 100% coverage of aggregation logic.
 */

import { describe, it, expect } from 'vitest'
import type { Income, Expense } from '../types'
import type {
  MonthlyAggregate,
  QuarterlyAggregate,
  CategoryAggregate,
  VendorAggregate,
  YearComparison,
  PLChartDataPoint,
  ProfitTrendDataPoint,
  ExpenseDonutDataPoint,
} from '../types/reports'
import {
  aggregateByMonth,
  aggregateByQuarter,
  aggregateByCategory,
  aggregateByVendor,
  calculateYoYComparison,
  calculateQuarterlyTotals,
  preparePLChartData,
  prepareProfitTrendData,
  prepareExpenseDonutData,
  getMonthName,
  calculatePercentageChange,
  getTrendDirection,
  sumByField,
  groupByMonth,
  groupByCategory,
} from './report-aggregation'

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockIncome = (overrides: Partial<Income> = {}): Income => ({
  id: 'inc-1',
  date: new Date('2024-03-15'),
  clientId: 'client-1',
  description: 'Consulting services',
  netAmount: 1000,
  vatRate: 19,
  vatAmount: 190,
  grossAmount: 1190,
  euerLine: 14,
  euerCategory: 'services',
  ustReported: false,
  createdAt: new Date(),
  ...overrides,
})

const createMockExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'exp-1',
  date: new Date('2024-03-10'),
  vendor: 'Adobe',
  description: 'Software subscription',
  netAmount: 50,
  vatRate: 19,
  vatAmount: 9.5,
  grossAmount: 59.5,
  euerLine: 34,
  euerCategory: 'software',
  deductiblePercent: 100,
  isRecurring: true,
  vorsteuerClaimed: false,
  isGwg: false,
  createdAt: new Date(),
  ...overrides,
})

/** Create a set of incomes across different months */
const createYearlyIncomes = (year: number): Income[] => {
  return [
    createMockIncome({ id: 'inc-jan', date: new Date(year, 0, 15), netAmount: 5000, vatAmount: 950 }),
    createMockIncome({ id: 'inc-feb', date: new Date(year, 1, 15), netAmount: 4500, vatAmount: 855 }),
    createMockIncome({ id: 'inc-mar', date: new Date(year, 2, 15), netAmount: 6000, vatAmount: 1140 }),
    createMockIncome({ id: 'inc-apr', date: new Date(year, 3, 15), netAmount: 5500, vatAmount: 1045 }),
    createMockIncome({ id: 'inc-may', date: new Date(year, 4, 15), netAmount: 4800, vatAmount: 912 }),
    createMockIncome({ id: 'inc-jun', date: new Date(year, 5, 15), netAmount: 7000, vatAmount: 1330 }),
    createMockIncome({ id: 'inc-jul', date: new Date(year, 6, 15), netAmount: 3000, vatAmount: 570 }),
    createMockIncome({ id: 'inc-aug', date: new Date(year, 7, 15), netAmount: 4000, vatAmount: 760 }),
    createMockIncome({ id: 'inc-sep', date: new Date(year, 8, 15), netAmount: 5500, vatAmount: 1045 }),
    createMockIncome({ id: 'inc-oct', date: new Date(year, 9, 15), netAmount: 6500, vatAmount: 1235 }),
    createMockIncome({ id: 'inc-nov', date: new Date(year, 10, 15), netAmount: 5800, vatAmount: 1102 }),
    createMockIncome({ id: 'inc-dec', date: new Date(year, 11, 15), netAmount: 8000, vatAmount: 1520 }),
  ]
}

/** Create a set of expenses across different months and categories */
const createYearlyExpenses = (year: number): Expense[] => {
  return [
    createMockExpense({ id: 'exp-jan-1', date: new Date(year, 0, 5), netAmount: 500, vatAmount: 95, euerCategory: 'software' }),
    createMockExpense({ id: 'exp-jan-2', date: new Date(year, 0, 20), netAmount: 200, vatAmount: 38, euerCategory: 'hosting' }),
    createMockExpense({ id: 'exp-feb', date: new Date(year, 1, 10), netAmount: 800, vatAmount: 152, euerCategory: 'software', vendor: 'AWS' }),
    createMockExpense({ id: 'exp-mar', date: new Date(year, 2, 15), netAmount: 1500, vatAmount: 285, euerCategory: 'travel' }),
    createMockExpense({ id: 'exp-apr', date: new Date(year, 3, 10), netAmount: 300, vatAmount: 57, euerCategory: 'office_supplies' }),
    createMockExpense({ id: 'exp-may', date: new Date(year, 4, 5), netAmount: 100, vatAmount: 19, euerCategory: 'telecom' }),
    createMockExpense({ id: 'exp-jun', date: new Date(year, 5, 20), netAmount: 2000, vatAmount: 380, euerCategory: 'software', vendor: 'Microsoft' }),
    createMockExpense({ id: 'exp-jul', date: new Date(year, 6, 10), netAmount: 150, vatAmount: 28.5, euerCategory: 'books', vatRate: 7 }),
    createMockExpense({ id: 'exp-aug', date: new Date(year, 7, 15), netAmount: 400, vatAmount: 76, euerCategory: 'hosting' }),
    createMockExpense({ id: 'exp-sep', date: new Date(year, 8, 5), netAmount: 600, vatAmount: 114, euerCategory: 'training' }),
    createMockExpense({ id: 'exp-oct', date: new Date(year, 9, 20), netAmount: 250, vatAmount: 47.5, euerCategory: 'insurance', vatRate: 0 }),
    createMockExpense({ id: 'exp-nov', date: new Date(year, 10, 10), netAmount: 350, vatAmount: 66.5, euerCategory: 'software' }),
    createMockExpense({ id: 'exp-dec', date: new Date(year, 11, 5), netAmount: 900, vatAmount: 171, euerCategory: 'software', vendor: 'Adobe' }),
  ]
}

// ============================================================================
// AGGREGATE BY MONTH TESTS
// ============================================================================

describe('aggregateByMonth', () => {
  it('should aggregate income and expenses by month', () => {
    const incomes = [
      createMockIncome({ date: new Date(2024, 0, 15), netAmount: 5000, vatAmount: 950 }),
      createMockIncome({ date: new Date(2024, 0, 25), netAmount: 3000, vatAmount: 570 }),
    ]
    const expenses = [
      createMockExpense({ date: new Date(2024, 0, 10), netAmount: 500, vatAmount: 95 }),
    ]

    const result = aggregateByMonth(incomes, expenses, 2024)
    const january = result.find((m) => m.month === 1)

    expect(january).toBeDefined()
    expect(january?.income).toBe(8000)
    expect(january?.expenses).toBe(500)
    expect(january?.profit).toBe(7500)
    expect(january?.vatCollected).toBe(1520)
    expect(january?.vatPaid).toBe(95)
  })

  it('should return 12 months for a full year', () => {
    const result = aggregateByMonth([], [], 2024)
    expect(result).toHaveLength(12)
  })

  it('should handle empty arrays', () => {
    const result = aggregateByMonth([], [], 2024)
    const january = result.find((m) => m.month === 1)

    expect(january?.income).toBe(0)
    expect(january?.expenses).toBe(0)
    expect(january?.profit).toBe(0)
  })

  it('should correctly calculate transaction count', () => {
    const incomes = createYearlyIncomes(2024)
    const expenses = createYearlyExpenses(2024)

    const result = aggregateByMonth(incomes, expenses, 2024)
    const january = result.find((m) => m.month === 1)

    // 1 income + 2 expenses in January
    expect(january?.transactionCount).toBe(3)
  })

  it('should handle multiple incomes in same month', () => {
    const incomes = [
      createMockIncome({ date: new Date(2024, 2, 5), netAmount: 1000 }),
      createMockIncome({ date: new Date(2024, 2, 15), netAmount: 2000 }),
      createMockIncome({ date: new Date(2024, 2, 25), netAmount: 3000 }),
    ]

    const result = aggregateByMonth(incomes, [], 2024)
    const march = result.find((m) => m.month === 3)

    expect(march?.income).toBe(6000)
  })

  it('should filter by year correctly', () => {
    const incomes = [
      createMockIncome({ date: new Date(2024, 0, 15), netAmount: 5000 }),
      createMockIncome({ date: new Date(2023, 0, 15), netAmount: 3000 }), // Previous year
    ]

    const result = aggregateByMonth(incomes, [], 2024)
    const january = result.find((m) => m.month === 1)

    expect(january?.income).toBe(5000) // Only 2024 income
  })
})

// ============================================================================
// AGGREGATE BY QUARTER TESTS
// ============================================================================

describe('aggregateByQuarter', () => {
  it('should aggregate monthly data into quarters', () => {
    const incomes = createYearlyIncomes(2024)
    const expenses = createYearlyExpenses(2024)
    const monthly = aggregateByMonth(incomes, expenses, 2024)

    const result = aggregateByQuarter(monthly)

    expect(result).toHaveLength(4)
    expect(result[0].quarter).toBe(1)
    expect(result[3].quarter).toBe(4)
  })

  it('should calculate Q1 totals correctly', () => {
    const incomes = createYearlyIncomes(2024)
    const expenses = createYearlyExpenses(2024)
    const monthly = aggregateByMonth(incomes, expenses, 2024)

    const result = aggregateByQuarter(monthly)
    const q1 = result.find((q) => q.quarter === 1)

    // Q1 income: 5000 + 4500 + 6000 = 15500
    expect(q1?.income).toBe(15500)
  })

  it('should calculate net VAT (Zahllast) correctly', () => {
    const incomes = createYearlyIncomes(2024)
    const expenses = createYearlyExpenses(2024)
    const monthly = aggregateByMonth(incomes, expenses, 2024)

    const result = aggregateByQuarter(monthly)
    const q1 = result[0]

    expect(q1.netVat).toBe(q1.vatCollected - q1.vatPaid)
  })

  it('should handle empty monthly data', () => {
    const result = aggregateByQuarter([])
    expect(result).toHaveLength(0)
  })
})

// ============================================================================
// AGGREGATE BY CATEGORY TESTS
// ============================================================================

describe('aggregateByCategory', () => {
  it('should group expenses by category', () => {
    const expenses = createYearlyExpenses(2024)
    const result = aggregateByCategory(expenses)

    expect(result.length).toBeGreaterThan(0)

    const software = result.find((c) => c.category === 'software')
    expect(software).toBeDefined()
  })

  it('should calculate percentage of total correctly', () => {
    const expenses = [
      createMockExpense({ netAmount: 600, euerCategory: 'software' }),
      createMockExpense({ netAmount: 400, euerCategory: 'hosting' }),
    ]

    const result = aggregateByCategory(expenses)

    const software = result.find((c) => c.category === 'software')
    expect(software?.percentage).toBe(60)

    const hosting = result.find((c) => c.category === 'hosting')
    expect(hosting?.percentage).toBe(40)
  })

  it('should calculate average transaction amount', () => {
    const expenses = [
      createMockExpense({ netAmount: 100, euerCategory: 'software' }),
      createMockExpense({ netAmount: 200, euerCategory: 'software' }),
      createMockExpense({ netAmount: 300, euerCategory: 'software' }),
    ]

    const result = aggregateByCategory(expenses)
    const software = result.find((c) => c.category === 'software')

    expect(software?.averageTransaction).toBe(200)
  })

  it('should sort categories by amount descending', () => {
    const expenses = [
      createMockExpense({ netAmount: 100, euerCategory: 'telecom' }),
      createMockExpense({ netAmount: 500, euerCategory: 'software' }),
      createMockExpense({ netAmount: 300, euerCategory: 'hosting' }),
    ]

    const result = aggregateByCategory(expenses)

    expect(result[0].category).toBe('software')
    expect(result[1].category).toBe('hosting')
    expect(result[2].category).toBe('telecom')
  })

  it('should handle empty expenses array', () => {
    const result = aggregateByCategory([])
    expect(result).toHaveLength(0)
  })

  it('should include transaction count per category', () => {
    const expenses = [
      createMockExpense({ euerCategory: 'software' }),
      createMockExpense({ euerCategory: 'software' }),
      createMockExpense({ euerCategory: 'hosting' }),
    ]

    const result = aggregateByCategory(expenses)
    const software = result.find((c) => c.category === 'software')

    expect(software?.transactionCount).toBe(2)
  })
})

// ============================================================================
// AGGREGATE BY VENDOR TESTS
// ============================================================================

describe('aggregateByVendor', () => {
  it('should group expenses by vendor', () => {
    const expenses = [
      createMockExpense({ vendor: 'Adobe', netAmount: 100 }),
      createMockExpense({ vendor: 'Adobe', netAmount: 200 }),
      createMockExpense({ vendor: 'AWS', netAmount: 500 }),
    ]

    const result = aggregateByVendor(expenses)

    expect(result).toHaveLength(2)
  })

  it('should calculate total per vendor', () => {
    const expenses = [
      createMockExpense({ vendor: 'Adobe', netAmount: 100 }),
      createMockExpense({ vendor: 'Adobe', netAmount: 200 }),
    ]

    const result = aggregateByVendor(expenses)
    const adobe = result.find((v) => v.vendor === 'Adobe')

    expect(adobe?.amount).toBe(300)
    expect(adobe?.transactionCount).toBe(2)
  })

  it('should sort by amount descending', () => {
    const expenses = [
      createMockExpense({ vendor: 'Small Vendor', netAmount: 50 }),
      createMockExpense({ vendor: 'Big Vendor', netAmount: 1000 }),
      createMockExpense({ vendor: 'Medium Vendor', netAmount: 300 }),
    ]

    const result = aggregateByVendor(expenses)

    expect(result[0].vendor).toBe('Big Vendor')
    expect(result[1].vendor).toBe('Medium Vendor')
    expect(result[2].vendor).toBe('Small Vendor')
  })

  it('should limit to top N vendors when specified', () => {
    const expenses = Array.from({ length: 20 }, (_, i) =>
      createMockExpense({ vendor: `Vendor ${i}`, netAmount: i * 100 })
    )

    const result = aggregateByVendor(expenses, 5)

    expect(result).toHaveLength(5)
    expect(result[0].vendor).toBe('Vendor 19') // Highest amount
  })
})

// ============================================================================
// YEAR-OVER-YEAR COMPARISON TESTS
// ============================================================================

describe('calculateYoYComparison', () => {
  it('should calculate basic YoY metrics', () => {
    const currentYear = {
      totalIncome: 100000,
      totalExpenses: 30000,
      profit: 70000,
    }
    const previousYear = {
      totalIncome: 80000,
      totalExpenses: 25000,
      profit: 55000,
    }

    const result = calculateYoYComparison(currentYear, previousYear, 2024)

    const incomeComparison = result.find((c) => c.metric === 'totalIncome')
    expect(incomeComparison?.currentYear).toBe(100000)
    expect(incomeComparison?.previousYear).toBe(80000)
    expect(incomeComparison?.change).toBe(20000)
    expect(incomeComparison?.changePercent).toBe(25)
    expect(incomeComparison?.trend).toBe('up')
  })

  it('should detect downward trend', () => {
    const currentYear = { totalIncome: 50000, totalExpenses: 20000, profit: 30000 }
    const previousYear = { totalIncome: 80000, totalExpenses: 25000, profit: 55000 }

    const result = calculateYoYComparison(currentYear, previousYear, 2024)

    const incomeComparison = result.find((c) => c.metric === 'totalIncome')
    expect(incomeComparison?.trend).toBe('down')
    expect(incomeComparison?.changePercent).toBe(-37.5)
  })

  it('should detect neutral trend for zero change', () => {
    const currentYear = { totalIncome: 50000, totalExpenses: 20000, profit: 30000 }
    const previousYear = { totalIncome: 50000, totalExpenses: 20000, profit: 30000 }

    const result = calculateYoYComparison(currentYear, previousYear, 2024)

    const incomeComparison = result.find((c) => c.metric === 'totalIncome')
    expect(incomeComparison?.trend).toBe('neutral')
    expect(incomeComparison?.changePercent).toBe(0)
  })

  it('should handle division by zero when previous year is 0', () => {
    const currentYear = { totalIncome: 50000, totalExpenses: 20000, profit: 30000 }
    const previousYear = { totalIncome: 0, totalExpenses: 0, profit: 0 }

    const result = calculateYoYComparison(currentYear, previousYear, 2024)

    const incomeComparison = result.find((c) => c.metric === 'totalIncome')
    expect(incomeComparison?.changePercent).toBe(100) // New revenue = 100% growth
  })

  it('should include expense comparison', () => {
    const currentYear = { totalIncome: 100000, totalExpenses: 40000, profit: 60000 }
    const previousYear = { totalIncome: 80000, totalExpenses: 30000, profit: 50000 }

    const result = calculateYoYComparison(currentYear, previousYear, 2024)

    const expenseComparison = result.find((c) => c.metric === 'totalExpenses')
    expect(expenseComparison).toBeDefined()
    expect(expenseComparison?.change).toBe(10000)
  })
})

// ============================================================================
// CHART DATA PREPARATION TESTS
// ============================================================================

describe('preparePLChartData', () => {
  it('should format monthly data for P&L chart', () => {
    const incomes = createYearlyIncomes(2024)
    const expenses = createYearlyExpenses(2024)
    const monthly = aggregateByMonth(incomes, expenses, 2024)

    const result = preparePLChartData(monthly)

    expect(result).toHaveLength(12)
    expect(result[0].month).toBe('Jan')
    expect(result[0].monthIndex).toBe(1)
    expect(result[0]).toHaveProperty('income')
    expect(result[0]).toHaveProperty('expenses')
    expect(result[0]).toHaveProperty('profit')
  })

  it('should calculate profit as income minus expenses', () => {
    const monthly: MonthlyAggregate[] = [
      {
        year: 2024,
        month: 1,
        income: 5000,
        expenses: 2000,
        profit: 3000,
        vatCollected: 950,
        vatPaid: 380,
        transactionCount: 5,
      },
    ]

    const result = preparePLChartData(monthly)

    expect(result[0].profit).toBe(3000)
  })
})

describe('prepareProfitTrendData', () => {
  it('should calculate cumulative profit', () => {
    const monthly: MonthlyAggregate[] = [
      { year: 2024, month: 1, income: 5000, expenses: 2000, profit: 3000, vatCollected: 950, vatPaid: 380, transactionCount: 5 },
      { year: 2024, month: 2, income: 6000, expenses: 2500, profit: 3500, vatCollected: 1140, vatPaid: 475, transactionCount: 4 },
      { year: 2024, month: 3, income: 4000, expenses: 1500, profit: 2500, vatCollected: 760, vatPaid: 285, transactionCount: 3 },
    ]

    const result = prepareProfitTrendData(monthly)

    expect(result[0].cumulativeProfit).toBe(3000)
    expect(result[1].cumulativeProfit).toBe(6500) // 3000 + 3500
    expect(result[2].cumulativeProfit).toBe(9000) // 6500 + 2500
  })

  it('should handle negative profit months', () => {
    const monthly: MonthlyAggregate[] = [
      { year: 2024, month: 1, income: 5000, expenses: 2000, profit: 3000, vatCollected: 950, vatPaid: 380, transactionCount: 5 },
      { year: 2024, month: 2, income: 1000, expenses: 2000, profit: -1000, vatCollected: 190, vatPaid: 380, transactionCount: 4 },
    ]

    const result = prepareProfitTrendData(monthly)

    expect(result[0].cumulativeProfit).toBe(3000)
    expect(result[1].cumulativeProfit).toBe(2000) // 3000 - 1000
  })
})

describe('prepareExpenseDonutData', () => {
  it('should format category data for donut chart', () => {
    const categories: CategoryAggregate[] = [
      { category: 'software', label: 'Software', amount: 600, percentage: 60, transactionCount: 3, averageTransaction: 200 },
      { category: 'hosting', label: 'Hosting', amount: 400, percentage: 40, transactionCount: 2, averageTransaction: 200 },
    ]

    const result = prepareExpenseDonutData(categories)

    expect(result).toHaveLength(2)
    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('value')
    expect(result[0]).toHaveProperty('percentage')
    expect(result[0]).toHaveProperty('color')
  })

  it('should assign colors from palette', () => {
    const categories: CategoryAggregate[] = [
      { category: 'software', label: 'Software', amount: 100, percentage: 50, transactionCount: 1, averageTransaction: 100 },
      { category: 'hosting', label: 'Hosting', amount: 100, percentage: 50, transactionCount: 1, averageTransaction: 100 },
    ]

    const result = prepareExpenseDonutData(categories)

    expect(result[0].color).toBeDefined()
    expect(result[1].color).toBeDefined()
    expect(result[0].color).not.toBe(result[1].color)
  })
})

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getMonthName', () => {
  it('should return English month names by default', () => {
    expect(getMonthName(1)).toBe('Jan')
    expect(getMonthName(6)).toBe('Jun')
    expect(getMonthName(12)).toBe('Dec')
  })

  it('should return German month names when locale is de', () => {
    expect(getMonthName(1, 'de')).toBe('Jan')
    expect(getMonthName(3, 'de')).toBe('Mär')
    expect(getMonthName(12, 'de')).toBe('Dez')
  })

  it('should handle invalid month numbers', () => {
    expect(getMonthName(0)).toBe('Jan') // Default to Jan
    expect(getMonthName(13)).toBe('Dec') // Default to Dec
  })
})

describe('calculatePercentageChange', () => {
  it('should calculate positive percentage change', () => {
    expect(calculatePercentageChange(100, 80)).toBe(25)
  })

  it('should calculate negative percentage change', () => {
    expect(calculatePercentageChange(80, 100)).toBe(-20)
  })

  it('should return 0 for no change', () => {
    expect(calculatePercentageChange(100, 100)).toBe(0)
  })

  it('should handle previous value of 0', () => {
    expect(calculatePercentageChange(100, 0)).toBe(100)
  })

  it('should handle both values being 0', () => {
    expect(calculatePercentageChange(0, 0)).toBe(0)
  })
})

describe('getTrendDirection', () => {
  it('should return up for positive change', () => {
    expect(getTrendDirection(10)).toBe('up')
    expect(getTrendDirection(0.1)).toBe('up')
  })

  it('should return down for negative change', () => {
    expect(getTrendDirection(-10)).toBe('down')
    expect(getTrendDirection(-0.1)).toBe('down')
  })

  it('should return neutral for zero change', () => {
    expect(getTrendDirection(0)).toBe('neutral')
  })
})

describe('sumByField', () => {
  it('should sum a specific numeric field', () => {
    const items = [
      { amount: 100 },
      { amount: 200 },
      { amount: 300 },
    ]

    expect(sumByField(items, 'amount')).toBe(600)
  })

  it('should return 0 for empty array', () => {
    expect(sumByField([], 'amount')).toBe(0)
  })
})

describe('groupByMonth', () => {
  it('should group items by month', () => {
    const items = [
      { date: new Date(2024, 0, 15), amount: 100 },
      { date: new Date(2024, 0, 25), amount: 200 },
      { date: new Date(2024, 1, 10), amount: 300 },
    ]

    const result = groupByMonth(items, 2024)

    expect(result[1]).toHaveLength(2) // January
    expect(result[2]).toHaveLength(1) // February
  })

  it('should filter by year', () => {
    const items = [
      { date: new Date(2024, 0, 15), amount: 100 },
      { date: new Date(2023, 0, 15), amount: 200 },
    ]

    const result = groupByMonth(items, 2024)

    expect(result[1]).toHaveLength(1) // Only 2024 January
  })
})

describe('groupByCategory', () => {
  it('should group expenses by category', () => {
    const expenses = [
      createMockExpense({ euerCategory: 'software' }),
      createMockExpense({ euerCategory: 'software' }),
      createMockExpense({ euerCategory: 'hosting' }),
    ]

    const result = groupByCategory(expenses)

    expect(result['software']).toHaveLength(2)
    expect(result['hosting']).toHaveLength(1)
  })
})

// ============================================================================
// QUARTERLY TOTALS TESTS
// ============================================================================

describe('calculateQuarterlyTotals', () => {
  it('should sum monthly data into quarterly totals', () => {
    const monthly: MonthlyAggregate[] = [
      { year: 2024, month: 1, income: 5000, expenses: 1000, profit: 4000, vatCollected: 950, vatPaid: 190, transactionCount: 5 },
      { year: 2024, month: 2, income: 6000, expenses: 1500, profit: 4500, vatCollected: 1140, vatPaid: 285, transactionCount: 4 },
      { year: 2024, month: 3, income: 4000, expenses: 500, profit: 3500, vatCollected: 760, vatPaid: 95, transactionCount: 3 },
    ]

    const result = calculateQuarterlyTotals(monthly)

    expect(result.income).toBe(15000)
    expect(result.expenses).toBe(3000)
    expect(result.profit).toBe(12000)
    expect(result.vatCollected).toBe(2850)
    expect(result.vatPaid).toBe(570)
  })

  it('should handle partial quarter data', () => {
    const monthly: MonthlyAggregate[] = [
      { year: 2024, month: 1, income: 5000, expenses: 1000, profit: 4000, vatCollected: 950, vatPaid: 190, transactionCount: 5 },
    ]

    const result = calculateQuarterlyTotals(monthly)

    expect(result.income).toBe(5000)
  })

  it('should handle empty monthly data', () => {
    const result = calculateQuarterlyTotals([])

    expect(result.income).toBe(0)
    expect(result.expenses).toBe(0)
    expect(result.profit).toBe(0)
  })
})
