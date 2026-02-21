/**
 * Banking Page - Full-featured bank accounts, transactions, and reconciliation
 *
 * Uses modular components from features/accounting/components/Banking/
 */

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, List, AlertCircle, BarChart3 } from 'lucide-react'
import {
  BankAccountList,
  BankConnectDialog,
  TransactionList,
  TransactionMatchDialog,
  UnmatchedQueue,
  BankReconciliation,
} from '@/features/accounting/components/Banking'
import {
  bankingService,
  type BankAccount,
  type BankTransaction,
} from '@/services/web/bankingService'

export function BankingPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null)
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize))

  const loadData = useCallback(async () => {
    try {
      const [accs, txs] = await Promise.all([
        bankingService.getAccounts(),
        bankingService.getTransactions(),
      ])
      setAccounts(accs)
      setTransactions(txs)
    } catch {
      toast.error('Fehler beim Laden der Bankdaten')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handlers
  const handleConnectAccount = async (data: {
    bank_name: string
    iban: string
    bic?: string
    account_name?: string
    balance?: number
  }) => {
    try {
      await bankingService.connectAccount(data)
      toast.success('Bankkonto verbunden')
      loadData()
    } catch {
      toast.error('Fehler beim Verbinden')
      throw new Error('connect failed')
    }
  }

  const handleSyncAccount = async (accountId: string) => {
    setSyncingAccountId(accountId)
    try {
      const result = await bankingService.syncAccount(accountId)
      toast.success(
        `${result.transactions_imported} Transaktionen importiert`
      )
      loadData()
    } catch {
      toast.error('Synchronisierung fehlgeschlagen')
    } finally {
      setSyncingAccountId(null)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await bankingService.deleteAccount(accountId)
      toast.success('Bankkonto entfernt')
      loadData()
    } catch {
      toast.error('Fehler beim Entfernen')
    }
  }

  // Match handlers
  const handleMatchInvoice = async (txId: string, invoiceId: string) => {
    await bankingService.matchTransaction(txId, 'invoice', invoiceId)
    toast.success('Transaktion zugeordnet')
    loadData()
  }

  const handleMatchExpense = async (txId: string, expenseId: string) => {
    await bankingService.matchTransaction(txId, 'expense', expenseId)
    toast.success('Transaktion zugeordnet')
    loadData()
  }

  const handleMatchIncome = async (txId: string, incomeId: string) => {
    await bankingService.matchTransaction(txId, 'income', incomeId)
    toast.success('Transaktion zugeordnet')
    loadData()
  }

  const handleCreateExpense = async (
    txId: string,
    data: { category: string; description?: string; vat_rate?: number }
  ) => {
    await bankingService.createExpenseFromTransaction(txId, data)
    toast.success('Ausgabe erstellt und zugeordnet')
    loadData()
  }

  const handleCreateIncome = async (
    txId: string,
    data: { description?: string; vat_rate?: number; client_id?: string }
  ) => {
    await bankingService.createIncomeFromTransaction(txId, data)
    toast.success('Einnahme erstellt und zugeordnet')
    loadData()
  }

  const handleIgnore = async (txId: string, reason?: string) => {
    await bankingService.ignoreTransaction(txId, reason)
    toast.success('Transaktion ignoriert')
    loadData()
  }

  const handleAutoMatchAll = async () => {
    try {
      const result = await bankingService.autoMatch()
      toast.success(
        `${result.matched} von ${result.total_processed} Transaktionen zugeordnet`
      )
      loadData()
    } catch {
      toast.error('Auto-Match fehlgeschlagen')
    }
  }

  const handleIgnoreSelected = async (txIds: string[]) => {
    let count = 0
    for (const id of txIds) {
      try {
        await bankingService.ignoreTransaction(id)
        count++
      } catch {
        // Continue
      }
    }
    toast.success(`${count} Transaktionen ignoriert`)
    loadData()
  }

  const unmatchedCount = transactions.filter(
    (tx) => tx.match_status === 'unmatched'
  ).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Banking</h1>
        <p className="text-muted-foreground">
          Bankkonten & Transaktionen verwalten
        </p>
      </div>

      {/* Bank Accounts */}
      <BankAccountList
        accounts={accounts}
        isLoading={false}
        onConnectAccount={() => setShowConnectDialog(true)}
        onSyncAccount={handleSyncAccount}
        onDeleteAccount={handleDeleteAccount}
        syncingAccountId={syncingAccountId}
      />

      {/* Tabs: Transactions | Unmatched | Reconciliation */}
      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1">
          <TabsTrigger value="transactions" className="flex items-center gap-1.5">
            <List className="h-4 w-4" />
            Transaktionen
            <Badge variant="secondary" className="h-5 text-[10px] ml-1">
              {transactions.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            Offen
            {unmatchedCount > 0 && (
              <Badge variant="destructive" className="h-5 text-[10px] ml-1">
                {unmatchedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Abstimmung
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-4">
          <TransactionList
            transactions={transactions}
            accounts={accounts}
            onRowClick={setSelectedTransaction}
            page={page}
            setPage={setPage}
            pageSize={pageSize}
            totalPages={totalPages}
          />
        </TabsContent>

        <TabsContent value="unmatched" className="mt-4">
          <UnmatchedQueue
            transactions={transactions}
            onAutoMatchAll={handleAutoMatchAll}
            onIgnoreSelected={handleIgnoreSelected}
            onRowClick={setSelectedTransaction}
          />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <BankReconciliation transactions={transactions} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <BankConnectDialog
        open={showConnectDialog}
        onOpenChange={setShowConnectDialog}
        onConnect={handleConnectAccount}
      />

      <TransactionMatchDialog
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        transaction={selectedTransaction}
        onMatchInvoice={handleMatchInvoice}
        onMatchExpense={handleMatchExpense}
        onMatchIncome={handleMatchIncome}
        onCreateExpense={handleCreateExpense}
        onCreateIncome={handleCreateIncome}
        onIgnore={handleIgnore}
      />
    </div>
  )
}
