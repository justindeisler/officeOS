/**
 * InvoicePreview Component
 *
 * Displays a formatted, document-like preview of an invoice for printing
 * or PDF export. Mirrors the Puppeteer-generated PDF template in design
 * and structure, including sender/client address and tax info.
 */

import { useState } from 'react'
import type { Invoice, InvoiceStatus } from '../../types'
import type { Client } from '@/types'
import type { BusinessProfile } from '@/types'
import { cn } from '@/lib/utils'
import { api, isWebBuild } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Printer, Download, X, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

export interface InvoicePreviewProps {
  /** Invoice to preview */
  invoice: Invoice
  /** Optional full client object (with address) */
  client?: Client | null
  /** Callback when print button is clicked */
  onPrint?: () => void
  /** Callback when download button is clicked */
  onDownload?: () => void
  /** Callback when close button is clicked */
  onClose?: () => void
  /** Additional CSS classes */
  className?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getUnitLabel(unit: string): string {
  const map: Record<string, string> = {
    hours: 'Std.',
    hour: 'Std.',
    hrs: 'Std.',
    days: 'Tage',
    day: 'Tag',
    pieces: 'Stk.',
    piece: 'Stk.',
    pcs: 'Stk.',
    units: 'Einh.',
    unit: 'Einh.',
    pauschal: 'pauschal',
    flat: 'pauschal',
  }
  return map[unit?.toLowerCase?.()] ?? unit ?? ''
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; classes: string }> = {
  draft:     { label: 'Entwurf',    classes: 'bg-gray-100 text-gray-600' },
  sent:      { label: 'Versendet', classes: 'bg-blue-100 text-blue-700' },
  paid:      { label: 'Bezahlt',   classes: 'bg-green-100 text-green-700' },
  overdue:   { label: 'Überfällig',classes: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Storniert', classes: 'bg-gray-100 text-gray-500' },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InvoicePreview({
  invoice,
  client,
  onPrint,
  onDownload,
  onClose,
  className,
}: InvoicePreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const { businessProfile } = useSettingsStore()
  const profile: BusinessProfile | undefined = businessProfile ?? undefined

  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft

  const handleDownload = async () => {
    if (onDownload) { onDownload(); return }
    if (!isWebBuild()) { window.print(); return }
    setIsDownloading(true)
    try {
      const blob = await api.downloadInvoicePdf(invoice.id)
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${invoice.invoiceNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    if (onPrint) { onPrint() } else { window.print() }
  }

  // Derive due date (14 days) if not set
  const dueDate = invoice.dueDate ?? addDays(invoice.invoiceDate, 14)

  return (
    <div className={cn('space-y-4 p-4', className)}>

      {/* ── Action Bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Download className="mr-2 h-4 w-4" />}
            PDF herunterladen
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Schließen</span>
        </Button>
      </div>

      {/* ── Document ─────────────────────────────────────────── */}
      <div
        className="rounded-xl border bg-white shadow-sm print:border-0 print:shadow-none overflow-hidden"
        style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
      >

        {/* ─── Header strip ─────────────────────────────────── */}
        <div
          className="flex items-start justify-between px-8 py-6"
          style={{ background: '#f0f4f8', borderBottom: '2px solid #1e3a5f' }}
        >
          {/* Brand */}
          <div>
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-base mb-2"
              style={{ background: '#1e3a5f' }}
            >
              {profile?.fullName
                ? profile.fullName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
                : 'JD'}
            </div>
            <div className="text-xl font-bold leading-tight" style={{ color: '#1e3a5f' }}>
              {profile?.fullName ?? 'Justin Deisler'}
            </div>
            {profile?.jobTitle && (
              <div className="text-sm text-gray-500">{profile.jobTitle}</div>
            )}
          </div>

          {/* Title + number */}
          <div className="text-right">
            <div className="text-3xl font-bold uppercase tracking-wide" style={{ color: '#1e3a5f' }}>
              Rechnung
            </div>
            <div
              className="inline-block mt-2 px-3 py-1 rounded text-sm font-semibold border"
              style={{ background: 'white', color: '#1e3a5f', borderColor: '#c3d4e8' }}
            >
              {invoice.invoiceNumber}
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* ─── Address block ────────────────────────────────── */}
          <div className="flex justify-between gap-8">

            {/* Recipient */}
            <div className="flex-1">
              {/* Sender strip (window envelope format) */}
              <div className="text-xs text-gray-400 pb-1 mb-2 border-b border-gray-200 truncate">
                {profile?.fullName} · {profile?.street} · {profile?.postalCode} {profile?.city}
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#1e3a5f' }}>
                Rechnungsempfänger
              </div>
              <div className="text-sm leading-relaxed">
                <div className="font-bold text-base">{client?.name ?? '—'}</div>
                {client?.company && <div>{client.company}</div>}
                {client?.address?.street && <div>{client.address.street}</div>}
                {(client?.address?.zip || client?.address?.city) && (
                  <div>{[client.address.zip, client.address.city].filter(Boolean).join(' ')}</div>
                )}
                {client?.address?.country && <div>{client.address.country}</div>}
                {client?.email && <div className="text-gray-500 mt-1">{client.email}</div>}
              </div>
            </div>

            {/* Sender */}
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#1e3a5f' }}>
                Absender
              </div>
              <div className="text-xs leading-relaxed text-gray-600">
                <div className="font-semibold text-sm text-gray-800">{profile?.fullName ?? '—'}</div>
                {profile?.jobTitle && <div>{profile.jobTitle}</div>}
                {profile?.street && <div>{profile.street}</div>}
                {(profile?.postalCode || profile?.city) && (
                  <div>{[profile?.postalCode, profile?.city].filter(Boolean).join(' ')}</div>
                )}
                {profile?.email && <div className="mt-1">{profile.email}</div>}
                {profile?.phone && <div>{profile.phone}</div>}
                {(profile?.vatId || profile?.taxId) && <div className="mt-1" />}
                {profile?.vatId && <div>USt-IdNr.: {profile.vatId}</div>}
                {profile?.taxId && <div>St.-Nr.: {profile.taxId}</div>}
              </div>
            </div>
          </div>

          {/* ─── Meta grid ────────────────────────────────────── */}
          <div
            className="grid grid-cols-4 gap-4 rounded-lg p-4"
            style={{ background: '#f0f4f8', border: '1px solid #c3d4e8' }}
          >
            {[
              { label: 'Rechnungsdatum', value: formatDate(invoice.invoiceDate) },
              { label: 'Leistungsdatum', value: formatDate(invoice.invoiceDate) },
              { label: 'Fällig am',      value: formatDate(dueDate) },
              {
                label: 'Status',
                value: (
                  <span
                    className={cn('inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide', statusCfg.classes)}
                  >
                    {statusCfg.label}
                  </span>
                ),
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#2d5282' }}>
                  {label}
                </div>
                <div className="text-sm font-semibold text-gray-800">{value}</div>
              </div>
            ))}
          </div>

          {/* ─── Line items ───────────────────────────────────── */}
          <div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ background: '#1e3a5f' }}>
                  {['Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Betrag'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-white',
                        i === 0 ? 'text-left w-[44%]' :
                        i === 1 || i === 2 ? 'text-center w-[10%]' : 'text-right w-[18%]'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, idx) => (
                  <tr
                    key={item.id ?? idx}
                    style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}
                  >
                    <td className="px-3 py-3 font-medium">{item.description}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-3 text-center text-gray-600">{getUnitLabel(item.unit)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '2px solid #1e3a5f' }} />
          </div>

          {/* ─── Totals ───────────────────────────────────────── */}
          <div className="flex justify-end">
            <div className="w-64 overflow-hidden rounded-lg border border-gray-200">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-600">Nettobetrag</span>
                <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-100">
                <span className="text-gray-500">USt. {invoice.vatRate}%</span>
                <span className="font-medium text-gray-600">{formatCurrency(invoice.vatAmount)}</span>
              </div>
              <div
                className="flex justify-between px-4 py-3 text-sm font-bold"
                style={{ background: '#1e3a5f', color: 'white' }}
              >
                <span>Gesamtbetrag</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* ─── Payment info ─────────────────────────────────── */}
          {profile?.bankIban && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#1e3a5f' }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#1e3a5f' }}>
                  Zahlungsinformationen
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                {[
                  ['Empfänger', profile?.bankAccountHolder || profile?.fullName],
                  ['Bank', profile?.bankName],
                  ['IBAN', profile?.bankIban?.replace(/(.{4})/g, '$1 ').trim()],
                  ['BIC', profile?.bankBic],
                  ['Verwendungszweck', invoice.invoiceNumber],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string} className="flex gap-2">
                    <span className="text-gray-400 min-w-[90px]">{label}</span>
                    <span
                      className="font-medium text-gray-700"
                      style={{ fontFamily: "monospace", letterSpacing: label === 'IBAN' ? '0.5px' : undefined }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Notes ────────────────────────────────────────── */}
          {invoice.notes && (
            <div
              className="rounded-r-lg py-3 px-4 text-sm"
              style={{ borderLeft: '3px solid #1e3a5f', background: '#f0f4f8' }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#1e3a5f' }}>
                Hinweise
              </div>
              <div className="text-gray-600 leading-relaxed">{invoice.notes}</div>
            </div>
          )}

          {/* ─── Footer ───────────────────────────────────────── */}
          <div className="flex justify-between pt-4 border-t border-gray-200 text-xs text-gray-400">
            <div>
              <span className="font-semibold" style={{ color: '#1e3a5f' }}>{profile?.fullName}</span>
              {' · '}
              {[profile?.street, [profile?.postalCode, profile?.city].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
              {profile?.email && ` · ${profile.email}`}
            </div>
            <div className="text-right">
              {profile?.taxId && <div>Steuernummer: {profile.taxId}</div>}
              {profile?.vatId && <div>USt-IdNr.: {profile.vatId}</div>}
            </div>
          </div>

        </div>{/* /content */}
      </div>{/* /document */}
    </div>
  )
}

export default InvoicePreview
