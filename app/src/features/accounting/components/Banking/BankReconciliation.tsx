/**
 * BankReconciliation Component
 *
 * Reconciliation dashboard showing:
 * - Total transactions, matched %, unmatched count, ignored count
 * - Period selector (month/quarter/year)
 * - Visual match rate breakdown
 */

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  AlertCircle,
  Ban,
  Sparkles,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { BankTransaction } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface BankReconciliationProps {
  transactions: BankTransaction[]
  isLoading?: boolean
  className?: string
}

type Period = 'month' | 'quarter' | 'year' | 'all'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function getDateRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  let from: Date

  switch (period) {
    case 'month':
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      from = new Date(now.getFullYear(), qMonth, 1)
      break
    }
    case 'year':
      from = new Date(now.getFullYear(), 0, 1)
      break
    case 'all':
    default:
      from = new Date(2000, 0, 1)
      break
  }

  return { from, to }
}

function getPeriodLabel(period: Period): string {
  const labels: Record<Period, string> = {
    month: 'Dieser Monat',
    quarter: 'Dieses Quartal',
    year: 'Dieses Jahr',
    all: 'Gesamt',
  }
  return labels[period]
}

export function BankReconciliation({
  transactions,
  isLoading,
  className,
}: BankReconciliationProps) {
  const [period, setPeriod] = useState<Period>('month')

  const stats = useMemo(() => {
    const range = getDateRange(period)
    const filtered = transactions.filter((tx) => {
      const date = new Date(tx.booking_date)
      return date >= range.from && date <= range.to
    })

    const total = filtered.length
    const matched = filtered.filter(
      (tx) =>
        tx.match_status === 'manual_matched' ||
        tx.match_status === 'auto_matched' ||
        tx.match_status === 'booked'
    ).length
    const unmatched = filtered.filter((tx) => tx.match_status === 'unmatched').length
    const ignored = filtered.filter((tx) => tx.match_status === 'ignored').length
    const autoMatched = filtered.filter((tx) => tx.match_status === 'auto_matched').length

    const matchRate = total > 0 ? (matched / total) * 100 : 0

    const totalIncoming = filtered
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0)
    const totalOutgoing = filtered
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    return {
      total,
      matched,
      unmatched,
      ignored,
      autoMatched,
      matchRate,
      totalIncoming,
      totalOutgoing,
      net: totalIncoming - totalOutgoing,
    }
  }, [transactions, period])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Kontenabstimmung</h3>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Dieser Monat</SelectItem>
            <SelectItem value="quarter">Dieses Quartal</SelectItem>
            <SelectItem value="year">Dieses Jahr</SelectItem>
            <SelectItem value="all">Gesamt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Transaktionen
              </span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {getPeriodLabel(period)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Zuordnungsrate
              </span>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold">
              {stats.matchRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.matched} von {stats.total} zugeordnet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Offen
              </span>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">
              {stats.unmatched}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Noch zuzuordnen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Ignoriert
              </span>
              <Ban className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-500">{stats.ignored}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Irrelevante Umsätze
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Match Rate Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4 mb-3">
            <span className="text-sm font-medium">Zuordnungsstatus</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
            {stats.total > 0 && (
              <>
                <div
                  className="bg-green-500 transition-all duration-500"
                  style={{ width: `${(stats.matched / stats.total) * 100}%` }}
                  title={`Zugeordnet: ${stats.matched}`}
                />
                <div
                  className="bg-yellow-400 transition-all duration-500"
                  style={{ width: `${(stats.unmatched / stats.total) * 100}%` }}
                  title={`Offen: ${stats.unmatched}`}
                />
                <div
                  className="bg-gray-300 transition-all duration-500"
                  style={{ width: `${(stats.ignored / stats.total) * 100}%` }}
                  title={`Ignoriert: ${stats.ignored}`}
                />
              </>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Zugeordnet ({stats.matched})
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              Offen ({stats.unmatched})
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              Ignoriert ({stats.ignored})
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Eingänge</span>
            </div>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(stats.totalIncoming)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">Ausgänge</span>
            </div>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(stats.totalOutgoing)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">Netto</span>
            </div>
            <p
              className={cn(
                'text-xl font-bold',
                stats.net >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {formatCurrency(stats.net)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
