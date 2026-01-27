/**
 * YearComparison Component
 *
 * Dashboard displaying year-over-year comparison metrics.
 */

import { cn } from '@/lib/utils'
import type { YearComparison as YearComparisonType } from '../../types/reports'
import { ComparisonCard, type ComparisonFormat } from './ComparisonCard'

export interface YearComparisonProps {
  /** Comparison data for each metric */
  comparisons: YearComparisonType[]
  /** Current year being compared */
  currentYear: number
  /** Previous year for comparison */
  previousYear: number
  /** Custom title (defaults to "YYYY vs YYYY") */
  title?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Determine if positive change is good for a metric
 */
function isPositiveGood(metric: string): boolean {
  const negativeMetrics = ['totalExpenses', 'expenses', 'vatPaid', 'taxOwed']
  return !negativeMetrics.includes(metric)
}

/**
 * Year-over-Year Comparison Dashboard
 *
 * Displays multiple KPI cards comparing current vs previous year.
 */
export function YearComparison({
  comparisons,
  currentYear,
  previousYear,
  title,
  className,
}: YearComparisonProps) {
  // Handle empty data
  if (!comparisons || comparisons.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    )
  }

  const displayTitle = title || `${currentYear} vs ${previousYear}`

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{displayTitle}</h2>
      </div>

      {/* Comparison Grid */}
      <div
        data-testid="comparison-grid"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {comparisons.map((comparison) => (
          <ComparisonCard
            key={comparison.metric}
            title={comparison.label}
            currentValue={comparison.currentYear}
            previousValue={comparison.previousYear}
            format={comparison.format as ComparisonFormat}
            positiveIsGood={isPositiveGood(comparison.metric)}
          />
        ))}
      </div>
    </div>
  )
}
