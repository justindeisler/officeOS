import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UstVoranmeldungList, EuerReportView, Anlageverzeichnis, AfaSummary } from "@/features/accounting/components/Reports";
import { DatevExportDialog } from "@/features/accounting/components/Export";
import { getAllAssets } from "@/features/accounting/api/assets";
import { getAllIncome } from "@/features/accounting/api/income";
import { getAllExpenses } from "@/features/accounting/api/expenses";
import type { Asset, Income, Expense } from "@/features/accounting/types";

export function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDatevDialogOpen, setIsDatevDialogOpen] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [assetsData, incomesData, expensesData] = await Promise.all([
          getAllAssets(),
          getAllIncome(),
          getAllExpenses(),
        ]);
        setAssets(assetsData);
        setIncomes(incomesData);
        setExpenses(expensesData);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="vat">VAT (USt)</TabsTrigger>
          <TabsTrigger value="euer">Profit (EÜR)</TabsTrigger>
          <TabsTrigger value="assets">Asset Register</TabsTrigger>
          <TabsTrigger value="afa">Depreciation</TabsTrigger>
          <TabsTrigger value="datev">DATEV Export</TabsTrigger>
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
