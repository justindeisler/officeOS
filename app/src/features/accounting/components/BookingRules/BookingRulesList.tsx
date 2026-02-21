/**
 * BookingRulesList Component
 *
 * Table of booking rules with:
 * - Priority display, drag-and-drop ordering placeholder
 * - Toggle active/inactive
 * - Edit/Delete buttons
 * - Match count display
 */

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Trash2,
  Edit,
  Plus,
  Zap,
  ArrowUp,
  ArrowDown,
  Loader2,
} from 'lucide-react'
import type { BookingRule } from '@/services/web/bankingService'
import { cn } from '@/lib/utils'

export interface BookingRulesListProps {
  rules: BookingRule[]
  isLoading?: boolean
  onCreateRule: () => void
  onEditRule: (rule: BookingRule) => void
  onDeleteRule: (ruleId: string) => void
  onToggleActive: (rule: BookingRule) => void
  className?: string
}

function getDirectionLabel(dir: string | null): string {
  if (dir === 'credit') return 'Eingang'
  if (dir === 'debit') return 'Ausgang'
  return 'Alle'
}

function getMatchTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    expense: 'Ausgabe',
    income: 'Einnahme',
    ignore: 'Ignorieren',
  }
  return type ? labels[type] || type : '—'
}

export function BookingRulesList({
  rules,
  isLoading,
  onCreateRule,
  onEditRule,
  onDeleteRule,
  onToggleActive,
  className,
}: BookingRulesListProps) {
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
          <h2 className="text-lg font-semibold">Buchungsregeln</h2>
          <p className="text-sm text-muted-foreground">
            {rules.length} {rules.length === 1 ? 'Regel' : 'Regeln'} konfiguriert
          </p>
        </div>
        <Button onClick={onCreateRule}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Regel
        </Button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine Buchungsregeln konfiguriert.</p>
            <p className="text-sm mt-1">
              Erstellen Sie Regeln, um Bankumsätze automatisch zu kategorisieren.
            </p>
            <Button onClick={onCreateRule} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Erste Regel erstellen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
              <Card
                key={rule.id}
                className={cn(
                  'transition-opacity',
                  !rule.is_active && 'opacity-50'
                )}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    {/* Priority + Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Priority */}
                      <div className="text-center w-12 flex-shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Prio
                        </div>
                        <div className="font-mono font-bold text-lg">
                          {rule.priority}
                        </div>
                      </div>

                      {/* Rule info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{rule.name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {/* Conditions */}
                          {rule.condition_direction && (
                            <Badge variant="outline" className="text-[10px]">
                              {getDirectionLabel(rule.condition_direction)}
                            </Badge>
                          )}
                          {rule.condition_counterpart_pattern && (
                            <Badge variant="outline" className="text-[10px]">
                              Auftraggeber: {rule.condition_counterpart_pattern}
                            </Badge>
                          )}
                          {rule.condition_purpose_pattern && (
                            <Badge variant="outline" className="text-[10px]">
                              Zweck: {rule.condition_purpose_pattern}
                            </Badge>
                          )}
                          {(rule.condition_amount_min !== null ||
                            rule.condition_amount_max !== null) && (
                            <Badge variant="outline" className="text-[10px]">
                              {rule.condition_amount_min !== null
                                ? `€${rule.condition_amount_min}`
                                : '€0'}{' '}
                              –{' '}
                              {rule.condition_amount_max !== null
                                ? `€${rule.condition_amount_max}`
                                : '∞'}
                            </Badge>
                          )}

                          {/* Actions */}
                          {rule.action_category && (
                            <Badge className="text-[10px]">
                              → {rule.action_category}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {getMatchTypeLabel(rule.action_match_type)}
                          </Badge>

                          {/* Match count */}
                          <span className="text-[10px] text-muted-foreground">
                            {rule.match_count} Treffer
                          </span>

                          {rule.action_auto_confirm === 1 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-green-300 text-green-700"
                            >
                              Auto-Buchen
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch
                        checked={!!rule.is_active}
                        onCheckedChange={() => onToggleActive(rule)}
                        aria-label={
                          rule.is_active ? 'Deaktivieren' : 'Aktivieren'
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditRule(rule)}
                        title="Bearbeiten"
                      >
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onDeleteRule(rule.id)}
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  )
}
