/**
 * Tax Forecast Tests
 *
 * Tests for German VAT (USt) forecasting and deadline calculations.
 * Target: 20+ tests with 95% coverage of forecast logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MonthlyAggregate, TaxForecast, ForecastConfidence } from '../types/reports'
import {
  projectQuarterlyIncome,
  projectQuarterlyExpenses,
  calculateEstimatedZahllast,
  determineConfidenceLevel,
  getVatDueDate,
  calculateForecast,
  getQuarterFromMonth,
  getQuarterMonths,
  calculateProjectionRange,
  getMonthsInQuarter,
  getCurrentQuarter,
  formatQuarterPeriod,
} from './tax-forecast'

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockMonthlyData = (overrides: Partial<MonthlyAggregate> = {}): MonthlyAggregate => ({
  year: 2024,
  month: 1,
  income: 5000,
  expenses: 1500,
  profit: 3500,
  vatCollected: 950,
  vatPaid: 285,
  transactionCount: 5,
  ...overrides,
})

/** Create 6 months of historical data */
const createHistoricalData = (year: number): MonthlyAggregate[] => {
  return [
    createMockMonthlyData({ year, month: 1, income: 5000, expenses: 1500, vatCollected: 950, vatPaid: 285 }),
    createMockMonthlyData({ year, month: 2, income: 5500, expenses: 1800, vatCollected: 1045, vatPaid: 342 }),
    createMockMonthlyData({ year, month: 3, income: 4800, expenses: 1200, vatCollected: 912, vatPaid: 228 }),
    createMockMonthlyData({ year, month: 4, income: 6000, expenses: 2000, vatCollected: 1140, vatPaid: 380 }),
    createMockMonthlyData({ year, month: 5, income: 5200, expenses: 1600, vatCollected: 988, vatPaid: 304 }),
    createMockMonthlyData({ year, month: 6, income: 5800, expenses: 1900, vatCollected: 1102, vatPaid: 361 }),
  ]
}

// ============================================================================
// INCOME PROJECTION TESTS
// ============================================================================

describe('projectQuarterlyIncome', () => {
  it('should project Q2 income based on weighted historical average', () => {
    const history = createHistoricalData(2024)

    // Uses weighted average favoring recent months
    // Result will be higher than simple average due to recency weighting
    const result = projectQuarterlyIncome(history, 2024, 2)

    // Should be a reasonable projection (between 15000 and 18000)
    expect(result).toBeGreaterThan(15000)
    expect(result).toBeLessThan(18000)
  })

  it('should use only available months when history is incomplete', () => {
    const history = [
      createMockMonthlyData({ month: 1, income: 6000 }),
    ]

    const result = projectQuarterlyIncome(history, 2024, 2)

    // Only 1 month available, use that average
    expect(result).toBeCloseTo(18000, 0) // 6000 * 3
  })

  it('should return 0 when no history is available', () => {
    const result = projectQuarterlyIncome([], 2024, 2)

    expect(result).toBe(0)
  })

  it('should weight recent months more heavily', () => {
    const history = [
      createMockMonthlyData({ month: 1, income: 3000 }), // Older
      createMockMonthlyData({ month: 2, income: 3000 }), // Older
      createMockMonthlyData({ month: 3, income: 9000 }), // Recent spike
    ]

    const result = projectQuarterlyIncome(history, 2024, 2)

    // With recency weighting, should be higher than simple average
    expect(result).toBeGreaterThan(15000) // Simple avg would be 5000 * 3 = 15000
  })
})

// ============================================================================
// EXPENSE PROJECTION TESTS
// ============================================================================

describe('projectQuarterlyExpenses', () => {
  it('should project Q2 expenses based on weighted historical average', () => {
    const history = createHistoricalData(2024)

    // Uses weighted average favoring recent months
    // Result will differ from simple average due to recency weighting
    const result = projectQuarterlyExpenses(history, 2024, 2)

    // Should be a reasonable projection (between 4000 and 6000)
    expect(result).toBeGreaterThan(4000)
    expect(result).toBeLessThan(6000)
  })

  it('should return 0 when no history is available', () => {
    const result = projectQuarterlyExpenses([], 2024, 2)

    expect(result).toBe(0)
  })
})

// ============================================================================
// ZAHLLAST CALCULATION TESTS
// ============================================================================

