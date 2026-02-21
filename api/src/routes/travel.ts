/**
 * Travel Expense API Routes (Reisekosten)
 *
 * Manages travel records with German tax-compliant calculations:
 * - Per Diem (Verpflegungsmehraufwand)
 * - Mileage (Kilometerpauschale)
 * - Business Meals (Bewirtungskosten)
 *
 * Auto-creates linked expense entries for accounting integration.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getDb, generateId, getCurrentTimestamp } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateBody.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { cache, cacheKey, TTL } from '../cache.js';
import { calculatePerDiem, calculateMileage, calculateTotalTravel } from '../services/travelService.js';
import { auditCreate, auditUpdate, auditSoftDelete, extractAuditContext } from '../services/auditService.js';
import { enforcePeriodLock } from '../services/periodLockService.js';
import { getNextSequenceNumber } from '../services/sequenceService.js';
import type { TravelRecord, MealsProvided, VehicleType } from '../types/travel.js';
import { BUSINESS_MEAL_DEDUCTIBLE_PERCENT, MILEAGE_RATES } from '../types/travel.js';

const router = Router();

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const MealsProvidedSchema = z.object({
  breakfast: z.boolean().default(false),
  lunch: z.boolean().default(false),
  dinner: z.boolean().default(false),
}).strict();

const VehicleTypeSchema = z.enum(['car', 'motorcycle', 'bike']);

export const CreateTravelRecordSchema = z.object({
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  destination: z.string().min(1, 'Destination is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  // Mileage
  distance_km: z.coerce.number().min(0).nullable().optional(),
  vehicle_type: VehicleTypeSchema.optional().default('car'),
  // Per Diem
  absence_hours: z.coerce.number().min(0).max(720).nullable().optional(), // max 30 days
  meals_provided: MealsProvidedSchema.nullable().optional(),
  // Accommodation
  accommodation_amount: z.coerce.number().min(0).nullable().optional(),
  // Other
  other_costs: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
}).strip();

export const UpdateTravelRecordSchema = z.object({
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').nullable().optional(),
  destination: z.string().min(1).optional(),
  purpose: z.string().min(1).optional(),
  distance_km: z.coerce.number().min(0).nullable().optional(),
  vehicle_type: VehicleTypeSchema.optional(),
  absence_hours: z.coerce.number().min(0).max(720).nullable().optional(),
  meals_provided: MealsProvidedSchema.nullable().optional(),
  accommodation_amount: z.coerce.number().min(0).nullable().optional(),
  other_costs: z.coerce.number().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
}).strip();

export const CalculatePerDiemSchema = z.object({
  absence_hours: z.coerce.number().min(0, 'Absence hours must be >= 0'),
  meals_provided: MealsProvidedSchema.optional().default({
    breakfast: false,
    lunch: false,
    dinner: false,
  }),
}).strip();

export const CalculateMileageSchema = z.object({
  distance_km: z.coerce.number().min(0, 'Distance must be >= 0'),
  vehicle_type: VehicleTypeSchema.optional().default('car'),
}).strip();

const UpdateBusinessMealSchema = z.object({
  is_business_meal: z.coerce.number().min(0).max(1),
  meal_participants: z.array(z.string().min(1)).min(1, 'At least 1 participant required').optional(),
  meal_purpose: z.string().min(1, 'Business purpose is required').optional(),
  meal_location: z.string().nullable().optional(),
}).strip().refine(
  (data) => {
    // When marking as business meal, require participants and purpose
    if (data.is_business_meal === 1) {
      return data.meal_participants && data.meal_participants.length > 0 && data.meal_purpose;
    }
    return true;
  },
  { message: 'Business meals require meal_participants and meal_purpose' }
);

// ============================================================================
// DB Row Type
// ============================================================================

interface TravelRecordRow {
  id: string;
  expense_id: string | null;
  trip_date: string;
  return_date: string | null;
  destination: string;
  purpose: string;
  distance_km: number | null;
  vehicle_type: string;
  km_rate: number;
  mileage_amount: number | null;
  absence_hours: number | null;
  per_diem_rate: number | null;
  per_diem_amount: number | null;
  meals_provided: string | null;
  meal_deductions: number | null;
  accommodation_amount: number | null;
  other_costs: number | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  category: string;
  net_amount: number;
  deductible_percent: number;
  is_business_meal: number;
  meal_participants: string | null;
  meal_purpose: string | null;
  meal_location: string | null;
  [key: string]: unknown;
}

// ============================================================================
// Helpers
// ============================================================================

/** Parse meals_provided JSON from DB row */
function parseMealsProvided(json: string | null): MealsProvided | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Format a travel record row for API response */
function formatTravelRecord(row: TravelRecordRow): TravelRecord {
  return {
    ...row,
    vehicle_type: (row.vehicle_type || 'car') as VehicleType,
    meals_provided: parseMealsProvided(row.meals_provided),
  };
}

