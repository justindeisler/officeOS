/**
 * ElsterHistoryList Component
 *
 * Lists past ELSTER submissions (USt-VA, ZM, EÜR).
 * Shows status badges, download buttons, and transfer tickets.
 */

import { useState, useEffect, useCallback } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ElsterSubmission } from '@/lib/api'
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
import { Loader2, Download, FileCode } from 'lucide-react'

export interface ElsterHistoryListProps {
  /** Additional CSS classes */
  className?: string
}

const TYPE_LABELS: Record<string, string> = {
  ust_va: 'USt-VA',
  zm: 'ZM',
  euer: 'EÜR',
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'secondary' },
  validated: { label: 'Validiert', variant: 'outline' },
  submitted: { label: 'Übermittelt', variant: 'default' },
  accepted: { label: 'Akzeptiert', variant: 'default' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' },
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
}

export function ElsterHistoryList({ className }: ElsterHistoryListProps) {
  const [submissions, setSubmissions] = useState<ElsterSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterYear, setFilterYear] = useState<string>('all')

  const availableYears = getAvailableYears()

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const filters: { type?: string; year?: number } = {}
      if (filterType !== 'all') filters.type = filterType
      if (filterYear !== 'all') filters.year = parseInt(filterYear)
      const data = await api.getElsterSubmissions(filters)
      setSubmissions(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [filterType, filterYear])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleDownloadXml = (submission: ElsterSubmission) => {
    if (!submission.xml) return
    const blob = new Blob([submission.xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const typeLabel = TYPE_LABELS[submission.type] || submission.type
    link.download = `${typeLabel}-${submission.period_key}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">ELSTER-Verlauf</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Übersicht aller ELSTER-Übermittlungen
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Typ:</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="ust_va">USt-VA</SelectItem>
              <SelectItem value="zm">ZM</SelectItem>
              <SelectItem value="euer">EÜR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Jahr:</label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && submissions.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Keine ELSTER-Übermittlungen gefunden
        </div>
      )}

      {/* Table */}
      {!isLoading && submissions.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Typ</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Transferticket</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => {
                const statusConfig = STATUS_CONFIG[sub.status] || STATUS_CONFIG.draft
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileCode className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{TYPE_LABELS[sub.type] || sub.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{sub.period_key}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                      {sub.test_mode && (
                        <Badge variant="outline" className="ml-1 text-xs">Test</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(sub.created_at)}
                    </TableCell>
                    <TableCell>
                      {sub.transfer_ticket ? (
                        <span className="font-mono text-xs">{sub.transfer_ticket}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.xml && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadXml(sub)}
                          aria-label="XML herunterladen"
                          title="XML herunterladen"
                        >
                          <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default ElsterHistoryList
