/**
 * InvoiceDialog Component
 *
 * Dialog wrapper for InvoiceForm to create and edit invoice records.
 * Manages the dialog state and connects form submission to the invoice store.
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { InvoiceForm } from './InvoiceForm'
import { invoiceService } from '@/services'
import type { Invoice, NewInvoice } from '../../types'
import { toast } from 'sonner'

export interface InvoiceDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Invoice record to edit (null for create mode) */
  invoice?: Invoice | null
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when invoice is successfully created or updated */
  onSuccess?: () => void
}

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onClose,
  onSuccess,
}: InvoiceDialogProps) {
  const handleSubmit = async (data: NewInvoice) => {
    try {
      if (invoice) {
        await invoiceService.update(invoice.id, {
          issueDate: data.invoiceDate.toISOString(),
          dueDate: data.dueDate.toISOString(),
          clientId: data.clientId || '',
          projectId: data.projectId,
          taxRate: data.vatRate,
          notes: data.notes,
          lineItems: data.items.map(item => ({
            id: crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'hours',
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
          })),
        })
        toast.success('Invoice updated')
      } else {
        const newInvoice = await invoiceService.create({
          invoiceNumber: '',
          clientId: data.clientId || '',
          projectId: data.projectId,
          issueDate: data.invoiceDate.toISOString(),
          dueDate: data.dueDate.toISOString(),
          status: 'draft',
          amount: data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
          currency: 'EUR',
          taxRate: data.vatRate,
          taxAmount: 0,
          totalAmount: 0,
          notes: data.notes,
          lineItems: data.items.map(item => ({
            id: crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'hours',
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
          })),
          updatedAt: new Date().toISOString(),
        })
        toast.success(`Invoice ${newInvoice.invoiceNumber} created`)
      }
      onClose()
      onSuccess?.()
    } catch (err) {
      console.error('Invoice save error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save invoice')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] max-w-[700px] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 [&>*]:max-w-full">
        <InvoiceForm
          invoice={invoice || undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export default InvoiceDialog
