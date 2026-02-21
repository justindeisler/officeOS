/**
 * DuplicatesPage
 *
 * Management page for viewing and resolving marked duplicate records.
 * Accessible from /accounting/duplicates
 *
 * Features:
 * - List all marked duplicates grouped by original
 * - Unmark button per duplicate
 * - Filter by type (income/expense)
 * - Stats: count of marked duplicates
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2, Copy, ArrowRight, Filter, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { listMarkedDuplicates, unmarkDuplicate } from '@/features/accounting/api/duplicates'
import type { MarkedDuplicate } from '@/features/accounting/api/duplicates'

type TypeFilter = 'all' | 'income' | 'expense'

/**
 * Format a number as Euro currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format an ISO date string to German locale
 */
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function DuplicatesPage() {
  const navigate = useNavigate()
  const [duplicates, setDuplicates] = useState<MarkedDuplicate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [unmarkingIds, setUnmarkingIds] = useState<Set<string>>(new Set())

  const loadDuplicates = useCallback(async () => {
    setIsLoading(true)
    try {
      const filterType = typeFilter === 'all' ? undefined : typeFilter
      const data = await listMarkedDuplicates(filterType)
      setDuplicates(data)
    } catch (error) {
      console.error('Failed to load duplicates:', error)
      toast.error('Failed to load duplicate records')
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    loadDuplicates()
  }, [loadDuplicates])

  const handleUnmark = async (dup: MarkedDuplicate) => {
    setUnmarkingIds((prev) => new Set(prev).add(dup.id))
    try {
      await unmarkDuplicate(dup.type, dup.id)
      setDuplicates((prev) => prev.filter((d) => d.id !== dup.id))
      toast.success('Record unmarked as duplicate')
    } catch (error) {
      console.error('Failed to unmark duplicate:', error)
      toast.error('Failed to unmark duplicate')
    } finally {
      setUnmarkingIds((prev) => {
        const next = new Set(prev)
        next.delete(dup.id)
        return next
      })
    }
  }

  const handleViewRecord = (dup: MarkedDuplicate) => {
    const basePath = dup.type === 'expense' ? '/accounting/expenses' : '/accounting/income'
    navigate(basePath, { state: { highlightId: dup.id } })
  }

  const handleViewOriginal = (dup: MarkedDuplicate) => {
    const basePath = dup.type === 'expense' ? '/accounting/expenses' : '/accounting/income'
    navigate(basePath, { state: { highlightId: dup.duplicate_of_id } })
  }

  // Group duplicates by duplicate_of_id
  const grouped = duplicates.reduce<Record<string, MarkedDuplicate[]>>((acc, dup) => {
    const key = dup.duplicate_of_id
    if (!acc[key]) acc[key] = []
    acc[key].push(dup)
    return acc
  }, {})

  // Stats
  const totalDuplicates = duplicates.length
  const expenseCount = duplicates.filter((d) => d.type === 'expense').length
  const incomeCount = duplicates.filter((d) => d.type === 'income').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Duplicate Records</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage records that have been marked as duplicates.
          Duplicates are excluded from EÜR and USt calculations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Total Duplicates</div>
          <div className="text-2xl font-bold mt-1" data-testid="total-duplicates">
            {totalDuplicates}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Expense Duplicates</div>
          <div className="text-2xl font-bold mt-1" data-testid="expense-duplicates">
            {expenseCount}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-muted-foreground">Income Duplicates</div>
          <div className="text-2xl font-bold mt-1" data-testid="income-duplicates">
            {incomeCount}
          </div>
        </div>
      </div>

      {/* Filter & Refresh */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Filter by type">
          {(['all', 'expense', 'income'] as TypeFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              role="radio"
              aria-checked={typeFilter === filter}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === filter
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTypeFilter(filter)}
            >
              {filter === 'all' ? 'All' : filter === 'expense' ? 'Expenses' : 'Income'}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadDuplicates}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : totalDuplicates === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Copy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No duplicates found</h3>
          <p className="text-sm mt-1">
            {typeFilter !== 'all'
              ? `No ${typeFilter} records are currently marked as duplicates.`
              : 'No records are currently marked as duplicates.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([originalId, dups]) => (
            <div key={originalId} className="rounded-lg border" data-testid="duplicate-group">
              {/* Group Header */}
              <div className="p-4 bg-muted/50 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium">
                      Original: {originalId.slice(0, 8)}...
                    </span>
                    <Badge variant="secondary">
                      {dups.length} duplicate{dups.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewOriginal(dups[0])}
                  >
                    View Original
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Duplicate Rows */}
              <div className="divide-y">
                {dups.map((dup) => (
                  <div
                    key={dup.id}
                    className="p-4 flex items-center justify-between"
                    data-testid="duplicate-row"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={dup.type === 'expense' ? 'destructive' : 'default'}>
                          {dup.type}
                        </Badge>
                        <span className="font-medium truncate">{dup.partner}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(dup.amount)} · {formatDate(dup.date)}
                        {dup.description && dup.description !== dup.partner && (
                          <span className="ml-2">— {dup.description}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewRecord(dup)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnmark(dup)}
                        disabled={unmarkingIds.has(dup.id)}
                        data-testid={`unmark-${dup.id}`}
                      >
                        {unmarkingIds.has(dup.id) ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : null}
                        Unmark
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
