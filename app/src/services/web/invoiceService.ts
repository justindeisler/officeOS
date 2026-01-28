/**
 * Web-based Invoice Service stub
 * TODO: Implement invoice API endpoints
 */

import type { Invoice } from "@/types";

class InvoiceService {
  async getAll(): Promise<Invoice[]> {
    console.warn("Invoice service not yet implemented for web");
    return [];
  }

  async getById(_id: string): Promise<Invoice | null> {
    return null;
  }

  async getByClient(_clientId: string): Promise<Invoice[]> {
    return [];
  }

  async getByStatus(_status: string): Promise<Invoice[]> {
    return [];
  }

  async create(_item: Omit<Invoice, "id" | "createdAt">): Promise<Invoice> {
    throw new Error("Invoice creation not yet implemented for web");
  }

  async update(_id: string, _updates: Partial<Invoice>): Promise<void> {
    throw new Error("Invoice update not yet implemented for web");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("Invoice deletion not yet implemented for web");
  }

  async getNextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return `${year}-001`;
  }
}

export const invoiceService = new InvoiceService();
