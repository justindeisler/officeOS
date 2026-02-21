/**
 * Dunning (Mahnwesen) Page - Full-featured with wizard and history
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { AlertTriangle, Send, RefreshCw, Mail, History, BarChart3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  bankingService,
  type DunningEntry,
} from '@/services/web/bankingService'
import {
  DunningButton,
} from '@/features/accounting/components/Invoices/DunningButton'
import {
  DunningWizard,
  type DunningInvoice,
} from '@/features/accounting/components/Invoices/DunningWizard'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const dunningLevelLabels: Record<
  number,
  { label: string; color: string }
> = {
  0: { label: 'Keine Mahnung', color: 'bg-gray-100 text-gray-800' },
  1: { label: 'Zahlungserinnerung', color: 'bg-yellow-100 text-yellow-800' },
  2: { label: '1. Mahnung', color: 'bg-orange-100 text-orange-800' },
  3: { label: '2. Mahnung', color: 'bg-red-100 text-red-800' },
}

export function DunningPage() {
  const [overdueInvoices, setOverdueInvoices] = useState<DunningInvoice[]>([])
  const [dunningEntries, setDunningEntries] = useState<DunningEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardInvoice, setWizardInvoice] = useState<DunningInvoice | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [overdue, entries] = await Promise.all([
        bankingService.getOverdueInvoices(),
        bankingService.getDunningEntries(),
      ])
      setOverdueInvoices(overdue as DunningInvoice[])
      setDunningEntries(entries)
    } catch {
      toast.error('Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateDunning = async (data: {
    invoice_id: string
    level: number
    fee: number
    interest_rate: number
    notes?: string
  }) => {
    try {
      await bankingService.createDunning(data)
      toast.success(
        `${dunningLevelLabels[data.level]?.label || 'Mahnung'} erstellt`
      )
      loadData()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fehler beim Erstellen'
      toast.error(msg)
      throw error
    }
  }

  const handleSendDunning = async (entryId: string) => {
    try {
      await bankingService.sendDunning(entryId)
      toast.success('Als versendet markiert')
      loadData()
    } catch {
      toast.error('Fehler')
    }
  }

  const overdueDays = (dueDate: string) => {
    return Math.ceil(
      (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  }

  // Stats
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.total, 0)
  const avgOverdueDays =
    overdueInvoices.length > 0
      ? Math.round(
          overdueInvoices.reduce((sum, inv) => sum + overdueDays(inv.due_date), 0) /
            overdueInvoices.length
        )
      : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mahnwesen</h1>
        <p className="text-muted-foreground">
          Überfällige Rechnungen & Zahlungserinnerungen
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Überfällig
              </span>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">
              {overdueInvoices.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              offene Rechnungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Betrag
              </span>
              <BarChart3 className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(totalOverdue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ausstehend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Ø Überfällig
              </span>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{avgOverdueDays} Tage</p>
            <p className="text-xs text-muted-foreground mt-1">
              Durchschnitt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Mahnungen
              </span>
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{dunningEntries.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              gesamt erstellt
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList>
          <TabsTrigger value="overdue" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Überfällig
            {overdueInvoices.length > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px] ml-1">
                {overdueInvoices.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            Verlauf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="mt-4">
          {overdueInvoices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Keine überfälligen Rechnungen 🎉
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {overdueInvoices.map((inv) => (
                <Card key={inv.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div>
                          <p className="font-medium">
                            {inv.invoice_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {inv.client_name || 'Kein Kunde'}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          {overdueDays(inv.due_date)} Tage
                        </Badge>
                        {inv.dunning_level > 0 && (
                          <Badge
                            className={
                              dunningLevelLabels[inv.dunning_level]?.color
                            }
                            variant="outline"
                          >
                            {dunningLevelLabels[inv.dunning_level]?.label}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium">
                          {formatCurrency(inv.total)}
                        </span>
                        <DunningButton
                          dunningLevel={inv.dunning_level}
                          onClick={() => setWizardInvoice(inv)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {dunningEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Noch keine Mahnungen erstellt.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dunningEntries.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            dunningLevelLabels[entry.level]?.color
                          }
                          variant="outline"
                        >
                          {dunningLevelLabels[entry.level]?.label}
                        </Badge>
                        <span className="text-sm font-medium">
                          {entry.invoice_number}
                        </span>
                        {entry.fee > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Gebühr: {formatCurrency(entry.fee)}
                          </span>
                        )}
                        {entry.interest_amount > 0 && (
                          <span className="text-sm text-muted-foreground">
                            Zinsen: {formatCurrency(entry.interest_amount)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            entry.status === 'sent' ? 'default' : 'secondary'
                          }
                        >
                          {entry.status === 'sent' ? 'Versendet' : 'Entwurf'}
                        </Badge>
                        {entry.sent_date && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.sent_date)}
                          </span>
                        )}
                        {entry.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendDunning(entry.id)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Senden
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dunning Wizard Dialog */}
      <DunningWizard
        open={!!wizardInvoice}
        onOpenChange={(open) => !open && setWizardInvoice(null)}
        invoice={wizardInvoice}
        onCreateDunning={handleCreateDunning}
      />
    </div>
  )
}
