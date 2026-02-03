/**
 * Web-based Invoice Service using REST API
 */

import { api } from "@/lib/api";
import type { Invoice, InvoiceLineItem } from "@/types";

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(v => 
        typeof v === 'object' && v !== null ? toCamelCase(v as Record<string, unknown>) : v
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[snakeKey] = toSnakeCase(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map(v => 
        typeof v === 'object' && v !== null && !(v instanceof Date) ? toSnakeCase(v as Record<string, unknown>) : v
      );
    } else if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function mapInvoice(raw: Record<string, unknown>): Invoice {
  const camel = toCamelCase(raw);
  return {
    id: camel.id as string,
    invoiceNumber: camel.invoiceNumber as string,
    clientId: camel.clientId as string,
    projectId: camel.projectId as string | undefined,
    issueDate: camel.invoiceDate as string || camel.issueDate as string,
    dueDate: camel.dueDate as string,
    status: camel.status as Invoice['status'],
    amount: camel.subtotal as number || camel.amount as number || 0,
    currency: camel.currency as string || 'EUR',
    taxRate: camel.vatRate as number || camel.taxRate as number || 19,
    taxAmount: camel.vatAmount as number || camel.taxAmount as number || 0,
    totalAmount: camel.total as number || camel.totalAmount as number || 0,
    paidDate: camel.paymentDate as string | undefined || camel.paidDate as string | undefined,
    notes: camel.notes as string | undefined,
    markdownPath: camel.markdownPath as string | undefined,
    pdfPath: camel.pdfPath as string | undefined,
    lineItems: ((camel.items || camel.lineItems || []) as Record<string, unknown>[]).map(item => ({
      id: (item.id as string) || crypto.randomUUID(),
      description: item.description as string,
      quantity: item.quantity as number,
      unit: item.unit as string || 'hours',
      unitPrice: item.unitPrice as number || item.unit_price as number,
      amount: item.amount as number,
    })) as InvoiceLineItem[],
    createdAt: camel.createdAt as string,
    updatedAt: camel.updatedAt as string || camel.createdAt as string,
  };
}

class InvoiceService {
  async getAll(): Promise<Invoice[]> {
    const invoices = await api.getInvoices();
    return invoices.map(inv => mapInvoice(inv as Record<string, unknown>));
  }

  async getById(id: string): Promise<Invoice | null> {
    try {
      const invoice = await api.getInvoice(id);
      return mapInvoice(invoice as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  async getByClient(clientId: string): Promise<Invoice[]> {
    const invoices = await api.getInvoices({ client_id: clientId });
    return invoices.map(inv => mapInvoice(inv as Record<string, unknown>));
  }

  async getByStatus(status: string): Promise<Invoice[]> {
    const invoices = await api.getInvoices({ status });
    return invoices.map(inv => mapInvoice(inv as Record<string, unknown>));
  }

  async create(item: Omit<Invoice, "id" | "createdAt">): Promise<Invoice> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    // Map fields to what API expects
    const payload = {
      invoice_date: snakeItem.issue_date || snakeItem.invoice_date,
      due_date: snakeItem.due_date,
      client_id: snakeItem.client_id,
      project_id: snakeItem.project_id,
      vat_rate: snakeItem.tax_rate || snakeItem.vat_rate || 19,
      notes: snakeItem.notes,
      items: (snakeItem.line_items || snakeItem.items || []) as unknown[],
    };
    const created = await api.createInvoice(payload);
    return mapInvoice(created as Record<string, unknown>);
  }

  async update(id: string, updates: Partial<Invoice>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateInvoice(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteInvoice(id);
  }

  async markAsSent(id: string): Promise<Invoice> {
    const result = await api.sendInvoice(id);
    return mapInvoice(result as Record<string, unknown>);
  }

  async markAsPaid(id: string, paymentDate: Date, paymentMethod?: string): Promise<Invoice> {
    const result = await api.payInvoice(id, paymentDate.toISOString().split('T')[0], paymentMethod);
    return mapInvoice(result as Record<string, unknown>);
  }

  async cancelInvoice(id: string): Promise<Invoice> {
    const result = await api.cancelInvoice(id);
    return mapInvoice(result as Record<string, unknown>);
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const invoices = await this.getAll();
    const thisYearInvoices = invoices.filter(inv => 
      inv.invoiceNumber?.startsWith(`RE-${year}`)
    );
    const maxNum = thisYearInvoices.reduce((max, inv) => {
      const match = inv.invoiceNumber?.match(/RE-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return `RE-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  }
}

export const invoiceService = new InvoiceService();
