/**
 * Tax Forecast Utilities
 *
 * Functions for projecting German VAT (USt) payments and calculating deadlines.
 * Supports quarterly USt-Voranmeldung forecasting with confidence levels.
 */

import type { MonthlyAggregate, TaxForecast, ForecastConfidence } from '../types/reports'

// ============================================================================
// INCOME & EXPENSE PROJECTION
// ============================================================================

/**
 * Project quarterly income based on historical data
 * Uses weighted average favoring recent months
 */
export function projectQuarterlyIncome(
  history: MonthlyAggregate[],
  year: number,
  quarter: 1 | 2 | 3 | 4
): number {
  if (history.length === 0) return 0

  const averageMonthlyIncome = calculateWeightedAverage(history, 'income')
  return averageMonthlyIncome * 3 // 3 months per quarter
}

/**
 * Project quarterly expenses based on historical data
 * Uses weighted average favoring recent months
 */
export function projectQuarterlyExpenses(
  history: MonthlyAggregate[],
  year: number,
  quarter: 1 | 2 | 3 | 4
): number {
  if (history.length === 0) return 0

  const averageMonthlyExpenses = calculateWeightedAverage(history, 'expenses')
  return averageMonthlyExpenses * 3 // 3 months per quarter
}

/**
 * Calculate weighted average with recency bias
 * More recent months have higher weight
 */
function calculateWeightedAverage(
  history: MonthlyAggregate[],
  field: 'income' | 'expenses' | 'vatCollected' | 'vatPaid'
): number {
  if (history.length === 0) return 0

  // Sort by date (most recent last)
  const sorted = [...history].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  // Apply exponential weighting (recent months weighted more)
  let totalWeight = 0
  let weightedSum = 0

  sorted.forEach((month, index) => {
    // Weight increases exponentially with recency
    const weight = Math.pow(1.2, index)
    weightedSum += month[field] * weight
    totalWeight += weight
  })

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

// ============================================================================
// ZAHLLAST CALCULATION
// ============================================================================

/**
 * Calculate estimated VAT payment (Zahllast)
 * Positive = owe money, Negative = refund expected
 */
export function calculateEstimatedZahllast(
  projectedUmsatzsteuer: number,
  projectedVorsteuer: number
): number {
  return projectedUmsatzsteuer - projectedVorsteuer
}

// ============================================================================
// CONFIDENCE LEVEL
// ============================================================================

/**
 * Determine forecast confidence based on available data points
 */
export function determineConfidenceLevel(dataPoints: number): ForecastConfidence {
  if (dataPoints < 3) return 'low'
  if (dataPoints < 6) return 'medium'
  return 'high'
}

/**
 * Calculate projection range based on confidence level
 */
export function calculateProjectionRange(
  estimate: number,
  confidence: ForecastConfidence
): { low: number; high: number } {
  const margins: Record<ForecastConfidence, number> = {
    low: 0.3, // 30% margin
    medium: 0.2, // 20% margin
    high: 0.1, // 10% margin
  }

  const margin = margins[confidence]

  return {
    low: estimate * (1 - margin),
    high: estimate * (1 + margin),
  }
}

// ============================================================================
// VAT DUE DATE CALCULATION
// ============================================================================

/**
 * Get VAT (USt-Voranmeldung) due date for a quarter
 * Standard deadline: 10th of month following quarter end
 * With Dauerfristverlängerung: Add 1 month
 */
export function getVatDueDate(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  hasDauerfrist: boolean
): Date {
  // Quarter end months: Q1=Mar(2), Q2=Jun(5), Q3=Sep(8), Q4=Dec(11)
  const quarterEndMonth = quarter * 3 - 1 // 0-indexed: 2, 5, 8, 11

  // Due month is 1 (or 2 with Dauerfrist) after quarter end
  let dueMonth = quarterEndMonth + 1 + (hasDauerfrist ? 1 : 0)
  let dueYear = year

  // Handle year rollover
  if (dueMonth > 11) {
    dueMonth = dueMonth - 12
    dueYear = year + 1
  }

  return new Date(dueYear, dueMonth, 10)
}

// ============================================================================
// FULL FORECAST CALCULATION
// ============================================================================

/**
 * Generate complete tax forecast for upcoming quarter
 */
export function calculateForecast(
  history: MonthlyAggregate[],
  year: number,
  quarter: 1 | 2 | 3 | 4,
  hasDauerfrist: boolean
): TaxForecast {
  // Project income and expenses
  const projectedIncome = projectQuarterlyIncome(history, year, quarter)
  const projectedExpenses = projectQuarterlyExpenses(history, year, quarter)

  // Calculate VAT (assuming standard 19% rate for simplicity)
  const projectedUmsatzsteuer = projectedIncome * 0.19
  const projectedVorsteuer = projectedExpenses * 0.19

  // Calculate net payment
  const estimatedZahllast = calculateEstimatedZahllast(
    projectedUmsatzsteuer,
    projectedVorsteuer
  )

  // Determine confidence
  const dataPointsUsed = history.length
  const confidence = determineConfidenceLevel(dataPointsUsed)

  // Calculate projection range
  const projectionRange = calculateProjectionRange(estimatedZahllast, confidence)

  // Get due date
  const dueDate = getVatDueDate(year, quarter, hasDauerfrist)

  return {
    period: formatQuarterPeriod(year, quarter),
    year,
    quarter,
    projectedIncome,
    projectedExpenses,
    projectedUmsatzsteuer,
    projectedVorsteuer,
    estimatedZahllast,
    confidence,
    dueDate,
    hasDauerfrist,
    dataPointsUsed,
    projectionRange,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get quarter number (1-4) from month (1-12)
 */
export function getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
  return Math.ceil(month / 3) as 1 | 2 | 3 | 4
}

/**
 * Get month numbers for a quarter
 */
export function getQuarterMonths(quarter: 1 | 2 | 3 | 4): [number, number, number] {
  const startMonth = (quarter - 1) * 3 + 1
  return [startMonth, startMonth + 1, startMonth + 2]
}

/**
 * Count months with data in a specific quarter
 */
export function getMonthsInQuarter(
  history: MonthlyAggregate[],
  year: number,
  quarter: 1 | 2 | 3 | 4
): number {
  const quarterMonths = getQuarterMonths(quarter)

  return history.filter(
    (m) =>
      m.year === year &&
      quarterMonths.includes(m.month) &&
      (m.income > 0 || m.expenses > 0)
  ).length
}

/**
 * Get current quarter based on system date
 */
export function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth() + 1 // 1-indexed
  return getQuarterFromMonth(month)
}

/**
 * Format quarter period string (e.g., "2024-Q1")
 */
export function formatQuarterPeriod(year: number, quarter: 1 | 2 | 3 | 4): string {
  return `${year}-Q${quarter}`
}
