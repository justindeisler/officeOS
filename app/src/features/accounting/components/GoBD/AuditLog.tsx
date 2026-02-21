/**
 * AuditLog Component
 *
 * Timeline/accordion view showing GoBD change history.
 * Supports both entity-specific view and global search.
 */

import { useState, useEffect } from 'react'
import { cn, getErrorMessage } from '@/lib/utils'
import { useAuditLog } from '../../hooks/useAuditLog'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, ChevronDown, Search, Plus, Pencil, Trash2, Lock, ArrowRight } from 'lucide-react'

export interface AuditLogProps {
  /** Entity type to show audit for (e.g., 'income', 'expense', 'invoice') */
  entityType?: string
  /** Entity ID to show audit for */
  entityId?: string
  /** Whether to show in compact/embedded mode */
  embedded?: boolean
  /** Additional CSS classes */
  className?: string
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; color: string; bgColor: string }> = {
  create: { icon: Plus, label: 'Erstellt', color: 'text-green-700', bgColor: 'bg-green-100' },
  update: { icon: Pencil, label: 'Geändert', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  delete: { icon: Trash2, label: 'Gelöscht', color: 'text-red-700', bgColor: 'bg-red-100' },
  lock: { icon: Lock, label: 'Gesperrt', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  unlock: { icon: Lock, label: 'Entsperrt', color: 'text-purple-700', bgColor: 'bg-purple-100' },
}

const ENTITY_LABELS: Record<string, string> = {
  income: 'Einnahme',
  expense: 'Ausgabe',
  invoice: 'Rechnung',
  asset: 'Anlagegut',
  period_lock: 'Periodensperre',
  attachment: 'Anhang',
}

function formatTimestamp(ts: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts))
}

function formatDate(ts: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ts))
}

export function AuditLog({
  entityType,
  entityId,
  embedded = false,
  className,
}: AuditLogProps) {
  const { entries, total, isLoading, error, fetchForEntity, search } = useAuditLog({
    entityType,
    entityId,
    autoFetch: !!entityType && !!entityId,
  })

  // Search mode state
  const [searchMode, setSearchMode] = useState(!entityType || !entityId)
  const [filterEntityType, setFilterEntityType] = useState<string>('all')
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')

  const handleSearch = async () => {
    await search({
      entity_type: filterEntityType !== 'all' ? filterEntityType : undefined,
      action: filterAction !== 'all' ? filterAction : undefined,
      start_date: filterStartDate || undefined,
      end_date: filterEndDate || undefined,
      limit: 100,
    })
  }

  // Auto-search on mount in search mode
  useEffect(() => {
    if (searchMode && !entityType && !entityId) {
      search({ limit: 50 })
    }
  }, [searchMode, entityType, entityId, search])

  if (isLoading && entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-6', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Audit-Log laden...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('rounded-lg border border-destructive p-4 text-sm text-destructive', className)}>
        {error}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {!embedded && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Audit-Log</h2>
            {total > 0 && (
              <Badge variant="secondary">{total} Einträge</Badge>
            )}
          </div>

          {/* Filters */}
          {searchMode && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Typ</Label>
                  <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="income">Einnahmen</SelectItem>
                      <SelectItem value="expense">Ausgaben</SelectItem>
                      <SelectItem value="invoice">Rechnungen</SelectItem>
                      <SelectItem value="asset">Anlagegüter</SelectItem>
                      <SelectItem value="period_lock">Periodensperren</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aktion</Label>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle</SelectItem>
                      <SelectItem value="create">Erstellt</SelectItem>
                      <SelectItem value="update">Geändert</SelectItem>
                      <SelectItem value="delete">Gelöscht</SelectItem>
                      <SelectItem value="lock">Gesperrt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Von</Label>
                  <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bis</Label>
                  <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-8" />
                </div>
              </div>
              <Button size="sm" onClick={handleSearch} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                <Search className="mr-2 h-3 w-3" />
                Suchen
              </Button>
            </div>
          )}
        </>
      )}

      {/* Timeline */}
      {entries.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          Keine Audit-Einträge gefunden
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.update
            const Icon = config.icon
            const hasFieldChange = entry.field_name && (entry.old_value !== undefined || entry.new_value !== undefined)

            return (
              <Collapsible key={entry.id}>
                <CollapsibleTrigger className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-muted/50 transition-colors group">
                  {/* Action icon */}
                  <div className={cn('flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0', config.bgColor)}>
                    <Icon className={cn('h-3.5 w-3.5', config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className={cn('text-xs', config.color)}>
                        {config.label}
                      </Badge>
                      {!embedded && entry.entity_type && (
                        <span className="text-xs text-muted-foreground">
                          {ENTITY_LABELS[entry.entity_type] || entry.entity_type}
                        </span>
                      )}
                      {entry.field_name && (
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          {entry.field_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatTimestamp(entry.timestamp)}
                      {entry.user_id && ` • ${entry.user_id}`}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  {hasFieldChange && (
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  )}
                </CollapsibleTrigger>

                {hasFieldChange && (
                  <CollapsibleContent className="pl-12 pr-3 pb-2">
                    <div className="flex items-center gap-2 text-xs bg-muted/30 rounded p-2">
                      {entry.old_value !== undefined && entry.old_value !== null && (
                        <span className="text-red-600 line-through font-mono truncate max-w-[200px]">
                          {entry.old_value}
                        </span>
                      )}
                      {entry.old_value !== undefined && entry.new_value !== undefined && (
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      )}
                      {entry.new_value !== undefined && entry.new_value !== null && (
                        <span className="text-green-600 font-mono truncate max-w-[200px]">
                          {entry.new_value}
                        </span>
                      )}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AuditLog
