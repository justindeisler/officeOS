/**
 * BankConnectDialog Component
 *
 * Multi-step wizard for connecting a new bank account.
 * Step 1: Bank info (name, IBAN, BIC)
 * Step 2: Initial balance
 * Step 3: Confirmation
 */

import { useState } from 'react'
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
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BankConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnect: (data: {
    bank_name: string
    iban: string
    bic?: string
    account_name?: string
    balance?: number
  }) => Promise<void>
}

function formatIban(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

function validateIban(iban: string): boolean {
  const clean = iban.replace(/\s/g, '')
  return clean.length >= 15 && clean.length <= 34 && /^[A-Z]{2}[0-9]{2}/.test(clean)
}

const STEPS = [
  { title: 'Bankdaten', description: 'Bankname und IBAN eingeben' },
  { title: 'Anfangssaldo', description: 'Aktuellen Kontostand eintragen' },
  { title: 'Bestätigung', description: 'Daten überprüfen und bestätigen' },
]

export function BankConnectDialog({
  open,
  onOpenChange,
  onConnect,
}: BankConnectDialogProps) {
  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [bankName, setBankName] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [accountName, setAccountName] = useState('')
  const [balance, setBalance] = useState('')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setStep(0)
    setBankName('')
    setIban('')
    setBic('')
    setAccountName('')
    setBalance('')
    setErrors({})
    setIsSubmitting(false)
  }

  const handleOpenChange = (value: boolean) => {
    if (!value) resetForm()
    onOpenChange(value)
  }

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!bankName.trim()) {
      newErrors.bankName = 'Bankname ist erforderlich'
    }

    if (!iban.trim()) {
      newErrors.iban = 'IBAN ist erforderlich'
    } else if (!validateIban(iban)) {
      newErrors.iban = 'Ungültige IBAN'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 0 && !validateStep1()) return
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onConnect({
        bank_name: bankName.trim(),
        iban: iban.replace(/\s/g, ''),
        bic: bic.trim() || undefined,
        account_name: accountName.trim() || undefined,
        balance: balance ? parseFloat(balance) : undefined,
      })
      handleOpenChange(false)
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bankkonto verbinden
          </DialogTitle>
          <DialogDescription>{STEPS[step].description}</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors',
                  i < step
                    ? 'bg-green-100 text-green-700'
                    : i === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
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

        {/* Step 1: Bank info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bankname *</Label>
              <Input
                id="bankName"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="z.B. Deutsche Bank, Sparkasse, N26"
                autoFocus
              />
              {errors.bankName && (
                <p className="text-xs text-destructive">{errors.bankName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="iban">IBAN *</Label>
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(formatIban(e.target.value))}
                placeholder="DE89 3704 0044 0532 0130 00"
                className="font-mono"
                maxLength={40}
              />
              {errors.iban && (
                <p className="text-xs text-destructive">{errors.iban}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bic">
                BIC <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="bic"
                value={bic}
                onChange={(e) => setBic(e.target.value.toUpperCase())}
                placeholder="z.B. DEUTDEDB"
                className="font-mono"
                maxLength={11}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountName">
                Kontoname <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="accountName"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="z.B. Geschäftskonto, Sparkonto"
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <p>
                Aktuell werden Konten manuell verbunden. FinAPI-Integration für
                automatischen Import wird in einer zukünftigen Version verfügbar.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Initial balance */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Aktueller Kontostand (€)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0,00"
                className="text-lg font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Geben Sie den aktuellen Kontostand ein. Dieser kann jederzeit
                durch Synchronisierung aktualisiert werden.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium">{bankName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IBAN</span>
                <span className="font-mono text-xs">{iban}</span>
              </div>
              {bic && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">BIC</span>
                  <span className="font-mono text-xs">{bic}</span>
                </div>
              )}
              {accountName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kontoname</span>
                  <span>{accountName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Anfangssaldo</span>
                <span className="font-semibold">
                  {balance
                    ? new Intl.NumberFormat('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                      }).format(parseFloat(balance))
                    : '€0,00'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={step === 0 ? () => handleOpenChange(false) : handleBack}
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
            <Button onClick={handleNext}>
              Weiter
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Konto verbinden
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
