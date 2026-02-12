import { useState } from "react";
import { format, isPast, parseISO } from "date-fns";
import {
  FileText,
  MoreHorizontal,
  Send,
  CheckCircle,
  Trash2,
  Edit,
  Download,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useClientStore } from "@/stores/clientStore";
import type { Invoice, InvoiceStatus } from "@/types";

interface InvoiceCardProps {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  onExport: (invoice: Invoice) => void;
}

const statusConfig: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  paid: { label: "Paid", variant: "outline" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

export function InvoiceCard({ invoice, onEdit, onExport }: InvoiceCardProps) {
  const { updateStatus, markAsPaid, deleteInvoice } = useInvoiceStore();
  const { clients } = useClientStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const client = clients.find((c) => c.id === invoice.clientId);

  // Check if actually overdue
  const isOverdue =
    invoice.status === "sent" && isPast(parseISO(invoice.dueDate));
  const displayStatus = isOverdue ? "overdue" : invoice.status;
  const config = statusConfig[displayStatus];

  const handleConfirmDelete = () => {
    deleteInvoice(invoice.id);
    setShowDeleteDialog(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency,
    }).format(amount);
  };

  return (
    <Card className="group">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-medium">
                  {invoice.invoiceNumber}
                </span>
                <Badge variant={config.variant} className="text-xs">
                  {isOverdue && <AlertCircle className="h-3 w-3 mr-1" />}
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {client?.name || "Unknown Client"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="text-right">
              <p className="font-semibold text-sm sm:text-base">
                {formatCurrency(invoice.totalAmount)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                Due {format(parseISO(invoice.dueDate), "MMM d")}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 min-h-[44px] min-w-[44px] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(invoice)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport(invoice)}>
                  <Download className="h-4 w-4 mr-2" />
                  Export to Markdown
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {invoice.status === "draft" && (
                  <DropdownMenuItem
                    onClick={() => updateStatus(invoice.id, "sent")}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Mark as Sent
                  </DropdownMenuItem>
                )}
                {(invoice.status === "sent" || isOverdue) && (
                  <DropdownMenuItem onClick={() => markAsPaid(invoice.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Line items preview */}
        {invoice.lineItems.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground space-y-1">
              {invoice.lineItems.slice(0, 2).map((item, idx) => (
                <div key={idx} className="flex justify-between gap-2">
                  <span className="truncate flex-1 min-w-0">
                    {item.description}
                  </span>
                  <span className="shrink-0">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              {invoice.lineItems.length > 2 && (
                <p className="text-muted-foreground/70">
                  +{invoice.lineItems.length - 2} more item{invoice.lineItems.length - 2 !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete invoice ${invoice.invoiceNumber}?`}
        description="This will permanently delete the invoice. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
