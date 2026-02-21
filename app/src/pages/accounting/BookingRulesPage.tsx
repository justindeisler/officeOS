/**
 * Booking Rules Page - Full-featured auto-categorization rules management
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  BookingRulesList,
  BookingRuleDialog,
} from '@/features/accounting/components/BookingRules'
import {
  bankingService,
  type BookingRule,
} from '@/services/web/bankingService'

export function BookingRulesPage() {
  const [rules, setRules] = useState<BookingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<BookingRule | null>(null)

  const loadData = useCallback(async () => {
    try {
      setRules(await bankingService.getRules())
    } catch {
      toast.error('Fehler beim Laden der Buchungsregeln')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = () => {
    setEditingRule(null)
    setShowDialog(true)
  }

  const handleEdit = (rule: BookingRule) => {
    setEditingRule(rule)
    setShowDialog(true)
  }

  const handleSave = async (data: Partial<BookingRule>) => {
    try {
      if (editingRule) {
        await bankingService.updateRule(editingRule.id, data)
        toast.success('Regel aktualisiert')
      } else {
        await bankingService.createRule(data)
        toast.success('Regel erstellt')
      }
      loadData()
    } catch {
      toast.error('Fehler beim Speichern')
      throw new Error('save failed')
    }
  }

  const handleDelete = async (ruleId: string) => {
    try {
      await bankingService.deleteRule(ruleId)
      toast.success('Regel gelöscht')
      loadData()
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  const handleToggleActive = async (rule: BookingRule) => {
    try {
      await bankingService.updateRule(rule.id, {
        is_active: rule.is_active ? 0 : 1,
      } as Partial<BookingRule>)
      toast.success(rule.is_active ? 'Deaktiviert' : 'Aktiviert')
      loadData()
    } catch {
      toast.error('Fehler')
    }
  }

  const handleTest = async (data: Partial<BookingRule>) => {
    return bankingService.testRule(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buchungsregeln</h1>
        <p className="text-muted-foreground">
          Automatische Kategorisierung von Bankumsätzen
        </p>
      </div>

      <BookingRulesList
        rules={rules}
        isLoading={loading}
        onCreateRule={handleCreate}
        onEditRule={handleEdit}
        onDeleteRule={handleDelete}
        onToggleActive={handleToggleActive}
      />

      <BookingRuleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        rule={editingRule}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  )
}
