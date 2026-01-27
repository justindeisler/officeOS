import { useState } from "react";
import { IncomeList } from "@/features/accounting/components/Income";
import { IncomeDialog } from "@/features/accounting/components/Income/IncomeDialog";
import type { Income } from "@/features/accounting/types";

export function IncomePage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddIncome = () => {
    setEditingIncome(null);
    setDialogOpen(true);
  };

  const handleEditIncome = (income: Income) => {
    setEditingIncome(income);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingIncome(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Income</h1>
            <p className="text-muted-foreground">Track and manage your business income</p>
          </div>
        </div>
        <IncomeList
          onAddIncome={handleAddIncome}
          onEditIncome={handleEditIncome}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <IncomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        income={editingIncome}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />
    </>
  );
}
