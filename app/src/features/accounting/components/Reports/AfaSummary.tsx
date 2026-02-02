/**
 * AfaSummary Component
 *
 * Annual depreciation summary report showing:
 * - Year-by-year depreciation schedule
 * - Per-asset AfA amounts
 * - Total AfA for the year
 * - Category breakdowns
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
import { FileSpreadsheet, TrendingDown, Calculator } from 'lucide-react'
import type { Asset, AssetCategory } from '../../types'

export interface AfaSummaryProps {
  /** Report year */
  year: number
  /** List of assets */
  assets: Asset[]
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Show category breakdown */
  showCategoryBreakdown?: boolean
  /** Show yearly comparison */
  showYearlyComparison?: boolean
  /** Callback when CSV export is clicked */
  onExportCSV?: (assets: Asset[], year: number) => void
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
 * Format percentage
 */
function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)
}

/**
 * Get category display name (German)
 */
function getCategoryLabel(category: AssetCategory): string {
  const labels: Record<AssetCategory, string> = {
    computer: 'EDV/Computer',
    furniture: 'Büromöbel',
    equipment: 'Geräte',
    software: 'Software',
    phone: 'Telefon',
  }
  return labels[category] || category
}

/**
 * Calculate remaining depreciation years
 */
function getRemainingYears(asset: Asset, year: number): number {
  const startYear = new Date(asset.afaStartDate).getFullYear()
  const endYear = startYear + asset.afaYears
  const remaining = endYear - year - 1
  return Math.max(0, remaining)
}

/**
 * Get AfA amount for a specific year from depreciation schedule
 */
function getAfaForYear(asset: Asset, year: number): number {
  const entry = asset.depreciationSchedule?.find(d => d.year === year)
  return entry?.amount ?? asset.afaAnnualAmount
}

export function AfaSummary({
  year,
  assets,
  isLoading = false,
  error = null,
  showCategoryBreakdown = false,
  showYearlyComparison = false,
  onExportCSV,
  className,
}: AfaSummaryProps) {
  // Filter active assets with depreciation
  const activeAssets = useMemo(() => {
    return assets.filter(asset => asset.status === 'active' || asset.afaAnnualAmount > 0)
  }, [assets])

  // Sort by AfA amount descending
  const sortedAssets = useMemo(() => {
    return [...activeAssets].sort((a, b) => b.afaAnnualAmount - a.afaAnnualAmount)
  }, [activeAssets])

  // Calculate summary values
  const summary = useMemo(() => {
    const totalAfa = sortedAssets.reduce(
      (sum, asset) => sum + asset.afaAnnualAmount,
      0
    )
    const averageAfa = sortedAssets.length > 0 ? totalAfa / sortedAssets.length : 0
    return {
      count: sortedAssets.length,
      totalAfa,
      averageAfa,
    }
  }, [sortedAssets])

  // Calculate category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<AssetCategory, { count: number; total: number }> = {
      computer: { count: 0, total: 0 },
      furniture: { count: 0, total: 0 },
      equipment: { count: 0, total: 0 },
      software: { count: 0, total: 0 },
      phone: { count: 0, total: 0 },
    }

    for (const asset of sortedAssets) {
      if (breakdown[asset.category]) {
        breakdown[asset.category].count++
        breakdown[asset.category].total += asset.afaAnnualAmount
      }
    }

    return Object.entries(breakdown)
      .filter(([_, data]) => data.count > 0)
      .map(([category, data]) => ({
        category: category as AssetCategory,
        ...data,
      }))
      .sort((a, b) => b.total - a.total)
  }, [sortedAssets])

  // Get years for comparison from depreciation schedules
  const comparisonYears = useMemo(() => {
    if (!showYearlyComparison) return []

    const years = new Set<number>()
    for (const asset of sortedAssets) {
      if (asset.depreciationSchedule) {
        for (const entry of asset.depreciationSchedule) {
          years.add(entry.year)
        }
      }
    }
    return Array.from(years).sort()
  }, [sortedAssets, showYearlyComparison])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">AfA-Übersicht {year}</h2>
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
        <h2 className="text-xl font-semibold">AfA-Übersicht {year}</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (sortedAssets.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">AfA-Übersicht {year}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <TrendingDown className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Keine Abschreibungen vorhanden</p>
          <p className="text-sm mt-1">No depreciation for this year</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">AfA-Übersicht {year}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExportCSV?.(sortedAssets, year)}
          className="w-full sm:w-auto"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          CSV Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="afa-summary-totals">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Gesamt-AfA {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.totalAfa)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anlagen mit AfA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.count} Anlagen</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Durchschnitt/Anlage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.averageAfa)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {showCategoryBreakdown && categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              AfA nach Kategorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.map(({ category, count, total }) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getCategoryLabel(category)}</span>
                    <span className="text-sm text-muted-foreground">
                      ({count} Anlagen)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(total)}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatPercent(total / summary.totalAfa)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yearly Comparison */}
      {showYearlyComparison && comparisonYears.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Jahresvergleich
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {comparisonYears.map((compYear) => {
                const yearTotal = sortedAssets.reduce(
                  (sum, asset) => sum + getAfaForYear(asset, compYear),
                  0
                )
                const isCurrent = compYear === year
                return (
                  <div
                    key={compYear}
                    className={cn(
                      'flex-1 text-center p-3 rounded-lg border',
                      isCurrent && 'bg-muted border-primary'
                    )}
                  >
                    <div className="text-sm font-medium">{compYear}</div>
                    <div className={cn('text-lg font-bold', isCurrent && 'text-primary')}>
                      {formatCurrency(yearTotal)}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depreciation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            AfA-Aufstellung {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Anlage</TableHead>
                <TableHead scope="col">Kategorie</TableHead>
                <TableHead scope="col" className="text-right">
                  AfA {year}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Anteil
                </TableHead>
                <TableHead scope="col" className="text-center">
                  Restlaufzeit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAssets.map((asset) => {
                const percentage = summary.totalAfa > 0
                  ? asset.afaAnnualAmount / summary.totalAfa
                  : 0
                const remainingYears = getRemainingYears(asset, year)

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      {asset.name}
                      {asset.inventoryNumber && (
                        <span className="block text-xs text-muted-foreground">
                          Inv.-Nr.: {asset.inventoryNumber}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getCategoryLabel(asset.category)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(asset.afaAnnualAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(percentage)}
                    </TableCell>
                    <TableCell className="text-center">
                      {remainingYears > 0 ? (
                        <span>{remainingYears} Jahre</span>
                      ) : (
                        <span className="text-muted-foreground">Abgeschlossen</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {/* Total Row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>Gesamt</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(summary.totalAfa)}
                </TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Section */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <strong>Hinweise zur AfA-Berechnung:</strong>
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Lineare Abschreibung gemäß AfA-Tabelle</li>
          <li>Pro-rata-temporis im Anschaffungs- und Abgangsjahr</li>
          <li>Beträge netto (ohne Umsatzsteuer)</li>
        </ul>
      </div>
    </div>
  )
}

export default AfaSummary
