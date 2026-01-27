/**
 * Clients API
 *
 * Database operations for clients.
 * Uses @tauri-apps/plugin-sql for Tauri-compatible database operations.
 */

import { getDb } from './db'
import type { Client, NewClient } from '../types'

/**
 * Database row type for clients
 */
interface ClientRow {
  id: string
  name: string
  address: string | null
  vat_id: string | null
  email: string | null
  created_at: string
}

/**
 * Map database row to Client type
 */
function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? undefined,
    vatId: row.vat_id ?? undefined,
    email: row.email ?? undefined,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Get all clients
 */
export async function getAllClients(): Promise<Client[]> {
  try {
    const db = await getDb()
    const rows = await db.select<ClientRow[]>(
      'SELECT * FROM clients ORDER BY name ASC'
    )
    return rows.map(rowToClient)
  } catch (err) {
    console.error('getAllClients error:', err)
    throw err
  }
}

/**
 * Get client by ID
 */
export async function getClientById(id: string): Promise<Client | null> {
  const db = await getDb()
  const rows = await db.select<ClientRow[]>(
    'SELECT * FROM clients WHERE id = $1',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  return rowToClient(rows[0])
}

/**
 * Create a new client
 */
export async function createClient(data: NewClient): Promise<Client> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO clients (id, name, address, vat_id, email, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      data.name,
      data.address ?? null,
      data.vatId ?? null,
      data.email ?? null,
      now,
    ]
  )

  return {
    id,
    name: data.name,
    address: data.address,
    vatId: data.vatId,
    email: data.email,
    createdAt: new Date(now),
  }
}

/**
 * Update an existing client
 */
export async function updateClient(
  id: string,
  data: Partial<NewClient>
): Promise<Client | null> {
  const existing = await getClientById(id)
  if (!existing) {
    return null
  }

  const db = await getDb()

  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`)
    values.push(data.name)
  }

  if (data.address !== undefined) {
    updates.push(`address = $${paramIndex++}`)
    values.push(data.address ?? null)
  }

  if (data.vatId !== undefined) {
    updates.push(`vat_id = $${paramIndex++}`)
    values.push(data.vatId ?? null)
  }

  if (data.email !== undefined) {
    updates.push(`email = $${paramIndex++}`)
    values.push(data.email ?? null)
  }

  if (updates.length > 0) {
    values.push(id)
    await db.execute(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  }

  return getClientById(id)
}

/**
 * Delete a client
 */
export async function deleteClient(id: string): Promise<boolean> {
  const existing = await getClientById(id)
  if (!existing) {
    return false
  }

  const db = await getDb()
  await db.execute('DELETE FROM clients WHERE id = $1', [id])

  return true
}
