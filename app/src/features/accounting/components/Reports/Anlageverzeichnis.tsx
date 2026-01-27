/**
 * Anlageverzeichnis (Asset Register) Component
 *
 * Formal asset register report for German tax filing (EÜR Anlage AVEÜR).
 * Lists all business assets with depreciation details.
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileText, FileSpreadsheet, Package } from 'lucide-react'
import type { Asset } from '../../types'

export interface AnlageverzeichnisProps {
  /** Report year */
  year: number
  /** List of assets to display */
  assets: Asset[]
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Show only assets acquired in the specified year */
  showOnlyYearAcquisitions?: boolean
  /** Callback when CSV export is clicked */
  onExportCSV?: (assets: Asset[], year: number) => void
  /** Callback when PDF export is clicked */
  onExportPDF?: (assets: Asset[], year: number) => void
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
 * Format date in German format
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Get category display name (German)
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    computer: 'EDV/Computer',
    furniture: 'Büromöbel',
    equipment: 'Geräte',
    software: 'Software',
    phone: 'Telefon',
  }
  return labels[category] || category
}

/**
 * Get status display text (German)
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Aktiv',
    disposed: 'Abgang',
    sold: 'Verkauft',
  }
  return labels[status] || status
}

/**
 * Get book value for a specific year from depreciation schedule
 */
function getBookValueForYear(asset: Asset, year: number): number {
  if (!asset.depreciationSchedule || asset.depreciationSchedule.length === 0) {
    return asset.purchasePrice
  }

  const yearEntry = asset.depreciationSchedule.find(entry => entry.year === year)
  if (yearEntry) {
    return yearEntry.bookValue
  }

  // If no entry for the year, use the last known book value
  const sortedEntries = [...asset.depreciationSchedule].sort((a, b) => b.year - a.year)
  const lastEntry = sortedEntries.find(entry => entry.year <= year)
  return lastEntry ? lastEntry.bookValue : asset.purchasePrice
}

export function Anlageverzeichnis({
  year,
  assets,
  isLoading = false,
  error = null,
  showOnlyYearAcquisitions = false,
  onExportCSV,
  onExportPDF,
  className,
}: AnlageverzeichnisProps) {
  // Filter assets if needed
  const filteredAssets = useMemo(() => {
    if (showOnlyYearAcquisitions) {
      return assets.filter(asset => {
        const purchaseYear = new Date(asset.purchaseDate).getFullYear()
        return purchaseYear === year
      })
    }
    return assets
  }, [assets, year, showOnlyYearAcquisitions])

  // Calculate summary values
  const summary = useMemo(() => {
    const totalPurchaseValue = filteredAssets.reduce(
      (sum, asset) => sum + asset.purchasePrice,
      0
    )
    const totalAnnualAfa = filteredAssets.reduce(
      (sum, asset) => sum + asset.afaAnnualAmount,
      0
    )
    const totalBookValue = filteredAssets.reduce(
      (sum, asset) => sum + getBookValueForYear(asset, year),
      0
    )
    return {
      count: filteredAssets.length,
      totalPurchaseValue,
      totalAnnualAfa,
      totalBookValue,
    }
  }, [filteredAssets, year])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">Anlageverzeichnis {year}</h2>
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
        <h2 className="text-xl font-semibold">Anlageverzeichnis {year}</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (filteredAssets.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">Anlageverzeichnis {year}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Keine Anlagen vorhanden</p>
          <p className="text-sm mt-1">No assets registered</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Anlageverzeichnis {year}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExportCSV?.(filteredAssets, year)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            CSV Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExportPDF?.(filteredAssets, year)}
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="summary-section">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anlagen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.count} Anlagen</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anschaffungswert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalPurchaseValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AfA {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalAnnualAfa)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Buchwert {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalBookValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Bezeichnung</TableHead>
                <TableHead scope="col">Kategorie</TableHead>
                <TableHead scope="col">Anschaffung</TableHead>
                <TableHead scope="col" className="text-right">
                  Anschaffungswert
                </TableHead>
                <TableHead scope="col" className="text-center">
                  AfA Jahre
                </TableHead>
                <TableHead scope="col" className="text-right">
                  AfA/Jahr
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Buchwert {year}
                </TableHead>
                <TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAssets.map((asset) => {
                const bookValue = getBookValueForYear(asset, year)
                const isDisposed = asset.status !== 'active'

                return (
                  <TableRow
                    key={asset.id}
                    className={cn(isDisposed && 'text-muted-foreground')}
                  >
                    <TableCell className="font-medium">
                      {asset.name}
                      {asset.inventoryNumber && (
                        <span className="block text-xs text-muted-foreground">
                          Inv.-Nr.: {asset.inventoryNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getCategoryLabel(asset.category)}</TableCell>
                    <TableCell>
                      {formatDate(new Date(asset.purchaseDate))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(asset.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-center">
                      {asset.afaYears} Jahre
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(asset.afaAnnualAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(bookValue)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
                          asset.status === 'active' &&
                            'bg-green-100 text-green-700',
                          asset.status === 'disposed' &&
                            'bg-gray-100 text-gray-700',
                          asset.status === 'sold' &&
                            'bg-blue-100 text-blue-700'
                        )}
                      >
                        {getStatusLabel(asset.status)}
                      </span>
                      {isDisposed && asset.disposalDate && (
                        <span className="block text-xs text-muted-foreground mt-1">
                          {formatDate(new Date(asset.disposalDate))}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Export Info */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <strong>Hinweise zum Anlageverzeichnis:</strong>
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Erforderlich für EÜR Anlage AVEÜR (Anlageverzeichnis)</li>
          <li>Alle Beträge sind Netto-Werte (ohne USt)</li>
          <li>Lineare AfA-Methode gemäß AfA-Tabelle</li>
        </ul>
      </div>
    </div>
  )
}

export default Anlageverzeichnis
