import { useState } from "react";
import { ExpenseList } from "@/features/accounting/components/Expenses";
import { ExpenseDialog } from "@/features/accounting/components/Expenses/ExpenseDialog";
import type { Expense } from "@/features/accounting/types";

export function ExpensesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleAddExpense = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleSuccess = () => {
    setRefreshTrigger((n) => n + 1);
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in">
        <ExpenseList
          onAddExpense={handleAddExpense}
          onEditExpense={handleEditExpense}
          refreshTrigger={refreshTrigger}
        />
      </div>
      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editingExpense}
        onClose={handleCloseDialog}
        onSuccess={handleSuccess}
      />
    </>
  );
}
