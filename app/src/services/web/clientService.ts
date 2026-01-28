/**
 * Web-based Client Service using REST API
 */

import { api } from "@/lib/api";
import type { Client } from "@/types";

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

class ClientService {
  async getAll(): Promise<Client[]> {
    const clients = await api.getClients();
    return clients.map(c => toCamelCase(c as Record<string, unknown>) as unknown as Client);
  }

  async getById(id: string): Promise<Client | null> {
    try {
      const client = await api.getClient(id);
      return toCamelCase(client as Record<string, unknown>) as unknown as Client;
    } catch {
      return null;
    }
  }

  async getActive(): Promise<Client[]> {
    const clients = await api.getClients({ status: 'active' });
    return clients.map(c => toCamelCase(c as Record<string, unknown>) as unknown as Client);
  }

  async create(item: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const client = await api.createClient(snakeItem);
    return toCamelCase(client as Record<string, unknown>) as unknown as Client;
  }

  async update(id: string, updates: Partial<Client>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateClient(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteClient(id);
  }
}

export const clientService = new ClientService();
