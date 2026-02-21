/**
 * InvoiceList Component
 *
 * Displays a table of invoices with status badges, filtering,
 * and summary statistics. Supports invoice status management.
 */

import { useState, useMemo } from 'react'
import { useInvoices } from '../../hooks/useInvoices'
import type { Invoice, InvoiceStatus } from '../../types'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Search, Loader2, Send, Check, Download, Lock } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { api, isWebBuild } from '@/lib/api'
import { usePeriodLocks } from '../../hooks/usePeriodLocks'
import { isRecordLocked } from '../../utils/isRecordLocked'

export interface InvoiceListProps {
  /** Callback when new invoice button is clicked */
  onAddInvoice?: () => void
  /** Callback when an invoice is selected for editing */
  onEditInvoice?: (invoice: Invoice) => void
  /** Callback when an invoice is selected for preview */
  onPreviewInvoice?: (invoice: Invoice) => void
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

/**
 * Get status badge variant and label
 */
function getStatusBadge(status: InvoiceStatus): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  switch (status) {
    case 'draft':
      return { variant: 'secondary', label: 'Draft' }
    case 'sent':
      return { variant: 'default', label: 'Sent' }
    case 'paid':
      return { variant: 'outline', label: 'Paid' }
    case 'overdue':
      return { variant: 'destructive', label: 'Overdue' }
    case 'cancelled':
      return { variant: 'secondary', label: 'Cancelled' }
    default:
      return { variant: 'secondary', label: status }
  }
}

export function InvoiceList({
  onAddInvoice,
  onEditInvoice,
  onPreviewInvoice,
  className,
}: InvoiceListProps) {
  const {
    invoices,
    isLoading,
    error,
    deleteInvoice,
    markAsSent,
    markAsPaid,
    setSelectedInvoice,
  } = useInvoices()

  const { periods } = usePeriodLocks()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let result = invoices

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(term) ||
          invoice.notes?.toLowerCase().includes(term)
      )
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((invoice) => invoice.status === statusFilter)
    }

    return result
  }, [invoices, searchTerm, statusFilter])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const outstanding = invoices
      .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.total, 0)

    const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length

    return { outstanding, overdueCount }
  }, [invoices])

  // Handle row click
  const handleRowClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    onEditInvoice?.(invoice)
  }

  // Handle delete
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingInvoiceId(id)
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (deletingInvoiceId) {
      await deleteInvoice(deletingInvoiceId)
      setDeletingInvoiceId(null)
    }
  }

  // Handle mark as sent
  const handleMarkAsSent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await markAsSent(id)
  }

  // Handle mark as paid
  const handleMarkAsPaid = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await markAsPaid(id, new Date())
  }

  // Handle PDF download
  const handleDownloadPdf = async (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation()

    // Only available in web build (uses REST API)
    if (!isWebBuild()) {
      console.warn('PDF download is only available in web mode')
      return
    }

    setDownloadingId(invoice.id)

    try {
      const blob = await api.downloadInvoicePdf(invoice.id)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-destructive">{getErrorMessage(error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
        <Button onClick={onAddInvoice}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Status filter */}
        <div className="w-48">
          <Label htmlFor="statusFilter" className="sr-only">
            Status
          </Label>
          <select
            id="statusFilter"
            aria-label="Status"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      {invoices.length > 0 && (
        <div className="flex gap-4">
          <div className="rounded-lg bg-muted px-4 py-2">
            <span className="text-sm text-muted-foreground">Outstanding: </span>
            <span className="font-semibold">{formatCurrency(summary.outstanding)}</span>
          </div>
          {summary.overdueCount > 0 && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
              <span className="font-semibold">{summary.overdueCount} overdue</span>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {filteredInvoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== 'all'
              ? 'No invoices match your filters'
              : 'No invoices yet. Create your first invoice to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[32px]"></TableHead>
                  <TableHead>Invoice №</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => {
                  const statusBadge = getStatusBadge(invoice.status)
                  const locked = isRecordLocked(invoice.invoiceDate, periods)

                  return (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(invoice)}
                    >
                      <TableCell className="w-[32px] px-2">
                        {locked && (
                          <Lock className="h-3.5 w-3.5 text-red-400" aria-label="Gesperrt" title="Zeitraum gesperrt" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {/* Download PDF button (only in web mode) */}
                          {isWebBuild() && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDownloadPdf(e, invoice)}
                              aria-label="Download PDF"
                              title="Download PDF"
                              disabled={downloadingId === invoice.id}
                            >
                              {downloadingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              )}
                            </Button>
                          )}
                          {invoice.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleMarkAsSent(e, invoice.id)}
                              aria-label="Send"
                              title="Mark as Sent"
                            >
                              <Send className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                          )}
                          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleMarkAsPaid(e, invoice.id)}
                              aria-label="Mark as Paid"
                              title="Mark as Paid"
                            >
                              <Check className="h-4 w-4 text-muted-foreground hover:text-green-600" />
                            </Button>
                          )}
                          {/* Delete button for all statuses */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(e, invoice.id)}
                            aria-label="Delete"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingInvoiceId}
        onOpenChange={(open) => !open && setDeletingInvoiceId(null)}
        title="Delete invoice?"
        description="This will permanently delete this invoice. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default InvoiceList
