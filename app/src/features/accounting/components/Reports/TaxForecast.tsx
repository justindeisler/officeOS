/**
 * TaxForecast Component
 *
 * Displays VAT (USt) forecast with confidence indicators and due dates.
 * Shows projected Zahllast (VAT payment) for German freelancers.
 */

import { cn } from '@/lib/utils'
import type { TaxForecast as TaxForecastType, ForecastConfidence } from '../../types/reports'

export interface TaxForecastProps {
  /** Forecast data */
  forecast: TaxForecastType
  /** Display variant */
  variant?: 'default' | 'compact'
  /** Additional CSS classes */
  className?: string
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Get confidence badge styling
 */
function getConfidenceBadgeClass(confidence: ForecastConfidence): string {
  const baseClass = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium'

  switch (confidence) {
    case 'high':
      return cn(baseClass, 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200')
    case 'medium':
      return cn(baseClass, 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200')
    case 'low':
      return cn(baseClass, 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200')
  }
}

/**
 * Tax Forecast Display Component
 */
export function TaxForecast({
  forecast,
  variant = 'default',
  className,
}: TaxForecastProps) {
  const isRefund = forecast.estimatedZahllast < 0
  const isCompact = variant === 'compact'

  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Tax Forecast</h3>
          <p className="text-2xl font-bold text-foreground">{forecast.period}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={getConfidenceBadgeClass(forecast.confidence)}>
            {forecast.confidence.charAt(0).toUpperCase() + forecast.confidence.slice(1)} confidence
          </span>
          {forecast.hasDauerfrist && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Dauerfrist
            </span>
          )}
        </div>
      </div>

      {/* Main Amount */}
      <div className="mb-6 p-4 rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground mb-1">
          Estimated {isRefund ? 'Refund (Erstattung)' : 'Payment (Zahllast)'}
        </p>
        <p className={cn(
          'text-3xl font-bold',
          isRefund ? 'text-green-600 dark:text-green-400' : 'text-foreground'
        )}>
          {isRefund ? '-' : ''}{formatCurrency(Math.abs(forecast.estimatedZahllast))}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Range: {formatCurrency(forecast.projectionRange.low)} – {formatCurrency(forecast.projectionRange.high)}
        </p>
      </div>

      {!isCompact && (
        <>
          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Projected Income</p>
              <p className="text-lg font-semibold">{formatCurrency(forecast.projectedIncome)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Projected Expenses</p>
              <p className="text-lg font-semibold">{formatCurrency(forecast.projectedExpenses)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">USt (Collected)</p>
              <p className="text-lg font-semibold">{formatCurrency(forecast.projectedUmsatzsteuer)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vorsteuer (Paid)</p>
              <p className="text-lg font-semibold">{formatCurrency(forecast.projectedVorsteuer)}</p>
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
            <div>
              <span className="font-medium">Due Date:</span>{' '}
              {formatDate(forecast.dueDate)}
            </div>
            <div>
              <span className="font-medium">Based on:</span>{' '}
              {forecast.dataPointsUsed} months of data
            </div>
          </div>
        </>
      )}

      {isCompact && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Due: {formatDate(forecast.dueDate)}</span>
          <span>{forecast.dataPointsUsed} months data</span>
        </div>
      )}
    </div>
  )
}
