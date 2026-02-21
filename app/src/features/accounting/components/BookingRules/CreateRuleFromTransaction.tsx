/**
 * CreateRuleFromTransaction Component
 *
 * Quick dialog pre-filled from transaction data.
 * - Vendor name → vendor pattern
 * - Purpose → text pattern
 * - Suggest category
 * - One-click "Create & Apply"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Zap, ArrowRight } from 'lucide-react'
import type { BankTransaction, BookingRule } from '@/services/web/bankingService'
import { EXPENSE_CATEGORIES } from '../../types'

export interface CreateRuleFromTransactionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: BankTransaction | null
  onSave: (data: Partial<BookingRule>) => Promise<void>
}

export function CreateRuleFromTransaction({
  open,
  onOpenChange,
  transaction,
  onSave,
}: CreateRuleFromTransactionProps) {
  const [name, setName] = useState('')
  const [counterpartPattern, setCounterpartPattern] = useState('')
  const [purposePattern, setPurposePattern] = useState('')
  const [actionCategory, setActionCategory] = useState('other')
  const [actionVatRate, setActionVatRate] = useState(19)
  const [actionMatchType, setActionMatchType] = useState('expense')
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open && transaction) {
      const counterpart = transaction.counterpart_name || ''
      setName(counterpart || 'Neue Regel')
      setCounterpartPattern(counterpart)
      setPurposePattern('')
      setActionCategory('other')
      setActionVatRate(19)
      setActionMatchType(transaction.amount >= 0 ? 'income' : 'expense')
      setAutoConfirm(false)
    }
  }, [open, transaction])

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const payload: Partial<BookingRule> = {
        name,
        priority: 100,
        is_active: 1,
        action_vat_rate: actionVatRate,
        action_match_type: actionMatchType,
        action_auto_confirm: autoConfirm ? 1 : 0,
      } as Partial<BookingRule>

      if (counterpartPattern) {
        ;(payload as Record<string, unknown>).condition_counterpart_pattern = counterpartPattern
      }
      if (purposePattern) {
        ;(payload as Record<string, unknown>).condition_purpose_pattern = purposePattern
      }
      if (actionCategory) {
        ;(payload as Record<string, unknown>).action_category = actionCategory
      }
      if (transaction) {
        ;(payload as Record<string, unknown>).condition_direction =
          transaction.amount >= 0 ? 'credit' : 'debit'
      }

      await onSave(payload)
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!transaction) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Regel aus Transaktion erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie schnell eine Buchungsregel basierend auf dieser Transaktion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction preview */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">
                {transaction.counterpart_name || 'Unbekannt'}
              </span>
              <span className="font-mono">
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(transaction.amount)}
              </span>
            </div>
            {transaction.purpose && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {transaction.purpose}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Regelname</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Auftraggeber-Muster</Label>
            <Input
              value={counterpartPattern}
              onChange={(e) => setCounterpartPattern(e.target.value)}
              placeholder="z.B. Netflix"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Zweck-Muster{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={purposePattern}
              onChange={(e) => setPurposePattern(e.target.value)}
              placeholder="z.B. Mitgliedschaft"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={actionMatchType} onValueChange={setActionMatchType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Ausgabe</SelectItem>
                  <SelectItem value="income">Einnahme</SelectItem>
                  <SelectItem value="ignore">Ignorieren</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>MwSt</Label>
              <Select
                value={String(actionVatRate)}
                onValueChange={(v) => setActionVatRate(Number(v))}
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
          </div>

          {actionMatchType !== 'ignore' && (
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={actionCategory} onValueChange={setActionCategory}>
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
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={autoConfirm}
              onCheckedChange={setAutoConfirm}
              id="quickAutoConfirm"
            />
            <Label htmlFor="quickAutoConfirm" className="text-sm cursor-pointer">
              Automatisch buchen
            </Label>
          </div>

          <Button onClick={handleSave} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Regel erstellen & anwenden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
