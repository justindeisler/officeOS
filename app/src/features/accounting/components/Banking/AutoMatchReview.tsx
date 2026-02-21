/**
 * AutoMatchReview Component
 *
 * Review auto-match suggestions before confirming:
 * - List of suggested matches with confidence scores
 * - Accept/Reject per suggestion
 * - Bulk accept high-confidence (>80%)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Check,
  X,
  Zap,
  Sparkles,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
} from 'lucide-react'
import type { BankTransaction } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface AutoMatchSuggestion {
  transaction: BankTransaction
  matchType: string
  matchedId: string
  confidence: number
  reason: string
}

export interface AutoMatchReviewProps {
  suggestions: AutoMatchSuggestion[]
  isLoading?: boolean
  onAccept?: (txId: string, matchType: string, matchedId: string) => Promise<void>
  onReject?: (txId: string) => void
  onAcceptAll?: (minConfidence?: number) => Promise<void>
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
    year: 'numeric',
  })
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 bg-green-100'
  if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100'
  return 'text-red-600 bg-red-100'
}

function getMatchTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    invoice: 'Rechnung',
    expense: 'Ausgabe',
    income: 'Einnahme',
  }
  return labels[type] || type
}

export function AutoMatchReview({
  suggestions,
  isLoading,
  onAccept,
  onReject,
  onAcceptAll,
  className,
}: AutoMatchReviewProps) {
  const [accepting, setAccepting] = useState<string | null>(null)
  const [acceptingAll, setAcceptingAll] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.transaction.id))
  const highConfidenceCount = visibleSuggestions.filter((s) => s.confidence >= 0.8).length

  const handleAccept = async (suggestion: AutoMatchSuggestion) => {
    setAccepting(suggestion.transaction.id)
    try {
      await onAccept?.(
        suggestion.transaction.id,
        suggestion.matchType,
        suggestion.matchedId
      )
      setDismissed((prev) => new Set([...prev, suggestion.transaction.id]))
    } finally {
      setAccepting(null)
    }
  }

  const handleReject = (txId: string) => {
    onReject?.(txId)
    setDismissed((prev) => new Set([...prev, txId]))
  }

  const handleAcceptAllHighConfidence = async () => {
    setAcceptingAll(true)
    try {
      await onAcceptAll?.(0.8)
      const highConfIds = new Set(
        suggestions.filter((s) => s.confidence >= 0.8).map((s) => s.transaction.id)
      )
      setDismissed((prev) => new Set([...prev, ...highConfIds]))
    } finally {
      setAcceptingAll(false)
    }
  }

  if (visibleSuggestions.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
          <p className="text-muted-foreground">
            Keine Auto-Match Vorschläge zu prüfen.
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
            <Sparkles className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base">Auto-Match Vorschläge</CardTitle>
            <Badge variant="secondary">{visibleSuggestions.length}</Badge>
          </div>
          {highConfidenceCount > 0 && (
            <Button
              size="sm"
              onClick={handleAcceptAllHighConfidence}
              disabled={acceptingAll}
            >
              {acceptingAll ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              Alle &gt;80% akzeptieren ({highConfidenceCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {visibleSuggestions.map((suggestion) => {
            const tx = suggestion.transaction
            const isIncoming = tx.amount >= 0
            const isProcessing = accepting === tx.id

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                {/* Transaction info */}
                <div
                  className={cn(
                    'flex-shrink-0 p-1.5 rounded-full',
                    isIncoming ? 'bg-green-100' : 'bg-red-100'
                  )}
                >
                  {isIncoming ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {tx.counterpart_name || 'Unbekannt'}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {getMatchTypeLabel(suggestion.matchType)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {suggestion.reason}
                  </p>
                </div>

                <span
                  className={cn(
                    'font-mono font-medium text-sm flex-shrink-0',
                    isIncoming ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {formatCurrency(tx.amount)}
                </span>

                {/* Confidence badge */}
                <Badge
                  className={cn(
                    'text-xs font-mono flex-shrink-0',
                    getConfidenceColor(suggestion.confidence)
                  )}
                  variant="outline"
                >
                  {Math.round(suggestion.confidence * 100)}%
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-600 hover:bg-green-100"
                    onClick={() => handleAccept(suggestion)}
                    disabled={isProcessing}
                    title="Akzeptieren"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-100"
                    onClick={() => handleReject(tx.id)}
                    disabled={isProcessing}
                    title="Ablehnen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
