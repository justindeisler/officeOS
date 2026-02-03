/**
 * ProfitTrendChart Component
 *
 * Line chart showing monthly profit and cumulative profit over time.
 * Uses Recharts for visualization with design-system colors.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ProfitTrendDataPoint } from '../../types/reports'
import { CHART_COLORS } from '../../types/reports'

export interface ProfitTrendChartProps {
  /** Chart data - monthly profit and cumulative */
  data: ProfitTrendDataPoint[]
  /** Optional chart title */
  title?: string
  /** Chart height in pixels */
  height?: number
  /** Show cumulative profit line (default: true) */
  showCumulative?: boolean
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
 * Profit Trend Line Chart
 *
 * Displays monthly profit with optional cumulative profit line.
 */
export function ProfitTrendChart({
  data,
  title,
  height = 300,
  showCumulative = true,
  className,
}: ProfitTrendChartProps) {
  // Handle empty data
  if (!data || data.length === 0) {
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
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          role="img"
          aria-label="Profit trend chart"
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              if (Math.abs(value) >= 1000) {
                return `${(value / 1000).toFixed(1)}k`
              }
              return value.toFixed(0)
            }}
            className="text-muted-foreground"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => (
              <span className="text-sm text-foreground">{value}</span>
            )}
          />
          <Line
            type="monotone"
            dataKey="profit"
            name="Monthly Profit"
            stroke={CHART_COLORS.profit}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS.profit, r: 4 }}
            activeDot={{ r: 6 }}
          />
          {showCumulative && (
            <Line
              type="monotone"
              dataKey="cumulativeProfit"
              name="Cumulative Profit"
              stroke={CHART_COLORS.income}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: CHART_COLORS.income, r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