/** Calculate all computed fields for a travel record */
function computeTravelFields(data: z.infer<typeof CreateTravelRecordSchema>) {
  const vehicleType = data.vehicle_type || 'car';
  let mileageAmount: number | null = null;
  let kmRate = MILEAGE_RATES[vehicleType];
  let perDiemRate: number | null = null;
  let perDiemAmount: number | null = null;
  let mealDeductions: number | null = null;

  // Mileage
  if (data.distance_km && data.distance_km > 0) {
    const mileage = calculateMileage(data.distance_km, vehicleType);
    mileageAmount = mileage.amount;
    kmRate = mileage.km_rate;
  }

  // Per Diem
  if (data.absence_hours && data.absence_hours > 0) {
    const meals: MealsProvided = data.meals_provided || {
      breakfast: false,
      lunch: false,
      dinner: false,
    };
    const perDiem = calculatePerDiem(data.absence_hours, meals);
    perDiemRate = perDiem.rate;
    perDiemAmount = perDiem.net_amount;
    mealDeductions = perDiem.meal_deductions;
  }

  // Total
  const totalAmount = calculateTotalTravel({
    distance_km: data.distance_km ?? null,
    vehicle_type: vehicleType,
    mileage_amount: mileageAmount,
    absence_hours: data.absence_hours ?? null,
    per_diem_amount: perDiemAmount,
    meals_provided: data.meals_provided ?? null,
    accommodation_amount: data.accommodation_amount ?? null,
    other_costs: data.other_costs ?? null,
  });

  return {
    vehicleType,
    kmRate,
    mileageAmount,
    perDiemRate,
    perDiemAmount,
    mealDeductions,
    totalAmount,
  };
}

// ============================================================================
// Calculator Routes (must be before /:id to avoid route conflicts)
// ============================================================================

/**
 * POST /api/travel-records/calculate-per-diem
 * Calculate per diem without creating a record
 */
router.post('/calculate-per-diem', validateBody(CalculatePerDiemSchema), asyncHandler(async (req: Request, res: Response) => {
  const { absence_hours, meals_provided } = req.body;
  const result = calculatePerDiem(absence_hours, meals_provided);
  res.json(result);
}));

/**
 * POST /api/travel-records/calculate-mileage
 * Calculate mileage compensation without creating a record
 */
router.post('/calculate-mileage', validateBody(CalculateMileageSchema), asyncHandler(async (req: Request, res: Response) => {
  const { distance_km, vehicle_type } = req.body;
  const result = calculateMileage(distance_km, vehicle_type);
  res.json(result);
}));

// ============================================================================
// Travel Record CRUD
// ============================================================================

/**
 * POST /api/travel-records
 * Create a new travel record with auto-linked expense
 */
router.post('/', validateBody(CreateTravelRecordSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const data = req.body as z.infer<typeof CreateTravelRecordSchema>;

  // GoBD: Check period lock
  enforcePeriodLock(db, data.trip_date, 'Reisekosten erstellen');

  const computed = computeTravelFields(data);

  // Use transaction to create both expense and travel record atomically
  const travelId = generateId();
  const expenseId = generateId();
  const now = getCurrentTimestamp();

  const netAmount = computed.totalAmount;
  const vatRate = 0; // Travel expenses are typically net (no VAT on per diem/mileage)
  const vatAmount = 0;
  const grossAmount = netAmount;

  // GoBD: Sequential reference number for the expense
  const referenceNumber = getNextSequenceNumber(db, 'EA');

  const insertExpense = db.prepare(
    `INSERT INTO expenses (
      id, date, vendor, description, category, net_amount, vat_rate,
      vat_amount, gross_amount, euer_line, euer_category, payment_method,
      deductible_percent, reference_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const insertTravel = db.prepare(
    `INSERT INTO travel_records (
      id, expense_id, trip_date, return_date, destination, purpose,
      distance_km, vehicle_type, km_rate, mileage_amount,
      absence_hours, per_diem_rate, per_diem_amount,
      meals_provided, meal_deductions,
      accommodation_amount, other_costs, notes, total_amount, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    // Create expense entry
    insertExpense.run(
      expenseId,
      data.trip_date,
      null, // vendor
      `Reisekosten: ${data.destination} - ${data.purpose}`,
      'travel',
      netAmount,
      vatRate,
      vatAmount,
      grossAmount,
      34, // EÜR line for travel
      'travel',
      null,
      100, // 100% deductible
      referenceNumber,
      now
    );

    // Create travel record linked to expense
    insertTravel.run(
      travelId,
      expenseId,
      data.trip_date,
      data.return_date ?? null,
      data.destination,
      data.purpose,
      data.distance_km ?? null,
      computed.vehicleType,
      computed.kmRate,
      computed.mileageAmount,
      data.absence_hours ?? null,
      computed.perDiemRate,
      computed.perDiemAmount,
      data.meals_provided ? JSON.stringify(data.meals_provided) : null,
      computed.mealDeductions,
      data.accommodation_amount ?? null,
      data.other_costs ?? null,
      data.notes ?? null,
      computed.totalAmount,
      now
    );
  });

  transaction();

  const record = db.prepare('SELECT * FROM travel_records WHERE id = ?').get(travelId) as TravelRecordRow;

  // GoBD: Audit trail
  auditCreate(db, 'expense', expenseId, { travel_record_id: travelId, type: 'travel' } as unknown as Record<string, unknown>, extractAuditContext(req));

  cache.invalidate('expenses:*');
  cache.invalidate('travel:*');

  res.status(201).json(formatTravelRecord(record));
}));

