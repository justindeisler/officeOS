/**
 * UstVoranmeldungPreview Component
 *
 * Print-friendly preview of quarterly VAT declaration with:
 * - Official Kennzahlen (tax form field numbers)
 * - VAT calculation breakdown
 * - Status indicator
 * - German formatting
 */

import React from 'react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { UstVoranmeldung } from '../../types'

export interface UstVoranmeldungPreviewProps {
  /** The USt-Voranmeldung data to display */
  ustVoranmeldung: UstVoranmeldung
  /** Additional CSS classes */
  className?: string
}

/**
 * Format number as German currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Format date as German date
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

/**
 * German VAT form field numbers (Kennzahlen)
 */
const KENNZAHLEN = {
  UMSATZSTEUER_19: 81,
  UMSATZSTEUER_7: 86,
  VORSTEUER: 66,
  ZAHLLAST: 83,
}

export function UstVoranmeldungPreview({
  ustVoranmeldung,
  className,
}: UstVoranmeldungPreviewProps) {
  const isRefund = ustVoranmeldung.zahllast < 0

  return (
    <div className={cn('space-y-6 print:bg-white print:text-black', className)}>
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h2 className="text-xl font-bold">USt-Voranmeldung</h2>
        <p className="text-lg">{ustVoranmeldung.period}</p>
        <div className="mt-2 flex justify-center gap-4 text-sm text-muted-foreground print:text-gray-600">
          <span>{formatDate(ustVoranmeldung.startDate)}</span>
          <span>–</span>
          <span>{formatDate(ustVoranmeldung.endDate)}</span>
        </div>
      </div>

      {/* Company Info Placeholder */}
      <div className="border rounded-lg p-4 bg-muted/20 print:bg-gray-50">
        <h3 className="font-medium mb-2">Steuerpflichtige/r / Unternehmen</h3>
        <p className="text-sm text-muted-foreground print:text-gray-600">
          [Name und Anschrift eintragen]
        </p>
        <p className="text-sm text-muted-foreground print:text-gray-600">
          Steuernummer: [Steuernummer eintragen]
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Status: </span>
          {ustVoranmeldung.status === 'draft' ? (
            <Badge variant="secondary">Entwurf</Badge>
          ) : (
            <Badge variant="default">Gemeldet</Badge>
          )}
        </div>
        {ustVoranmeldung.filedDate && (
          <div className="text-sm text-muted-foreground print:text-gray-600">
            Gemeldet am: {formatDate(ustVoranmeldung.filedDate)}
          </div>
        )}
      </div>

      {/* VAT Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Kennzahl</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Umsatzsteuer section */}
            <TableRow className="bg-muted/30 print:bg-gray-100">
              <TableCell colSpan={3} className="font-semibold">
                Umsatzsteuer (Output VAT)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">KZ 81</TableCell>
              <TableCell>
                Umsatzsteuer 19%
                <span className="text-sm text-muted-foreground ml-2 print:text-gray-600">
                  (Steuerpflichtige Umsätze zum Steuersatz von 19%)
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.umsatzsteuer19)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">KZ 86</TableCell>
              <TableCell>
                Umsatzsteuer 7%
                <span className="text-sm text-muted-foreground ml-2 print:text-gray-600">
                  (Steuerpflichtige Umsätze zum Steuersatz von 7%)
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.umsatzsteuer7)}
              </TableCell>
            </TableRow>
            <TableRow className="font-medium">
              <TableCell></TableCell>
              <TableCell>Summe Umsatzsteuer</TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.totalUmsatzsteuer)}
              </TableCell>
            </TableRow>

            {/* Vorsteuer section */}
            <TableRow className="bg-muted/30 print:bg-gray-100">
              <TableCell colSpan={3} className="font-semibold">
                Vorsteuer (Input VAT)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-mono text-sm">KZ 66</TableCell>
              <TableCell>
                Abziehbare Vorsteuer
                <span className="text-sm text-muted-foreground ml-2 print:text-gray-600">
                  (Vorsteuerbeträge aus Rechnungen)
                </span>
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(ustVoranmeldung.vorsteuer)}
              </TableCell>
            </TableRow>

            {/* Zahllast section */}
            <TableRow className="border-t-2 bg-muted font-bold print:bg-gray-200">
              <TableCell className="font-mono text-sm">KZ 83</TableCell>
              <TableCell>
                Zahllast{' '}
                {isRefund && (
                  <span className="text-green-600 font-normal">(Erstattung)</span>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right',
                  isRefund ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(Math.abs(ustVoranmeldung.zahllast))}
                {isRefund && ' (Erstattung)'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Calculation Explanation */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground print:bg-gray-50 print:text-gray-600">
        <p>
          <strong>Berechnung:</strong> Zahllast = Umsatzsteuer − Vorsteuer
        </p>
        <p className="mt-1">
          {ustVoranmeldung.totalUmsatzsteuer.toLocaleString('de-DE')} € − {ustVoranmeldung.vorsteuer.toLocaleString('de-DE')} € = {ustVoranmeldung.zahllast.toLocaleString('de-DE')} €
        </p>
        <p className="mt-2">
          {isRefund ? (
            <>Negativer Betrag = Sie erhalten eine <strong>Erstattung</strong> vom Finanzamt</>
          ) : (
            <>Positiver Betrag = Sie müssen diesen Betrag an das Finanzamt <strong>überweisen</strong></>
          )}
        </p>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground print:text-gray-600 border-t pt-4">
        <p>Erstellt am: {formatDate(new Date())}</p>
        <p className="mt-1">Diese Vorschau dient nur zur Kontrolle. Für die offizielle Abgabe nutzen Sie bitte ELSTER.</p>
      </div>
    </div>
  )
}

export default UstVoranmeldungPreview
