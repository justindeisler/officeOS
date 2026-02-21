/**
 * SuSa Report Component
 *
 * Summen- und Saldenliste (Trial Balance / Sum and Balance List).
 * Standard German accounting report showing:
 * - Account numbers (SKR03)
 * - Debit/Credit totals per account
 * - Balance per account
 * - Grouped by account type
 * - Export to CSV and print functionality
 */

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Printer, Download } from 'lucide-react'
import { useSuSa } from '../../hooks/useBWA'
import type { SuSaAccount } from '../../api/bwa-reports'

// ============================================================================
// Types
// ============================================================================

export interface SuSaReportProps {
  /** Override the year */
  year?: number
  /** Additional CSS classes */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2020 + i)

/**
 * Account type classification based on SKR03 account number ranges.
 * Standard German chart of accounts structure:
 * 0xxx = Anlage- und Kapitalkonten (Assets / Capital)
 * 1xxx = Finanz- und Privatkonten (Financial / Receivables / Payables)
 * 2xxx = Abgrenzungskonten
 * 3xxx = Wareneingang
 * 4xxx = Betriebliche Aufwendungen (Expenses)
 * 5xxx-7xxx = Weitere Aufwendungen
 * 8xxx = Erlöse (Income)
 * 9xxx = Vortrags- und statistische Konten
 */
interface AccountGroup {
  label: string
  range: [number, number][]
}

const ACCOUNT_GROUPS: AccountGroup[] = [
  {
    label: 'Anlage- & Kapitalkonten',
    range: [[0, 999]],
  },
  {
    label: 'Finanz- & Umsatzsteuerkonten',
    range: [[1000, 1999]],
  },
  {
    label: 'Aufwendungen',
    range: [
      [2000, 2999],
      [3000, 3999],
      [4000, 4999],
      [5000, 5999],
      [6000, 6999],
      [7000, 7999],
    ],
  },
  {
    label: 'Erlöse',
    range: [
      [8000, 8999],
      [9000, 9999],
    ],
  },
]

