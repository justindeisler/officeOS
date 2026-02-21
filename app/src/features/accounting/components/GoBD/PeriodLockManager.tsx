/**
 * PeriodLockManager Component
 *
 * Grid/calendar view showing months, quarters, and year
 * with lock/unlock functionality for GoBD compliance.
 */

import { useState } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { usePeriodLocks } from '../../hooks/usePeriodLocks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Lock, Unlock, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react'

export interface PeriodLockManagerProps {
  /** Additional CSS classes */
  className?: string
}

const MONTH_LABELS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez',
]

function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 6 }, (_, i) => currentYear - i)
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function isFuturePeriod(key: string): boolean {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split('-').map(Number)
    return year > currentYear || (year === currentYear && month > currentMonth)
  }
  if (/^\d{4}-Q[1-4]$/.test(key)) {
    const year = parseInt(key.slice(0, 4))
    const quarter = parseInt(key.slice(6))
    const lastMonthOfQ = quarter * 3
    return year > currentYear || (year === currentYear && lastMonthOfQ > currentMonth)
  }
  if (/^\d{4}$/.test(key)) {
    return parseInt(key) > currentYear
  }
  return false
}

export function PeriodLockManager({ className }: PeriodLockManagerProps) {
  const {
    periods,
    isLoading,
    error,
    selectedYear,
    setSelectedYear,
    lockPeriod,
    unlockPeriod,
  } = usePeriodLocks()

  const [lockDialogOpen, setLockDialogOpen] = useState(false)
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const availableYears = getAvailableYears()

  // Separate periods by type
  const months = periods.filter(p => p.type === 'month')
  const quarters = periods.filter(p => p.type === 'quarter')
  const yearPeriod = periods.find(p => p.type === 'year')

  const handleLockClick = (key: string) => {
    setSelectedPeriodKey(key)
    setReason('')
    setActionError(null)
    setLockDialogOpen(true)
  }

  const handleUnlockClick = (key: string) => {
    setSelectedPeriodKey(key)
    setReason('')
    setActionError(null)
    setUnlockDialogOpen(true)
  }

  const handleConfirmLock = async () => {
    if (!selectedPeriodKey) return
    setActionLoading(true)
    setActionError(null)
    try {
      await lockPeriod(selectedPeriodKey, reason || undefined)
      setLockDialogOpen(false)
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmUnlock = async () => {
    if (!selectedPeriodKey || !reason.trim()) return
    setActionLoading(true)
    setActionError(null)
    try {
      await unlockPeriod(selectedPeriodKey, reason)
      setUnlockDialogOpen(false)
    } catch (err) {
      setActionError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const getPeriodLabel = (key: string): string => {
    if (/^\d{4}-\d{2}$/.test(key)) {
      const month = parseInt(key.split('-')[1])
      return MONTH_LABELS[month - 1]
    }
    if (/^\d{4}-Q[1-4]$/.test(key)) {
      return `Quartal ${key.slice(6)}`
    }
    return `Jahr ${key}`
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">Zeiträume sperren</h2>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <h2 className="text-xl font-semibold">Zeiträume sperren</h2>
        <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
          Fehler: {error}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Zeiträume sperren</h2>
          <p className="text-sm text-muted-foreground mt-1">
            GoBD-konforme Periodensperrung nach Meldung an das Finanzamt
          </p>
        </div>
        <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Months Grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Monate
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {months.map((period) => {
            const monthIdx = parseInt(period.key.split('-')[1]) - 1
            const future = isFuturePeriod(period.key)
            return (
              <button
                key={period.key}
                onClick={() => period.locked ? handleUnlockClick(period.key) : handleLockClick(period.key)}
                disabled={future}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors text-sm',
                  future && 'opacity-40 cursor-not-allowed bg-gray-50',
                  !future && period.locked && 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer',
                  !future && !period.locked && 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer',
                )}
                aria-label={`${MONTH_SHORT[monthIdx]} ${selectedYear}: ${period.locked ? 'gesperrt' : future ? 'zukünftig' : 'offen'}`}
              >
                <span className="font-medium">{MONTH_SHORT[monthIdx]}</span>
                {future ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : period.locked ? (
                  <Lock className="h-4 w-4 text-red-500" />
                ) : (
                  <Unlock className="h-4 w-4 text-green-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quarters */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Quartale
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {quarters.map((period) => {
            const qNum = period.key.slice(6)
            const future = isFuturePeriod(period.key)
            return (
              <button
                key={period.key}
                onClick={() => period.locked ? handleUnlockClick(period.key) : handleLockClick(period.key)}
                disabled={future}
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 transition-colors',
                  future && 'opacity-40 cursor-not-allowed bg-gray-50',
                  !future && period.locked && 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer',
                  !future && !period.locked && 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer',
                )}
                aria-label={`Quartal ${qNum} ${selectedYear}: ${period.locked ? 'gesperrt' : future ? 'zukünftig' : 'offen'}`}
              >
                <span className="font-medium">Q{qNum}</span>
                {future ? (
                  <span className="text-xs text-gray-400">—</span>
                ) : period.locked ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="destructive" className="text-xs">Gesperrt</Badge>
                    <Lock className="h-4 w-4 text-red-500" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs text-green-700 border-green-300">Offen</Badge>
                    <Unlock className="h-4 w-4 text-green-500" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Year */}
      {yearPeriod && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Geschäftsjahr
          </h3>
          <button
            onClick={() => yearPeriod.locked ? handleUnlockClick(yearPeriod.key) : handleLockClick(yearPeriod.key)}
            className={cn(
              'flex items-center justify-between rounded-lg border p-4 w-full sm:w-auto sm:min-w-[300px] transition-colors',
              yearPeriod.locked
                ? 'bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer'
                : 'bg-green-50 border-green-200 hover:bg-green-100 cursor-pointer',
            )}
            aria-label={`Jahr ${selectedYear}: ${yearPeriod.locked ? 'gesperrt' : 'offen'}`}
          >
            <div className="flex items-center gap-2">
              {yearPeriod.locked
                ? <ShieldAlert className="h-5 w-5 text-red-500" />
                : <ShieldCheck className="h-5 w-5 text-green-500" />}
              <span className="font-semibold">{selectedYear}</span>
            </div>
            {yearPeriod.locked ? (
              <Badge variant="destructive">Gesperrt</Badge>
            ) : (
              <Badge variant="outline" className="text-green-700 border-green-300">Offen</Badge>
            )}
          </button>
          {yearPeriod.lock?.reason && (
            <p className="text-xs text-muted-foreground mt-2">
              Grund: {yearPeriod.lock.reason} • Gesperrt am: {formatDate(yearPeriod.lock.locked_at)}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-200 border border-green-300" />
          <span>Offen</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-200 border border-red-300" />
          <span>Gesperrt</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
          <span>Zukünftig</span>
        </div>
      </div>

      {/* Lock Dialog */}
      <Dialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zeitraum sperren</DialogTitle>
            <DialogDescription>
              {selectedPeriodKey && getPeriodLabel(selectedPeriodKey)} {selectedYear} wird gesperrt.
              Gesperrte Zeiträume können nicht mehr bearbeitet werden (GoBD).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="lockReason">Grund (optional)</Label>
              <Input
                id="lockReason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="z.B. USt-VA gemeldet"
              />
            </div>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialogOpen(false)} disabled={actionLoading}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleConfirmLock} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Lock className="mr-2 h-4 w-4" />
              Sperren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zeitraum entsperren</DialogTitle>
            <DialogDescription>
              {selectedPeriodKey && getPeriodLabel(selectedPeriodKey)} {selectedYear} wird entsperrt.
              Ein Grund ist für die GoBD-Dokumentation erforderlich.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="unlockReason">Grund (erforderlich)</Label>
              <Input
                id="unlockReason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="z.B. Korrekturbuchung erforderlich"
              />
            </div>
            {actionError && (
              <p className="text-sm text-destructive">{actionError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockDialogOpen(false)} disabled={actionLoading}>
              Abbrechen
            </Button>
            <Button onClick={handleConfirmUnlock} disabled={actionLoading || !reason.trim()}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Unlock className="mr-2 h-4 w-4" />
              Entsperren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PeriodLockManager
