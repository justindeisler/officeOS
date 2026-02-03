/**
 * Test Database Utility
 *
 * Provides in-memory SQLite database for testing the accounting feature.
 * Each test gets a fresh database instance to ensure isolation.
 */

import Database from 'better-sqlite3'

/**
 * Create an in-memory SQLite database for testing
 * Returns the raw SQLite connection
 */
export function createTestDatabase(): {
  sqlite: Database.Database
} {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:')

  // Enable foreign keys
  sqlite.pragma('foreign_keys = ON')

  // Create all tables
  initializeTestSchema(sqlite)

  return { sqlite }
}

/**
 * Initialize the database schema for testing
 */
function initializeTestSchema(sqlite: Database.Database): void {
  // Clients table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      vat_id TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Income table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      invoice_id TEXT REFERENCES invoices(id),
      description TEXT NOT NULL,
      net_amount REAL NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER DEFAULT 14,
      euer_category TEXT DEFAULT 'services',
      payment_method TEXT,
      bank_reference TEXT,
      ust_period TEXT,
      ust_reported INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Expenses table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      vendor TEXT NOT NULL,
      description TEXT NOT NULL,
      net_amount REAL NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER NOT NULL,
      euer_category TEXT NOT NULL,
      deductible_percent INTEGER DEFAULT 100,
      payment_method TEXT,
      receipt_path TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT,
      ust_period TEXT,
      vorsteuer_claimed INTEGER DEFAULT 0,
      is_gwg INTEGER DEFAULT 0,
      asset_id TEXT REFERENCES assets(id),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Invoices table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      client_id TEXT REFERENCES clients(id),
      subtotal REAL NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount REAL NOT NULL,
      total REAL NOT NULL,
      payment_date TEXT,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Invoice items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'hours',
      unit_price REAL NOT NULL,
      amount REAL NOT NULL
    )
  `)

  // Assets table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      purchase_date TEXT NOT NULL,
      vendor TEXT,
      purchase_price REAL NOT NULL,
      vat_paid REAL NOT NULL,
      gross_price REAL NOT NULL,
      afa_method TEXT DEFAULT 'linear',
      afa_years INTEGER NOT NULL,
      afa_start_date TEXT NOT NULL,
      afa_annual_amount REAL NOT NULL,
      status TEXT DEFAULT 'active',
      disposal_date TEXT,
      disposal_price REAL,
      euer_line INTEGER DEFAULT 30,
      euer_category TEXT DEFAULT 'afa_beweglich',
      category TEXT,
      inventory_number TEXT,
      location TEXT DEFAULT 'Home Office',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Depreciation schedule table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS depreciation_schedule (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      months INTEGER NOT NULL,
      amount REAL NOT NULL,
      cumulative REAL NOT NULL,
      book_value REAL NOT NULL
    )
  `)

  // EÜR categories table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS euer_categories (
      id TEXT PRIMARY KEY,
      line_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      vorsteuer_eligible INTEGER DEFAULT 1
    )
  `)

  // Settings table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Create indexes
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
    CREATE INDEX IF NOT EXISTS idx_income_client_id ON income(client_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
  `)
}

/**
 * Clear all data from the test database (keep schema)
 */
export function clearTestDatabase(sqlite: Database.Database): void {
  const tables = [
    'depreciation_schedule',
    'invoice_items',
    'income',
    'expenses',
    'invoices',
    'assets',
    'clients',
    'euer_categories',
    'settings',
  ]

  for (const table of tables) {
    sqlite.exec(`DELETE FROM ${table}`)
  }
}

/**
 * Close the test database connection
 */
export function closeTestDatabase(sqlite: Database.Database): void {
  sqlite.close()
}

/**
 * Seed EÜR categories for testing
 */
export function seedEuerCategories(sqlite: Database.Database): void {
  const categories = [
    { id: 'betriebseinnahmen', line: 14, name: 'Betriebseinnahmen', type: 'income', vorsteuer: 1 },
    { id: 'ust_erstattung', line: 18, name: 'USt-Erstattung', type: 'income', vorsteuer: 0 },
    { id: 'fremdleistungen', line: 25, name: 'Fremdleistungen', type: 'expense', vorsteuer: 1 },
    { id: 'vorsteuer', line: 27, name: 'Vorsteuer', type: 'expense', vorsteuer: 0 },
    { id: 'gezahlte_ust', line: 28, name: 'Gezahlte USt', type: 'expense', vorsteuer: 0 },
    { id: 'afa', line: 30, name: 'AfA', type: 'expense', vorsteuer: 0 },
    { id: 'arbeitszimmer', line: 33, name: 'Arbeitszimmer', type: 'expense', vorsteuer: 1 },
    { id: 'sonstige', line: 34, name: 'Sonstige Betriebsausgaben', type: 'expense', vorsteuer: 1 },
  ]

  const stmt = sqlite.prepare(`
    INSERT OR REPLACE INTO euer_categories (id, line_number, name, type, vorsteuer_eligible)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const cat of categories) {
    stmt.run(cat.id, cat.line, cat.name, cat.type, cat.vorsteuer)
  }
}
