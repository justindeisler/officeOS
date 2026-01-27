/**
 * ExpenseDonut Component
 *
 * Donut/pie chart showing expense breakdown by category.
 * Uses Recharts for visualization with design-system colors.
 */

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { ExpenseDonutDataPoint } from '../../types/reports'

export interface ExpenseDonutProps {
  /** Chart data - category breakdown */
  data: ExpenseDonutDataPoint[]
  /** Optional chart title */
  title?: string
  /** Chart height in pixels */
  height?: number
  /** Show total in center (default: false) */
  showTotal?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Format currency for tooltip and labels
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
}: {
  active?: boolean
  payload?: Array<{ payload: ExpenseDonutDataPoint }>
}) {
  if (!active || !payload || payload.length === 0) return null

  const data = payload[0].payload

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium text-sm mb-1">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatCurrency(data.value)} ({data.percentage.toFixed(1)}%)
      </p>
    </div>
  )
}

/**
 * Expense Breakdown Donut Chart
 *
 * Displays expense categories as a donut chart with optional center total.
 */
export function ExpenseDonut({
  data,
  title,
  height = 300,
  showTotal = false,
  className,
}: ExpenseDonutProps) {
  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height }}>
        <p className="text-muted-foreground text-sm">No data available</p>
      </div>
    )
  }

  // Calculate total for center display
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className={cn('w-full', className)}>
      {title && (
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
      )}
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart
            role="img"
            aria-label="Expense breakdown chart"
          >
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {showTotal && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center" style={{ marginBottom: '36px' }}>
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
