/**
 * BankAccountList Component
 *
 * Grid view of connected bank accounts with status indicators,
 * balance display, sync buttons, and account management.
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import {
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  CreditCard,
} from 'lucide-react'
import type { BankAccount } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface BankAccountListProps {
  accounts: BankAccount[]
  isLoading: boolean
  onConnectAccount: () => void
  onSyncAccount: (accountId: string) => void
  onDeleteAccount: (accountId: string) => void
  syncingAccountId?: string | null
  className?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function maskIban(iban: string | null): string {
  if (!iban) return '—'
  const clean = iban.replace(/\s/g, '')
  if (clean.length < 8) return iban
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`
}

function formatLastSync(dateStr: string | null): string {
  if (!dateStr) return 'Nie synchronisiert'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Gerade eben'
  if (diffMins < 60) return `vor ${diffMins} Min.`
  if (diffHours < 24) return `vor ${diffHours} Std.`
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getSyncStatusConfig(status: string, error: string | null) {
  if (error) {
    return {
      icon: AlertCircle,
      label: 'Fehler',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-800 border-red-200',
    }
  }
  switch (status) {
    case 'synced':
      return {
        icon: Wifi,
        label: 'Synchronisiert',
        variant: 'default' as const,
        className: 'bg-green-100 text-green-800 border-green-200',
      }
    case 'syncing':
      return {
        icon: RefreshCw,
        label: 'Synchronisiert...',
        variant: 'default' as const,
        className: 'bg-blue-100 text-blue-800 border-blue-200',
      }
    default:
      return {
        icon: WifiOff,
        label: 'Ausstehend',
        variant: 'secondary' as const,
        className: 'bg-gray-100 text-gray-800 border-gray-200',
      }
  }
}

export function BankAccountList({
  accounts,
  isLoading,
  onConnectAccount,
  onSyncAccount,
  onDeleteAccount,
  syncingAccountId,
  className,
}: BankAccountListProps) {
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {accounts.length} {accounts.length === 1 ? 'Konto' : 'Konten'}
            </span>
          </div>
          {accounts.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Gesamtsaldo: </span>
              <span
                className={cn(
                  'font-semibold',
                  totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {formatCurrency(totalBalance)}
              </span>
            </div>
          )}
        </div>
        <Button onClick={onConnectAccount} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Konto verbinden
        </Button>
      </div>

      {/* Account cards */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Keine Bankkonten verbunden.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Verbinden Sie Ihr Geschäftskonto, um Transaktionen zu importieren.
            </p>
            <Button onClick={onConnectAccount} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Erstes Konto verbinden
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const syncStatus = getSyncStatusConfig(
              account.sync_status,
              account.last_sync_error
            )
            const SyncIcon = syncStatus.icon
            const isSyncing = syncingAccountId === account.id

            return (
              <Card
                key={account.id}
                className={cn(
                  'transition-shadow hover:shadow-md',
                  !account.is_active && 'opacity-60'
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <CardTitle className="text-base truncate">
                        {account.account_name || account.bank_name || 'Bankkonto'}
                      </CardTitle>
                    </div>
                    <Badge className={syncStatus.className} variant="outline">
                      <SyncIcon className="h-3 w-3 mr-1" />
                      {syncStatus.label}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    {maskIban(account.iban)}
                  </p>
                </CardHeader>
                <CardContent>
                  <div
                    className={cn(
                      'text-2xl font-bold mb-2',
                      account.balance >= 0 ? 'text-foreground' : 'text-red-600'
                    )}
                  >
                    {formatCurrency(account.balance)}
                  </div>

                  {account.last_sync_error && (
                    <p className="text-xs text-destructive mb-2 line-clamp-2">
                      {account.last_sync_error}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground mb-3">
                    {formatLastSync(account.last_sync_at)}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => onSyncAccount(account.id)}
                      disabled={isSyncing}
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5 mr-1.5', isSyncing && 'animate-spin')}
                      />
                      {isSyncing ? 'Sync...' : 'Synchronisieren'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeletingAccountId(account.id)}
                      title="Konto entfernen"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deletingAccountId}
        onOpenChange={(open) => !open && setDeletingAccountId(null)}
        title="Bankkonto entfernen?"
        description="Das Konto wird entfernt. Transaktionen bleiben erhalten."
        onConfirm={() => {
          if (deletingAccountId) {
            onDeleteAccount(deletingAccountId)
            setDeletingAccountId(null)
          }
        }}
      />
    </div>
  )
}
