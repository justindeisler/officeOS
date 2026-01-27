/**
 * ExpenseDialog Component
 *
 * Dialog wrapper for ExpenseForm to create and edit expense records.
 * Manages the dialog state and connects form submission to the expenses store.
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { ExpenseForm } from './ExpenseForm'
import { useExpenses } from '../../hooks/useExpenses'
import type { Expense, NewExpense } from '../../types'

export interface ExpenseDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Expense record to edit (null for create mode) */
  expense?: Expense | null
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when expense is successfully created or updated */
  onSuccess?: () => void
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  onClose,
  onSuccess,
}: ExpenseDialogProps) {
  const { createExpense, updateExpense } = useExpenses()

  const handleSubmit = async (data: NewExpense) => {
    if (expense) {
      await updateExpense(expense.id, data)
    } else {
      await createExpense(data)
    }
    onSuccess?.()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <ExpenseForm
          expense={expense || undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export default ExpenseDialog
