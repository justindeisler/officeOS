/**
 * EInvoiceValidationResult Component
 *
 * Dialog showing E-Rechnung validation pass/fail status
 * with a list of rule violations and severity levels.
 */

import { cn } from '@/lib/utils'
import type { EInvoiceValidationResult as ValidationResult } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

export interface EInvoiceValidationResultProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Validation result data */
  result: ValidationResult | null
  /** Invoice number for context */
  invoiceNumber?: string
  /** Additional CSS classes */
  className?: string
}

export function EInvoiceValidationResultDialog({
  open,
  onOpenChange,
  result,
  invoiceNumber,
  className,
}: EInvoiceValidationResultProps) {
  if (!result) return null

  const totalIssues = result.errors.length + result.warnings.length
  const formatLabel = result.format === 'zugferd'
    ? 'ZUGFeRD'
    : result.format === 'xrechnung-ubl'
      ? 'X-Rechnung (UBL)'
      : result.format === 'xrechnung-cii'
        ? 'X-Rechnung (CII)'
        : result.format

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-md', className)}>
        <DialogHeader>
          <DialogTitle>EN 16931 Validierung</DialogTitle>
          <DialogDescription>
            {invoiceNumber
              ? `Prüfergebnis für ${invoiceNumber}`
              : 'E-Rechnung Prüfergebnis'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall status */}
          <div className={cn(
            'flex items-center gap-3 rounded-lg p-4',
            result.valid
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          )}>
            {result.valid
              ? <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
              : <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />}
            <div>
              <p className="font-semibold">
                {result.valid ? 'Validierung bestanden' : 'Validierung fehlgeschlagen'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {formatLabel}
                </Badge>
                {totalIssues > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {totalIssues} {totalIssues === 1 ? 'Problem' : 'Probleme'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                Fehler ({result.errors.length})
              </p>
              <ul className="space-y-1.5">
                {result.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm rounded-md bg-red-50 p-2">
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500" />
                    <span className="text-red-700">{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-yellow-700 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Warnungen ({result.warnings.length})
              </p>
              <ul className="space-y-1.5">
                {result.warnings.map((warn, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm rounded-md bg-yellow-50 p-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                    <span className="text-yellow-700">{warn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success - no issues */}
          {result.valid && totalIssues === 0 && (
            <div className="flex items-start gap-2 text-sm text-green-600 bg-green-50 rounded-lg p-3">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Keine Probleme gefunden. Die Rechnung entspricht der EN 16931 Norm
                und kann als E-Rechnung im Format {formatLabel} exportiert werden.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EInvoiceValidationResultDialog
