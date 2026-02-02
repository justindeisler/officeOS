/**
 * Accounting InvoicesPage
 *
 * Unified invoices management page under the Accounting feature.
 * Combines polished UI from legacy InvoicesPage with the accounting
 * system's database-backed infrastructure and German tax compliance.
 */

import { useState, useMemo, useEffect } from 'react'
import { Plus, FileText, TrendingUp, Send, Check, Trash2, Download, Loader2 } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { MoneyRain } from '@/components/ui/MoneyRain'
import { useCelebration } from '@/hooks/useCelebration'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { InvoiceDialog } from '@/features/accounting/components/Invoices'
import { useInvoices } from '@/features/accounting/hooks/useInvoices'
import { api } from '@/lib/api'
import { useClients } from '@/features/accounting/hooks/useClients'
import { useProjectStore } from '@/stores/projectStore'
import type { Invoice, InvoiceStatus } from '@/features/accounting/types'
import { toast } from 'sonner'
import { isPast } from 'date-fns'

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
function getStatusBadge(status: InvoiceStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  label: string
} {
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

export function InvoicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [deletingInvoice, setDeletingInvoice] = useState<Invoice | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Celebration animation for paid invoices
  const celebration = useCelebration()

  const {
    invoices,
    isLoading,
    error,
    markAsSent,
    markAsPaid,
    deleteInvoice,
    refresh,
  } = useInvoices()

  const { clients } = useClients()

  const { projects, initialize: initializeProjects } = useProjectStore()

  // Initialize projects store on mount
  useEffect(() => {
    initializeProjects()
  }, [initializeProjects])

  // Create client lookup map for efficient name resolution
  const clientMap = useMemo(() => {
    return new Map(clients.map((c) => [c.id, c]))
  }, [clients])

  // Create project lookup map for efficient name resolution
  const projectMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]))
  }, [projects])

  // Calculate stats
  const stats = useMemo(() => {
    const draft = invoices.filter((inv) => inv.status === 'draft').length
    const sent = invoices.filter(
      (inv) => inv.status === 'sent' && !isPast(inv.dueDate)
    ).length
    const paid = invoices.filter((inv) => inv.status === 'paid').length
    const overdue = invoices.filter(
      (inv) =>
        inv.status === 'overdue' ||
        (inv.status === 'sent' && isPast(inv.dueDate))
    ).length

    // YTD revenue (paid invoices in current year)
    const currentYear = new Date().getFullYear()
    const ytdRevenue = invoices
      .filter(
        (inv) =>
          inv.status === 'paid' &&
          inv.paymentDate &&
          inv.paymentDate.getFullYear() === currentYear
      )
      .reduce((sum, inv) => sum + inv.total, 0)

    return { draft, sent, paid, overdue, ytdRevenue }
  }, [invoices])

  // Calculate monthly revenue for current year
  const monthlyRevenue = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    return months.map((month, index) => {
      const revenue = invoices
        .filter(
          (inv) =>
            inv.status === 'paid' &&
            inv.paymentDate &&
            inv.paymentDate.getFullYear() === currentYear &&
            inv.paymentDate.getMonth() === index
        )
        .reduce((sum, inv) => sum + inv.total, 0)
      return { month, revenue }
    })
  }, [invoices])

  // Filter invoices based on tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const isOverdue =
        inv.status === 'sent' && isPast(inv.dueDate)

      switch (activeTab) {
        case 'draft':
          return inv.status === 'draft'
        case 'sent':
          return inv.status === 'sent' && !isOverdue
        case 'paid':
          return inv.status === 'paid'
        case 'overdue':
          return isOverdue || inv.status === 'overdue'
        default:
          return true
      }
    })
  }, [invoices, activeTab])

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingInvoice(null)
  }

  const handleSuccess = () => {
    refresh()
  }

  const handleMarkAsSent = async (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation()
    const result = await markAsSent(invoice.id)
    if (result) {
      toast.success(`Invoice ${invoice.invoiceNumber} marked as sent`)
    }
  }

  const handleMarkAsPaid = async (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation()
    const result = await markAsPaid(invoice.id, new Date())
    if (result) {
      toast.success(`Invoice ${invoice.invoiceNumber} marked as paid`)
      celebration.trigger() // Trigger money rain celebration!
    }
  }

  const handleDelete = (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation()
    setDeletingInvoice(invoice)
  }

  const handleConfirmDelete = async () => {
    if (deletingInvoice) {
      const result = await deleteInvoice(deletingInvoice.id)
      if (result) {
        toast.success(`Invoice ${deletingInvoice.invoiceNumber} deleted`)
      }
      setDeletingInvoice(null)
    }
  }

  const handleDownloadPdf = async (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation()
    setDownloadingId(invoice.id)

    try {
      const blob = await api.downloadInvoicePdf(invoice.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (err) {
      console.error('Failed to download PDF:', err)
      toast.error('Failed to download PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Invoices
          </h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Money Rain Celebration */}
      <MoneyRain
        isActive={celebration.isActive}
        onComplete={celebration.onComplete}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Invoices
          </h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Draft</p>
            <p className="text-2xl font-bold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">YTD Revenue</p>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(stats.ytdRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      {stats.ytdRevenue > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {new Date().getFullYear()} Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 h-16">
              {monthlyRevenue.map((month, idx) => {
                const maxRevenue = Math.max(
                  ...monthlyRevenue.map((m) => m.revenue)
                )
                const height =
                  maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col justify-end items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/80 rounded-t transition-all"
                      style={{
                        height: `${height}%`,
                        minHeight: height > 0 ? 4 : 0,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {month.month}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-1 sm:inline-flex sm:w-auto">
          <TabsTrigger value="all" className="flex-shrink-0">All ({invoices.length})</TabsTrigger>
          <TabsTrigger value="draft" className="flex-shrink-0">Draft ({stats.draft})</TabsTrigger>
          <TabsTrigger value="sent" className="flex-shrink-0">Sent ({stats.sent})</TabsTrigger>
          <TabsTrigger value="overdue" className="text-destructive flex-shrink-0">
            Overdue ({stats.overdue})
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex-shrink-0">Paid ({stats.paid})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                <p className="text-muted-foreground mt-4">Loading invoices...</p>
              </CardContent>
            </Card>
          ) : filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === 'all'
                    ? 'No invoices yet'
                    : `No ${activeTab} invoices`}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {activeTab === 'all'
                    ? 'Create your first invoice to get started.'
                    : `You don't have any ${activeTab} invoices.`}
                </p>
                {activeTab === 'all' && (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice №</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const statusBadge = getStatusBadge(invoice.status)
                    const isOverdue =
                      invoice.status === 'sent' && isPast(invoice.dueDate)

                    return (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEdit(invoice)}
                      >
                        <TableCell className="font-medium">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          {invoice.clientId
                            ? clientMap.get(invoice.clientId)?.name ?? '—'
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {invoice.projectId
                            ? projectMap.get(invoice.projectId)?.name ?? '—'
                            : '—'}
                        </TableCell>
                        <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                        <TableCell
                          className={isOverdue ? 'text-destructive' : ''}
                        >
                          {formatDate(invoice.dueDate)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isOverdue ? 'destructive' : statusBadge.variant
                            }
                          >
                            {isOverdue ? 'Overdue' : statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(invoice.subtotal)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(invoice.vatAmount)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Download PDF button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDownloadPdf(e, invoice)}
                              title="Download PDF"
                              disabled={downloadingId === invoice.id}
                            >
                              {downloadingId === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              ) : (
                                <Download className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              )}
                            </Button>
                            {invoice.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleMarkAsSent(e, invoice)}
                                title="Mark as Sent"
                              >
                                <Send className="h-4 w-4 text-muted-foreground hover:text-primary" />
                              </Button>
                            )}
                            {(invoice.status === 'sent' ||
                              invoice.status === 'overdue' ||
                              isOverdue) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleMarkAsPaid(e, invoice)}
                                title="Mark as Paid"
                              >
                                <Check className="h-4 w-4 text-muted-foreground hover:text-green-600" />
                              </Button>
                            )}
                            {/* Delete button for all statuses */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDelete(e, invoice)}
                              title="Delete Invoice"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={editingInvoice}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingInvoice}
        onOpenChange={(open) => !open && setDeletingInvoice(null)}
        title={`Delete invoice ${deletingInvoice?.invoiceNumber}?`}
        description="This will permanently delete this invoice. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
