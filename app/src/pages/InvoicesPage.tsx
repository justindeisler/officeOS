import { useState } from "react";
import { Plus, FileText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceDialog } from "@/components/invoices/InvoiceDialog";
import {
  useInvoiceStore,
  useInvoiceStats,
  useMonthlyRevenue,
} from "@/stores/invoiceStore";
import { useClientStore } from "@/stores/clientStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  exportInvoiceToMarkdown,
  downloadMarkdown,
} from "@/lib/markdown";
import type { Invoice } from "@/types";
import { toast } from "sonner";
import { isPast, parseISO } from "date-fns";

export function InvoicesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const { invoices } = useInvoiceStore();
  const { clients } = useClientStore();
  const { projects } = useProjectStore();
  const stats = useInvoiceStats();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = useMonthlyRevenue(currentYear);

  // Calculate YTD revenue
  const ytdRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setDialogOpen(true);
  };

  const handleExport = (invoice: Invoice) => {
    const client = clients.find((c) => c.id === invoice.clientId);
    const project = invoice.projectId
      ? projects.find((p) => p.id === invoice.projectId)
      : undefined;

    const markdown = exportInvoiceToMarkdown(invoice, { client, project });
    const filename = `${invoice.invoiceNumber}.md`;
    downloadMarkdown(markdown, filename);
    toast.success(`Exported ${invoice.invoiceNumber} to markdown`);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingInvoice(null);
  };

  // Filter invoices based on tab
  const filteredInvoices = invoices.filter((inv) => {
    const isOverdue =
      inv.status === "sent" && isPast(parseISO(inv.dueDate));

    switch (activeTab) {
      case "draft":
        return inv.status === "draft";
      case "sent":
        return inv.status === "sent" && !isOverdue;
      case "paid":
        return inv.status === "paid";
      case "overdue":
        return isOverdue;
      default:
        return true;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Invoices</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-full sm:w-auto min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardContent className="p-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Draft</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Sent</p>
            <p className="text-xl sm:text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Paid</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Overdue</p>
            <p className="text-xl sm:text-2xl font-bold text-destructive">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 col-span-2 sm:col-span-1">
          <CardContent className="p-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-muted-foreground">YTD Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {formatCurrency(ytdRevenue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Summary */}
      {ytdRevenue > 0 && (
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {currentYear} Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="flex gap-1 h-16">
              {monthlyRevenue.map((month, idx) => {
                const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue));
                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col justify-end items-center gap-1"
                  >
                    <div
                      className="w-full bg-primary/80 rounded-t transition-all"
                      style={{ height: `${height}%`, minHeight: height > 0 ? 4 : 0 }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {month.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex h-auto">
          <TabsTrigger value="all" className="min-h-[44px] text-xs sm:text-sm">
            <span className="hidden sm:inline">All ({invoices.length})</span>
            <span className="sm:hidden">All</span>
          </TabsTrigger>
          <TabsTrigger value="draft" className="min-h-[44px] text-xs sm:text-sm">
            <span className="hidden sm:inline">Draft ({stats.draft})</span>
            <span className="sm:hidden">Draft</span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="min-h-[44px] text-xs sm:text-sm">
            <span className="hidden sm:inline">Sent ({stats.sent})</span>
            <span className="sm:hidden">Sent</span>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="text-destructive min-h-[44px] text-xs sm:text-sm col-span-2 sm:col-span-1">
            <span className="hidden sm:inline">Overdue ({stats.overdue})</span>
            <span className="sm:hidden">Overdue</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="min-h-[44px] text-xs sm:text-sm">
            <span className="hidden sm:inline">Paid ({stats.paid})</span>
            <span className="sm:hidden">Paid</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === "all"
                    ? "No invoices yet"
                    : `No ${activeTab} invoices`}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {activeTab === "all"
                    ? "Create your first invoice to get started."
                    : `You don't have any ${activeTab} invoices.`}
                </p>
                {activeTab === "all" && (
                  <Button onClick={() => setDialogOpen(true)} className="min-h-[44px]">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onEdit={handleEdit}
                  onExport={handleExport}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Invoice Dialog */}
      <InvoiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoice={editingInvoice}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
