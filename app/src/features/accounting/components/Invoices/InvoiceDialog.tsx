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
import * as invoicesApi from '../../api/invoices'
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
        await invoicesApi.updateInvoice(invoice.id, data)
        toast.success('Invoice updated')
      } else {
        const newInvoice = await invoicesApi.createInvoice(data)
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
