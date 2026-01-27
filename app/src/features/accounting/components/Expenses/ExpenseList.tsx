/**
 * ExpenseList Component
 *
 * Displays a table of expense records with sorting, filtering,
 * and summary statistics. Shows Vorsteuer, GWG status, and recurring indicators.
 */

import { useState, useMemo, useEffect } from 'react'
import { useExpenses } from '../../hooks/useExpenses'
import type { Expense } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Search, Loader2 } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export interface ExpenseListProps {
  /** Callback when add expense button is clicked */
  onAddExpense?: () => void
  /** Callback when an expense record is selected for editing */
  onEditExpense?: (expense: Expense) => void
  /** Additional CSS classes */
  className?: string
  /** Trigger to refresh the expense list */
  refreshTrigger?: number
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

export function ExpenseList({
  onAddExpense,
  onEditExpense,
  className,
  refreshTrigger,
}: ExpenseListProps) {
  const {
    expenses,
    isLoading,
    error,
    deleteExpense,
    setSelectedExpense,
    refresh,
  } = useExpenses()

  const [searchTerm, setSearchTerm] = useState('')
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh()
    }
  }, [refreshTrigger, refresh])

  // Filter expenses by search term
  const filteredExpenses = useMemo(() => {
    if (!searchTerm) return expenses

    const term = searchTerm.toLowerCase()
    return expenses.filter(
      (item) =>
        item.description.toLowerCase().includes(term) ||
        item.vendor.toLowerCase().includes(term) ||
        item.euerCategory.toLowerCase().includes(term)
    )
  }, [expenses, searchTerm])

  // Calculate totals
  const totals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, item) => ({
        net: acc.net + item.netAmount,
        vat: acc.vat + item.vatAmount,
        gross: acc.gross + item.grossAmount,
      }),
      { net: 0, vat: 0, gross: 0 }
    )
  }, [filteredExpenses])

  // Handle row click
  const handleRowClick = (item: Expense) => {
    setSelectedExpense(item)
    onEditExpense?.(item)
  }

  // Handle delete
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingExpenseId(id)
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (deletingExpenseId) {
      await deleteExpense(deletingExpenseId)
      setDeletingExpenseId(null)
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
        <p className="text-destructive">{error}</p>
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
        <h2 className="text-2xl font-semibold tracking-tight">Expenses</h2>
        <Button onClick={onAddExpense}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search expenses..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Empty state */}
      {filteredExpenses.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchTerm
              ? 'No expense records match your search'
              : 'No expense records yet. Add your first expense to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Vorsteuer</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className="font-medium">
                      {formatDate(item.date)}
                    </TableCell>
                    <TableCell>{item.vendor}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{item.description}</span>
                        {item.vorsteuerClaimed && (
                          <Badge variant="secondary" className="text-xs">
                            Claimed
                          </Badge>
                        )}
                        {item.isRecurring && (
                          <Badge variant="outline" className="text-xs">
                            Recurring
                          </Badge>
                        )}
                        {item.isGwg && (
                          <Badge variant="default" className="text-xs">
                            GWG
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.vatRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.netAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.vatAmount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.grossAmount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(e, item.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex justify-end">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm font-medium text-muted-foreground">Total</div>
              <div className="mt-1 grid grid-cols-3 gap-4 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Net</div>
                  <div className="font-medium">{formatCurrency(totals.net)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Vorsteuer</div>
                  <div className="font-medium">{formatCurrency(totals.vat)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gross</div>
                  <div className="font-semibold">{formatCurrency(totals.gross)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingExpenseId}
        onOpenChange={(open) => !open && setDeletingExpenseId(null)}
        title="Delete expense?"
        description="This will permanently delete this expense record. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default ExpenseList
