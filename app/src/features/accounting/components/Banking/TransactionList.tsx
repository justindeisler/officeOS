/**
 * TransactionList Component
 *
 * Full-featured table view of bank transactions with:
 * - Color coding by match status
 * - Filters: date range, account, match status, amount range, search
 * - Sort by date, amount
 * - Pagination
 * - Click row to open match dialog
 */

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react'
import type { BankTransaction, BankAccount } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface TransactionListProps {
  transactions: BankTransaction[]
  accounts?: BankAccount[]
  isLoading?: boolean
  onRowClick?: (tx: BankTransaction) => void
  page: number
  setPage: (page: number) => void
  pageSize: number
  totalPages: number
  className?: string
}

const matchStatusConfig: Record<
  string,
  { label: string; dotColor: string; bgColor: string }
> = {
  unmatched: {
    label: 'Offen',
    dotColor: 'bg-yellow-500',
    bgColor: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/20',
  },
  auto_matched: {
    label: 'Auto-Match',
    dotColor: 'bg-blue-500',
    bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
  },
  manual_matched: {
    label: 'Zugeordnet',
    dotColor: 'bg-green-500',
    bgColor: 'hover:bg-green-50 dark:hover:bg-green-950/20',
  },
  booked: {
    label: 'Gebucht',
    dotColor: 'bg-green-500',
    bgColor: 'hover:bg-green-50 dark:hover:bg-green-950/20',
  },
  ignored: {
    label: 'Ignoriert',
    dotColor: 'bg-gray-400',
    bgColor: 'hover:bg-gray-50 dark:hover:bg-gray-950/20 opacity-60',
  },
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

type SortField = 'date' | 'amount'
type SortDir = 'asc' | 'desc'

export function TransactionList({
  transactions,
  accounts,
  isLoading,
  onRowClick,
  page,
  setPage,
  pageSize,
  totalPages,
  className,
}: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Filter
  const filtered = useMemo(() => {
    let result = transactions

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (tx) =>
          tx.counterpart_name?.toLowerCase().includes(term) ||
          tx.purpose?.toLowerCase().includes(term) ||
          String(tx.amount).includes(term)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((tx) => tx.match_status === statusFilter)
    }

    if (accountFilter !== 'all') {
      result = result.filter((tx) => tx.account_id === accountFilter)
    }

    if (dateFrom) {
      result = result.filter((tx) => tx.booking_date >= dateFrom)
    }
    if (dateTo) {
      result = result.filter((tx) => tx.booking_date <= dateTo)
    }

    if (amountMin) {
      result = result.filter((tx) => Math.abs(tx.amount) >= parseFloat(amountMin))
    }
    if (amountMax) {
      result = result.filter((tx) => Math.abs(tx.amount) <= parseFloat(amountMax))
    }

    return result
  }, [transactions, searchTerm, statusFilter, accountFilter, dateFrom, dateTo, amountMin, amountMax])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') {
        cmp = a.booking_date.localeCompare(b.booking_date)
      } else {
        cmp = a.amount - b.amount
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortField, sortDir])

  // Paginate
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  const effectiveTotalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (accountFilter !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0) +
    (amountMin ? 1 : 0) +
    (amountMax ? 1 : 0)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search + Basic Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suchen (Auftraggeber, Zweck, Betrag)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="unmatched">Offen</SelectItem>
            <SelectItem value="auto_matched">Auto-Match</SelectItem>
            <SelectItem value="manual_matched">Zugeordnet</SelectItem>
            <SelectItem value="booked">Gebucht</SelectItem>
            <SelectItem value="ignored">Ignoriert</SelectItem>
          </SelectContent>
        </Select>

        <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="default" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Advanced Filters */}
      <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
        <CollapsibleContent>
          <div className="rounded-lg border bg-muted/30 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {accounts && accounts.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Konto</Label>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Konten" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Konten</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.account_name || a.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Datum von</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Datum bis</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Betrag min (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Betrag max (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="∞"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAccountFilter('all')
                  setDateFrom('')
                  setDateTo('')
                  setAmountMin('')
                  setAmountMax('')
                }}
              >
                Filter zurücksetzen
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{sorted.length} Transaktionen</span>
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {transactions.length === 0
            ? 'Keine Transaktionen vorhanden.'
            : 'Keine Transaktionen gefunden.'}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none w-[100px]"
                    onClick={() => toggleSort('date')}
                  >
                    Datum {sortField === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead>Auftraggeber</TableHead>
                  <TableHead className="hidden lg:table-cell">Verwendungszweck</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none w-[120px]"
                    onClick={() => toggleSort('amount')}
                  >
                    Betrag {sortField === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
                  </TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((tx) => {
                  const status = matchStatusConfig[tx.match_status] || matchStatusConfig.unmatched
                  return (
                    <TableRow
                      key={tx.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        status.bgColor
                      )}
                      onClick={() => onRowClick?.(tx)}
                    >
                      <TableCell className="text-sm tabular-nums">
                        {formatDate(tx.booking_date)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={cn(
                              'flex-shrink-0 p-1 rounded-full',
                              tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'
                            )}
                          >
                            {tx.amount >= 0 ? (
                              <ArrowDownLeft className="h-3 w-3 text-green-600" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                          <span className="font-medium truncate">
                            {tx.counterpart_name || 'Unbekannt'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground truncate max-w-[300px]">
                        {tx.purpose || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'font-mono font-medium',
                            tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          )}
                        >
                          {tx.amount >= 0 ? '+' : ''}
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', status.dotColor)} />
                          <span className="text-xs">{status.label}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden space-y-1">
            {paginated.map((tx) => {
              const status = matchStatusConfig[tx.match_status] || matchStatusConfig.unmatched
              return (
                <div
                  key={tx.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border cursor-pointer',
                    status.bgColor
                  )}
                  onClick={() => onRowClick?.(tx)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'flex-shrink-0 p-1.5 rounded-full',
                        tx.amount >= 0 ? 'bg-green-100' : 'bg-red-100'
                      )}
                    >
                      {tx.amount >= 0 ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">
                        {tx.counterpart_name || 'Unbekannt'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.purpose || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p
                      className={cn(
                        'font-mono font-medium text-sm',
                        tx.amount >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full', status.dotColor)} />
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(tx.booking_date)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {effectiveTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Seite {page} von {effectiveTotalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= effectiveTotalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
