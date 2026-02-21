/**
 * TransactionMatchDialog Component
 *
 * Modal showing transaction details with matching options:
 * - Auto-match suggestions (if any)
 * - Manual match: Invoice / Expense / Income / Create New / Ignore
 * - Conditional fields based on selection
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  TrendingDown,
  TrendingUp,
  Ban,
  Loader2,
  Sparkles,
  PlusCircle,
} from 'lucide-react'
import type { BankTransaction } from '@/services/web/bankingService'
import { EXPENSE_CATEGORIES } from '../../types'
import { cn } from '@/lib/utils'

export interface TransactionMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: BankTransaction | null
  onMatchInvoice?: (txId: string, invoiceId: string) => Promise<void>
  onMatchExpense?: (txId: string, expenseId: string) => Promise<void>
  onMatchIncome?: (txId: string, incomeId: string) => Promise<void>
  onCreateExpense?: (
    txId: string,
    data: { category: string; description?: string; vat_rate?: number }
  ) => Promise<void>
  onCreateIncome?: (
    txId: string,
    data: { description?: string; vat_rate?: number; client_id?: string }
  ) => Promise<void>
  onIgnore?: (txId: string, reason?: string) => Promise<void>
  onCreateRule?: (tx: BankTransaction) => void
}

type MatchMode =
  | 'match_invoice'
  | 'match_expense'
  | 'match_income'
  | 'create_expense'
  | 'create_income'
  | 'ignore'

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

export function TransactionMatchDialog({
  open,
  onOpenChange,
  transaction,
  onMatchInvoice,
  onMatchExpense,
  onMatchIncome,
  onCreateExpense,
  onCreateIncome,
  onIgnore,
  onCreateRule,
}: TransactionMatchDialogProps) {
  const [mode, setMode] = useState<MatchMode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Match fields
  const [matchedId, setMatchedId] = useState('')

  // Create expense fields
  const [category, setCategory] = useState('other')
  const [description, setDescription] = useState('')
  const [vatRate, setVatRate] = useState(19)

  // Ignore fields
  const [ignoreReason, setIgnoreReason] = useState('')

  // Reset on open/close
  useEffect(() => {
    if (open && transaction) {
      setMode(null)
      setMatchedId('')
      setCategory('other')
      setDescription(transaction.purpose || '')
      setVatRate(19)
      setIgnoreReason('')

      // Auto-suggest mode based on amount direction
      if (transaction.amount > 0) {
        setMode('create_income')
      } else {
        setMode('create_expense')
      }
    }
  }, [open, transaction])

  if (!transaction) return null

  const tx = transaction
  const isIncoming = tx.amount >= 0

  const handleSubmit = async () => {
    if (!mode) return
    setIsSubmitting(true)
    try {
      switch (mode) {
        case 'match_invoice':
          await onMatchInvoice?.(tx.id, matchedId)
          break
        case 'match_expense':
          await onMatchExpense?.(tx.id, matchedId)
          break
        case 'match_income':
          await onMatchIncome?.(tx.id, matchedId)
          break
        case 'create_expense':
          await onCreateExpense?.(tx.id, {
            category,
            description: description || undefined,
            vat_rate: vatRate,
          })
          break
        case 'create_income':
          await onCreateIncome?.(tx.id, {
            description: description || undefined,
            vat_rate: vatRate,
          })
          break
        case 'ignore':
          await onIgnore?.(tx.id, ignoreReason || undefined)
          break
      }
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const modeOptions: Array<{
    value: MatchMode
    label: string
    icon: React.ElementType
    description: string
    available: boolean
  }> = [
    {
      value: 'match_invoice',
      label: 'Rechnung zuordnen',
      icon: Receipt,
      description: 'Mit einer vorhandenen Rechnung verknüpfen',
      available: isIncoming,
    },
    {
      value: 'create_income',
      label: 'Einnahme erstellen',
      icon: TrendingUp,
      description: 'Neue Einnahme aus dieser Transaktion',
      available: isIncoming,
    },
    {
      value: 'create_expense',
      label: 'Ausgabe erstellen',
      icon: TrendingDown,
      description: 'Neue Ausgabe aus dieser Transaktion',
      available: !isIncoming,
    },
    {
      value: 'match_expense',
      label: 'Ausgabe zuordnen',
      icon: TrendingDown,
      description: 'Mit einer vorhandenen Ausgabe verknüpfen',
      available: !isIncoming,
    },
    {
      value: 'match_income',
      label: 'Einnahme zuordnen',
      icon: TrendingUp,
      description: 'Mit einer vorhandenen Einnahme verknüpfen',
      available: isIncoming,
    },
    {
      value: 'ignore',
      label: 'Ignorieren',
      icon: Ban,
      description: 'Transaktion als irrelevant markieren',
      available: true,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transaktion zuordnen</DialogTitle>
          <DialogDescription>
            Ordnen Sie diese Transaktion einer Rechnung, Einnahme oder Ausgabe zu.
          </DialogDescription>
        </DialogHeader>

        {/* Transaction Details */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'p-1.5 rounded-full',
                  isIncoming ? 'bg-green-100' : 'bg-red-100'
                )}
              >
                {isIncoming ? (
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                )}
              </div>
              <span className="font-medium">
                {tx.counterpart_name || 'Unbekannt'}
              </span>
            </div>
            <span
              className={cn(
                'font-mono text-lg font-bold',
                isIncoming ? 'text-green-600' : 'text-red-600'
              )}
            >
              {isIncoming ? '+' : ''}
              {formatCurrency(tx.amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Datum: </span>
              <span>{formatDate(tx.booking_date)}</span>
            </div>
            {tx.counterpart_iban && (
              <div>
                <span className="text-muted-foreground">IBAN: </span>
                <span className="font-mono text-xs">{tx.counterpart_iban}</span>
              </div>
            )}
          </div>

          {tx.purpose && (
            <div className="text-sm">
              <span className="text-muted-foreground">Zweck: </span>
              <span>{tx.purpose}</span>
            </div>
          )}

          {tx.match_confidence !== null && tx.match_confidence > 0 && (
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-blue-600">
                Auto-Match Vorschlag ({Math.round(tx.match_confidence * 100)}% Konfidenz)
              </span>
            </div>
          )}
        </div>

        {/* Match Mode Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Aktion wählen</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modeOptions
              .filter((opt) => opt.available)
              .map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                      mode === opt.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setMode(opt.value)}
                  >
                    <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Conditional Fields */}
        {mode && (
          <div className="space-y-4 border-t pt-4">
            {/* Match to existing */}
            {(mode === 'match_invoice' ||
              mode === 'match_expense' ||
              mode === 'match_income') && (
              <div className="space-y-2">
                <Label>
                  {mode === 'match_invoice'
                    ? 'Rechnungsnummer'
                    : mode === 'match_expense'
                    ? 'Ausgaben-ID'
                    : 'Einnahmen-ID'}
                </Label>
                <Input
                  value={matchedId}
                  onChange={(e) => setMatchedId(e.target.value)}
                  placeholder="ID eingeben..."
                />
              </div>
            )}

            {/* Create expense */}
            {mode === 'create_expense' && (
              <>
                <div className="space-y-2">
                  <Label>Kategorie</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                        <SelectItem key={key} value={key}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={tx.purpose || tx.counterpart_name || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>MwSt-Satz</Label>
                  <Select
                    value={String(vatRate)}
                    onValueChange={(v) => setVatRate(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Create income */}
            {mode === 'create_income' && (
              <>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={tx.purpose || tx.counterpart_name || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label>MwSt-Satz</Label>
                  <Select
                    value={String(vatRate)}
                    onValueChange={(v) => setVatRate(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Ignore */}
            {mode === 'ignore' && (
              <div className="space-y-2">
                <Label>
                  Grund <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={ignoreReason}
                  onChange={(e) => setIgnoreReason(e.target.value)}
                  placeholder="z.B. Private Transaktion, Umbuchung..."
                />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-2">
          <div className="flex gap-2">
            {onCreateRule && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onCreateRule(tx)
                  onOpenChange(false)
                }}
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />
                Regel erstellen
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={!mode || isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Zuordnen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
