/**
 * Clients API Route Tests
 *
 * Tests client CRUD operations, filtering, and address fields.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestClient,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(() => null),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  cacheKey: (...parts: unknown[]) => parts.join(':'),
  TTL: { CLIENTS: 600000 },
}));

import { createTestApp } from '../../test/app.js';
import clientsRouter from '../clients.js';
import request from 'supertest';

const app = createTestApp(clientsRouter, '/api/clients');

// ============================================================================
// Tests
// ============================================================================

describe('Clients API', () => {
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

  // ==========================================================================
  // GET /api/clients
  // ==========================================================================

  describe('GET /api/clients', () => {
    it('returns empty array when no clients exist', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns all clients sorted by name', async () => {
      insertTestClient(testDb, { name: 'Zebra Corp' });
      insertTestClient(testDb, { name: 'Alpha Inc' });
      insertTestClient(testDb, { name: 'Mega Co' });

      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      expect(res.body[0].name).toBe('Alpha Inc');
      expect(res.body[2].name).toBe('Zebra Corp');
    });

    it('filters by status', async () => {
      insertTestClient(testDb, { name: 'Active Client' });
      const inactiveId = insertTestClient(testDb, { name: 'Inactive Client' });
      testDb.prepare("UPDATE clients SET status = 'inactive' WHERE id = ?").run(inactiveId);

      const res = await request(app).get('/api/clients?status=active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Active Client');
    });

    it('returns address as null when no address set', async () => {
      insertTestClient(testDb, { name: 'No Address' });

      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(200);
      expect(res.body[0].address).toBeNull();
    });

    it('returns nested address object when address is set', async () => {
      insertTestClient(testDb, {
        name: 'Address Client',
        address_street: 'Hauptstraße 1',
        address_zip: '10115',
        address_city: 'Berlin',
        address_country: 'Deutschland',
      });

      const res = await request(app).get('/api/clients');
      expect(res.status).toBe(200);
      expect(res.body[0].address).toEqual({
        street: 'Hauptstraße 1',
        zip: '10115',
        city: 'Berlin',
        country: 'Deutschland',
      });
    });
  });

  // ==========================================================================
  // GET /api/clients/:id
  // ==========================================================================

  describe('GET /api/clients/:id', () => {
    it('returns a single client', async () => {
      const id = insertTestClient(testDb, {
        name: 'Test Client',
        email: 'test@example.com',
        company: 'Test Corp',
      });

      const res = await request(app).get(`/api/clients/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Client');
      expect(res.body.email).toBe('test@example.com');
      expect(res.body.company).toBe('Test Corp');
    });

    it('returns nested address object', async () => {
      const id = insertTestClient(testDb, {
        name: 'Addressed Client',
        address_street: 'Musterstr. 5',
        address_zip: '80333',
        address_city: 'München',
      });

      const res = await request(app).get(`/api/clients/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.address).toMatchObject({
        street: 'Musterstr. 5',
        zip: '80333',
        city: 'München',
      });
    });

    it('returns 404 for non-existent client', async () => {
      const res = await request(app).get('/api/clients/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/clients
  // ==========================================================================

  describe('POST /api/clients', () => {
    it('creates a client with name only', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ name: 'New Client' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Client');
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('active');
    });

    it('creates a client with all scalar fields', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({
          name: 'Full Client',
          email: 'full@example.com',
          company: 'Full Corp',
          contact_info: '123-456-7890',
          notes: 'Important client',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Full Client');
      expect(res.body.email).toBe('full@example.com');
      expect(res.body.company).toBe('Full Corp');
      expect(res.body.notes).toBe('Important client');
    });

    it('creates a client with nested address object', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({
          name: 'Address Client',
          address: {
            street: 'Berliner Str. 10',
            zip: '10117',
            city: 'Berlin',
            country: 'Deutschland',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.address).toEqual({
        street: 'Berliner Str. 10',
        zip: '10117',
        city: 'Berlin',
        country: 'Deutschland',
      });
    });

    it('does not include address_ flat fields in response', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({
          name: 'Clean Response',
          address: { street: 'Test 1', zip: '12345', city: 'Teststadt' },
        });

      expect(res.status).toBe(201);
      expect(res.body.address_street).toBeUndefined();
      expect(res.body.address_zip).toBeUndefined();
      expect(res.body.address_city).toBeUndefined();
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ email: 'no-name@test.com' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // PATCH /api/clients/:id
  // ==========================================================================

  describe('PATCH /api/clients/:id', () => {
    it('updates client scalar fields', async () => {
      const id = insertTestClient(testDb, { name: 'Original Name' });

      const res = await request(app)
        .patch(`/api/clients/${id}`)
        .send({ name: 'Updated Name', email: 'updated@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.email).toBe('updated@test.com');
    });

    it('updates address via nested object', async () => {
      const id = insertTestClient(testDb, { name: 'Client' });

      const res = await request(app)
        .patch(`/api/clients/${id}`)
        .send({
          address: {
            street: 'Neue Straße 99',
            zip: '50667',
            city: 'Köln',
            country: 'Deutschland',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.address).toMatchObject({
        street: 'Neue Straße 99',
        zip: '50667',
        city: 'Köln',
        country: 'Deutschland',
      });
    });

    it('partially updates client', async () => {
      const id = insertTestClient(testDb, {
        name: 'Client',
        email: 'original@test.com',
        company: 'Original Corp',
      });

      const res = await request(app)
        .patch(`/api/clients/${id}`)
        .send({ email: 'new@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Client');
      expect(res.body.email).toBe('new@test.com');
      expect(res.body.company).toBe('Original Corp');
    });

    it('returns 404 for non-existent client', async () => {
      const res = await request(app)
        .patch('/api/clients/nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // DELETE /api/clients/:id
  // ==========================================================================

  describe('DELETE /api/clients/:id', () => {
    it('deletes a client', async () => {
      const id = insertTestClient(testDb, { name: 'To Delete' });

      const res = await request(app).delete(`/api/clients/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('To Delete');

      // Verify deleted
      const check = await request(app).get(`/api/clients/${id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent client', async () => {
      const res = await request(app).delete('/api/clients/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