describe('calculateEstimatedZahllast', () => {
  it('should calculate net VAT payment (Zahllast)', () => {
    // USt collected: 3000, Vorsteuer: 900
    // Zahllast: 3000 - 900 = 2100
    const result = calculateEstimatedZahllast(3000, 900)

    expect(result).toBe(2100)
  })

  it('should return negative when Vorsteuer exceeds USt', () => {
    // USt collected: 500, Vorsteuer: 1000
    // Zahllast: 500 - 1000 = -500 (refund)
    const result = calculateEstimatedZahllast(500, 1000)

    expect(result).toBe(-500)
  })

  it('should return 0 when both are 0', () => {
    const result = calculateEstimatedZahllast(0, 0)

    expect(result).toBe(0)
  })
})

// ============================================================================
// CONFIDENCE LEVEL TESTS
// ============================================================================

describe('determineConfidenceLevel', () => {
  it('should return low confidence for < 3 months of data', () => {
    expect(determineConfidenceLevel(1)).toBe('low')
    expect(determineConfidenceLevel(2)).toBe('low')
  })

  it('should return medium confidence for 3-5 months of data', () => {
    expect(determineConfidenceLevel(3)).toBe('medium')
    expect(determineConfidenceLevel(4)).toBe('medium')
    expect(determineConfidenceLevel(5)).toBe('medium')
  })

  it('should return high confidence for 6+ months of data', () => {
    expect(determineConfidenceLevel(6)).toBe('high')
    expect(determineConfidenceLevel(12)).toBe('high')
    expect(determineConfidenceLevel(24)).toBe('high')
  })
})

// ============================================================================
// VAT DUE DATE TESTS
// ============================================================================

describe('getVatDueDate', () => {
  it('should return 10th of month after quarter end (without Dauerfrist)', () => {
    // Q1 ends March 31, due April 10
    const result = getVatDueDate(2024, 1, false)

    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(3) // April (0-indexed)
    expect(result.getDate()).toBe(10)
  })

  it('should return 10th of second month after quarter end (with Dauerfrist)', () => {
    // Q1 ends March 31, with Dauerfrist due May 10
    const result = getVatDueDate(2024, 1, true)

    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(4) // May (0-indexed)
    expect(result.getDate()).toBe(10)
  })

  it('should handle Q4 correctly (crosses year boundary)', () => {
    // Q4 ends Dec 31, due Jan 10 next year
    const result = getVatDueDate(2024, 4, false)

    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(10)
  })

  it('should handle Q4 with Dauerfrist correctly', () => {
    // Q4 ends Dec 31, with Dauerfrist due Feb 10 next year
    const result = getVatDueDate(2024, 4, true)

    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(10)
  })
})

// ============================================================================
// FULL FORECAST CALCULATION TESTS
// ============================================================================

describe('calculateForecast', () => {
  it('should generate complete forecast for upcoming quarter', () => {
    const history = createHistoricalData(2024)

    const result = calculateForecast(history, 2024, 2, false)

    expect(result).toHaveProperty('period', '2024-Q2')
    expect(result).toHaveProperty('year', 2024)
    expect(result).toHaveProperty('quarter', 2)
    expect(result).toHaveProperty('projectedIncome')
    expect(result).toHaveProperty('projectedExpenses')
    expect(result).toHaveProperty('projectedUmsatzsteuer')
    expect(result).toHaveProperty('projectedVorsteuer')
    expect(result).toHaveProperty('estimatedZahllast')
    expect(result).toHaveProperty('confidence')
    expect(result).toHaveProperty('dueDate')
    expect(result).toHaveProperty('dataPointsUsed')
    expect(result).toHaveProperty('projectionRange')
  })

  it('should calculate VAT from projected income at 19% rate', () => {
    const history = createHistoricalData(2024)

    const result = calculateForecast(history, 2024, 2, false)

    // Projected USt should be approximately 19% of projected income
    expect(result.projectedUmsatzsteuer).toBeCloseTo(result.projectedIncome * 0.19, -2)
  })

  it('should set confidence based on data points used', () => {
    const shortHistory = [createMockMonthlyData({ month: 1 })]
    const result = calculateForecast(shortHistory, 2024, 2, false)

    expect(result.confidence).toBe('low')
  })

  it('should include projection range', () => {
    const history = createHistoricalData(2024)

    const result = calculateForecast(history, 2024, 2, false)

    expect(result.projectionRange.low).toBeLessThan(result.estimatedZahllast)
    expect(result.projectionRange.high).toBeGreaterThan(result.estimatedZahllast)
  })
})

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe('getQuarterFromMonth', () => {
  it('should return Q1 for months 1-3', () => {
    expect(getQuarterFromMonth(1)).toBe(1)
    expect(getQuarterFromMonth(2)).toBe(1)
    expect(getQuarterFromMonth(3)).toBe(1)
  })

  it('should return Q2 for months 4-6', () => {
    expect(getQuarterFromMonth(4)).toBe(2)
    expect(getQuarterFromMonth(5)).toBe(2)
    expect(getQuarterFromMonth(6)).toBe(2)
  })

  it('should return Q3 for months 7-9', () => {
    expect(getQuarterFromMonth(7)).toBe(3)
    expect(getQuarterFromMonth(8)).toBe(3)
    expect(getQuarterFromMonth(9)).toBe(3)
  })

  it('should return Q4 for months 10-12', () => {
    expect(getQuarterFromMonth(10)).toBe(4)
    expect(getQuarterFromMonth(11)).toBe(4)
    expect(getQuarterFromMonth(12)).toBe(4)
  })
})