/**
 * GET /api/travel-records
 * List all travel records
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date } = req.query;
  const key = cacheKey('travel', 'list', start_date as string, end_date as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = 'SELECT * FROM travel_records WHERE 1=1';
  const params: unknown[] = [];

  if (start_date) {
    sql += ' AND trip_date >= ?';
    params.push(start_date);
  }

  if (end_date) {
    sql += ' AND trip_date <= ?';
    params.push(end_date);
  }

  sql += ' ORDER BY trip_date DESC';

  const rows = db.prepare(sql).all(...params) as TravelRecordRow[];
  const records = rows.map(formatTravelRecord);

  cache.set(key, records, TTL.EXPENSES);
  res.json(records);
}));

/**
 * GET /api/travel-records/:id
 * Get a single travel record
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM travel_records WHERE id = ?').get(req.params.id) as TravelRecordRow | undefined;

  if (!row) {
    throw new NotFoundError('Travel record', req.params.id);
  }

  res.json(formatTravelRecord(row));
}));

/**
 * PATCH /api/travel-records/:id
 * Update a travel record (recalculates totals)
 */
router.patch('/:id', validateBody(UpdateTravelRecordSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM travel_records WHERE id = ?').get(id) as TravelRecordRow | undefined;
  if (!existing) {
    throw new NotFoundError('Travel record', id);
  }

  // GoBD: Check period lock
  enforcePeriodLock(db, existing.trip_date, 'Reisekosten ändern');

  const data = req.body as z.infer<typeof UpdateTravelRecordSchema>;

  // Merge existing with updates for recalculation
  const merged = {
    trip_date: data.trip_date ?? existing.trip_date,
    return_date: data.return_date !== undefined ? data.return_date : existing.return_date,
    destination: data.destination ?? existing.destination,
    purpose: data.purpose ?? existing.purpose,
    distance_km: data.distance_km !== undefined ? data.distance_km : existing.distance_km,
    vehicle_type: (data.vehicle_type ?? existing.vehicle_type ?? 'car') as VehicleType,
    absence_hours: data.absence_hours !== undefined ? data.absence_hours : existing.absence_hours,
    meals_provided: data.meals_provided !== undefined ? data.meals_provided : parseMealsProvided(existing.meals_provided),
    accommodation_amount: data.accommodation_amount !== undefined ? data.accommodation_amount : existing.accommodation_amount,
    other_costs: data.other_costs !== undefined ? data.other_costs : existing.other_costs,
    notes: data.notes !== undefined ? data.notes : existing.notes,
  };

  // Recalculate
  const computed = computeTravelFields({
    ...merged,
    trip_date: merged.trip_date,
    destination: merged.destination,
    purpose: merged.purpose,
    vehicle_type: merged.vehicle_type,
    meals_provided: merged.meals_provided ?? undefined,
  });

  const transaction = db.transaction(() => {
    // Update travel record
    db.prepare(
      `UPDATE travel_records SET
        trip_date = ?, return_date = ?, destination = ?, purpose = ?,
        distance_km = ?, vehicle_type = ?, km_rate = ?, mileage_amount = ?,
        absence_hours = ?, per_diem_rate = ?, per_diem_amount = ?,
        meals_provided = ?, meal_deductions = ?,
        accommodation_amount = ?, other_costs = ?, notes = ?, total_amount = ?
      WHERE id = ?`
    ).run(
      merged.trip_date,
      merged.return_date ?? null,
      merged.destination,
      merged.purpose,
      merged.distance_km ?? null,
      computed.vehicleType,
      computed.kmRate,
      computed.mileageAmount,
      merged.absence_hours ?? null,
      computed.perDiemRate,
      computed.perDiemAmount,
      merged.meals_provided ? JSON.stringify(merged.meals_provided) : null,
      computed.mealDeductions,
      merged.accommodation_amount ?? null,
      merged.other_costs ?? null,
      merged.notes ?? null,
      computed.totalAmount,
      id
    );

    // Update linked expense if exists
    if (existing.expense_id) {
      db.prepare(
        `UPDATE expenses SET
          date = ?, net_amount = ?, vat_amount = 0, gross_amount = ?,
          description = ?
        WHERE id = ?`
      ).run(
        merged.trip_date,
        computed.totalAmount,
        computed.totalAmount,
        `Reisekosten: ${merged.destination} - ${merged.purpose}`,
        existing.expense_id
      );
    }
  });

  transaction();

  const updated = db.prepare('SELECT * FROM travel_records WHERE id = ?').get(id) as TravelRecordRow;

  // GoBD: Audit trail
  auditUpdate(
    db, 'expense', existing.expense_id || id,
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
    extractAuditContext(req)
  );

  cache.invalidate('expenses:*');
  cache.invalidate('travel:*');

  res.json(formatTravelRecord(updated));
}));

