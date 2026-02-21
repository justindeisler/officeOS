/**
 * ZmReportView Component
 *
 * Displays the Zusammenfassende Meldung (EU Sales List) report.
 * Shows EU client VAT IDs with quarterly totals.
 * Supports ELSTER XML generation.
 */

import { useState, useCallback } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ElsterZmResult } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Download, FileCode, CheckCircle2, AlertTriangle } from 'lucide-react'

export interface ZmReportViewProps {
  /** Additional CSS classes */
  className?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
}

function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const month = new Date().getMonth()
  return (Math.floor(month / 3) + 1) as 1 | 2 | 3 | 4
}

export function ZmReportView({ className }: ZmReportViewProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(getCurrentQuarter())
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zmResult, setZmResult] = useState<ElsterZmResult | null>(null)

  const availableYears = getAvailableYears()

  // Generate ZM report
  const handleGenerate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.generateZmElster(selectedYear, selectedQuarter, true)
      setZmResult(result)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear, selectedQuarter])

  // Download XML
  const handleDownloadXml = useCallback(() => {
    if (!zmResult?.xml) return
    const blob = new Blob([zmResult.xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ZM-${selectedYear}-Q${selectedQuarter}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [zmResult, selectedYear, selectedQuarter])

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Zusammenfassende Meldung (ZM)</h2>
          <p className="text-sm text-muted-foreground mt-1">
            EU-Umsätze für das Bundeszentralamt für Steuern
          </p>
        </div>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Jahr:</label>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Quartal:</label>
          <Select value={String(selectedQuarter)} onValueChange={v => setSelectedQuarter(Number(v) as 1|2|3|4)}>
            <SelectTrigger className="w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1</SelectItem>
              <SelectItem value="2">Q2</SelectItem>
              <SelectItem value="3">Q3</SelectItem>
              <SelectItem value="4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleGenerate} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <FileCode className="mr-2 h-4 w-4" />
          ZM berechnen
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {zmResult && (
        <>
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-sm">
              {zmResult.entryCount} EU-Kunden
            </Badge>
            <Badge variant="outline" className="text-sm">
              Gesamtbetrag: {formatCurrency(zmResult.taxData.totalAmount)}
            </Badge>
            <Badge variant="outline" className="text-sm font-mono">
              Submission: {zmResult.submission.id.slice(0, 8)}...
            </Badge>
          </div>

          {/* EU Client Table */}
          {zmResult.taxData.entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <p>Keine EU-Umsätze im Zeitraum Q{selectedQuarter} {selectedYear}</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>USt-IdNr.</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Bemessungsgrundlage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zmResult.taxData.entries.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">{entry.vatId}</TableCell>
                      <TableCell>{entry.name || '—'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(entry.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="border-t-2 bg-muted font-bold">
                    <TableCell colSpan={2}>Summe</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(zmResult.taxData.totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Download XML */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleDownloadXml}>
              <Download className="mr-2 h-4 w-4" />
              ELSTER XML herunterladen
            </Button>
          </div>

          {/* Info */}
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
              <p>
                Die ZM muss quartalsweise an das Bundeszentralamt für Steuern (BZSt) 
                über das ELSTER-Portal übermittelt werden. Laden Sie die XML-Datei 
                herunter und importieren Sie diese in Ihre Steuersoftware oder 
                das ELSTER-Online-Portal.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Initial state - no data yet */}
      {!zmResult && !error && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p>Wählen Sie Jahr und Quartal und klicken Sie "ZM berechnen", um die EU-Umsätze zu berechnen.</p>
        </div>
      )}
    </div>
  )
}

export default ZmReportView
