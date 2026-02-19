/**
 * Web-based Client Service using REST API
 */

import { api } from "@/lib/api";
import type { Client } from "@/types";

type RawClientRow = Record<string, unknown> & {
  address?: {
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
};

/**
 * Convert a raw API response row (snake_case flat) into a Client object.
 * The API already returns a nested `address` object — we just need to
 * camelCase the top-level scalar keys.
 */
function mapRowToClient(row: RawClientRow): Client {
  const {
    id,
    name,
    email,
    company,
    contact_info,
    notes,
    status,
    created_at,
    updated_at,
    address,
  } = row as Record<string, unknown>;

  const client: Client = {
    id: id as string,
    name: name as string,
    email: email as string | undefined,
    company: company as string | undefined,
    contactInfo: contact_info as string | undefined,
    notes: notes as string | undefined,
    status: (status as Client["status"]) ?? "active",
    createdAt: created_at as string,
    updatedAt: updated_at as string,
  };

  const addr = address as RawClientRow["address"];
  if (addr && (addr.street || addr.zip || addr.city || addr.country)) {
    client.address = {
      street: addr.street ?? undefined,
      zip: addr.zip ?? undefined,
      city: addr.city ?? undefined,
      country: addr.country ?? undefined,
    };
  }

  return client;
}

/**
 * Convert a Client (or partial) to the snake_case payload for the API.
 * The address is sent as a nested object — the API handles the mapping.
 */
function mapClientToPayload(
  client: Partial<Omit<Client, "id" | "createdAt" | "updatedAt">>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (client.name !== undefined) payload.name = client.name;
  if (client.email !== undefined) payload.email = client.email;
  if (client.company !== undefined) payload.company = client.company;
  if (client.contactInfo !== undefined) payload.contact_info = client.contactInfo;
  if (client.notes !== undefined) payload.notes = client.notes;
  if (client.status !== undefined) payload.status = client.status;

  // Pass address as-is (API handles nested -> flat mapping)
  if (client.address !== undefined) {
    payload.address = client.address ?? null;
  }

  return payload;
}

class ClientService {
  async getAll(): Promise<Client[]> {
    const rows = await api.getClients();
    return (rows as RawClientRow[]).map(mapRowToClient);
  }

  async getById(id: string): Promise<Client | null> {
    try {
      const row = await api.getClient(id);
      return mapRowToClient(row as RawClientRow);
    } catch {
      return null;
    }
  }

  async getActive(): Promise<Client[]> {
    const rows = await api.getClients({ status: "active" });
    return (rows as RawClientRow[]).map(mapRowToClient);
  }

  async create(
    item: Omit<Client, "id" | "createdAt" | "updatedAt">
  ): Promise<Client> {
    const payload = mapClientToPayload(item);
    const row = await api.createClient(payload);
    return mapRowToClient(row as RawClientRow);
  }

  async update(id: string, updates: Partial<Client>): Promise<void> {
    const payload = mapClientToPayload(updates);
    await api.updateClient(id, payload);
  }

  async delete(id: string): Promise<void> {
    await api.deleteClient(id);
  }
}

export const clientService = new ClientService();
