import { create } from "zustand";
import { invoiceService } from "@/services";
import { toast } from "sonner";
import type { Invoice, InvoiceStatus, InvoiceLineItem } from "@/types";

interface InvoiceState {
  invoices: Invoice[];
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  addInvoice: (
    data: Omit<Invoice, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  updateStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
}

// Calculate totals from line items
const calculateTotals = (
  lineItems: InvoiceLineItem[],
  taxRate: number
): { amount: number; taxAmount: number; totalAmount: number } => {
  const amount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxAmount = amount * (taxRate / 100);
  const totalAmount = amount + taxAmount;
  return { amount, taxAmount, totalAmount };
};

export const useInvoiceStore = create<InvoiceState>()((set, get) => ({
  invoices: [],
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const invoices = await invoiceService.getAll();
      set({ invoices, isLoaded: true });
    } catch (error) {
      console.error("Failed to load invoices:", error);
      toast.error("Failed to load invoices");
      set({ isLoaded: true });
    }
  },

  addInvoice: async (data) => {
    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();

    // Generate invoice number if not provided
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      try {
        invoiceNumber = await invoiceService.getNextInvoiceNumber();
      } catch {
        const year = new Date().getFullYear();
        const count = get().invoices.filter((inv) =>
          inv.invoiceNumber.includes(`${year}`)
        ).length;
        invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, "0")}`;
      }
    }

    const { amount, taxAmount, totalAmount } = calculateTotals(
      data.lineItems,
      data.taxRate
    );

    const optimisticInvoice: Invoice = {
      ...data,
      id: tempId,
      invoiceNumber,
      amount,
      taxAmount,
      totalAmount,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ invoices: [optimisticInvoice, ...state.invoices] }));

    try {
      const createdInvoice = await invoiceService.create({
        ...data,
        invoiceNumber,
        amount,
        taxAmount,
        totalAmount,
        updatedAt: now,
      });
      set((state) => ({
        invoices: state.invoices.map((inv) =>
          inv.id === tempId ? createdInvoice : inv
        ),
      }));
      return createdInvoice.id;
    } catch (error) {
      set((state) => ({
        invoices: state.invoices.filter((inv) => inv.id !== tempId),
      }));
      console.error("Failed to create invoice:", error);
      toast.error("Failed to create invoice");
      return tempId;
    }
  },

  updateInvoice: async (id, updates) => {
    const previousInvoices = get().invoices;
    const now = new Date().toISOString();

    set((state) => ({
      invoices: state.invoices.map((invoice) => {
        if (invoice.id !== id) return invoice;

        let calculatedUpdates = {};
        if (updates.lineItems || updates.taxRate !== undefined) {
          const lineItems = updates.lineItems || invoice.lineItems;
          const taxRate =
            updates.taxRate !== undefined ? updates.taxRate : invoice.taxRate;
          calculatedUpdates = calculateTotals(lineItems, taxRate);
        }

        return {
          ...invoice,
          ...updates,
          ...calculatedUpdates,
          updatedAt: now,
        };
      }),
    }));

    try {
      const invoice = previousInvoices.find((inv) => inv.id === id);
      let calculatedUpdates = {};
      if (updates.lineItems || updates.taxRate !== undefined) {
        const lineItems = updates.lineItems || invoice?.lineItems || [];
        const taxRate =
          updates.taxRate !== undefined
            ? updates.taxRate
            : invoice?.taxRate || 0;
        calculatedUpdates = calculateTotals(lineItems, taxRate);
      }

      await invoiceService.update(id, {
        ...updates,
        ...calculatedUpdates,
        updatedAt: now,
      });
    } catch (error) {
      set({ invoices: previousInvoices });
      console.error("Failed to update invoice:", error);
      toast.error("Failed to update invoice");
    }
  },

  deleteInvoice: async (id) => {
    const previousInvoices = get().invoices;

    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.id !== id),
    }));

    try {
      await invoiceService.delete(id);
    } catch (error) {
      set({ invoices: previousInvoices });
      console.error("Failed to delete invoice:", error);
      toast.error("Failed to delete invoice");
    }
  },

  updateStatus: async (id, status) => {
    const previousInvoices = get().invoices;
    const now = new Date().toISOString();

    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === id ? { ...invoice, status, updatedAt: now } : invoice
      ),
    }));

    try {
      await invoiceService.update(id, { status, updatedAt: now });
    } catch (error) {
      set({ invoices: previousInvoices });
      console.error("Failed to update invoice status:", error);
      toast.error("Failed to update invoice status");
    }
  },

  markAsPaid: async (id) => {
    const previousInvoices = get().invoices;
    const now = new Date();
    const nowString = now.toISOString();

    set((state) => ({
      invoices: state.invoices.map((invoice) =>
        invoice.id === id
          ? {
              ...invoice,
              status: "paid" as InvoiceStatus,
              paidDate: nowString,
              updatedAt: nowString,
            }
          : invoice
      ),
    }));

    try {
      await invoiceService.markAsPaid(id, now);
    } catch (error) {
      set({ invoices: previousInvoices });
      console.error("Failed to mark invoice as paid:", error);
      toast.error("Failed to mark invoice as paid");
    }
  },
}));

// Selectors
export const useInvoicesByStatus = (status: InvoiceStatus) => {
  const { invoices } = useInvoiceStore();
  return invoices.filter((inv) => inv.status === status);
};

export const useInvoicesByClient = (clientId: string) => {
  const { invoices } = useInvoiceStore();
  return invoices.filter((inv) => inv.clientId === clientId);
};

export const useInvoiceStats = () => {
  const { invoices } = useInvoiceStore();

  const stats = {
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
  };

  const today = new Date();

  invoices.forEach((inv) => {
    if (inv.status === "sent" && new Date(inv.dueDate) < today) {
      stats.overdue++;
    } else {
      stats[inv.status]++;
    }

    if (inv.status === "paid") {
      stats.totalRevenue += inv.totalAmount;
    } else if (inv.status === "sent") {
      stats.pendingRevenue += inv.totalAmount;
    }
  });

  return stats;
};

export const useMonthlyRevenue = (year: number) => {
  const { invoices } = useInvoiceStore();

  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(year, i).toLocaleDateString("en-US", { month: "short" }),
    revenue: 0,
    invoiced: 0,
  }));

  invoices.forEach((inv) => {
    const invDate = new Date(inv.issueDate);
    if (invDate.getFullYear() !== year) return;

    const monthIndex = invDate.getMonth();
    monthlyData[monthIndex].invoiced += inv.totalAmount;

    if (inv.status === "paid" && inv.paidDate) {
      const paidDate = new Date(inv.paidDate);
      if (paidDate.getFullYear() === year) {
        const paidMonthIndex = paidDate.getMonth();
        monthlyData[paidMonthIndex].revenue += inv.totalAmount;
      }
    }
  });

  return monthlyData;
};

export const useRevenueByClient = () => {
  const { invoices } = useInvoiceStore();

  const byClient: Record<string, { invoiced: number; paid: number }> = {};

  invoices.forEach((inv) => {
    if (!byClient[inv.clientId]) {
      byClient[inv.clientId] = { invoiced: 0, paid: 0 };
    }
    byClient[inv.clientId].invoiced += inv.totalAmount;
    if (inv.status === "paid") {
      byClient[inv.clientId].paid += inv.totalAmount;
    }
  });

  return byClient;
};
