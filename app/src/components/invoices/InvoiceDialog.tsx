import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useClientStore } from "@/stores/clientStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types";
import { format, addDays } from "date-fns";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
  onClose: () => void;
}

const emptyLineItem: InvoiceLineItem = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  amount: 0,
};

export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  onClose,
}: InvoiceDialogProps) {
  const { addInvoice, updateInvoice } = useInvoiceStore();
  const { clients } = useClientStore();
  const { projects } = useProjectStore();

  const activeClients = clients.filter((c) => c.status === "active");

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(
    format(addDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [currency, setCurrency] = useState("EUR");
  const [taxRate, setTaxRate] = useState(19);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { ...emptyLineItem },
  ]);

  // Client's projects
  const clientProjects = projects.filter((p) => p.clientId === clientId);

  useEffect(() => {
    if (invoice) {
      setClientId(invoice.clientId);
      setProjectId(invoice.projectId);
      setStatus(invoice.status);
      setIssueDate(format(new Date(invoice.issueDate), "yyyy-MM-dd"));
      setDueDate(format(new Date(invoice.dueDate), "yyyy-MM-dd"));
      setCurrency(invoice.currency);
      setTaxRate(invoice.taxRate);
      setNotes(invoice.notes || "");
      setLineItems(
        invoice.lineItems.length > 0
          ? invoice.lineItems
          : [{ ...emptyLineItem }]
      );
    } else {
      // Reset form for new invoice
      setClientId("");
      setProjectId(undefined);
      setStatus("draft");
      setIssueDate(format(new Date(), "yyyy-MM-dd"));
      setDueDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
      setCurrency("EUR");
      setTaxRate(19);
      setNotes("");
      setLineItems([{ ...emptyLineItem }]);
    }
  }, [invoice, open]);

  const updateLineItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    // Recalculate amount for this line
    if (field === "quantity" || field === "unitPrice") {
      updated[index].amount =
        Number(updated[index].quantity) * Number(updated[index].unitPrice);
    }

    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { ...emptyLineItem }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) return;

    const invoiceData = {
      clientId,
      projectId,
      invoiceNumber: invoice?.invoiceNumber || "",
      amount: subtotal,
      currency,
      taxRate,
      taxAmount,
      totalAmount: total,
      status,
      issueDate: new Date(issueDate).toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      notes: notes || undefined,
      lineItems: lineItems.filter((item) => item.description.trim()),
    };

    if (invoice) {
      updateInvoice(invoice.id, invoiceData);
    } else {
      addInvoice(invoiceData);
    }

    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[700px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {invoice ? "Edit Invoice" : "Create Invoice"}
            </DialogTitle>
            <DialogDescription>
              {invoice
                ? `Editing invoice ${invoice.invoiceNumber}`
                : "Create a new invoice for a client"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Client and Project */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="project">Project (optional)</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(v) =>
                    setProjectId(v === "none" ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {clientProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates and Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as InvoiceStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Currency and Tax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CHF">CHF</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="taxRate">Tax Rate (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="grid gap-2">
              <Label>Line Items</Label>
              <div className="space-y-3 sm:space-y-2">
                {lineItems.map((item, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start p-3 sm:p-0 bg-muted/30 sm:bg-transparent rounded-lg sm:rounded-none">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(index, "description", e.target.value)
                      }
                      className="w-full sm:flex-1"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, "quantity", Number(e.target.value))
                        }
                        className="flex-1 sm:w-20 sm:flex-initial"
                        min="1"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateLineItem(
                            index,
                            "unitPrice",
                            Number(e.target.value)
                          )
                        }
                        className="flex-1 sm:w-28 sm:flex-initial"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="sm:w-28 text-left sm:text-right text-sm font-medium sm:font-normal pt-0 sm:pt-2">
                        {formatCurrency(item.amount)}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        disabled={lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                className="w-fit"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes or payment terms..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!clientId || subtotal === 0}>
              {invoice ? "Update Invoice" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
