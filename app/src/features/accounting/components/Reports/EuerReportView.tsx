/**
 * EuerReportView Component
 *
 * Displays annual EÜR (Einnahmen-Überschuss-Rechnung) reports with:
 * - Year selector
 * - Income breakdown by EÜR line numbers
 * - Expense breakdown by EÜR line numbers
 * - Gewinn/Verlust calculation
 * - Print and export functionality
 */

import React from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Printer, Download } from 'lucide-react'
import { useEuerReport } from '../../hooks/useEuerReport'
import { EUER_LINES } from '../../types'

export interface EuerReportViewProps {
  /** Callback when print is clicked */
  onPrint?: () => void
  /** Callback when export is clicked */
  onExport?: () => void
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
 * Get available years for selection (current year and previous 5 years)
 */
function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
}

/**
 * EÜR line labels in German
 */
const LINE_LABELS: Record<number, { name: string; description: string }> = {
  [EUER_LINES.BETRIEBSEINNAHMEN]: {
    name: 'Betriebseinnahmen',
    description: 'Standard taxable business income',
  },
  [EUER_LINES.UST_ERSTATTUNG]: {
    name: 'USt-Erstattung',
    description: 'VAT refunds from tax office',
  },
  [EUER_LINES.FREMDLEISTUNGEN]: {
    name: 'Fremdleistungen',
    description: 'Subcontractors',
  },
  [EUER_LINES.VORSTEUER]: {
    name: 'Vorsteuer',
    description: 'Input VAT',
  },
  [EUER_LINES.GEZAHLTE_UST]: {
    name: 'Gezahlte USt',
    description: 'Output VAT paid',
  },
  [EUER_LINES.AFA]: {
    name: 'AfA',
    description: 'Depreciation',
  },
  [EUER_LINES.ARBEITSZIMMER]: {
    name: 'Arbeitszimmer',
    description: 'Home office',
  },
  [EUER_LINES.SONSTIGE]: {
    name: 'Sonstige',
    description: 'Other expenses',
  },
}

export function EuerReportView({
  onPrint,
  onExport,
  className,
}: EuerReportViewProps) {
  const {
    euerReport,
    isLoading,
    error,
    selectedYear,
    setSelectedYear,
    getLineDetails,
  } = useEuerReport()

  const availableYears = getAvailableYears()
  const lineDetails = getLineDetails()

  // Handle print
  const handlePrint = () => {
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  // Handle export
  const handleExport = () => {
    if (onExport) {
      onExport()
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">EÜR {selectedYear}</h2>
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
        <h2 className="text-xl font-semibold">EÜR {selectedYear}</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {getErrorMessage(error)}
        </div>
      </div>
    )
  }

  // Empty state
  if (!euerReport) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">EÜR {selectedYear}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Keine Daten verfügbar
        </div>
      </div>
    )
  }

  const isProfit = euerReport.gewinn >= 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">EÜR {selectedYear}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Year Selection */}
      <div className="flex items-center gap-2">
        <label htmlFor="year-select" className="text-sm font-medium">
          Jahr:
        </label>
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setSelectedYear(Number(value))}
        >
          <SelectTrigger id="year-select" className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* EÜR Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Zeile</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Einnahmen (Income) section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-semibold">
                Einnahmen
              </TableCell>
            </TableRow>
            {lineDetails.income.map((line) => (
              <TableRow key={line.line}>
                <TableCell className="font-mono text-sm">
                  Zeile {line.line}
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{line.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({line.description})
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(euerReport.income[line.line] || 0)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium bg-muted/20">
              <TableCell></TableCell>
              <TableCell>Summe Einnahmen</TableCell>
              <TableCell className="text-right">
                {formatCurrency(euerReport.totalIncome)}
              </TableCell>
            </TableRow>

            {/* Ausgaben (Expenses) section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={3} className="font-semibold">
                Ausgaben
              </TableCell>
            </TableRow>
            {lineDetails.expenses.map((line) => (
              <TableRow key={line.line}>
                <TableCell className="font-mono text-sm">
                  Zeile {line.line}
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{line.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      ({line.description})
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(euerReport.expenses[line.line] || 0)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium bg-muted/20">
              <TableCell></TableCell>
              <TableCell>Summe Ausgaben</TableCell>
              <TableCell className="text-right">
                {formatCurrency(euerReport.totalExpenses)}
              </TableCell>
            </TableRow>

            {/* Gewinn/Verlust section */}
            <TableRow className="border-t-2 bg-muted font-bold">
              <TableCell></TableCell>
              <TableCell>{isProfit ? 'Gewinn' : 'Verlust'}</TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  isProfit ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(Math.abs(euerReport.gewinn))}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Explanation */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <strong>Gewinn/Verlust</strong>: Einnahmen − Ausgaben
        </p>
        <p>
          Positiver Betrag = Gewinn (steuerpflichtiges Einkommen)
          <br />
          Negativer Betrag = Verlust (kann vorgetragen werden)
        </p>
      </div>
    </div>
  )
}

export default EuerReportView
