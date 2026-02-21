/**
 * DunningWizard Component
 *
 * Multi-step wizard for creating dunning notices:
 * Step 1: Select reminder level
 * Step 2: Preview reminder text
 * Step 3: Add fee/interest
 * Step 4: Send or Download
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
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Mail,
  AlertTriangle,
  Send,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DunningInvoice {
  id: string
  invoice_number: string
  total: number
  due_date: string
  client_name: string | null
  client_email: string | null
  dunning_level: number
}

export interface DunningWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: DunningInvoice | null
  onCreateDunning: (data: {
    invoice_id: string
    level: number
    fee: number
    interest_rate: number
    notes?: string
  }) => Promise<void>
  onSendDunning?: (entryId: string) => Promise<void>
}

const levelTemplates: Record<
  number,
  { subject: string; body: string; suggestedFee: number; suggestedInterest: number }
> = {
  1: {
    subject: 'Zahlungserinnerung',
    body: `Sehr geehrte Damen und Herren,

wir möchten Sie freundlich daran erinnern, dass die Rechnung {invoice_number} über {amount} am {due_date} fällig war.

Bitte überweisen Sie den ausstehenden Betrag innerhalb der nächsten 7 Tage auf unser Konto.

Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben als gegenstandslos.

Mit freundlichen Grüßen`,
    suggestedFee: 0,
    suggestedInterest: 0,
  },
  2: {
    subject: '1. Mahnung',
    body: `Sehr geehrte Damen und Herren,

trotz unserer Zahlungserinnerung ist die Rechnung {invoice_number} über {amount} (fällig am {due_date}) weiterhin offen.

Wir bitten Sie dringend, den Betrag zuzüglich eventueller Mahngebühren innerhalb von 7 Tagen zu begleichen.

Bei Fragen wenden Sie sich bitte an uns.

Mit freundlichen Grüßen`,
    suggestedFee: 5,
    suggestedInterest: 0,
  },
  3: {
    subject: '2. Mahnung (letzte Aufforderung)',
    body: `Sehr geehrte Damen und Herren,

die Rechnung {invoice_number} über {amount} (fällig am {due_date}) ist trotz wiederholter Aufforderung weiterhin nicht bezahlt.

Wir fordern Sie hiermit letztmalig auf, den Gesamtbetrag einschließlich aller Mahngebühren und Verzugszinsen innerhalb von 5 Werktagen zu überweisen.

Sollte die Zahlung nicht fristgemäß eingehen, sehen wir uns gezwungen, weitere rechtliche Schritte einzuleiten.

Mit freundlichen Grüßen`,
    suggestedFee: 10,
    suggestedInterest: 5,
  },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function overdueDays(dueDate: string): number {
  return Math.ceil(
    (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
  )
}

const STEPS = [
  { title: 'Mahnstufe', description: 'Wählen Sie die Erinnerungsstufe' },
  { title: 'Vorschau', description: 'Text prüfen und anpassen' },
  { title: 'Gebühren', description: 'Mahngebühren und Zinsen' },
  { title: 'Absenden', description: 'Versand bestätigen' },
]

export function DunningWizard({
  open,
  onOpenChange,
  invoice,
  onCreateDunning,
  onSendDunning,
}: DunningWizardProps) {
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedLevel, setSelectedLevel] = useState(1)
  const [reminderText, setReminderText] = useState('')
  const [fee, setFee] = useState(0)
  const [interestRate, setInterestRate] = useState(0)

  // Initialize when opening
  useEffect(() => {
    if (open && invoice) {
      const nextLevel = Math.min((invoice.dunning_level || 0) + 1, 3)
      setSelectedLevel(nextLevel)
      setStep(0)

      const template = levelTemplates[nextLevel] || levelTemplates[1]
      const text = template.body
        .replace('{invoice_number}', invoice.invoice_number)
        .replace('{amount}', formatCurrency(invoice.total))
        .replace(
          '{due_date}',
          new Date(invoice.due_date).toLocaleDateString('de-DE')
        )
      setReminderText(text)
      setFee(template.suggestedFee)
      setInterestRate(template.suggestedInterest)
    }
  }, [open, invoice])

  if (!invoice) return null

  const days = overdueDays(invoice.due_date)
  const interestAmount =
    interestRate > 0
      ? Math.round(((invoice.total * interestRate) / 100 / 365) * days * 100) / 100
      : 0
  const totalDue = invoice.total + fee + interestAmount

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onCreateDunning({
        invoice_id: invoice.id,
        level: selectedLevel,
        fee,
        interest_rate: interestRate,
        notes: reminderText,
      })
      onOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateTextForLevel = (level: number) => {
    setSelectedLevel(level)
    const template = levelTemplates[level] || levelTemplates[1]
    const text = template.body
      .replace('{invoice_number}', invoice.invoice_number)
      .replace('{amount}', formatCurrency(invoice.total))
      .replace(
        '{due_date}',
        new Date(invoice.due_date).toLocaleDateString('de-DE')
      )
    setReminderText(text)
    setFee(template.suggestedFee)
    setInterestRate(template.suggestedInterest)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Mahnung erstellen
          </DialogTitle>
          <DialogDescription>
            {invoice.invoice_number} — {invoice.client_name || 'Kein Kunde'} —{' '}
            {days} Tage überfällig
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-medium',
                  i < step
                    ? 'bg-green-100 text-green-700'
                    : i === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 rounded',
                    i < step ? 'bg-green-300' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Select level */}
        {step === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((level) => {
              const template = levelTemplates[level]
              const disabled = level <= (invoice.dunning_level || 0)
              return (
                <button
                  key={level}
                  type="button"
                  className={cn(
                    'w-full p-4 rounded-lg border text-left transition-colors',
                    selectedLevel === level
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => !disabled && updateTextForLevel(level)}
                  disabled={disabled}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          level === 1 && 'border-yellow-300 text-yellow-700',
                          level === 2 && 'border-orange-300 text-orange-700',
                          level === 3 && 'border-red-300 text-red-700'
                        )}
                      >
                        Stufe {level}
                      </Badge>
                      <span className="font-medium">{template.subject}</span>
                    </div>
                    {disabled && (
                      <span className="text-xs text-muted-foreground">Bereits gesendet</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gebühr: {formatCurrency(template.suggestedFee)} | Zinsen:{' '}
                    {template.suggestedInterest}%
                  </p>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 2: Preview text */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Mahntext (bearbeitbar)</Label>
              <Textarea
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                rows={10}
                className="text-sm font-mono"
              />
            </div>
          </div>
        )}

        {/* Step 3: Fees */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Rechnungsbetrag</span>
                <span className="font-medium">{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mahngebühr</span>
                <span className="font-medium">{formatCurrency(fee)}</span>
              </div>
              {interestAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>
                    Verzugszinsen ({interestRate}% p.a., {days} Tage)
                  </span>
                  <span className="font-medium">{formatCurrency(interestAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2 font-bold">
                <span>Gesamtforderung</span>
                <span>{formatCurrency(totalDue)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mahngebühr (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Verzugszinsen (%/Jahr)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Send */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rechnung</span>
                <span className="font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Kunde</span>
                <span>{invoice.client_name || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Stufe</span>
                <Badge variant="outline">
                  {levelTemplates[selectedLevel]?.subject || `Stufe ${selectedLevel}`}
                </Badge>
              </div>
              <div className="flex justify-between text-sm border-t pt-2 font-bold">
                <span>Gesamtforderung</span>
                <span>{formatCurrency(totalDue)}</span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              Die Mahnung wird als Entwurf gespeichert. Sie können sie anschließend
              per E-Mail versenden oder als PDF herunterladen.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={step === 0 ? () => onOpenChange(false) : () => setStep(step - 1)}
            disabled={isSubmitting}
          >
            {step === 0 ? (
              'Abbrechen'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück
              </>
            )}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Weiter
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Mahnung erstellen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
