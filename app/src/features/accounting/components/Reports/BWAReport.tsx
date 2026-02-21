/**
 * BWA Report Component
 *
 * Betriebswirtschaftliche Auswertung (Business Performance Analysis).
 * Displays a 12-column monthly P&L table with:
 * - Income categories as rows, months as columns
 * - Expenses section with category breakdown
 * - Profit/loss row with conditional coloring
 * - Year totals column
 * - Print-friendly layout
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Printer } from 'lucide-react'
import { useBWA } from '../../hooks/useBWA'
import type { BWAReport as BWAReportType, MonthlyAggregate } from '../../api/bwa-reports'

// ============================================================================
// Types
// ============================================================================

export interface BWAReportProps {
  /** Override the year (otherwise uses hook default) */
  year?: number
  /** Additional CSS classes */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const MONTH_HEADERS = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
] as const

/** Year options: 2020–2026 */
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2020 + i)

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format number as German currency (1.234,56 €)
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Collect all unique income categories across all months
 */
function getIncomeCategories(months: MonthlyAggregate[]): string[] {
  const categories = new Set<string>()
  for (const month of months) {
    for (const cat of Object.keys(month.income.by_category)) {
      categories.add(cat)
    }
  }
  return Array.from(categories).sort()
}

/**
 * Collect all unique expense categories across all months
 */
function getExpenseCategories(months: MonthlyAggregate[]): string[] {
  const categories = new Set<string>()
  for (const month of months) {
    for (const cat of Object.keys(month.expenses.by_category)) {
      categories.add(cat)
    }
  }
  return Array.from(categories).sort()
}

/**
 * Human-readable category labels (German)
 */
const CATEGORY_LABELS: Record<string, string> = {
  services: 'Dienstleistungen',
  products: 'Produkte',
  consulting: 'Beratung',
  license: 'Lizenzen',
  uncategorized: 'Sonstige Einnahmen',
  software: 'Software & Lizenzen',
  hosting: 'Hosting & Domains',
  telecom: 'Telekommunikation',
  hardware: 'Hardware & Technik',
  office_supplies: 'Büromaterial',
  travel: 'Reisekosten',
  training: 'Fortbildung',
  books: 'Fachliteratur',
  insurance: 'Versicherungen',
  bank_fees: 'Kontoführung',
  legal: 'Rechts- & Beratung',
  marketing: 'Marketing & Werbung',
  fremdleistungen: 'Fremdleistungen',
  depreciation: 'Abschreibungen (AfA)',
  homeoffice: 'Arbeitszimmer',
  other: 'Sonstige Kosten',
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category
}

