/**
 * ComparisonCard Component
 *
 * Reusable KPI card showing year-over-year comparison with trend indicators.
 */

import { cn } from '@/lib/utils'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { TrendDirection } from '../../types/reports'

export type ComparisonFormat = 'currency' | 'percent' | 'number'

export interface ComparisonCardProps {
  /** Card title/label */
  title: string
  /** Current period value */
  currentValue: number
  /** Previous period value */
  previousValue: number
  /** Value format type */
  format: ComparisonFormat
  /** Whether positive change is good (default: true) */
  positiveIsGood?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Format value based on type
 */
function formatValue(value: number, format: ComparisonFormat): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case 'percent':
      return new Intl.NumberFormat('de-DE', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100)
    case 'number':
    default:
      return new Intl.NumberFormat('de-DE').format(value)
  }
}

/**
 * Calculate percentage change
 */
function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return ((current - previous) / previous) * 100
}

/**
 * Get trend direction
 */
function getTrend(change: number): TrendDirection {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'neutral'
}

/**
 * Get trend color based on direction and whether positive is good
 */
function getTrendColor(trend: TrendDirection, positiveIsGood: boolean): string {
  if (trend === 'neutral') return 'text-muted-foreground'

  const isPositive = trend === 'up'
  const isGood = positiveIsGood ? isPositive : !isPositive

  return isGood
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
}

/**
 * Trend indicator icon
 */
function TrendIcon({ trend, className }: { trend: TrendDirection; className?: string }) {
  switch (trend) {
    case 'up':
      return <ArrowUp data-testid="trend-up" className={className} />
    case 'down':
      return <ArrowDown data-testid="trend-down" className={className} />
    case 'neutral':
    default:
      return <Minus data-testid="trend-neutral" className={className} />
  }
}

/**
 * Comparison Card Component
 *
 * Displays a metric with current/previous values and trend indicator.
 */
export function ComparisonCard({
  title,
  currentValue,
  previousValue,
  format,
  positiveIsGood = true,
  className,
}: ComparisonCardProps) {
  const change = currentValue - previousValue
  const changePercent = calculateChangePercent(currentValue, previousValue)
  const trend = getTrend(change)
  const trendColor = getTrendColor(trend, positiveIsGood)

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {/* Title */}
      <p className="text-sm text-muted-foreground mb-1">{title}</p>

      {/* Current Value */}
      <p className="text-2xl font-bold mb-2">{formatValue(currentValue, format)}</p>

      {/* Change Indicator */}
      <div className="flex items-center gap-2">
        <TrendIcon
          trend={trend}
          className={cn('h-4 w-4', trendColor)}
        />
        <span className={cn('text-sm font-medium', trendColor)}>
          {Math.abs(changePercent).toFixed(1)}%
        </span>
        <span className="text-xs text-muted-foreground">
          vs {formatValue(previousValue, format)}
        </span>
      </div>
    </div>
  )
}
