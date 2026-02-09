/**
 * Test Setup - In-memory SQLite database for API tests
 *
 * Creates a fresh in-memory database for each test file with the real schema.
 * Mocks the database module so all routes use the test database.
 */

import Database from 'better-sqlite3';
import { vi } from 'vitest';

let testDb: Database.Database;

/**
 * Full database schema matching the production database.
 * Kept in sync with actual migrations.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    color TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    company TEXT,
    contact_info TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    password_hash TEXT,
    role TEXT DEFAULT 'client',
    last_login_at TEXT,
    assigned_projects TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog',
    priority INTEGER DEFAULT 2,
    due_date TEXT,
    completed_at TEXT,
    estimated_minutes INTEGER,
    area TEXT DEFAULT 'freelance',
    markdown_path TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    assignee TEXT,
    prd_id TEXT,
    created_by TEXT,
    quick_capture BOOLEAN DEFAULT 0,
    ai_processed BOOLEAN DEFAULT 0,
    original_capture TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'draft',
    client_id TEXT REFERENCES clients(id),
    project_id TEXT REFERENCES projects(id),
    subtotal DECIMAL(10,2) NOT NULL,
    vat_rate INTEGER DEFAULT 19,
    vat_amount DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_date DATE,
    payment_method TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pdf_path TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'hours',
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS income (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    client_id TEXT,
    invoice_id TEXT,
    description TEXT NOT NULL,
    net_amount REAL NOT NULL,
    vat_rate REAL DEFAULT 19,
    vat_amount REAL NOT NULL,
    gross_amount REAL NOT NULL,
    euer_line INTEGER DEFAULT 14,
    euer_category TEXT DEFAULT 'services',
    payment_method TEXT,
    bank_reference TEXT,
    ust_period TEXT,
    ust_reported INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    vendor TEXT,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    net_amount REAL NOT NULL,
    vat_rate REAL DEFAULT 19,
    vat_amount REAL NOT NULL,
    gross_amount REAL NOT NULL,
    euer_line INTEGER,
    euer_category TEXT,
    payment_method TEXT,
    receipt_path TEXT,
    ust_period TEXT,
    ust_reported INTEGER DEFAULT 0,
    vorsteuer_claimed INTEGER DEFAULT 0,
    deductible_percent REAL DEFAULT 100,
    is_recurring INTEGER DEFAULT 0,
    recurring_frequency TEXT,
    is_gwg INTEGER DEFAULT 0,
    asset_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    purchase_date TEXT NOT NULL,
    vendor TEXT,
    purchase_price REAL NOT NULL,
    vat_paid REAL DEFAULT 0,
    gross_price REAL NOT NULL,
    afa_method TEXT DEFAULT 'linear',
    afa_years INTEGER NOT NULL,
    afa_start_date TEXT NOT NULL,
    afa_annual_amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    disposal_date TEXT,
    disposal_price REAL,
    euer_line INTEGER DEFAULT 30,
    euer_category TEXT DEFAULT 'depreciation',
    category TEXT NOT NULL,
    inventory_number TEXT,
    location TEXT,
    bill_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS depreciation_schedule (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    year INTEGER NOT NULL,
    depreciation_amount REAL NOT NULL,
    accumulated_depreciation REAL NOT NULL,
    book_value REAL NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
  );

  CREATE TABLE IF NOT EXISTS prds (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    feature_name TEXT NOT NULL,
    version TEXT DEFAULT '1.0',
    author TEXT DEFAULT 'Justin',
    assignee TEXT,
    area TEXT DEFAULT 'personal',
    status TEXT DEFAULT 'draft',
    problem_statement TEXT,
    goals TEXT,
    non_goals TEXT,
    target_users TEXT,
    user_stories TEXT,
    requirements TEXT,
    technical_approach TEXT,
    dependencies TEXT,
    risks TEXT,
    assumptions TEXT,
    constraints TEXT,
    success_metrics TEXT,
    milestones TEXT,
    estimated_effort TEXT,
    markdown_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    suggestion_id TEXT
  );
`;

/**
 * Create a fresh in-memory test database with the full schema
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}

/**
 * Get the current test database instance
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    testDb = createTestDb();
  }
  return testDb;
}

/**
 * Reset (recreate) the test database - call in beforeEach
 */
export function resetTestDb(): Database.Database {
  if (testDb) {
    testDb.close();
  }
  testDb = createTestDb();
  return testDb;
}

/**
 * Close the test database - call in afterAll
 */
export function closeTestDb(): void {
  if (testDb) {
    testDb.close();
  }
}

/**
 * Setup database mocking for route tests.
 * Call this at the top of each route test file.
 *
 * Returns setup/teardown functions to use in beforeEach/afterAll.
 */
export function setupDbMock() {
  // Mock the database module BEFORE importing routes
  vi.mock('../database.js', () => {
    // We need a reference that can be updated
    let _db: Database.Database | null = null;

    return {
      getDb: () => {
        if (!_db) throw new Error('Test DB not initialized. Call setTestDb() in beforeEach.');
        return _db;
      },
      generateId: () => crypto.randomUUID(),
      getCurrentTimestamp: () => new Date().toISOString(),
      closeDb: () => {
        // No-op in tests
      },
      // Test helper to set the db instance
      __setTestDb: (db: Database.Database) => {
        _db = db;
      },
    };
  });

  return {
    beforeEach: () => {
      const db = resetTestDb();
      // Access the mocked module to set the db
      const dbModule = require('../database.js') as { __setTestDb: (db: Database.Database) => void };
      dbModule.__setTestDb(db);
      return db;
    },
    afterAll: () => {
      closeTestDb();
      vi.restoreAllMocks();
    },
  };
}

