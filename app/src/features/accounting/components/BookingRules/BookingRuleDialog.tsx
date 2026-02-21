/**
 * BookingRuleDialog Component
 *
 * Create/edit booking rule form with:
 * - Conditions: vendor pattern, amount range, text pattern, direction
 * - Actions: category, VAT rate, description template, auto-confirm
 * - Testing: preview matching transactions
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, TestTube, Zap, Info } from 'lucide-react'
import type { BookingRule } from '@/services/web/bankingService'
import { EXPENSE_CATEGORIES } from '../../types'
import { cn } from '@/lib/utils'

export interface BookingRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: BookingRule | null
  onSave: (data: Partial<BookingRule>) => Promise<void>
  onTest?: (data: Partial<BookingRule>) => Promise<{
    total_unmatched: number
    would_match: number
    matches: unknown[]
  }>
}

export function BookingRuleDialog({
  open,
  onOpenChange,
  rule,
  onSave,
  onTest,
}: BookingRuleDialogProps) {
  const isEditing = !!rule

  // Form state
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(100)
  const [conditionDirection, setConditionDirection] = useState('')
  const [conditionCounterpart, setConditionCounterpart] = useState('')
  const [conditionPurpose, setConditionPurpose] = useState('')
  const [conditionAmountMin, setConditionAmountMin] = useState('')
  const [conditionAmountMax, setConditionAmountMax] = useState('')
  const [actionCategory, setActionCategory] = useState('')
  const [actionVatRate, setActionVatRate] = useState(19)
  const [actionDescriptionTemplate, setActionDescriptionTemplate] = useState('')
  const [actionMatchType, setActionMatchType] = useState('expense')
  const [actionAutoConfirm, setActionAutoConfirm] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    total_unmatched: number
    would_match: number
  } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load existing rule data
  useEffect(() => {
    if (open && rule) {
      setName(rule.name)
      setPriority(rule.priority)
      setConditionDirection(rule.condition_direction || '')
      setConditionCounterpart(rule.condition_counterpart_pattern || '')
      setConditionPurpose(rule.condition_purpose_pattern || '')
      setConditionAmountMin(
        rule.condition_amount_min !== null ? String(rule.condition_amount_min) : ''
      )
      setConditionAmountMax(
        rule.condition_amount_max !== null ? String(rule.condition_amount_max) : ''
      )
      setActionCategory(rule.action_category || '')
      setActionVatRate(rule.action_vat_rate ?? 19)
      setActionDescriptionTemplate(rule.action_description_template || '')
      setActionMatchType(rule.action_match_type || 'expense')
      setActionAutoConfirm(rule.action_auto_confirm === 1)
    } else if (open) {
      // Reset for new rule
      setName('')
      setPriority(100)
      setConditionDirection('')
      setConditionCounterpart('')
      setConditionPurpose('')
      setConditionAmountMin('')
      setConditionAmountMax('')
      setActionCategory('')
      setActionVatRate(19)
      setActionDescriptionTemplate('')
      setActionMatchType('expense')
      setActionAutoConfirm(false)
    }
    setTestResult(null)
    setErrors({})
  }, [open, rule])

  const buildPayload = (): Partial<BookingRule> => {
    const payload: Record<string, unknown> = {
      name,
      priority,
      action_vat_rate: actionVatRate,
      action_match_type: actionMatchType,
      action_auto_confirm: actionAutoConfirm ? 1 : 0,
    }

    if (conditionDirection) payload.condition_direction = conditionDirection
    if (conditionCounterpart)
      payload.condition_counterpart_pattern = conditionCounterpart
    if (conditionPurpose) payload.condition_purpose_pattern = conditionPurpose
    if (conditionAmountMin) payload.condition_amount_min = parseFloat(conditionAmountMin)
    if (conditionAmountMax) payload.condition_amount_max = parseFloat(conditionAmountMax)
    if (actionCategory) payload.action_category = actionCategory
    if (actionDescriptionTemplate)
      payload.action_description_template = actionDescriptionTemplate

    return payload as Partial<BookingRule>
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Name ist erforderlich'
    }

    // At least one condition
    const hasCondition =
      conditionDirection ||
      conditionCounterpart ||
      conditionPurpose ||
      conditionAmountMin ||
      conditionAmountMax

    if (!hasCondition) {
      newErrors.conditions = 'Mindestens eine Bedingung erforderlich'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      await onSave(buildPayload())
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async () => {
    if (!onTest) return
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(buildPayload())
      setTestResult(result)
    } catch {
      // Error handled silently
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Regel bearbeiten' : 'Neue Buchungsregel'}
          </DialogTitle>
          <DialogDescription>
            Definieren Sie Bedingungen und Aktionen für die automatische Zuordnung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Name *</Label>
              <Input
                id="ruleName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Netflix Abo"
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priorität (kleiner = höher)</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                min={1}
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm">Bedingungen</h4>
              {errors.conditions && (
                <Badge variant="destructive" className="text-[10px]">
                  {errors.conditions}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Richtung</Label>
              <Select value={conditionDirection} onValueChange={setConditionDirection}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Richtungen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_directions">Alle</SelectItem>
                  <SelectItem value="credit">Eingang (Haben)</SelectItem>
                  <SelectItem value="debit">Ausgang (Soll)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Auftraggeber enthält</Label>
              <Input
                value={conditionCounterpart}
                onChange={(e) => setConditionCounterpart(e.target.value)}
                placeholder="z.B. Netflix, Amazon"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Verwendungszweck enthält</Label>
              <Input
                value={conditionPurpose}
                onChange={(e) => setConditionPurpose(e.target.value)}
                placeholder="z.B. Mitgliedschaft, Rechnung"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs">Betrag min (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={conditionAmountMin}
                  onChange={(e) => setConditionAmountMin(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Betrag max (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={conditionAmountMax}
                  onChange={(e) => setConditionAmountMax(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium text-sm">Aktionen</h4>

            <div className="space-y-2">
              <Label className="text-xs">Typ</Label>
              <Select value={actionMatchType} onValueChange={setActionMatchType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Ausgabe erstellen</SelectItem>
                  <SelectItem value="income">Einnahme erstellen</SelectItem>
                  <SelectItem value="ignore">Ignorieren</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionMatchType !== 'ignore' && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={actionCategory} onValueChange={setActionCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
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
                  <Label className="text-xs">MwSt-Satz</Label>
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

                <div className="space-y-2">
                  <Label className="text-xs">
                    Beschreibungsvorlage{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    value={actionDescriptionTemplate}
                    onChange={(e) => setActionDescriptionTemplate(e.target.value)}
                    placeholder="z.B. {counterpart} - {purpose}"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Switch
                checked={actionAutoConfirm}
                onCheckedChange={setActionAutoConfirm}
                id="autoConfirm"
              />
              <Label htmlFor="autoConfirm" className="text-sm cursor-pointer">
                Automatisch buchen (ohne Bestätigung)
              </Label>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 p-3 text-sm">
              <strong>{testResult.would_match}</strong> von{' '}
              {testResult.total_unmatched} offenen Transaktionen würden matchen.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {onTest && (
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting}
                className="flex-1"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Testen
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              {isEditing ? 'Speichern' : 'Erstellen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
