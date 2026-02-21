/**
 * RecurringInvoiceDialog Component
 *
 * Create/edit recurring invoice template with:
 * - Client selector, frequency, dates
 * - Line items with per-line VAT
 * - Auto-send toggle
 * - Preview next 3 generation dates
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Trash2, Plus, Loader2, CalendarDays } from 'lucide-react'
import type { RecurringInvoice } from '@/services/web/bankingService'
import { useClients } from '../../hooks/useClients'

interface LineItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
}

export interface RecurringInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: RecurringInvoice | null
  onSave: (data: unknown) => Promise<void>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function getNextDates(
  startDate: string,
  frequency: string,
  count: number = 3
): string[] {
  const dates: string[] = []
  let current = new Date(startDate)

  for (let i = 0; i < count; i++) {
    dates.push(
      current.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    )
    switch (frequency) {
      case 'monthly':
        current = new Date(current.setMonth(current.getMonth() + 1))
        break
      case 'quarterly':
        current = new Date(current.setMonth(current.getMonth() + 3))
        break
      case 'yearly':
        current = new Date(current.setFullYear(current.getFullYear() + 1))
        break
    }
  }

  return dates
}

export function RecurringInvoiceDialog({
  open,
  onOpenChange,
  template,
  onSave,
}: RecurringInvoiceDialogProps) {
  const isEditing = !!template
  const { clients } = useClients()

  // Form state
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [nextDate, setNextDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState('')
  const [vatRate, setVatRate] = useState(19)
  const [paymentTermsDays, setPaymentTermsDays] = useState(14)
  const [autoSend, setAutoSend] = useState(false)
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit: 'hours', unit_price: 0 },
  ])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize from template
  useEffect(() => {
    if (open && template) {
      setName(template.name)
      setClientId(template.client_id || '')
      setFrequency(template.frequency)
      setNextDate(template.next_date.split('T')[0])
      setEndDate(template.end_date ? template.end_date.split('T')[0] : '')
      setVatRate(template.vat_rate)
      setPaymentTermsDays(template.payment_terms_days)
      setAutoSend(template.auto_send === 1)
      setNotes(template.notes || '')
      try {
        const parsed = JSON.parse(template.items_json) as LineItem[]
        setItems(
          parsed.length > 0
            ? parsed
            : [{ description: '', quantity: 1, unit: 'hours', unit_price: 0 }]
        )
      } catch {
        setItems([{ description: '', quantity: 1, unit: 'hours', unit_price: 0 }])
      }
    } else if (open) {
      // Reset for new
      setName('')
      setClientId('')
      setFrequency('monthly')
      setNextDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      setVatRate(19)
      setPaymentTermsDays(14)
      setAutoSend(false)
      setNotes('')
      setItems([{ description: '', quantity: 1, unit: 'hours', unit_price: 0 }])
    }
  }, [open, template])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items]
  )

  const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100
  const total = subtotal + vatAmount

  const nextDates = useMemo(
    () => getNextDates(nextDate, frequency),
    [nextDate, frequency]
  )

  const updateItem = (
    idx: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unit: 'hours', unit_price: 0 },
    ])
  }

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (items.length === 0 || !items[0].description) return

    setIsSubmitting(true)
    try {
      await onSave({
        name,
        client_id: clientId || null,
        frequency,
        next_date: nextDate,
        end_date: endDate || null,
        vat_rate: vatRate,
        payment_terms_days: paymentTermsDays,
        auto_send: autoSend ? 1 : 0,
        auto_generate: 1,
        is_active: 1,
        notes: notes || null,
        items,
      })
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? 'Vorlage bearbeiten'
              : 'Neue wiederkehrende Rechnung'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Monthly Hosting"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Kunde</Label>
              <Select value={clientId || '__none__'} onValueChange={(v) => setClientId(v === '__none__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Kunde wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kein Kunde</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Scheduling */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Frequenz</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monatlich</SelectItem>
                  <SelectItem value="quarterly">Quartalsweise</SelectItem>
                  <SelectItem value="yearly">Jährlich</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nächstes Datum</Label>
              <Input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Enddatum{' '}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Next dates preview */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <CalendarDays className="h-4 w-4 flex-shrink-0" />
            <span>Nächste Termine: {nextDates.join(' → ')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="space-y-2">
              <Label>Zahlungsziel (Tage)</Label>
              <Input
                type="number"
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={autoSend}
                  onCheckedChange={setAutoSend}
                  id="autoSend"
                />
                <Label htmlFor="autoSend" className="text-sm cursor-pointer">
                  Auto-Versand
                </Label>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Positionen</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Position
              </Button>
            </div>

            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_70px_70px_80px_32px] gap-2 items-center"
              >
                <Input
                  placeholder="Beschreibung"
                  value={item.description}
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Menge"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(idx, 'quantity', Number(e.target.value))
                  }
                />
                <Select
                  value={item.unit}
                  onValueChange={(v) => updateItem(idx, 'unit', v)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Std</SelectItem>
                    <SelectItem value="days">Tage</SelectItem>
                    <SelectItem value="month">Mon</SelectItem>
                    <SelectItem value="units">Stk</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Preis"
                  step="0.01"
                  value={item.unit_price}
                  onChange={(e) =>
                    updateItem(idx, 'unit_price', Number(e.target.value))
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeItem(idx)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}

            {/* Totals */}
            <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  MwSt ({vatRate}%)
                </span>
                <span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Gesamt</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>
              Notizen{' '}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anmerkungen zur Vorlage..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEditing ? 'Speichern' : 'Vorlage erstellen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
