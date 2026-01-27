/**
 * EuerExport Component
 *
 * Provides export functionality for EÜR reports with:
 * - Year selector
 * - Summary preview
 * - CSV and PDF export options
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, FileSpreadsheet } from 'lucide-react'
import { useEuerReport } from '../../hooks/useEuerReport'
import type { EuerReport } from '../../types'

export interface EuerExportProps {
  /** Callback when CSV export is clicked */
  onExportCSV?: (report: EuerReport) => void
  /** Callback when PDF export is clicked */
  onExportPDF?: (report: EuerReport) => void
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

export function EuerExport({
  onExportCSV,
  onExportPDF,
  className,
}: EuerExportProps) {
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

  // Handle CSV export
  const handleExportCSV = () => {
    if (onExportCSV && euerReport) {
      onExportCSV(euerReport)
    }
  }

  // Handle PDF export
  const handleExportPDF = () => {
    if (onExportPDF && euerReport) {
      onExportPDF(euerReport)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">EÜR Export</h2>
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
        <h2 className="text-xl font-semibold">EÜR Export</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (!euerReport) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">EÜR Export</h2>
        <div className="flex items-center gap-2 mb-4">
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">EÜR Export</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="mr-2 h-4 w-4" />
            PDF Export
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Einnahmen ({lineDetails.income.length} Positionen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(euerReport.totalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ausgaben ({lineDetails.expenses.length} Positionen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(euerReport.totalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {isProfit ? 'Gewinn' : 'Verlust'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                isProfit ? 'text-green-600' : 'text-red-600'
              )}
            >
              {formatCurrency(Math.abs(euerReport.gewinn))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Info */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <strong>Export-Hinweise:</strong>
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>CSV-Export: Tabellenformat für Excel/Numbers</li>
          <li>PDF-Export: Druckbares Format für Finanzamt</li>
          <li>Jahr: {selectedYear}</li>
        </ul>
      </div>
    </div>
  )
}

export default EuerExport
