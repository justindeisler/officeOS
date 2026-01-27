/**
 * DepreciationTable Component
 *
 * Displays a year-by-year depreciation schedule for an asset.
 * Shows AfA amounts, cumulative depreciation, and remaining book value.
 * Highlights pro-rata years and the current year.
 */

import type { DepreciationEntry } from '../../types'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export interface DepreciationTableProps {
  /** Depreciation schedule entries */
  schedule: DepreciationEntry[]
  /** Original purchase price */
  purchasePrice: number
  /** Purchase date */
  purchaseDate: Date
  /** AfA years (useful life) */
  afaYears?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Format number as German currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format date in German locale
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function DepreciationTable({
  schedule,
  purchasePrice,
  purchaseDate,
  afaYears,
  className,
}: DepreciationTableProps) {
  const currentYear = new Date().getFullYear()

  // Calculate total depreciation
  const totalDepreciation = schedule.reduce((sum, entry) => sum + entry.amount, 0)

  // Empty state
  if (schedule.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed p-8 text-center', className)}>
        <p className="text-muted-foreground">No depreciation schedule available.</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Depreciation Schedule</h3>
        {afaYears && (
          <Badge variant="outline" className="text-sm">
            {afaYears} years linear AfA
          </Badge>
        )}
      </div>

      {/* Summary Info */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Purchase Date: </span>
          <span className="font-medium">{formatDate(purchaseDate)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Purchase Price: </span>
          <span className="font-medium">{formatCurrency(purchasePrice)}</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Year</TableHead>
              <TableHead className="text-center">Months</TableHead>
              <TableHead className="text-right">AfA Amount</TableHead>
              <TableHead className="text-right">Cumulative</TableHead>
              <TableHead className="text-right">Book Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule.map((entry) => {
              const isCurrentYear = entry.year === currentYear
              const isProRata = entry.months < 12

              return (
                <TableRow
                  key={entry.id}
                  className={cn(
                    isCurrentYear && 'bg-primary/5',
                    entry.bookValue === 0 && 'text-muted-foreground'
                  )}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span>{entry.year}</span>
                      {isCurrentYear && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{entry.months}</span>
                      {isProRata && (
                        <span className="text-xs text-muted-foreground">(pro-rata)</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(entry.cumulative)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(entry.bookValue)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Total Summary */}
      <div className="flex justify-end">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-sm text-muted-foreground">Total AfA: </span>
              <span className="font-semibold">{formatCurrency(totalDepreciation)}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Final Book Value: </span>
              <span className="font-semibold">
                {formatCurrency(schedule[schedule.length - 1]?.bookValue ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DepreciationTable
