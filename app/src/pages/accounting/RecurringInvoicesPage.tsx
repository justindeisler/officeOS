/**
 * Recurring Invoices Page - Full-featured with modular components
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CalendarDays, RefreshCw } from 'lucide-react'
import {
  bankingService,
  type RecurringInvoice,
} from '@/services/web/bankingService'
import { RecurringInvoiceList } from '@/features/accounting/components/Invoices/RecurringInvoiceList'
import { RecurringInvoiceDialog } from '@/features/accounting/components/Invoices/RecurringInvoiceDialog'

export function RecurringInvoicesPage() {
  const [templates, setTemplates] = useState<RecurringInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RecurringInvoice | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await bankingService.getRecurringInvoices()
      setTemplates(data)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = () => {
    setEditingTemplate(null)
    setShowDialog(true)
  }

  const handleEdit = (template: RecurringInvoice) => {
    setEditingTemplate(template)
    setShowDialog(true)
  }

  const handleSave = async (data: unknown) => {
    try {
      if (editingTemplate) {
        await bankingService.updateRecurringInvoice(editingTemplate.id, data)
        toast.success('Vorlage aktualisiert')
      } else {
        await bankingService.createRecurringInvoice(data)
        toast.success('Vorlage erstellt')
      }
      loadData()
    } catch {
      toast.error('Fehler beim Speichern')
      throw new Error('save failed')
    }
  }

  const handleGenerate = async (templateId: string) => {
    setGeneratingId(templateId)
    try {
      await bankingService.generateFromRecurring(templateId)
      toast.success('Rechnung generiert')
      loadData()
    } catch {
      toast.error('Fehler beim Generieren')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleToggleActive = async (
    templateId: string,
    isActive: boolean
  ) => {
    try {
      await bankingService.updateRecurringInvoice(templateId, {
        is_active: isActive ? 0 : 1,
      })
      toast.success(isActive ? 'Pausiert' : 'Aktiviert')
      loadData()
    } catch {
      toast.error('Fehler')
    }
  }

  const handleDelete = async (templateId: string) => {
    try {
      await bankingService.deleteRecurringInvoice(templateId)
      toast.success('Vorlage gelöscht')
      loadData()
    } catch {
      toast.error('Fehler beim Löschen')
    }
  }

  const handleProcessAll = async () => {
    try {
      const result = await bankingService.processRecurring()
      if (result.generated > 0) {
        toast.success(`${result.generated} Rechnungen generiert`)
      } else {
        toast.info('Keine fälligen Vorlagen')
      }
      loadData()
    } catch {
      toast.error('Fehler beim Verarbeiten')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wiederkehrende Rechnungen</h1>
          <p className="text-muted-foreground">
            Automatische Rechnungserstellung
          </p>
        </div>
        <Button variant="outline" onClick={handleProcessAll}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Fällige verarbeiten
        </Button>
      </div>

      <RecurringInvoiceList
        templates={templates}
        isLoading={loading}
        onCreateTemplate={handleCreate}
        onEditTemplate={handleEdit}
        onGenerate={handleGenerate}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        generatingId={generatingId}
      />

      <RecurringInvoiceDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        template={editingTemplate}
        onSave={handleSave}
      />
    </div>
  )
}
