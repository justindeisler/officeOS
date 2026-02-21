/**
 * ELSTER Integration Tests
 * 
 * Tests USt-VA calculation, ZM generation, and submission management.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, resetTestDb, closeTestDb, resetIdCounter, insertTestIncome, insertTestExpense, insertTestClient } from '../../../src/test/setup.js';
import {
  calculateUstVa,
  generateUstVaXml,
  calculateZm,
  generateZmXml,
  createSubmission,
  updateSubmissionStatus,
  getSubmissions,
} from '../../services/elsterService.js';

// Mock database module
vi.mock('../../database.js', () => ({
  generateId: () => crypto.randomUUID(),
  getCurrentTimestamp: () => new Date().toISOString(),
  getDb: () => { throw new Error('Use db directly'); },
  closeDb: () => {},
}));

let db: Database.Database;

beforeEach(() => {
  db = resetTestDb();
  resetIdCounter();
});

afterAll(() => {
  closeTestDb();
});

// ============================================================================
// USt-VA Calculation Tests
// ============================================================================

describe('USt-VA Calculation', () => {
  it('should calculate quarterly USt-VA correctly', () => {
    // Add income in Q1
    insertTestIncome(db, { date: '2025-01-15', net_amount: 5000, vat_rate: 19 });
    insertTestIncome(db, { date: '2025-02-15', net_amount: 3000, vat_rate: 19 });
    insertTestIncome(db, { date: '2025-03-10', net_amount: 1000, vat_rate: 7 });

    // Add expenses in Q1
    insertTestExpense(db, { date: '2025-01-20', net_amount: 500, vat_rate: 19, category: 'software' });
    insertTestExpense(db, { date: '2025-02-10', net_amount: 200, vat_rate: 19, category: 'hosting' });

    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');

    // 19% base: 5000 + 3000 = 8000
    expect(data.kz81).toBe(8000);
    // 7% base: 1000
    expect(data.kz86).toBe(1000);
    // 19% tax: 8000 * 0.19 = 1520
    expect(data.kz36_tax).toBe(1520);
    // 7% tax: 1000 * 0.07 = 70
    expect(data.kz35_tax).toBe(70);
    // Vorsteuer: (500 + 200) * 0.19 = 133
    expect(data.kz66).toBe(133);
    // Zahllast: 1520 + 70 - 133 = 1457
    expect(data.kz83).toBe(1457);
  });

  it('should calculate monthly USt-VA', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 5000, vat_rate: 19 });

    const data = calculateUstVa(db, 2025, '01', 'monthly');

    expect(data.kz81).toBe(5000);
    expect(data.kz36_tax).toBe(950);
    expect(data.period).toBe('01');
    expect(data.periodType).toBe('monthly');
  });

  it('should exclude non-vorsteuer categories from Vorsteuer', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000, vat_rate: 19 });
    // Insurance is not Vorsteuer-eligible
    insertTestExpense(db, { date: '2025-01-20', net_amount: 500, vat_rate: 19, category: 'insurance' });
    // Software is eligible
    insertTestExpense(db, { date: '2025-01-20', net_amount: 300, vat_rate: 19, category: 'software' });

    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');

    // Only software Vorsteuer: 300 * 0.19 = 57
    expect(data.kz66).toBe(57);
  });

  it('should apply deductible percent to Vorsteuer', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000, vat_rate: 19 });
    // 70% deductible expense (e.g., business meal)
    insertTestExpense(db, {
      date: '2025-01-20', net_amount: 100, vat_rate: 19,
      category: 'travel', deductible_percent: 70,
    });

    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');

    // Vorsteuer: 100 * 0.19 * 0.70 = 13.30
    expect(data.kz66).toBe(13.3);
  });

  it('should handle negative Zahllast (Vorsteuerüberhang)', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 100, vat_rate: 19 });
    insertTestExpense(db, { date: '2025-01-20', net_amount: 5000, vat_rate: 19, category: 'software' });

    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');

    // Tax: 100 * 0.19 = 19
    // Vorsteuer: 5000 * 0.19 = 950
    // Zahllast: 19 - 950 = -931 (refund)
    expect(data.kz83).toBe(-931);
  });
});

// ============================================================================
// USt-VA XML Generation Tests
// ============================================================================

describe('USt-VA XML Generation', () => {
  it('should generate valid ELSTER XML', () => {
    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');
    // Add some data
    insertTestIncome(db, { date: '2025-01-15', net_amount: 5000, vat_rate: 19 });
    const dataWithRecords = calculateUstVa(db, 2025, 'Q1', 'quarterly');
    const xml = generateUstVaXml(dataWithRecords);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<DatenArt>UStVA</DatenArt>');
    expect(xml).toContain('<Jahr>2025</Jahr>');
    expect(xml).toContain('Kz81');
    expect(xml).toContain('Kz83');
  });

  it('should include Steuernummer when configured', () => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('tax_number', '143/123/12345')").run();
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000, vat_rate: 19 });

    const data = calculateUstVa(db, 2025, 'Q1', 'quarterly');
    const xml = generateUstVaXml(data);

    expect(xml).toContain('<Steuernummer>143/123/12345</Steuernummer>');
  });
});

// ============================================================================
// ZM Tests
// ============================================================================

describe('ZM (Zusammenfassende Meldung)', () => {
  it('should aggregate EU client transactions', () => {
    // Create EU client
    const clientId = insertTestClient(db, {
      name: 'EU Client',
      company: 'EU Company BV',
    });
    // Set EU flags
    db.prepare('UPDATE clients SET vat_id = ?, country_code = ?, is_eu_business = 1 WHERE id = ?')
      .run('NL123456789B01', 'NL', clientId);

    // Add income from EU client
    insertTestIncome(db, { date: '2025-01-15', net_amount: 5000, vat_rate: 0, client_id: clientId });
    insertTestIncome(db, { date: '2025-02-20', net_amount: 3000, vat_rate: 0, client_id: clientId });

    const data = calculateZm(db, 2025, 1);

    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].vatId).toBe('NL123456789B01');
    expect(data.entries[0].countryCode).toBe('NL');
    expect(data.entries[0].totalAmount).toBe(8000);
  });

  it('should exclude domestic clients', () => {
    // Create domestic client
    const clientId = insertTestClient(db, { name: 'German Client' });
    db.prepare('UPDATE clients SET country_code = ?, is_eu_business = 0 WHERE id = ?')
      .run('DE', clientId);

    insertTestIncome(db, { date: '2025-01-15', net_amount: 5000, client_id: clientId });

    const data = calculateZm(db, 2025, 1);
    expect(data.entries).toHaveLength(0);
  });

  it('should generate ZM XML', () => {
    const clientId = insertTestClient(db, { name: 'EU Client' });
    db.prepare('UPDATE clients SET vat_id = ?, country_code = ?, is_eu_business = 1 WHERE id = ?')
      .run('AT12345678', 'AT', clientId);
    insertTestIncome(db, { date: '2025-01-15', net_amount: 2000, vat_rate: 0, client_id: clientId });

    const data = calculateZm(db, 2025, 1);
    const xml = generateZmXml(data);

    expect(xml).toContain('<DatenArt>ZM</DatenArt>');
    expect(xml).toContain('quartal="1"');
    expect(xml).toContain('<UStIdNr>AT12345678</UStIdNr>');
    expect(xml).toContain('<Land>AT</Land>');
    expect(xml).toContain('<Betrag>2000.00</Betrag>');
  });
});

// ============================================================================
// Submission Management Tests
// ============================================================================

describe('Submission Management', () => {
  it('should create a draft submission', () => {
    const submission = createSubmission(db, 'ust_va', '2025-Q1', '<xml/>', { test: true }, true);

    expect(submission.type).toBe('ust_va');
    expect(submission.period).toBe('2025-Q1');
    expect(submission.status).toBe('draft');
    expect(submission.test_mode).toBe(1);
  });

  it('should update submission status', () => {
    const submission = createSubmission(db, 'ust_va', '2025-Q1', '<xml/>', {}, true);

    updateSubmissionStatus(db, submission.id, 'submitted', undefined, 'TT-123456');

    const updated = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(submission.id) as any;
    expect(updated.status).toBe('submitted');
    expect(updated.transfer_ticket).toBe('TT-123456');
    expect(updated.submitted_at).toBeTruthy();
  });

  it('should track accepted submissions', () => {
    const submission = createSubmission(db, 'ust_va', '2025-Q1', '<xml/>', {}, true);
    updateSubmissionStatus(db, submission.id, 'accepted');

    const updated = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(submission.id) as any;
    expect(updated.status).toBe('accepted');
    expect(updated.accepted_at).toBeTruthy();
  });

  it('should track rejected submissions with error', () => {
    const submission = createSubmission(db, 'ust_va', '2025-Q1', '<xml/>', {}, true);
    updateSubmissionStatus(db, submission.id, 'rejected', '<error/>', undefined, 'Invalid tax number');

    const updated = db.prepare('SELECT * FROM elster_submissions WHERE id = ?').get(submission.id) as any;
    expect(updated.status).toBe('rejected');
    expect(updated.error_message).toBe('Invalid tax number');
  });

  it('should list submissions with filters', () => {
    createSubmission(db, 'ust_va', '2025-Q1', '<xml/>', {});
    createSubmission(db, 'ust_va', '2025-Q2', '<xml/>', {});
    createSubmission(db, 'zm', '2025-Q1', '<xml/>', {});

    const all = getSubmissions(db);
    expect(all).toHaveLength(3);

    const ustVaOnly = getSubmissions(db, { type: 'ust_va' });
    expect(ustVaOnly).toHaveLength(2);

    const q1Only = getSubmissions(db, { period: '2025-Q1' });
    expect(q1Only).toHaveLength(2);
  });
});
