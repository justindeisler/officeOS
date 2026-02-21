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
    assigned_projects TEXT,
    address_street TEXT,
    address_zip TEXT,
    address_city TEXT,
    address_country TEXT DEFAULT 'Deutschland',
    vat_id TEXT,
    country_code TEXT DEFAULT 'DE',
    is_eu_business INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    budget_amount REAL,
    budget_currency TEXT DEFAULT 'EUR',
    start_date TEXT,
    target_end_date TEXT,
    actual_end_date TEXT,
    area TEXT DEFAULT 'freelance',
    markdown_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    client_visible BOOLEAN DEFAULT 0,
    assigned_client_ids TEXT,
    codebase_path TEXT,
    github_repo TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area);
  CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);

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
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_area ON tasks(area);

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS task_tags (
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id),
    project_id TEXT REFERENCES projects(id),
    client_id TEXT REFERENCES clients(id),
    category TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes INTEGER,
    is_running INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(start_time);
  CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);

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
    pdf_path TEXT,
    einvoice_format TEXT,
    einvoice_xml TEXT,
    einvoice_valid INTEGER,
    leitweg_id TEXT,
    buyer_reference TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'hours',
    unit_price DECIMAL(10,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL
  );

  CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'note',
    processed INTEGER DEFAULT 0,
    processed_to TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processing_status TEXT DEFAULT 'pending',
    processed_by TEXT,
    artifact_type TEXT,
    artifact_id TEXT,
    source TEXT DEFAULT 'manual',
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
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
    reference_number TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );
  CREATE INDEX IF NOT EXISTS idx_income_reference ON income(reference_number);

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
    deductible_percent INTEGER DEFAULT 100,
    vorsteuer_claimed INTEGER DEFAULT 0,
    is_recurring INTEGER DEFAULT 0,
    recurring_frequency TEXT,
    is_gwg INTEGER DEFAULT 0,
    asset_id TEXT REFERENCES assets(id),
    attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
    reference_number TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference_number);

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    purchase_price REAL NOT NULL,
    useful_life_years INTEGER NOT NULL,
    depreciation_method TEXT DEFAULT 'linear',
    salvage_value REAL DEFAULT 0,
    current_value REAL,
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL,
    disposal_date TEXT,
    disposal_price REAL,
    disposal_reason TEXT,
    vendor TEXT,
    vat_paid REAL DEFAULT 0,
    gross_price REAL,
    inventory_number TEXT,
    location TEXT,
    bill_path TEXT,
    euer_line INTEGER DEFAULT 30,
    euer_category TEXT DEFAULT 'depreciation',
    afa_start_date TEXT
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
    suggestion_id TEXT REFERENCES suggestions(id)
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    project_name TEXT,
    type TEXT CHECK(type IN ('improvement', 'feature', 'fix', 'refactor', 'security')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 2,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'implemented')) DEFAULT 'pending',
    prd_id TEXT,
    task_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    decided_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (prd_id) REFERENCES prds(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  );

  CREATE TABLE IF NOT EXISTS suggestion_comments (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Justin Deisler',
    comment_text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (suggestion_id) REFERENCES suggestions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_suggestion_comments_suggestion_id ON suggestion_comments(suggestion_id);

  CREATE TABLE IF NOT EXISTS james_actions (
    id TEXT PRIMARY KEY,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    project_id TEXT,
    task_id TEXT,
    suggestion_id TEXT,
    prd_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS james_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK(status IN ('backlog', 'queue', 'in_progress', 'done')) DEFAULT 'backlog',
    priority INTEGER DEFAULT 2,
    source TEXT,
    source_id TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS james_automations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    schedule TEXT NOT NULL,
    schedule_human TEXT,
    type TEXT DEFAULT 'cron',
    enabled INTEGER DEFAULT 1,
    last_run TEXT,
    next_run TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_activity (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    type TEXT CHECK(type IN ('commit', 'pr', 'issue')) NOT NULL,
    repo_name TEXT NOT NULL,
    sha TEXT,
    number INTEGER,
    title TEXT,
    description TEXT,
    author TEXT,
    url TEXT,
    created_at TEXT NOT NULL,
    closed_at TEXT,
    merged_at TEXT,
    additions INTEGER,
    deletions INTEGER,
    estimated_minutes INTEGER,
    imported_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_github_activity_project ON github_activity(project_id);
  CREATE INDEX IF NOT EXISTS idx_github_activity_type ON github_activity(type);
  CREATE INDEX IF NOT EXISTS idx_github_activity_repo ON github_activity(repo_name);
  CREATE INDEX IF NOT EXISTS idx_github_activity_created ON github_activity(created_at);
  CREATE INDEX IF NOT EXISTS idx_github_activity_sha ON github_activity(sha);

  CREATE TABLE IF NOT EXISTS github_sync_log (
    id TEXT PRIMARY KEY,
    repo_name TEXT NOT NULL,
    sync_type TEXT CHECK(sync_type IN ('manual', 'scheduled')) NOT NULL DEFAULT 'manual',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    commits_imported INTEGER DEFAULT 0,
    prs_imported INTEGER DEFAULT 0,
    issues_imported INTEGER DEFAULT 0,
    errors TEXT,
    status TEXT CHECK(status IN ('running', 'completed', 'failed')) NOT NULL DEFAULT 'running'
  );
  CREATE INDEX IF NOT EXISTS idx_github_sync_log_repo ON github_sync_log(repo_name);

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    stored_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    thumbnail_path TEXT,
    checksum TEXT,
    retention_type TEXT DEFAULT 'receipt',
    retention_until TEXT,
    deletion_blocked INTEGER DEFAULT 1,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_expense_id ON attachments(expense_id);
  CREATE INDEX IF NOT EXISTS idx_attachments_checksum ON attachments(checksum);

  CREATE TABLE IF NOT EXISTS ocr_extractions (
    id TEXT PRIMARY KEY,
    attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
    expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    vendor_name TEXT,
    vendor_confidence REAL,
    invoice_number TEXT,
    invoice_number_confidence REAL,
    invoice_date TEXT,
    invoice_date_confidence REAL,
    net_amount REAL,
    net_amount_confidence REAL,
    vat_rate REAL,
    vat_rate_confidence REAL,
    vat_amount REAL,
    vat_amount_confidence REAL,
    gross_amount REAL,
    gross_amount_confidence REAL,
    currency TEXT DEFAULT 'EUR',
    currency_confidence REAL,
    raw_text TEXT,
    raw_response TEXT,
    line_items TEXT,
    processing_time_ms INTEGER,
    error_message TEXT,
    is_credit_note INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ocr_extractions_attachment_id ON ocr_extractions(attachment_id);
  CREATE INDEX IF NOT EXISTS idx_ocr_extractions_expense_id ON ocr_extractions(expense_id);

  CREATE TABLE IF NOT EXISTS vendor_mappings (
    id TEXT PRIMARY KEY,
    ocr_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    default_category TEXT,
    default_vat_rate INTEGER,
    use_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_vendor_mappings_ocr_name ON vendor_mappings(ocr_name);

  CREATE TABLE IF NOT EXISTS social_media_posts (
    id TEXT PRIMARY KEY,
    platform TEXT CHECK(platform IN ('linkedin', 'instagram')) NOT NULL,
    status TEXT CHECK(status IN ('suggested', 'approved', 'scheduled', 'published', 'rejected')) DEFAULT 'suggested',
    content_text TEXT NOT NULL,
    visual_path TEXT,
    visual_type TEXT,
    scheduled_date TEXT,
    published_date TEXT,
    source TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_social_media_posts_platform ON social_media_posts(platform);
  CREATE INDEX IF NOT EXISTS idx_social_media_posts_status ON social_media_posts(status);
  CREATE INDEX IF NOT EXISTS idx_social_media_posts_scheduled_date ON social_media_posts(scheduled_date);

  CREATE TABLE IF NOT EXISTS api_usage (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    operation TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    cost_eur REAL,
    metadata TEXT,
    usage_quantity REAL,
    usage_unit TEXT,
    input_quantity REAL,
    output_quantity REAL,
    success INTEGER DEFAULT 1,
    source TEXT,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
  CREATE INDEX IF NOT EXISTS idx_api_usage_service ON api_usage(service);
  CREATE INDEX IF NOT EXISTS idx_api_usage_service_timestamp ON api_usage(service, timestamp);

  CREATE TABLE IF NOT EXISTS weekly_reviews (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    accomplishments TEXT,
    challenges TEXT,
    learnings TEXT,
    next_week_focus TEXT,
    energy_level TEXT,
    stress_level TEXT,
    notes TEXT,
    metrics TEXT,
    markdown_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- GoBD: Audit Trail (immutable)
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    user_id TEXT DEFAULT 'system',
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);

  -- GoBD: Period Locking
  CREATE TABLE IF NOT EXISTS period_locks (
    id TEXT PRIMARY KEY,
    period_type TEXT NOT NULL,
    period_key TEXT NOT NULL UNIQUE,
    locked_at TEXT NOT NULL,
    locked_by TEXT DEFAULT 'system',
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_period_locks_key ON period_locks(period_key);

  -- GoBD: Sequence Counters
  CREATE TABLE IF NOT EXISTS sequence_counters (
    prefix TEXT PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    address_street: string;
    address_zip: string;
    address_city: string;
    address_country: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('client');
  db.prepare(
    `INSERT INTO clients (id, name, email, company, contact_info, address_street, address_zip, address_city, address_country, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(
    id,
    overrides.name ?? 'Test Client',
    overrides.email ?? 'test@example.com',
    overrides.company ?? 'Test Corp',
    overrides.contact_info ?? null,
    overrides.address_street ?? null,
    overrides.address_zip ?? null,
    overrides.address_city ?? null,
    overrides.address_country ?? 'Deutschland'
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

/** Insert a test asset and return its ID */
export function insertTestAsset(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    category: string;
    purchase_date: string;
    purchase_price: number;
    useful_life_years: number;
    depreciation_method: string;
    salvage_value: number;
    current_value: number;
    status: string;
  }> = {}
): string {
  const id = overrides.id ?? testId('asset');
  const purchasePrice = overrides.purchase_price ?? 3000;
  db.prepare(
    `INSERT INTO assets (id, name, description, category, purchase_date, purchase_price,
     useful_life_years, depreciation_method, salvage_value, current_value, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.name ?? 'Test Asset',
    overrides.description ?? 'A test asset',
    overrides.category ?? 'equipment',
    overrides.purchase_date ?? '2024-01-15',
    purchasePrice,
    overrides.useful_life_years ?? 3,
    overrides.depreciation_method ?? 'linear',
    overrides.salvage_value ?? 0,
    overrides.current_value ?? purchasePrice,
    overrides.status ?? 'active'
  );
  return id;
}

/** Insert a test depreciation schedule entry and return its ID */
export function insertTestDepreciation(
  db: Database.Database,
  overrides: {
    asset_id: string;
    year: number;
    depreciation_amount: number;
    accumulated_depreciation?: number;
    book_value?: number;
  }
): string {
  const id = testId('dep');
  db.prepare(
    `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides.asset_id,
    overrides.year,
    overrides.depreciation_amount,
    overrides.accumulated_depreciation ?? overrides.depreciation_amount,
    overrides.book_value ?? 0
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