function getAccountGroup(accountNumber: string): string {
  const num = parseInt(accountNumber, 10)
  if (isNaN(num)) return 'Sonstige'

  for (const group of ACCOUNT_GROUPS) {
    for (const [min, max] of group.range) {
      if (num >= min && num <= max) {
        return group.label
      }
    }
  }
  return 'Sonstige'
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function generateCSV(accounts: SuSaAccount[], year: number): string {
  const BOM = '\ufeff' // UTF-8 BOM for Excel
  const header = 'Konto;Kontobezeichnung;Soll;Haben;Saldo\n'
  const rows = accounts
    .map(
      (a) =>
        `${a.account_number};${a.account_name};${a.debit.toFixed(2).replace('.', ',')};${a.credit.toFixed(2).replace('.', ',')};${a.balance.toFixed(2).replace('.', ',')}`
    )
    .join('\n')
  return BOM + header + rows
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ============================================================================
// Main Component
// ============================================================================

export function SuSaReport({ year, className }: SuSaReportProps) {
  const { data, isLoading, error, selectedYear, setSelectedYear } = useSuSa({
    year,
  })

  // Group accounts by type, filtering out zero-balance accounts
  const groupedAccounts = useMemo(() => {
    if (!data?.accounts) return []

    const activeAccounts = data.accounts.filter(
      (a) => a.debit !== 0 || a.credit !== 0
    )

    const groups: { label: string; accounts: SuSaAccount[]; debitTotal: number; creditTotal: number; balanceTotal: number }[] = []
    const groupMap = new Map<string, SuSaAccount[]>()

    for (const account of activeAccounts) {
      const groupLabel = getAccountGroup(account.account_number)
      if (!groupMap.has(groupLabel)) {
        groupMap.set(groupLabel, [])
      }
      groupMap.get(groupLabel)!.push(account)
    }

    // Maintain group order from ACCOUNT_GROUPS
    for (const group of ACCOUNT_GROUPS) {
      const accounts = groupMap.get(group.label)
      if (accounts && accounts.length > 0) {
        groups.push({
          label: group.label,
          accounts,
          debitTotal: accounts.reduce((s, a) => s + a.debit, 0),
          creditTotal: accounts.reduce((s, a) => s + a.credit, 0),
          balanceTotal: accounts.reduce((s, a) => s + a.balance, 0),
        })
      }
    }

    // Handle "Sonstige" if any
    const sonstige = groupMap.get('Sonstige')
    if (sonstige && sonstige.length > 0) {
      groups.push({
        label: 'Sonstige',
        accounts: sonstige,
        debitTotal: sonstige.reduce((s, a) => s + a.debit, 0),
        creditTotal: sonstige.reduce((s, a) => s + a.credit, 0),
        balanceTotal: sonstige.reduce((s, a) => s + a.balance, 0),
      })
    }

    return groups
  }, [data])

  // Grand totals
  const grandTotals = useMemo(() => {
    if (!data?.accounts) return { debit: 0, credit: 0, balance: 0 }
    const active = data.accounts.filter((a) => a.debit !== 0 || a.credit !== 0)
    return {
      debit: active.reduce((s, a) => s + a.debit, 0),
      credit: active.reduce((s, a) => s + a.credit, 0),
      balance: active.reduce((s, a) => s + a.balance, 0),
    }
  }, [data])

  // Handle CSV export
  const handleExport = () => {
    if (!data?.accounts) return
    const activeAccounts = data.accounts.filter(
      (a) => a.debit !== 0 || a.credit !== 0
    )
    const csv = generateCSV(activeAccounts, selectedYear)
    downloadCSV(csv, `SuSa_${selectedYear}.csv`)
  }

  // Handle print
  const handlePrint = () => window.print()

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">SuSa {selectedYear}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Laden...
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">SuSa {selectedYear}</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {error}
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || groupedAccounts.length === 0) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">SuSa {selectedYear}</h2>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Keine Daten verfügbar
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6 print:space-y-2', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h2 className="text-xl font-semibold">
          Summen- und Saldenliste {selectedYear}
        </h2>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            CSV Export
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print:text-center print:mb-4">
        <h1 className="text-lg font-bold">
          Summen- und Saldenliste {selectedYear}
        </h1>
      </div>

      {/* SuSa Table */}
      <div className="rounded-lg border overflow-x-auto print:border-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Konto</TableHead>
              <TableHead>Kontobezeichnung</TableHead>
              <TableHead className="text-right">Soll</TableHead>
              <TableHead className="text-right">Haben</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedAccounts.map((group) => (
              <React.Fragment key={group.label}>
                {/* Group Header */}
                <TableRow className="bg-muted/30">
                  <TableCell
                    colSpan={5}
                    className="font-semibold text-foreground"
                  >
                    {group.label}
                  </TableCell>
                </TableRow>

                {/* Accounts */}
                {group.accounts.map((account, idx) => (
                  <TableRow
                    key={account.account_number}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      idx % 2 === 1 && 'bg-muted/10'
                    )}
                  >
                    <TableCell className="font-mono text-sm">
                      {account.account_number}
                    </TableCell>
                    <TableCell>{account.account_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {account.debit > 0 ? formatCurrency(account.debit) : '–'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {account.credit > 0
                        ? formatCurrency(account.credit)
                        : '–'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums font-medium',
                        account.balance > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : account.balance < 0
                            ? 'text-orange-600 dark:text-orange-400'
                            : ''
                      )}
                    >
                      {formatCurrency(account.balance)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Group Subtotal */}
                <TableRow className="font-medium bg-muted/20 border-b-2">
                  <TableCell colSpan={2} className="text-right">
                    Summe {group.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(group.debitTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(group.creditTotal)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-semibold',
                      group.balanceTotal > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : group.balanceTotal < 0
                          ? 'text-orange-600 dark:text-orange-400'
                          : ''
                    )}
                  >
                    {formatCurrency(group.balanceTotal)}
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}

            {/* Grand Total */}
            <TableRow className="border-t-2 bg-muted font-bold text-base">
              <TableCell colSpan={2} className="text-right">
                Gesamtsumme
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(grandTotals.debit)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(grandTotals.credit)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  grandTotals.balance > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : grandTotals.balance < 0
                      ? 'text-orange-600 dark:text-orange-400'
                      : ''
                )}
              >
                {formatCurrency(grandTotals.balance)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Info */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground print:hidden">
        <p>
          <strong>SuSa</strong> = Summen- und Saldenliste (SKR03 Kontenrahmen).
        </p>
        <p className="mt-1">
          Soll = Aufwand/Vermögen | Haben = Erlöse/Verbindlichkeiten |
          Saldo = Soll − Haben
        </p>
      </div>
    </div>
  )
}

export default SuSaReport
