/**
 * UnmatchedQueue Component
 *
 * Focused view of unmatched transactions with:
 * - Bulk actions: Auto-match all, Ignore selected
 * - Quick match for high-confidence suggestions
 * - Counter badge
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Ban,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import type { BankTransaction } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface UnmatchedQueueProps {
  transactions: BankTransaction[]
  isLoading?: boolean
  onAutoMatchAll?: () => Promise<void>
  onIgnoreSelected?: (txIds: string[]) => Promise<void>
  onRowClick?: (tx: BankTransaction) => void
  className?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  })
}

export function UnmatchedQueue({
  transactions,
  isLoading,
  onAutoMatchAll,
  onIgnoreSelected,
  onRowClick,
  className,
}: UnmatchedQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [autoMatching, setAutoMatching] = useState(false)
  const [ignoring, setIgnoring] = useState(false)

  const unmatched = transactions.filter((tx) => tx.match_status === 'unmatched')
  const suggestedCount = unmatched.filter(
    (tx) => tx.match_confidence !== null && tx.match_confidence > 0.5
  ).length

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === unmatched.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unmatched.map((tx) => tx.id)))
    }
  }

  const handleAutoMatchAll = async () => {
    setAutoMatching(true)
    try {
      await onAutoMatchAll?.()
    } finally {
      setAutoMatching(false)
    }
  }

  const handleIgnoreSelected = async () => {
    setIgnoring(true)
    try {
      await onIgnoreSelected?.(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setIgnoring(false)
    }
  }

  if (unmatched.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
          <p className="text-muted-foreground font-medium">
            Alle Transaktionen zugeordnet! 🎉
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Keine offenen Transaktionen vorhanden.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Offene Transaktionen</CardTitle>
            <Badge variant="destructive" className="h-6">
              {unmatched.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleIgnoreSelected}
                disabled={ignoring}
              >
                {ignoring ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Ban className="h-3.5 w-3.5 mr-1.5" />
                )}
                {selectedIds.size} ignorieren
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleAutoMatchAll}
              disabled={autoMatching || unmatched.length === 0}
            >
              {autoMatching ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 mr-1.5" />
              )}
              Auto-Match
              {suggestedCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 text-[10px]">
                  {suggestedCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Select all */}
        <div className="flex items-center gap-2 pb-2 border-b mb-2">
          <Checkbox
            checked={selectedIds.size === unmatched.length && unmatched.length > 0}
            onCheckedChange={toggleSelectAll}
            aria-label="Alle auswählen"
          />
          <span className="text-xs text-muted-foreground">Alle auswählen</span>
        </div>

        {/* Transaction list */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {unmatched.map((tx) => {
            const isIncoming = tx.amount >= 0
            const hasSuggestion =
              tx.match_confidence !== null && tx.match_confidence > 0.5
            const isSelected = selectedIds.has(tx.id)

            return (
              <div
                key={tx.id}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border transition-colors',
                  isSelected
                    ? 'bg-primary/5 border-primary/30'
                    : hasSuggestion
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    : 'hover:bg-muted/50'
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(tx.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Transaktion ${tx.counterpart_name || 'auswählen'}`}
                />
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onRowClick?.(tx)}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 p-1 rounded-full',
                      isIncoming ? 'bg-green-100' : 'bg-red-100'
                    )}
                  >
                    {isIncoming ? (
                      <ArrowDownLeft className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">
                        {tx.counterpart_name || 'Unbekannt'}
                      </p>
                      {hasSuggestion && (
                        <Sparkles className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {tx.purpose || '—'} · {formatDate(tx.booking_date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-mono font-medium text-sm flex-shrink-0',
                      isIncoming ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {isIncoming ? '+' : ''}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