/**
 * DELETE /api/travel-records/:id
 * Delete a travel record and its linked expense
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM travel_records WHERE id = ?').get(id) as TravelRecordRow | undefined;
  if (!existing) {
    throw new NotFoundError('Travel record', id);
  }

  // GoBD: Check period lock
  enforcePeriodLock(db, existing.trip_date, 'Reisekosten löschen');

  const transaction = db.transaction(() => {
    // Soft-delete linked expense if exists
    if (existing.expense_id) {
      db.prepare('UPDATE expenses SET is_deleted = 1 WHERE id = ?').run(existing.expense_id);

      // GoBD: Audit trail for expense
      auditSoftDelete(
        db, 'expense', existing.expense_id,
        existing as unknown as Record<string, unknown>,
        extractAuditContext(req)
      );
    }

    // Hard-delete travel record (not a GoBD primary financial record)
    db.prepare('DELETE FROM travel_records WHERE id = ?').run(id);
  });

  transaction();

  cache.invalidate('expenses:*');
  cache.invalidate('travel:*');

  res.json({ success: true, message: 'Travel record deleted' });
}));

// ============================================================================
// Business Meal Routes
// ============================================================================

/**
 * GET /api/travel-records/business-meals
 * List all business meal expenses
 */
router.get('/business-meals/list', asyncHandler(async (_req: Request, res: Response) => {
  const db = getDb();
  const meals = db.prepare(
    `SELECT * FROM expenses
     WHERE is_business_meal = 1
       AND (is_deleted IS NULL OR is_deleted = 0)
     ORDER BY date DESC`
  ).all() as ExpenseRow[];

  const formatted = meals.map(m => ({
    ...m,
    meal_participants: m.meal_participants ? JSON.parse(m.meal_participants) : [],
  }));

  res.json(formatted);
}));

/**
 * PATCH /api/travel-records/business-meal/:id
 * Update business meal details on an expense
 */
router.patch('/business-meal/:id', validateBody(UpdateBusinessMealSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare(
    "SELECT * FROM expenses WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)"
  ).get(id) as ExpenseRow | undefined;

  if (!existing) {
    throw new NotFoundError('Expense', id);
  }

  // GoBD: Check period lock
  enforcePeriodLock(db, existing.date, 'Bewirtungskosten ändern');

  const { is_business_meal, meal_participants, meal_purpose, meal_location } = req.body;

  const updates: string[] = ['is_business_meal = ?'];
  const params: unknown[] = [is_business_meal];

  if (is_business_meal === 1) {
    // Set 70% deductible for business meals
    updates.push('deductible_percent = ?');
    params.push(BUSINESS_MEAL_DEDUCTIBLE_PERCENT);
  } else {
    // Restore 100% deductible when unmarking
    updates.push('deductible_percent = ?');
    params.push(100);
  }

  if (meal_participants !== undefined) {
    updates.push('meal_participants = ?');
    params.push(JSON.stringify(meal_participants));
  }

  if (meal_purpose !== undefined) {
    updates.push('meal_purpose = ?');
    params.push(meal_purpose);
  }

  if (meal_location !== undefined) {
    updates.push('meal_location = ?');
    params.push(meal_location);
  }

  params.push(id);
  db.prepare(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as ExpenseRow;

  // GoBD: Audit trail
  auditUpdate(
    db, 'expense', id,
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
    extractAuditContext(req)
  );

  cache.invalidate('expenses:*');

  res.json({
    ...updated,
    meal_participants: updated.meal_participants ? JSON.parse(updated.meal_participants) : [],
  });
}));

export default router;
