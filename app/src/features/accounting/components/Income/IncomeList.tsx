/**
 * IncomeList Component
 *
 * Displays a table of income records with sorting, filtering,
 * and summary statistics.
 */

import { useState, useMemo, useEffect } from 'react'
import { useIncome } from '../../hooks/useIncome'
import type { Income } from '../../types'
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
import { Trash2, Plus, Search, Loader2, FileText } from 'lucide-react'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'

export interface IncomeListProps {
  /** Callback when add income button is clicked */
  onAddIncome?: () => void
  /** Callback when an income record is selected for editing */
  onEditIncome?: (income: Income) => void
  /** Additional CSS classes */
  className?: string
  /** Trigger to refresh the income list */
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

export function IncomeList({
  onAddIncome,
  onEditIncome,
  className,
  refreshTrigger,
}: IncomeListProps) {
  const {
    income,
    isLoading,
    error,
    deleteIncome,
    setSelectedIncome,
    refresh,
  } = useIncome()

  const [searchTerm, setSearchTerm] = useState('')
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null)

  // Refresh when trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh()
    }
  }, [refreshTrigger, refresh])

  // Filter income by search term
  const filteredIncome = useMemo(() => {
    if (!searchTerm) return income

    const term = searchTerm.toLowerCase()
    return income.filter(
      (item) =>
        item.description.toLowerCase().includes(term) ||
        item.euerCategory.toLowerCase().includes(term)
    )
  }, [income, searchTerm])

  // Calculate totals
  const totals = useMemo(() => {
    return filteredIncome.reduce(
      (acc, item) => ({
        net: acc.net + item.netAmount,
        vat: acc.vat + item.vatAmount,
        gross: acc.gross + item.grossAmount,
      }),
      { net: 0, vat: 0, gross: 0 }
    )
  }, [filteredIncome])

  // Handle row click
  const handleRowClick = (item: Income) => {
    setSelectedIncome(item)
    onEditIncome?.(item)
  }

  // Handle delete
  const handleDelete = (e: React.MouseEvent, item: Income) => {
    e.stopPropagation()

    // Prevent deletion of income records linked to invoices
    if (item.invoiceId) {
      alert('This income record was auto-generated from an invoice. To remove it, cancel or modify the original invoice.')
      return
    }

    setDeletingIncomeId(item.id)
  }

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (deletingIncomeId) {
      await deleteIncome(deletingIncomeId)
      setDeletingIncomeId(null)
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Income</h2>
        <Button onClick={onAddIncome} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search income..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Empty state */}
      {filteredIncome.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {searchTerm
              ? 'No income records match your search'
              : 'No income records yet. Add your first income to get started.'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIncome.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(item)}
                  >
                    <TableCell className="font-medium">
                      {formatDate(item.date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.invoiceId && (
                          <span title="From Invoice">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </span>
                        )}
                        <span>{item.description}</span>
                        {item.invoiceId && (
                          <Badge variant="outline" className="text-xs">
                            Invoice
                          </Badge>
                        )}
                        {item.ustReported && (
                          <Badge variant="secondary" className="text-xs">
                            Reported
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
                      {item.invoiceId ? (
                        <span className="text-xs text-muted-foreground" title="Managed by invoice">
                          —
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleDelete(e, item)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="flex justify-start sm:justify-end">
            <div className="rounded-lg bg-muted p-3 sm:p-4 w-full sm:w-auto">
              <div className="text-sm font-medium text-muted-foreground">Total</div>
              <div className="mt-1 grid grid-cols-3 gap-2 sm:gap-4 text-right">
                <div>
                  <div className="text-xs text-muted-foreground">Net</div>
                  <div className="font-medium text-sm sm:text-base">{formatCurrency(totals.net)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">VAT</div>
                  <div className="font-medium text-sm sm:text-base">{formatCurrency(totals.vat)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Gross</div>
                  <div className="font-semibold text-sm sm:text-base">{formatCurrency(totals.gross)}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingIncomeId}
        onOpenChange={(open) => !open && setDeletingIncomeId(null)}
        title="Delete income?"
        description="This will permanently delete this income record. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

export default IncomeList
