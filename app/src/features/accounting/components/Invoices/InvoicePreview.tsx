/**
 * InvoicePreview Component
 *
 * Displays a formatted preview of an invoice for printing or PDF export.
 * Shows invoice header, line items, totals, and payment information.
 */

import type { Invoice, InvoiceStatus } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Printer, Download, X } from 'lucide-react'

export interface InvoicePreviewProps {
  /** Invoice to preview */
  invoice: Invoice
  /** Callback when print button is clicked */
  onPrint?: () => void
  /** Callback when download button is clicked */
  onDownload?: () => void
  /** Callback when close button is clicked */
  onClose?: () => void
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

export function InvoicePreview({
  invoice,
  onPrint,
  onDownload,
  onClose,
  className,
}: InvoicePreviewProps) {
  const statusBadge = getStatusBadge(invoice.status)

  return (
    <div className={cn('space-y-6 p-6', className)}>
      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Invoice Document */}
      <div className="rounded-lg border bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice</h1>
            <p className="text-xl font-semibold text-muted-foreground">
              {invoice.invoiceNumber}
            </p>
          </div>
          <Badge variant={statusBadge.variant} className="text-sm">
            {statusBadge.label}
          </Badge>
        </div>

        {/* Dates */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Invoice Date</p>
            <p className="font-medium">{formatDate(invoice.invoiceDate)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Due Date</p>
            <p className="font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit === 'hours' ? 'hrs' : item.unit}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="mb-8 ml-auto max-w-xs space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">VAT ({invoice.vatRate}%)</span>
            <span>{formatCurrency(invoice.vatAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>

        {/* Payment Information (for paid invoices) */}
        {invoice.status === 'paid' && invoice.paymentDate && (
          <div className="mb-8 rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
            <p className="font-medium text-green-800 dark:text-green-400">
              Paid on {formatDate(invoice.paymentDate)}
              {invoice.paymentMethod && ` via ${invoice.paymentMethod}`}
            </p>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground">Notes</p>
            <p className="mt-1">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvoicePreview
