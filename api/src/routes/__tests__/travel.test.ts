/**
 * Travel Expense Tests (Reisekosten)
 *
 * Tests for:
 * - Per Diem calculation (Verpflegungsmehraufwand)
 * - Meal deductions
 * - Mileage calculation (Kilometerpauschale)
 * - Total travel expense calculation
 * - Travel record CRUD with linked expenses
 * - Business meals (Bewirtungskosten) - 70% deductible
 * - Input validation
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestExpense,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

import { createTestApp } from '../../test/app.js';
import travelRouter from '../travel.js';
import request from 'supertest';

const app = createTestApp(travelRouter, '/api/travel-records');

// ============================================================================
// Unit Tests: Calculation Service
// ============================================================================

import {
  calculatePerDiem,
  calculateMileage,
  calculateTotalTravel,
  calculateMultiDayPerDiem,
} from '../../services/travelService.js';

describe('Travel Calculation Service', () => {
  // ========================================================================
  // Per Diem (Verpflegungsmehraufwand)
  // ========================================================================

  describe('calculatePerDiem', () => {
    it('returns €0 for absences under 8 hours', () => {
      const result = calculatePerDiem(7);
      expect(result.rate).toBe(0);
      expect(result.gross_amount).toBe(0);
      expect(result.net_amount).toBe(0);
    });

    it('returns €0 for 0 hours', () => {
      const result = calculatePerDiem(0);
      expect(result.net_amount).toBe(0);
    });

    it('returns €14 for absences of 8-23 hours', () => {
      const result = calculatePerDiem(8);
      expect(result.rate).toBe(14);
      expect(result.gross_amount).toBe(14);
      expect(result.net_amount).toBe(14);
    });

    it('returns €14 for 12 hours absence', () => {
      const result = calculatePerDiem(12);
      expect(result.rate).toBe(14);
      expect(result.net_amount).toBe(14);
    });

    it('returns €14 for 23 hours absence', () => {
      const result = calculatePerDiem(23);
      expect(result.rate).toBe(14);
      expect(result.net_amount).toBe(14);
    });

    it('returns €28 for absences of 24+ hours', () => {
      const result = calculatePerDiem(24);
      expect(result.rate).toBe(28);
      expect(result.gross_amount).toBe(28);
      expect(result.net_amount).toBe(28);
    });

    it('returns €28 for 48 hours absence', () => {
      const result = calculatePerDiem(48);
      expect(result.rate).toBe(28);
      expect(result.net_amount).toBe(28);
    });

    // Meal deductions
    it('deducts €5.60 for provided breakfast', () => {
      const result = calculatePerDiem(24, { breakfast: true, lunch: false, dinner: false });
      expect(result.meal_deductions).toBe(5.60);
      expect(result.net_amount).toBe(22.40); // 28 - 5.60
    });

    it('deducts €11.20 for provided lunch', () => {
      const result = calculatePerDiem(24, { breakfast: false, lunch: true, dinner: false });
      expect(result.meal_deductions).toBe(11.20);
      expect(result.net_amount).toBe(16.80); // 28 - 11.20
    });

    it('deducts €11.20 for provided dinner', () => {
      const result = calculatePerDiem(24, { breakfast: false, lunch: false, dinner: true });
      expect(result.meal_deductions).toBe(11.20);
      expect(result.net_amount).toBe(16.80); // 28 - 11.20
    });

    it('deducts all meals correctly (€28 total deduction)', () => {
      const result = calculatePerDiem(24, { breakfast: true, lunch: true, dinner: true });
      expect(result.meal_deductions).toBe(28.00); // 5.60 + 11.20 + 11.20
      expect(result.net_amount).toBe(0); // Cannot go below 0
    });

    it('applies meal deductions to 8-24h rate too', () => {
      const result = calculatePerDiem(10, { breakfast: true, lunch: false, dinner: false });
      expect(result.rate).toBe(14);
      expect(result.meal_deductions).toBe(5.60);
      expect(result.net_amount).toBe(8.40); // 14 - 5.60
    });

    it('net amount never goes below 0', () => {
      const result = calculatePerDiem(10, { breakfast: true, lunch: true, dinner: true });
      expect(result.net_amount).toBe(0);
      expect(result.meal_deductions).toBe(28.00);
    });

    it('throws for negative hours', () => {
      expect(() => calculatePerDiem(-1)).toThrow('Absence hours cannot be negative');
    });
  });

  // ========================================================================
  // Mileage (Kilometerpauschale)
  // ========================================================================

  describe('calculateMileage', () => {
    it('calculates car mileage at €0.30/km', () => {
      const result = calculateMileage(100, 'car');
      expect(result.km_rate).toBe(0.30);
      expect(result.amount).toBe(30.00);
    });

    it('calculates motorcycle mileage at €0.20/km', () => {
      const result = calculateMileage(100, 'motorcycle');
      expect(result.km_rate).toBe(0.20);
      expect(result.amount).toBe(20.00);
    });

    it('calculates bike mileage at €0.05/km', () => {
      const result = calculateMileage(100, 'bike');
      expect(result.km_rate).toBe(0.05);
      expect(result.amount).toBe(5.00);
    });

    it('defaults to car when no vehicle type specified', () => {
      const result = calculateMileage(50);
      expect(result.vehicle_type).toBe('car');
      expect(result.amount).toBe(15.00);
    });

    it('handles fractional distances', () => {
      const result = calculateMileage(33.5, 'car');
      expect(result.amount).toBe(10.05); // 33.5 * 0.30
    });

    it('returns 0 for 0 km', () => {
      const result = calculateMileage(0, 'car');
      expect(result.amount).toBe(0);
    });

    it('throws for negative distance', () => {
      expect(() => calculateMileage(-10, 'car')).toThrow('Distance cannot be negative');
    });
  });

  // ========================================================================
  // Total Travel Calculation
  // ========================================================================

  describe('calculateTotalTravel', () => {
    it('sums mileage + per diem + accommodation + other costs', () => {
      const total = calculateTotalTravel({
        distance_km: 200,
        vehicle_type: 'car',
        absence_hours: 10,
        meals_provided: { breakfast: false, lunch: false, dinner: false },
        accommodation_amount: 89.00,
        other_costs: 15.50,
      });
      // 200*0.30 = 60 + 14 (per diem 10h) + 89 + 15.50 = 178.50
      expect(total).toBe(178.50);
    });

    it('handles mileage only', () => {
      const total = calculateTotalTravel({
        distance_km: 100,
        vehicle_type: 'car',
      });
      expect(total).toBe(30.00);
    });

    it('handles per diem only', () => {
      const total = calculateTotalTravel({
        absence_hours: 24,
        meals_provided: { breakfast: false, lunch: false, dinner: false },
      });
      expect(total).toBe(28.00);
    });

    it('handles accommodation only', () => {
      const total = calculateTotalTravel({
        accommodation_amount: 120.00,
      });
      expect(total).toBe(120.00);
    });

    it('returns 0 for empty travel record', () => {
      const total = calculateTotalTravel({});
      expect(total).toBe(0);
    });

    it('uses pre-calculated mileage_amount if distance_km not set', () => {
      const total = calculateTotalTravel({
        mileage_amount: 45.00,
      });
      expect(total).toBe(45.00);
    });

    it('uses pre-calculated per_diem_amount if absence_hours not set', () => {
      const total = calculateTotalTravel({
        per_diem_amount: 14.00,
      });
      expect(total).toBe(14.00);
    });

    it('applies meal deductions in total calculation', () => {
      const total = calculateTotalTravel({
        absence_hours: 24,
        meals_provided: { breakfast: true, lunch: false, dinner: false },
      });
      expect(total).toBe(22.40); // 28 - 5.60
    });
  });

  // ========================================================================
  // Multi-day Trip
  // ========================================================================

  describe('calculateMultiDayPerDiem', () => {
    it('handles single day trip', () => {
      const days = calculateMultiDayPerDiem('2024-06-10', '2024-06-10', 10, 10);
      expect(days).toHaveLength(1);
      expect(days[0].rate).toBe(14);
    });

    it('handles two-day trip', () => {
      const days = calculateMultiDayPerDiem('2024-06-10', '2024-06-11', 14, 10);
      expect(days).toHaveLength(2);
      expect(days[0].rate).toBe(14); // First day: 14h
      expect(days[1].rate).toBe(14); // Second day: 10h
    });

    it('handles three-day trip with full middle day', () => {
      const days = calculateMultiDayPerDiem('2024-06-10', '2024-06-12', 14, 10);
      expect(days).toHaveLength(3);
      expect(days[0].rate).toBe(14);  // First day: 14h
      expect(days[1].rate).toBe(28);  // Middle day: 24h (full)
      expect(days[2].rate).toBe(14);  // Last day: 10h
    });

    it('throws if return date before trip date', () => {
      expect(() => calculateMultiDayPerDiem('2024-06-12', '2024-06-10', 10, 10))
        .toThrow('Return date must be on or after trip date');
    });
  });
});

// ============================================================================
// API Integration Tests
// ============================================================================

describe('Travel Record API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ========================================================================
  // POST /api/travel-records
  // ========================================================================

  describe('POST /api/travel-records', () => {
    it('creates a travel record with mileage', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          destination: 'München',
          purpose: 'Client meeting',
          distance_km: 200,
          vehicle_type: 'car',
        });

      expect(res.status).toBe(201);
      expect(res.body.destination).toBe('München');
      expect(res.body.distance_km).toBe(200);
      expect(res.body.mileage_amount).toBe(60.00); // 200 * 0.30
      expect(res.body.total_amount).toBe(60.00);
      expect(res.body.expense_id).toBeTruthy();
    });

    it('creates a travel record with per diem', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          destination: 'Berlin',
          purpose: 'Conference',
          absence_hours: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.per_diem_rate).toBe(14);
      expect(res.body.per_diem_amount).toBe(14.00);
      expect(res.body.total_amount).toBe(14.00);
    });

    it('creates a travel record with all components', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          return_date: '2024-06-16',
          destination: 'Hamburg',
          purpose: 'Workshop',
          distance_km: 300,
          vehicle_type: 'car',
          absence_hours: 24,
          meals_provided: { breakfast: true, lunch: false, dinner: false },
          accommodation_amount: 95.00,
          other_costs: 20.00,
        });

      expect(res.status).toBe(201);
      expect(res.body.mileage_amount).toBe(90.00); // 300 * 0.30
      expect(res.body.per_diem_amount).toBe(22.40); // 28 - 5.60
      expect(res.body.meal_deductions).toBe(5.60);
      expect(res.body.accommodation_amount).toBe(95.00);
      expect(res.body.other_costs).toBe(20.00);
      expect(res.body.total_amount).toBe(227.40); // 90 + 22.40 + 95 + 20
    });

    it('auto-creates linked expense with category=travel', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          destination: 'Berlin',
          purpose: 'Meeting',
          distance_km: 100,
        });

      expect(res.status).toBe(201);
      const expenseId = res.body.expense_id;
      expect(expenseId).toBeTruthy();

      // Verify expense was created
      const expense = testDb.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId) as any;
      expect(expense).toBeTruthy();
      expect(expense.category).toBe('travel');
      expect(expense.net_amount).toBe(30.00);
      expect(expense.deductible_percent).toBe(100);
      expect(expense.description).toContain('Berlin');
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          // missing destination and purpose
        });

      expect(res.status).toBe(400);
    });

    it('validates date format', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: 'not-a-date',
          destination: 'Berlin',
          purpose: 'Meeting',
        });

      expect(res.status).toBe(400);
    });

    it('rejects negative distance', async () => {
      const res = await request(app)
        .post('/api/travel-records')
        .send({
          trip_date: '2024-06-15',
          destination: 'Berlin',
          purpose: 'Meeting',
          distance_km: -50,
        });

      expect(res.status).toBe(400);
    });
  });

  // ========================================================================
  // GET /api/travel-records
  // ========================================================================

  describe('GET /api/travel-records', () => {
    it('returns empty array when no records', async () => {
      const res = await request(app).get('/api/travel-records');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all travel records', async () => {
      // Create two records
      await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });
      await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-20',
        destination: 'München',
        purpose: 'Conference',
        distance_km: 200,
      });

      const res = await request(app).get('/api/travel-records');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('filters by date range', async () => {
      await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });
      await request(app).post('/api/travel-records').send({
        trip_date: '2024-07-20',
        destination: 'München',
        purpose: 'Conference',
        distance_km: 200,
      });

      const res = await request(app)
        .get('/api/travel-records')
        .query({ start_date: '2024-07-01', end_date: '2024-07-31' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].destination).toBe('München');
    });
  });

  // ========================================================================
  // GET /api/travel-records/:id
  // ========================================================================

  describe('GET /api/travel-records/:id', () => {
    it('returns a single travel record', async () => {
      const createRes = await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });

      const res = await request(app).get(`/api/travel-records/${createRes.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.destination).toBe('Berlin');
    });

    it('returns 404 for non-existent record', async () => {
      const res = await request(app).get('/api/travel-records/non-existent-id');
      expect(res.status).toBe(404);
    });
  });

  // ========================================================================
  // PATCH /api/travel-records/:id
  // ========================================================================

  describe('PATCH /api/travel-records/:id', () => {
    it('updates travel record and recalculates totals', async () => {
      const createRes = await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });

      const res = await request(app)
        .patch(`/api/travel-records/${createRes.body.id}`)
        .send({ distance_km: 200 });

      expect(res.status).toBe(200);
      expect(res.body.distance_km).toBe(200);
      expect(res.body.mileage_amount).toBe(60.00); // 200 * 0.30
      expect(res.body.total_amount).toBe(60.00);
    });

    it('updates linked expense when travel record is updated', async () => {
      const createRes = await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });

      await request(app)
        .patch(`/api/travel-records/${createRes.body.id}`)
        .send({ distance_km: 200, destination: 'Hamburg' });

      // Verify linked expense updated
      const expense = testDb.prepare('SELECT * FROM expenses WHERE id = ?').get(createRes.body.expense_id) as any;
      expect(expense.net_amount).toBe(60.00);
      expect(expense.description).toContain('Hamburg');
    });

    it('returns 404 for non-existent record', async () => {
      const res = await request(app)
        .patch('/api/travel-records/non-existent')
        .send({ distance_km: 200 });

      expect(res.status).toBe(404);
    });
  });

  // ========================================================================
  // DELETE /api/travel-records/:id
  // ========================================================================

  describe('DELETE /api/travel-records/:id', () => {
    it('deletes travel record and soft-deletes linked expense', async () => {
      const createRes = await request(app).post('/api/travel-records').send({
        trip_date: '2024-06-15',
        destination: 'Berlin',
        purpose: 'Meeting',
        distance_km: 100,
      });

      const res = await request(app).delete(`/api/travel-records/${createRes.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Travel record should be gone
      const travel = testDb.prepare('SELECT * FROM travel_records WHERE id = ?').get(createRes.body.id);
      expect(travel).toBeUndefined();

      // Expense should be soft-deleted
      const expense = testDb.prepare('SELECT * FROM expenses WHERE id = ?').get(createRes.body.expense_id) as any;
      expect(expense.is_deleted).toBe(1);
    });

    it('returns 404 for non-existent record', async () => {
      const res = await request(app).delete('/api/travel-records/non-existent');
      expect(res.status).toBe(404);
    });
  });

  // ========================================================================
  // Calculator Endpoints
  // ========================================================================

  describe('POST /api/travel-records/calculate-per-diem', () => {
    it('calculates per diem for 10 hours', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-per-diem')
        .send({ absence_hours: 10 });

      expect(res.status).toBe(200);
      expect(res.body.rate).toBe(14);
      expect(res.body.net_amount).toBe(14);
    });

    it('calculates per diem with meal deductions', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-per-diem')
        .send({
          absence_hours: 24,
          meals_provided: { breakfast: true, lunch: false, dinner: true },
        });

      expect(res.status).toBe(200);
      expect(res.body.rate).toBe(28);
      expect(res.body.meal_deductions).toBe(16.80); // 5.60 + 11.20
      expect(res.body.net_amount).toBe(11.20); // 28 - 16.80
    });

    it('validates absence_hours >= 0', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-per-diem')
        .send({ absence_hours: -5 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/travel-records/calculate-mileage', () => {
    it('calculates car mileage', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-mileage')
        .send({ distance_km: 150, vehicle_type: 'car' });

      expect(res.status).toBe(200);
      expect(res.body.km_rate).toBe(0.30);
      expect(res.body.amount).toBe(45.00);
    });

    it('calculates motorcycle mileage', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-mileage')
        .send({ distance_km: 150, vehicle_type: 'motorcycle' });

      expect(res.status).toBe(200);
      expect(res.body.km_rate).toBe(0.20);
      expect(res.body.amount).toBe(30.00);
    });

    it('defaults to car', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-mileage')
        .send({ distance_km: 100 });

      expect(res.status).toBe(200);
      expect(res.body.vehicle_type).toBe('car');
      expect(res.body.amount).toBe(30.00);
    });

    it('validates distance >= 0', async () => {
      const res = await request(app)
        .post('/api/travel-records/calculate-mileage')
        .send({ distance_km: -10 });

      expect(res.status).toBe(400);
    });
  });

  // ========================================================================
  // Business Meals (Bewirtungskosten)
  // ========================================================================

  describe('Business Meals', () => {
    it('GET /api/travel-records/business-meals/list returns business meals', async () => {
      // Insert a regular expense and a business meal
      insertTestExpense(testDb, { id: 'exp-regular', description: 'Regular expense' });

      testDb.prepare(
        `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount,
         is_business_meal, meal_participants, meal_purpose, meal_location, deductible_percent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(
        'exp-meal-1', '2024-06-15', 'Restaurant ABC', 'Business dinner', 'other',
        100, 19, 19, 119,
        1, JSON.stringify(['John Doe', 'Jane Smith']), 'Client discussion', 'Restaurant ABC',
        70
      );

      const res = await request(app).get('/api/travel-records/business-meals/list');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].is_business_meal).toBe(1);
      expect(res.body[0].meal_participants).toEqual(['John Doe', 'Jane Smith']);
    });

    it('PATCH /api/travel-records/business-meal/:id marks expense as business meal', async () => {
      insertTestExpense(testDb, { id: 'exp-to-mark' });

      const res = await request(app)
        .patch('/api/travel-records/business-meal/exp-to-mark')
        .send({
          is_business_meal: 1,
          meal_participants: ['Alice', 'Bob'],
          meal_purpose: 'Project kickoff dinner',
          meal_location: 'Zum Goldenen Löwen',
        });

      expect(res.status).toBe(200);
      expect(res.body.is_business_meal).toBe(1);
      expect(res.body.deductible_percent).toBe(70); // Auto-set to 70%
      expect(res.body.meal_participants).toEqual(['Alice', 'Bob']);
      expect(res.body.meal_purpose).toBe('Project kickoff dinner');
    });

    it('restores 100% deductible when unmarking business meal', async () => {
      insertTestExpense(testDb, { id: 'exp-unmark' });

      // First mark as business meal
      await request(app)
        .patch('/api/travel-records/business-meal/exp-unmark')
        .send({
          is_business_meal: 1,
          meal_participants: ['Alice'],
          meal_purpose: 'Meeting',
        });

      // Then unmark
      const res = await request(app)
        .patch('/api/travel-records/business-meal/exp-unmark')
        .send({ is_business_meal: 0 });

      expect(res.status).toBe(200);
      expect(res.body.is_business_meal).toBe(0);
      expect(res.body.deductible_percent).toBe(100); // Restored
    });

    it('requires participants when marking as business meal', async () => {
      insertTestExpense(testDb, { id: 'exp-no-participants' });

      const res = await request(app)
        .patch('/api/travel-records/business-meal/exp-no-participants')
        .send({
          is_business_meal: 1,
          // missing meal_participants and meal_purpose
        });

      expect(res.status).toBe(400);
    });

    it('requires purpose when marking as business meal', async () => {
      insertTestExpense(testDb, { id: 'exp-no-purpose' });

      const res = await request(app)
        .patch('/api/travel-records/business-meal/exp-no-purpose')
        .send({
          is_business_meal: 1,
          meal_participants: ['Alice'],
          // missing meal_purpose
        });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app)
        .patch('/api/travel-records/business-meal/non-existent')
        .send({
          is_business_meal: 1,
          meal_participants: ['Alice'],
          meal_purpose: 'Meeting',
        });

      expect(res.status).toBe(404);
    });
  });
});