describe('getQuarterMonths', () => {
  it('should return months 1-3 for Q1', () => {
    expect(getQuarterMonths(1)).toEqual([1, 2, 3])
  })

  it('should return months 4-6 for Q2', () => {
    expect(getQuarterMonths(2)).toEqual([4, 5, 6])
  })

  it('should return months 7-9 for Q3', () => {
    expect(getQuarterMonths(3)).toEqual([7, 8, 9])
  })

  it('should return months 10-12 for Q4', () => {
    expect(getQuarterMonths(4)).toEqual([10, 11, 12])
  })
})

describe('calculateProjectionRange', () => {
  it('should return range based on confidence level', () => {
    // Low confidence: wider range (30%)
    const lowRange = calculateProjectionRange(1000, 'low')
    expect(lowRange.low).toBe(700)
    expect(lowRange.high).toBe(1300)

    // Medium confidence: moderate range (20%)
    const mediumRange = calculateProjectionRange(1000, 'medium')
    expect(mediumRange.low).toBe(800)
    expect(mediumRange.high).toBe(1200)

    // High confidence: tight range (10%)
    const highRange = calculateProjectionRange(1000, 'high')
    expect(highRange.low).toBe(900)
    expect(highRange.high).toBe(1100)
  })
})

describe('getMonthsInQuarter', () => {
  it('should return 3 for a full quarter', () => {
    const history = createHistoricalData(2024)
    const result = getMonthsInQuarter(history, 2024, 1)

    expect(result).toBe(3)
  })

  it('should return count of months with data', () => {
    const history = [
      createMockMonthlyData({ year: 2024, month: 1 }),
      createMockMonthlyData({ year: 2024, month: 2 }),
    ]

    const result = getMonthsInQuarter(history, 2024, 1)

    expect(result).toBe(2)
  })

  it('should return 0 for quarter with no data', () => {
    const result = getMonthsInQuarter([], 2024, 1)

    expect(result).toBe(0)
  })
})

describe('getCurrentQuarter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return Q1 for January-March', () => {
    vi.setSystemTime(new Date(2024, 1, 15)) // February
    expect(getCurrentQuarter()).toBe(1)
  })

  it('should return Q2 for April-June', () => {
    vi.setSystemTime(new Date(2024, 4, 15)) // May
    expect(getCurrentQuarter()).toBe(2)
  })

  it('should return Q3 for July-September', () => {
    vi.setSystemTime(new Date(2024, 7, 15)) // August
    expect(getCurrentQuarter()).toBe(3)
  })

  it('should return Q4 for October-December', () => {
    vi.setSystemTime(new Date(2024, 10, 15)) // November
    expect(getCurrentQuarter()).toBe(4)
  })
})

describe('formatQuarterPeriod', () => {
  it('should format quarter period string', () => {
    expect(formatQuarterPeriod(2024, 1)).toBe('2024-Q1')
    expect(formatQuarterPeriod(2024, 2)).toBe('2024-Q2')
    expect(formatQuarterPeriod(2024, 3)).toBe('2024-Q3')
    expect(formatQuarterPeriod(2024, 4)).toBe('2024-Q4')
  })
})
