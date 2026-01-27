/**
 * CategoryTrend Component
 *
 * Stacked area chart showing expense category trends over time.
 * Uses Recharts for visualization with design-system colors.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { CategoryTrendDataPoint } from '../../types/reports'

export interface CategoryConfig {
  /** Category key (must match data property) */
  key: string
  /** Display color for the area */
  color: string
}

export interface CategoryTrendProps {
  /** Chart data - monthly values per category */
  data: CategoryTrendDataPoint[]
  /** Category configurations with keys and colors */
  categories: CategoryConfig[]
  /** Optional chart title */
  title?: string
  /** Chart height in pixels */
  height?: number
  /** Stack type (default: 'none') */
  stackType?: 'none' | 'expand' | 'wiggle' | 'silhouette'
  /** Additional CSS classes */
  className?: string
}

/**
 * Format currency for tooltip
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
 * Custom tooltip content
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium text-sm mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

/**
 * Category Trend Stacked Area Chart
 *
 * Displays expense categories over time as stacked areas.
 */
export function CategoryTrend({
  data,
  categories,
  title,
  height = 300,
  stackType = 'none',
  className,
}: CategoryTrendProps) {
  // Handle empty data
  if (!data || data.length === 0 || !categories || categories.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          role="img"
          aria-label="Category trend chart"
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
          {categories.map((category) => (
            <Area
              key={category.key}
              type="monotone"
              dataKey={category.key}
              name={category.key}
              stackId={stackType !== 'none' ? '1' : undefined}
              stroke={category.color}
              fill={category.color}
              fillOpacity={0.6}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
