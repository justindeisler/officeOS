/**
 * IncomeDialog Component
 *
 * Dialog wrapper for IncomeForm to create and edit income records.
 * Manages the dialog state and connects form submission to the income store.
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { IncomeForm } from './IncomeForm'
import { useIncome } from '../../hooks/useIncome'
import type { Income, NewIncome } from '../../types'

export interface IncomeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Income record to edit (null for create mode) */
  income?: Income | null
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when income is successfully created or updated */
  onSuccess?: () => void
}

export function IncomeDialog({
  open,
  onOpenChange,
  income,
  onClose,
  onSuccess,
}: IncomeDialogProps) {
  const { createIncome, updateIncome } = useIncome()

  const handleSubmit = async (data: NewIncome) => {
    if (income) {
      await updateIncome(income.id, data)
    } else {
      await createIncome(data)
    }
    onSuccess?.()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[600px] max-h-[90vh] overflow-y-auto">
        <IncomeForm
          income={income || undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export default IncomeDialog
