/**
 * ElsterSubmissionWizard Component
 *
 * Multi-step wizard for generating ELSTER USt-VA submissions.
 * Steps: Review → Validate → Generate → Confirm
 */

import { useState, useCallback } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { api } from '@/lib/api'
import type { ElsterSubmissionResult, ElsterValidationResult } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  FileCheck,
  ArrowRight,
} from 'lucide-react'

export interface ElsterSubmissionWizardProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Year to generate for */
  year: number
  /** Quarter to generate for */
  quarter: 1 | 2 | 3 | 4
  /** Callback after successful submission */
  onSubmitted?: () => void
  /** Additional CSS classes */
  className?: string
}

/** Kennzahl labels for human-readable display */
const KENNZAHL_LABELS: Record<string, string> = {
  kz81: 'Kz 81 – Steuerpflichtige Umsätze 19%',
  kz86: 'Kz 86 – Steuerpflichtige Umsätze 7%',
  kz66: 'Kz 66 – Vorsteuerbeträge',
  kz83: 'Kz 83 – Verbleibende USt-Vorauszahlung',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

type WizardStep = 'review' | 'validate' | 'generate' | 'confirm'

export function ElsterSubmissionWizard({
  open,
  onOpenChange,
  year,
  quarter,
  onSubmitted,
  className,
}: ElsterSubmissionWizardProps) {
  const [step, setStep] = useState<WizardStep>('review')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data from each step
  const [validationResult, setValidationResult] = useState<ElsterValidationResult | null>(null)
  const [submissionResult, setSubmissionResult] = useState<ElsterSubmissionResult | null>(null)
  const [transferTicket, setTransferTicket] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  const periodLabel = `Q${quarter} ${year}`

  // Step 1: Load validation (also serves as review)
  const handleValidate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.validateUstVaElster(year, quarter, 'quarterly')
      setValidationResult(result)
      setStep('validate')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [year, quarter])

  // Step 2: Generate ELSTER XML
  const handleGenerate = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await api.generateUstVaElster(year, quarter, 'quarterly', true)
      setSubmissionResult(result)
      setStep('generate')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [year, quarter])

  // Download XML
  const handleDownloadXml = useCallback(() => {
    if (!submissionResult?.xml) return
    const blob = new Blob([submissionResult.xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `UStVA-${year}-Q${quarter}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [submissionResult, year, quarter])

  // Step 3: Confirm submission
  const handleConfirm = useCallback(async () => {
    if (!submissionResult?.submission?.id) return
    setIsConfirming(true)
    setError(null)
    try {
      await api.updateElsterSubmissionStatus(submissionResult.submission.id, {
        status: 'submitted',
        transfer_ticket: transferTicket || undefined,
      })
      setStep('confirm')
      onSubmitted?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsConfirming(false)
    }
  }, [submissionResult, transferTicket, onSubmitted])

  // Reset when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep('review')
      setValidationResult(null)
      setSubmissionResult(null)
      setTransferTicket('')
      setError(null)
    }
    onOpenChange(open)
  }

  const taxData = validationResult?.taxData || submissionResult?.taxData

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('max-w-lg', className)}>
        <DialogHeader>
          <DialogTitle>ELSTER USt-VA Export</DialogTitle>
          <DialogDescription>
            USt-Voranmeldung {periodLabel} für das Finanzamt vorbereiten
          </DialogDescription>
        </DialogHeader>

        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="review" disabled={step !== 'review'}>
              Prüfen
            </TabsTrigger>
            <TabsTrigger value="validate" disabled={!validationResult}>
              Validieren
            </TabsTrigger>
            <TabsTrigger value="generate" disabled={!submissionResult}>
              Generieren
            </TabsTrigger>
            <TabsTrigger value="confirm" disabled={step !== 'confirm'}>
              Bestätigen
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Review */}
          <TabsContent value="review" className="space-y-4 mt-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Zeitraum</h3>
              <p className="text-lg font-medium">{periodLabel}</p>
              <p className="text-sm text-muted-foreground">
                Klicken Sie auf "Daten prüfen", um die USt-VA Kennzahlen
                zu berechnen und zu validieren.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleValidate} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Daten prüfen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Validate */}
          <TabsContent value="validate" className="space-y-4 mt-4">
            {validationResult && (
              <>
                {/* Kennzahlen */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="font-semibold text-sm">Kennzahlen</h3>
                  <div className="space-y-2">
                    {Object.entries(KENNZAHL_LABELS).map(([key, label]) => {
                      const value = taxData?.[key] as number ?? 0
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cn(
                            'font-mono font-medium',
                            key === 'kz83' && value < 0 ? 'text-green-600' : '',
                            key === 'kz83' && value > 0 ? 'text-red-600' : '',
                          )}>
                            {formatCurrency(value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Validation status */}
                <div className={cn(
                  'flex items-center gap-3 rounded-lg p-3',
                  validationResult.valid
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                )}>
                  {validationResult.valid
                    ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                    : <XCircle className="h-5 w-5 text-red-600" />}
                  <span className="text-sm font-medium">
                    {validationResult.valid ? 'Validierung bestanden' : 'Validierungsfehler'}
                  </span>
                </div>

                {/* Errors */}
                {validationResult.errors.length > 0 && (
                  <div className="space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {validationResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-yellow-600">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep('review')}>
                    Zurück
                  </Button>
                  <Button onClick={handleGenerate} disabled={isLoading || !validationResult.valid}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ELSTER XML generieren
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Step 3: Generate */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            {submissionResult && (
              <>
                <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">ELSTER XML generiert</p>
                    <p className="text-sm text-green-600">
                      Submission-ID: {submissionResult.submission.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={handleDownloadXml}>
                  <Download className="mr-2 h-4 w-4" />
                  ELSTER XML herunterladen
                </Button>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                  <p>
                    <strong>Nächster Schritt:</strong> Laden Sie die XML-Datei herunter und
                    übermitteln Sie diese über <a href="https://www.elster.de" target="_blank" rel="noopener noreferrer" className="underline">elster.de</a> oder
                    Ihre Steuersoftware.
                  </p>
                  <p>
                    Nach erfolgreicher Übermittlung können Sie den Transferticket-Code hier eingeben.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transferTicket">Transferticket (optional)</Label>
                  <Input
                    id="transferTicket"
                    value={transferTicket}
                    onChange={(e) => setTransferTicket(e.target.value)}
                    placeholder="z.B. et12345678901234"
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setStep('validate')}>
                    Zurück
                  </Button>
                  <Button onClick={handleConfirm} disabled={isConfirming}>
                    {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <FileCheck className="mr-2 h-4 w-4" />
                    Als übermittelt markieren
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Step 4: Confirm */}
          <TabsContent value="confirm" className="space-y-4 mt-4">
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <p className="text-lg font-semibold">Übermittlung bestätigt</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Die USt-VA für {periodLabel} wurde als übermittelt markiert.
                </p>
                {transferTicket && (
                  <div className="mt-3">
                    <Badge variant="outline" className="font-mono">
                      Transferticket: {transferTicket}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>
                Schließen
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default ElsterSubmissionWizard
