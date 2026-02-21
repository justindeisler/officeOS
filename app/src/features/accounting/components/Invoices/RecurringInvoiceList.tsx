/**
 * RecurringInvoiceList Component
 *
 * Table of recurring invoice templates with:
 * - Client, frequency, next date, status
 * - Generate now, pause/resume, edit, delete
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Pause,
  Play,
  Trash2,
  FileText,
  CalendarDays,
  Loader2,
} from 'lucide-react'
import type { RecurringInvoice } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface RecurringInvoiceListProps {
  templates: RecurringInvoice[]
  isLoading?: boolean
  onCreateTemplate: () => void
  onEditTemplate?: (template: RecurringInvoice) => void
  onGenerate: (templateId: string) => void
  onToggleActive: (templateId: string, isActive: boolean) => void
  onDelete: (templateId: string) => void
  generatingId?: string | null
  className?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const frequencyLabels: Record<string, string> = {
  monthly: 'Monatlich',
  quarterly: 'Quartalsweise',
  yearly: 'Jährlich',
}

function getItemsTotal(itemsJson: string): number {
  try {
    const items = JSON.parse(itemsJson) as Array<{
      quantity: number
      unit_price: number
    }>
    return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  } catch {
    return 0
  }
}

function getNextDates(
  nextDate: string,
  frequency: string,
  count: number = 3
): string[] {
  const dates: string[] = []
  let current = new Date(nextDate)

  for (let i = 0; i < count; i++) {
    dates.push(
      current.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    )
    switch (frequency) {
      case 'monthly':
        current = new Date(current.setMonth(current.getMonth() + 1))
        break
      case 'quarterly':
        current = new Date(current.setMonth(current.getMonth() + 3))
        break
      case 'yearly':
        current = new Date(current.setFullYear(current.getFullYear() + 1))
        break
    }
  }

  return dates
}

export function RecurringInvoiceList({
  templates,
  isLoading,
  onCreateTemplate,
  onEditTemplate,
  onGenerate,
  onToggleActive,
  onDelete,
  generatingId,
  className,
}: RecurringInvoiceListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Wiederkehrende Rechnungen</h2>
          <p className="text-sm text-muted-foreground">
            {templates.length} {templates.length === 1 ? 'Vorlage' : 'Vorlagen'}
          </p>
        </div>
        <Button onClick={onCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Vorlage
        </Button>
      </div>

      {/* Templates */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine wiederkehrenden Rechnungen konfiguriert.</p>
            <p className="text-sm mt-1">
              Erstellen Sie Vorlagen für automatische Rechnungserstellung.
            </p>
            <Button onClick={onCreateTemplate} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Erste Vorlage erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => {
            const total = getItemsTotal(tpl.items_json)
            const isGenerating = generatingId === tpl.id
            const nextDates = getNextDates(tpl.next_date, tpl.frequency)

            return (
              <Card
                key={tpl.id}
                className={cn(!tpl.is_active && 'opacity-60')}
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onEditTemplate?.(tpl)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{tpl.name}</h3>
                        <Badge
                          variant={tpl.is_active ? 'default' : 'secondary'}
                        >
                          {tpl.is_active ? 'Aktiv' : 'Pausiert'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {frequencyLabels[tpl.frequency] || tpl.frequency}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                        <span>
                          Nächste:{' '}
                          <span className="text-foreground">
                            {new Date(tpl.next_date).toLocaleDateString('de-DE')}
                          </span>
                        </span>
                        <span>
                          Betrag:{' '}
                          <span className="text-foreground font-medium">
                            {formatCurrency(total)}
                          </span>
                        </span>
                        <span>{tpl.generated_count} erstellt</span>
                        {tpl.auto_send === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-green-300 text-green-700"
                          >
                            Auto-Versand
                          </Badge>
                        )}
                      </div>

                      {/* Next 3 dates preview */}
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        Nächste Termine: {nextDates.join(' → ')}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onGenerate(tpl.id)}
                        disabled={isGenerating || !tpl.is_active}
                        title="Jetzt generieren"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          onToggleActive(tpl.id, !!tpl.is_active)
                        }
                        title={tpl.is_active ? 'Pausieren' : 'Aktivieren'}
                      >
                        {tpl.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDelete(tpl.id)}
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
