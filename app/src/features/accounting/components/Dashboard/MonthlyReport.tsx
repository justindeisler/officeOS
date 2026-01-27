/**
 * MonthlyReport Component
 *
 * Displays a monthly breakdown of income, expenses, and VAT for a given year.
 * Supports quarterly summaries and export functionality.
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Printer } from 'lucide-react'
import type { MonthlyReportData } from '@/test/mocks/data/accounting/dashboard'

export interface MonthlyReportProps {
  /** Monthly report data */
  data: MonthlyReportData[]
  /** Year of the report */
  year: number
  /** Show quarterly summary rows */
  showQuarterlySummary?: boolean
  /** Callback when export is clicked */
  onExport?: () => void
  /** Callback when print is clicked */
  onPrint?: () => void
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
 * Get months for a quarter
 */
function getQuarterMonths(quarter: 1 | 2 | 3 | 4): string[] {
  const quarterMonths: Record<1 | 2 | 3 | 4, string[]> = {
    1: ['January', 'February', 'March'],
    2: ['April', 'May', 'June'],
    3: ['July', 'August', 'September'],
    4: ['October', 'November', 'December'],
  }
  return quarterMonths[quarter]
}

/**
 * Calculate totals for a set of reports
 */
function calculateTotals(data: MonthlyReportData[]) {
  return data.reduce(
    (acc, item) => ({
      income: acc.income + item.income,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
      vatCollected: acc.vatCollected + item.vatCollected,
      vatPaid: acc.vatPaid + item.vatPaid,
      netVat: acc.netVat + item.netVat,
    }),
    { income: 0, expenses: 0, profit: 0, vatCollected: 0, vatPaid: 0, netVat: 0 }
  )
}

export function MonthlyReport({
  data,
  year,
  showQuarterlySummary = false,
  onExport,
  onPrint,
  className,
}: MonthlyReportProps) {
  // Calculate yearly totals
  const yearlyTotals = useMemo(() => calculateTotals(data), [data])

  // Calculate quarterly totals
  const quarterlyTotals = useMemo(() => {
    if (!showQuarterlySummary) return null

    const quarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
    return quarters.map((q) => {
      const quarterMonths = getQuarterMonths(q)
      const quarterData = data.filter((d) => quarterMonths.includes(d.month))
      return {
        quarter: q,
        ...calculateTotals(quarterData),
      }
    })
  }, [data, showQuarterlySummary])

  // Group data by quarter for rendering
  const dataByQuarter = useMemo(() => {
    if (!showQuarterlySummary) return null

    const quarters: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
    return quarters.map((q) => {
      const quarterMonths = getQuarterMonths(q)
      return {
        quarter: q,
        months: data.filter((d) => quarterMonths.includes(d.month)),
      }
    })
  }, [data, showQuarterlySummary])

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">Monthly Report {year}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No data available for {year}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Monthly Report {year}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Report Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">VAT Collected (USt)</TableHead>
              <TableHead className="text-right">VAT Paid (Vorsteuer)</TableHead>
              <TableHead className="text-right">Net VAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showQuarterlySummary && dataByQuarter ? (
              // Render with quarterly summaries
              <>
                {dataByQuarter.map(({ quarter, months }) => (
                  <React.Fragment key={`q${quarter}`}>
                    {/* Month rows for this quarter */}
                    {months.map((item) => (
                      <TableRow key={item.month}>
                        <TableCell className="font-medium">{item.month}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.income)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.expenses)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            item.profit > 0 && 'text-green-600',
                            item.profit < 0 && 'text-red-600'
                          )}
                        >
                          {formatCurrency(item.profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.vatCollected)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.vatPaid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.netVat)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Quarterly summary row */}
                    {quarterlyTotals && months.length > 0 && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Q{quarter}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quarterlyTotals[quarter - 1].income)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quarterlyTotals[quarter - 1].expenses)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right',
                            quarterlyTotals[quarter - 1].profit > 0 && 'text-green-600',
                            quarterlyTotals[quarter - 1].profit < 0 && 'text-red-600'
                          )}
                        >
                          {formatCurrency(quarterlyTotals[quarter - 1].profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quarterlyTotals[quarter - 1].vatCollected)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quarterlyTotals[quarter - 1].vatPaid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(quarterlyTotals[quarter - 1].netVat)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </>
            ) : (
              // Render without quarterly summaries
              data.map((item) => (
                <TableRow key={item.month}>
                  <TableCell className="font-medium">{item.month}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.income)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-medium',
                      item.profit > 0 && 'text-green-600',
                      item.profit < 0 && 'text-red-600'
                    )}
                  >
                    {formatCurrency(item.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.vatCollected)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.vatPaid)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.netVat)}
                  </TableCell>
                </TableRow>
              ))
            )}

            {/* Yearly Total Row */}
            <TableRow className="border-t-2 bg-muted font-bold">
              <TableCell>Total {year}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(yearlyTotals.income)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(yearlyTotals.expenses)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  yearlyTotals.profit > 0 && 'text-green-600',
                  yearlyTotals.profit < 0 && 'text-red-600'
                )}
              >
                {formatCurrency(yearlyTotals.profit)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(yearlyTotals.vatCollected)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(yearlyTotals.vatPaid)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(yearlyTotals.netVat)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default MonthlyReport
