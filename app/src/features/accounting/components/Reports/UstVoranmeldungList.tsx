/**
 * UstVoranmeldungList Component
 *
 * Displays quarterly VAT declarations (USt-Voranmeldung) with:
 * - Quarter selection tabs
 * - Year selector
 * - VAT calculation breakdown
 * - Status tracking (draft/filed)
 * - Print functionality
 */

import React from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Printer, FileCheck } from 'lucide-react'
import { useUstVoranmeldung } from '../../hooks/useUstVoranmeldung'

export interface UstVoranmeldungListProps {
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
 * Format date as German date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * Get available years for selection (current year and previous 5 years)
 */
function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
}

export function UstVoranmeldungList({
  onPrint,
  className,
}: UstVoranmeldungListProps) {
  const {
    ustVoranmeldung,
    isLoading,
    error,
    selectedYear,
    selectedQuarter,
    setSelectedYear,
    setSelectedQuarter,
    markAsFiled,
  } = useUstVoranmeldung()

  const availableYears = getAvailableYears()

  // Handle print
  const handlePrint = () => {
    if (onPrint) {
      onPrint()
    } else {
      window.print()
    }
  }

  // Handle mark as filed
  const handleMarkAsFiled = async () => {
    if (ustVoranmeldung) {
      await markAsFiled(ustVoranmeldung.year, ustVoranmeldung.quarter)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">USt-Voranmeldung</h2>
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
        <h2 className="text-xl font-semibold">USt-Voranmeldung</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (!ustVoranmeldung) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">USt-Voranmeldung</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Keine Daten verfügbar
        </div>
      </div>
    )
  }

  const isRefund = ustVoranmeldung.zahllast < 0

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">USt-Voranmeldung</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
          {ustVoranmeldung.status === 'draft' && (
            <Button size="sm" onClick={handleMarkAsFiled}>
              <FileCheck className="mr-2 h-4 w-4" />
              Als gemeldet markieren
            </Button>
          )}
        </div>
      </div>

      {/* Year and Quarter Selection */}
      <div className="flex items-center gap-4">
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

        <Tabs
          value={`Q${selectedQuarter}`}
          onValueChange={(value) =>
            setSelectedQuarter(Number(value.replace('Q', '')) as 1 | 2 | 3 | 4)
          }
        >
          <TabsList>
            <TabsTrigger value="Q1">Q1</TabsTrigger>
            <TabsTrigger value="Q2">Q2</TabsTrigger>
            <TabsTrigger value="Q3">Q3</TabsTrigger>
            <TabsTrigger value="Q4">Q4</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Period Info */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Zeitraum</p>
          <p className="font-medium">{ustVoranmeldung.period}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(ustVoranmeldung.startDate)} –{' '}
            {formatDate(ustVoranmeldung.endDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Status</p>
          {ustVoranmeldung.status === 'draft' ? (
            <Badge variant="secondary">Entwurf</Badge>
          ) : (
            <Badge variant="default">Gemeldet</Badge>
          )}
          {ustVoranmeldung.filedDate && (
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(ustVoranmeldung.filedDate)}
            </p>
          )}
        </div>
      </div>

      {/* VAT Summary Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Position</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Umsatzsteuer section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-semibold">
                Umsatzsteuer (Output VAT)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Umsatzsteuer 19%</TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.umsatzsteuer19)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Umsatzsteuer 7%</TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.umsatzsteuer7)}
              </TableCell>
            </TableRow>
            <TableRow className="font-medium">
              <TableCell className="pl-8">Summe Umsatzsteuer</TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.totalUmsatzsteuer)}
              </TableCell>
            </TableRow>

            {/* Vorsteuer section */}
            <TableRow className="bg-muted/30">
              <TableCell colSpan={2} className="font-semibold">
                Vorsteuer (Input VAT)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="pl-8">Abziehbare Vorsteuer</TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.vorsteuer)}
              </TableCell>
            </TableRow>

            {/* Zahllast section */}
            <TableRow className="border-t-2 bg-muted font-bold">
              <TableCell>
                Zahllast{' '}
                {isRefund && (
                  <span className="text-green-600 font-normal">(Erstattung)</span>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  isRefund ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(Math.abs(ustVoranmeldung.zahllast))}
                {isRefund && ' (Erstattung)'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Explanation */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <strong>Zahllast</strong>: Umsatzsteuer − Vorsteuer
        </p>
        <p>
          Positiver Betrag = Zahlung an das Finanzamt fällig
          <br />
          Negativer Betrag = Erstattung vom Finanzamt erwartet
        </p>
      </div>
    </div>
  )
}

export default UstVoranmeldungList