// ============================================================================
// Test Data Factories
// ============================================================================

let idCounter = 0;

/** Generate a unique test ID */
export function testId(prefix = 'test'): string {
  idCounter++;
  return `${prefix}-${String(idCounter).padStart(4, '0')}`;
}

/** Reset the ID counter (call in beforeEach) */
export function resetIdCounter(): void {
  idCounter = 0;
}

/** Insert a test client and return its ID */
export function insertTestClient(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    company: string;
    contact_info: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('client');
  db.prepare(
    `INSERT INTO clients (id, name, email, company, contact_info, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    id,
    overrides.name ?? 'Test Client',
    overrides.email ?? 'test@example.com',
    overrides.company ?? 'Test Corp',
    overrides.contact_info ?? null
  );
  return id;
}

/** Insert a test project and return its ID */
export function insertTestProject(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    status: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('project');
  db.prepare(
    `INSERT INTO projects (id, name, description, status) VALUES (?, ?, ?, ?)`
  ).run(id, overrides.name ?? 'Test Project', overrides.description ?? 'A test project', overrides.status ?? 'active');
  return id;
}

/** Insert a test task and return its ID */
export function insertTestTask(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    title: string;
    status: string;
    priority: number;
    area: string;
    project_id: string;
    prd_id: string;
    due_date: string;
    assignee: string;
    sort_order: number;
  }> = {}
): string {
  const id = overrides.id ?? testId('task');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (id, title, status, priority, area, project_id, prd_id, due_date, assignee, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides.title ?? 'Test Task',
    overrides.status ?? 'backlog',
    overrides.priority ?? 2,
    overrides.area ?? 'freelance',
    overrides.project_id ?? null,
    overrides.prd_id ?? null,
    overrides.due_date ?? null,
    overrides.assignee ?? null,
    overrides.sort_order ?? 0,
    now,
    now
  );
  return id;
}

/** Insert a test invoice with items and return the invoice ID */
export function insertTestInvoice(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    invoice_number: string;
    status: string;
    client_id: string;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total: number;
    invoice_date: string;
    due_date: string;
    notes: string;
  }> = {},
  items: Array<{
    description: string;
    quantity: number;
    unit?: string;
    unit_price: number;
  }> = [{ description: 'Web Development', quantity: 10, unit: 'hours', unit_price: 100 }]
): string {
  const id = overrides.id ?? testId('invoice');
  const subtotal = overrides.subtotal ?? items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const vatRate = overrides.vat_rate ?? 19;
  const vatAmount = overrides.vat_amount ?? Math.round(subtotal * (vatRate / 100) * 100) / 100;
  const total = overrides.total ?? Math.round((subtotal + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO invoices (id, invoice_number, invoice_date, due_date, status, client_id, subtotal, vat_rate, vat_amount, total, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.invoice_number ?? `RE-2024-${String(idCounter).padStart(3, '0')}`,
    overrides.invoice_date ?? '2024-01-15',
    overrides.due_date ?? '2024-01-29',
    overrides.status ?? 'draft',
    overrides.client_id ?? null,
    subtotal,
    vatRate,
    vatAmount,
    total,
    overrides.notes ?? null
  );

  // Insert items
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const item of items) {
    const amount = Math.round(item.quantity * item.unit_price * 100) / 100;
    insertItem.run(testId('item'), id, item.description, item.quantity, item.unit ?? 'hours', item.unit_price, amount);
  }

  return id;
}

/** Insert a test income record and return its ID */
export function insertTestIncome(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    date: string;
    client_id: string;
    invoice_id: string;
    description: string;
    net_amount: number;
    vat_rate: number;
    vat_amount: number;
    gross_amount: number;
    euer_line: number;
    euer_category: string;
    ust_period: string;
    ust_reported: number;
  }> = {}
): string {
  const id = overrides.id ?? testId('income');
  const netAmount = overrides.net_amount ?? 1000;
  const vatRate = overrides.vat_rate ?? 19;
  const vatAmount = overrides.vat_amount ?? Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const grossAmount = overrides.gross_amount ?? Math.round((netAmount + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO income (id, date, client_id, invoice_id, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, ust_period, ust_reported, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.date ?? '2024-01-15',
    overrides.client_id ?? null,
    overrides.invoice_id ?? null,
    overrides.description ?? 'Test Income',
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    overrides.euer_line ?? 14,
    overrides.euer_category ?? 'services',
    overrides.ust_period ?? null,
    overrides.ust_reported ?? 0
  );
  return id;
}

/** Insert a test expense record and return its ID */
export function insertTestExpense(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    date: string;
    vendor: string;
    description: string;
    category: string;
    net_amount: number;
    vat_rate: number;
    vat_amount: number;
    gross_amount: number;
    euer_line: number;
    euer_category: string;
    vorsteuer_claimed: number;
    deductible_percent: number;
    ust_period: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('expense');
  const netAmount = overrides.net_amount ?? 500;
  const vatRate = overrides.vat_rate ?? 19;
  const vatAmount = overrides.vat_amount ?? Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const grossAmount = overrides.gross_amount ?? Math.round((netAmount + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, vorsteuer_claimed, deductible_percent, ust_period, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.date ?? '2024-01-15',
    overrides.vendor ?? 'Test Vendor',
    overrides.description ?? 'Test Expense',
    overrides.category ?? 'software',
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    overrides.euer_line ?? 27,
    overrides.euer_category ?? null,
    overrides.vorsteuer_claimed ?? 0,
    overrides.deductible_percent ?? 100,
    overrides.ust_period ?? null
  );
  return id;
}
