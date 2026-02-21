import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UstVoranmeldungList, EuerReportView, Anlageverzeichnis, AfaSummary } from "@/features/accounting/components/Reports";
import { ZmReportView } from "@/features/accounting/components/Reports/ZmReportView";
import { ElsterHistoryList } from "@/features/accounting/components/Reports/ElsterHistoryList";
import { PeriodLockManager } from "@/features/accounting/components/GoBD/PeriodLockManager";
import { AuditLog } from "@/features/accounting/components/GoBD/AuditLog";
import { DatevExportDialog } from "@/features/accounting/components/Export";
import { BankReconciliation } from "@/features/accounting/components/Banking/BankReconciliation";
import { getAllAssets } from "@/features/accounting/api/assets";
import { getAllIncome } from "@/features/accounting/api/income";
import { getAllExpenses } from "@/features/accounting/api/expenses";
import { bankingService, type BankTransaction } from "@/services/web/bankingService";
import type { Asset, Income, Expense } from "@/features/accounting/types";

export function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDatevDialogOpen, setIsDatevDialogOpen] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [assetsData, incomesData, expensesData, txData] = await Promise.all([
          getAllAssets(),
          getAllIncome(),
          getAllExpenses(),
          bankingService.getTransactions().catch(() => [] as BankTransaction[]),
        ]);
        setAssets(assetsData);
        setIncomes(incomesData);
        setExpenses(expensesData);
        setTransactions(txData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Reports</h1>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="vat" className="w-full">
        <TabsList className="flex w-full overflow-x-auto gap-1">
          <TabsTrigger value="vat" className="flex-shrink-0">VAT (USt)</TabsTrigger>
          <TabsTrigger value="euer" className="flex-shrink-0">Profit (EÜR)</TabsTrigger>
          <TabsTrigger value="assets" className="flex-shrink-0 whitespace-nowrap">Assets</TabsTrigger>
          <TabsTrigger value="afa" className="flex-shrink-0">AfA</TabsTrigger>
          <TabsTrigger value="zm" className="flex-shrink-0">ZM</TabsTrigger>
          <TabsTrigger value="banking" className="flex-shrink-0">Banking</TabsTrigger>
          <TabsTrigger value="datev" className="flex-shrink-0">DATEV</TabsTrigger>
          <TabsTrigger value="elster" className="flex-shrink-0">ELSTER</TabsTrigger>
          <TabsTrigger value="locks" className="flex-shrink-0">Sperren</TabsTrigger>
          <TabsTrigger value="audit" className="flex-shrink-0">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="vat" className="mt-6">
          <UstVoranmeldungList />
        </TabsContent>

        <TabsContent value="euer" className="mt-6">
          <EuerReportView />
        </TabsContent>

        <TabsContent value="assets" className="mt-6">
          <Anlageverzeichnis year={selectedYear} assets={assets} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="afa" className="mt-6">
          <AfaSummary year={selectedYear} assets={assets} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="zm" className="mt-6">
          <ZmReportView />
        </TabsContent>

        <TabsContent value="banking" className="mt-6">
          <BankReconciliation transactions={transactions} />
        </TabsContent>

        <TabsContent value="datev" className="mt-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">DATEV Export</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Export your accounting data in DATEV format for your tax advisor.
                  Supports CSV (Buchungsstapel) and XML (LedgerImport) formats.
                </p>
              </div>
              <Button onClick={() => setIsDatevDialogOpen(true)} size="lg">
                Open DATEV Export
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="elster" className="mt-6">
          <ElsterHistoryList />
        </TabsContent>

        <TabsContent value="locks" className="mt-6">
          <PeriodLockManager />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLog />
        </TabsContent>
      </Tabs>

      {/* DATEV Export Dialog */}
      <DatevExportDialog
        open={isDatevDialogOpen}
        onOpenChange={setIsDatevDialogOpen}
        incomes={incomes}
        expenses={expenses}
      />
    </div>
  );
}
