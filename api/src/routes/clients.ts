/**
 * Clients API routes
 */

import { Router } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { cache, cacheKey, TTL } from "../cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateClientSchema, UpdateClientSchema } from "../schemas/index.js";

const router = Router();

/**
 * Map a raw DB row to a client object with nested address structure.
 */
function mapClientRow(row: Record<string, unknown>): Record<string, unknown> {
  const {
    address_street,
    address_zip,
    address_city,
    address_country,
    ...rest
  } = row;

  // Only build address object if at least one non-country field is present
  const hasAddress = address_street || address_zip || address_city;

  return {
    ...rest,
    address: hasAddress
      ? {
          street: address_street ?? null,
          zip: address_zip ?? null,
          city: address_city ?? null,
          country: address_country ?? "Deutschland",
        }
      : null,
  };
}

// List clients
router.get("/", asyncHandler(async (req, res) => {
  const { status } = req.query;
  const key = cacheKey("clients", "list", status as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = "SELECT * FROM clients WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY name ASC";

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  const clients = rows.map(mapClientRow);
  cache.set(key, clients, TTL.CLIENTS);
  res.json(clients);
}));

// Get single client
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) {
    throw new NotFoundError("Client", req.params.id);
  }
  res.json(mapClientRow(row));
}));

// Create client
router.post("/", validateBody(CreateClientSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    name,
    email,
    company,
    contact_info,
    notes,
    status = "active",
    address,
  } = req.body;

  if (!name) {
    throw new ValidationError("Name is required");
  }

  // Extract address fields from nested object or flat fields
  const addressStreet = address?.street ?? req.body.address_street ?? null;
  const addressZip = address?.zip ?? req.body.address_zip ?? null;
  const addressCity = address?.city ?? req.body.address_city ?? null;
  const addressCountry = address?.country ?? req.body.address_country ?? "Deutschland";

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO clients (id, name, email, company, contact_info, notes, status,
       address_street, address_zip, address_city, address_country,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, name, email || null, company || null, contact_info || null,
    notes || null, status,
    addressStreet, addressZip, addressCity, addressCountry,
    now, now
  );

  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown>;
  cache.invalidate("clients:*");
  res.status(201).json(mapClientRow(row));
}));

// Update client
router.patch("/:id", validateBody(UpdateClientSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Client", id);
  }

  const scalarFields = ["name", "email", "company", "contact_info", "notes", "status"];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of scalarFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // Handle address — either as nested object or flat fields
  const address = req.body.address;
  if (address !== undefined) {
    if (address === null) {
      // Explicit null → clear address
      updates.push("address_street = ?", "address_zip = ?", "address_city = ?", "address_country = ?");
      params.push(null, null, null, "Deutschland");
    } else {
      if (address.street !== undefined) { updates.push("address_street = ?"); params.push(address.street || null); }
      if (address.zip !== undefined)    { updates.push("address_zip = ?");    params.push(address.zip || null); }
      if (address.city !== undefined)   { updates.push("address_city = ?");   params.push(address.city || null); }
      if (address.country !== undefined){ updates.push("address_country = ?"); params.push(address.country || "Deutschland"); }
    }
  } else {
    // Also support flat address_ fields for backward compatibility
    const flatAddressFields: Record<string, string> = {
      address_street: "address_street",
      address_zip: "address_zip",
      address_city: "address_city",
      address_country: "address_country",
    };
    for (const [reqField, dbField] of Object.entries(flatAddressFields)) {
      if (req.body[reqField] !== undefined) {
        updates.push(`${dbField} = ?`);
        params.push(req.body[reqField]);
      }
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(getCurrentTimestamp());
    params.push(id);

    db.prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const row = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown>;
  cache.invalidate("clients:*");
  res.json(mapClientRow(row));
}));

// Delete client
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Client", id);
  }

  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  cache.invalidate("clients:*");
  res.json({ success: true, message: `Client "${existing.name}" deleted` });
}));

export default router;