// ============================================================================
// Sub-components
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4" data-testid="bwa-loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function BWAReport({ year, className }: BWAReportProps) {
  const { data, isLoading, error, selectedYear, setSelectedYear } = useBWA({
    year,
  })

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">BWA {selectedYear}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Laden...
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">BWA {selectedYear}</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (!data) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">BWA {selectedYear}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Keine Daten verfügbar
        </div>
      </div>
    )
  }

  const incomeCategories = getIncomeCategories(data.months)
  const expenseCategories = getExpenseCategories(data.months)

  // Calculate category year totals
  const incomeCategoryTotals: Record<string, number> = {}
  for (const cat of incomeCategories) {
    incomeCategoryTotals[cat] = data.months.reduce(
      (sum, m) => sum + (m.income.by_category[cat] || 0),
      0
    )
  }

  const expenseCategoryTotals: Record<string, number> = {}
  for (const cat of expenseCategories) {
    expenseCategoryTotals[cat] = data.months.reduce(
      (sum, m) => sum + (m.expenses.by_category[cat] || 0),
      0
    )
  }

  const handlePrint = () => window.print()

  return (
    <div className={cn('space-y-6 print:space-y-2', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h2 className="text-xl font-semibold">BWA {selectedYear}</h2>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print:text-center print:mb-4">
        <h1 className="text-lg font-bold">
          Betriebswirtschaftliche Auswertung {selectedYear}
        </h1>
      </div>

      {/* BWA Table */}
      <div className="rounded-lg border overflow-x-auto print:border-0 print:overflow-visible">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          {/* Header Row */}
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left p-2 font-medium text-muted-foreground min-w-[180px] print:static">
                Position
              </th>
              {MONTH_HEADERS.map((month) => (
                <th
                  key={month}
                  className="text-right p-2 font-medium text-muted-foreground whitespace-nowrap"
                >
                  {month}
                </th>
              ))}
              <th className="text-right p-2 font-semibold text-foreground whitespace-nowrap border-l">
                Gesamt
              </th>
            </tr>
          </thead>

          <tbody>
            {/* ============= INCOME SECTION ============= */}
            <tr className="bg-green-50 dark:bg-green-950/20">
              <td
                colSpan={14}
                className="sticky left-0 z-10 bg-green-50 dark:bg-green-950/20 p-2 font-semibold text-green-800 dark:text-green-300 print:static"
              >
                Einnahmen
              </td>
            </tr>

            {incomeCategories.map((cat, idx) => (
              <tr
                key={`income-${cat}`}
                className={cn(
                  'border-b hover:bg-muted/30 transition-colors',
                  idx % 2 === 1 && 'bg-muted/10'
                )}
              >
                <td className="sticky left-0 z-10 bg-background p-2 font-medium print:static">
                  {getCategoryLabel(cat)}
                </td>
                {data.months.map((month) => (
                  <td
                    key={`${cat}-${month.month}`}
                    className="text-right p-2 tabular-nums"
                  >
                    {(month.income.by_category[cat] || 0) > 0
                      ? formatCurrency(month.income.by_category[cat])
                      : '–'}
                  </td>
                ))}
                <td className="text-right p-2 font-medium tabular-nums border-l">
                  {formatCurrency(incomeCategoryTotals[cat] || 0)}
                </td>
              </tr>
            ))}

            {/* Income Subtotal */}
            <tr className="border-b-2 font-semibold bg-green-50/50 dark:bg-green-950/10">
              <td className="sticky left-0 z-10 bg-green-50/50 dark:bg-green-950/10 p-2 print:static">
                Summe Einnahmen
              </td>
              {data.months.map((month) => (
                <td
                  key={`income-total-${month.month}`}
                  className="text-right p-2 tabular-nums text-green-700 dark:text-green-400"
                >
                  {formatCurrency(month.income.total)}
                </td>
              ))}
              <td className="text-right p-2 tabular-nums text-green-700 dark:text-green-400 border-l">
                {formatCurrency(data.totals.income)}
              </td>
            </tr>

            {/* Spacer */}
            <tr>
              <td colSpan={14} className="h-2" />
            </tr>

            {/* ============= EXPENSES SECTION ============= */}
            <tr className="bg-red-50 dark:bg-red-950/20">
              <td
                colSpan={14}
                className="sticky left-0 z-10 bg-red-50 dark:bg-red-950/20 p-2 font-semibold text-red-800 dark:text-red-300 print:static"
              >
                Ausgaben
              </td>
            </tr>

            {expenseCategories.map((cat, idx) => (
              <tr
                key={`expense-${cat}`}
                className={cn(
                  'border-b hover:bg-muted/30 transition-colors',
                  idx % 2 === 1 && 'bg-muted/10'
                )}
              >
                <td className="sticky left-0 z-10 bg-background p-2 font-medium print:static">
                  {getCategoryLabel(cat)}
                </td>
                {data.months.map((month) => (
                  <td
                    key={`${cat}-${month.month}`}
                    className="text-right p-2 tabular-nums"
                  >
                    {(month.expenses.by_category[cat] || 0) > 0
                      ? formatCurrency(month.expenses.by_category[cat])
                      : '–'}
                  </td>
                ))}
                <td className="text-right p-2 font-medium tabular-nums border-l">
                  {formatCurrency(expenseCategoryTotals[cat] || 0)}
                </td>
              </tr>
            ))}

            {/* Expenses Subtotal */}
            <tr className="border-b-2 font-semibold bg-red-50/50 dark:bg-red-950/10">
              <td className="sticky left-0 z-10 bg-red-50/50 dark:bg-red-950/10 p-2 print:static">
                Summe Ausgaben
              </td>
              {data.months.map((month) => (
                <td
                  key={`expense-total-${month.month}`}
                  className="text-right p-2 tabular-nums text-red-700 dark:text-red-400"
                >
                  {formatCurrency(month.expenses.total)}
                </td>
              ))}
              <td className="text-right p-2 tabular-nums text-red-700 dark:text-red-400 border-l">
                {formatCurrency(data.totals.expenses)}
              </td>
            </tr>

            {/* Spacer */}
            <tr>
              <td colSpan={14} className="h-2" />
            </tr>

            {/* ============= PROFIT ROW ============= */}
            <tr className="border-t-2 border-b-2 bg-muted font-bold text-base">
              <td className="sticky left-0 z-10 bg-muted p-2 print:static">
                {data.totals.profit >= 0 ? 'Gewinn' : 'Verlust'}
              </td>
              {data.months.map((month) => (
                <td
                  key={`profit-${month.month}`}
                  className={cn(
                    'text-right p-2 tabular-nums',
                    month.profit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {formatCurrency(month.profit)}
                </td>
              ))}
              <td
                className={cn(
                  'text-right p-2 tabular-nums border-l',
                  data.totals.profit >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {formatCurrency(data.totals.profit)}
              </td>
            </tr>

            {/* ============= MARGIN ROW ============= */}
            <tr className="text-muted-foreground text-xs">
              <td className="sticky left-0 z-10 bg-background p-2 print:static">
                Umsatzrendite
              </td>
              {data.months.map((month) => {
                const margin =
                  month.income.total > 0
                    ? (month.profit / month.income.total) * 100
                    : 0
                return (
                  <td
                    key={`margin-${month.month}`}
                    className="text-right p-2 tabular-nums"
                  >
                    {month.income.total > 0
                      ? `${margin.toFixed(1)} %`
                      : '–'}
                  </td>
                )
              })}
              <td className="text-right p-2 tabular-nums border-l">
                {data.totals.profit_margin_percent.toFixed(1)} %
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary info */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground print:hidden">
        <p>
          <strong>BWA</strong> = Betriebswirtschaftliche Auswertung.
          Monatliche Übersicht aller Einnahmen und Ausgaben.
        </p>
        <p className="mt-1">
          Die Umsatzrendite zeigt den Anteil des Gewinns am Umsatz (Einnahmen).
        </p>
      </div>
    </div>
  )
}

export default BWAReport
