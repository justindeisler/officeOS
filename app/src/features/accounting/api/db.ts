/**
 * SQLite Database Connection (Tauri SQL Plugin)
 *
 * Provides database connection for the accounting feature.
 * Uses @tauri-apps/plugin-sql for SQLite operations in Tauri.
 *
 * NOTE: Dynamic import to avoid blocking React mount.
 */

import type Database from '@tauri-apps/plugin-sql';

// Singleton database instance
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

/**
 * Get the database instance (lazy initialization)
 * Ensures tables are created on first access
 */
export async function getDb(): Promise<Database> {
  if (db) return db;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    const { default: Database } = await import('@tauri-apps/plugin-sql');
    db = await Database.load('sqlite:personal-assistant.db');
    await initializeTables(db);
    return db;
  })();

  return initPromise;
}

/**
 * Initialize the database with all tables
 * Called automatically on first database access
 */
async function initializeTables(database: Database): Promise<void> {
  // Clients table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      vat_id TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Income table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      client_id TEXT REFERENCES clients(id),
      invoice_id TEXT REFERENCES invoices(id),
      description TEXT NOT NULL,
      net_amount DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      gross_amount DECIMAL(10,2) NOT NULL,
      euer_line INTEGER DEFAULT 14,
      euer_category TEXT DEFAULT 'services',
      payment_method TEXT,
      bank_reference TEXT,
      ust_period TEXT,
      ust_reported BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Expenses table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date DATE NOT NULL,
      vendor TEXT NOT NULL,
      description TEXT NOT NULL,
      net_amount DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      gross_amount DECIMAL(10,2) NOT NULL,
      euer_line INTEGER NOT NULL,
      euer_category TEXT NOT NULL,
      deductible_percent INTEGER DEFAULT 100,
      payment_method TEXT,
      receipt_path TEXT,
      is_recurring BOOLEAN DEFAULT FALSE,
      recurring_frequency TEXT,
      ust_period TEXT,
      vorsteuer_claimed BOOLEAN DEFAULT FALSE,
      is_gwg BOOLEAN DEFAULT FALSE,
      asset_id TEXT REFERENCES assets(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invoices table
  await database.execute(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Invoice items table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit TEXT DEFAULT 'hours',
      unit_price DECIMAL(10,2) NOT NULL,
      amount DECIMAL(10,2) NOT NULL
    )
  `);

  // Assets table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      purchase_date DATE NOT NULL,
      vendor TEXT,
      purchase_price DECIMAL(10,2) NOT NULL,
      vat_paid DECIMAL(10,2) NOT NULL,
      gross_price DECIMAL(10,2) NOT NULL,
      afa_method TEXT DEFAULT 'linear',
      afa_years INTEGER NOT NULL,
      afa_start_date DATE NOT NULL,
      afa_annual_amount DECIMAL(10,2) NOT NULL,
      status TEXT DEFAULT 'active',
      disposal_date DATE,
      disposal_price DECIMAL(10,2),
      euer_line INTEGER DEFAULT 30,
      euer_category TEXT DEFAULT 'afa_beweglich',
      category TEXT,
      inventory_number TEXT,
      location TEXT DEFAULT 'Home Office',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Depreciation schedule table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS depreciation_schedule (
      id TEXT PRIMARY KEY,
      asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      months INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      cumulative DECIMAL(10,2) NOT NULL,
      book_value DECIMAL(10,2) NOT NULL
    )
  `);

  // EÜR categories table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS euer_categories (
      id TEXT PRIMARY KEY,
      line_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      vorsteuer_eligible BOOLEAN DEFAULT TRUE
    )
  `);

  // Settings table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create indexes for common queries
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_income_date ON income(date)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_income_client_id ON income(client_id)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_income_ust_period ON income(ust_period)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_euer_category ON expenses(euer_category)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_expenses_ust_period ON expenses(ust_period)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)`);
  await database.execute(`CREATE INDEX IF NOT EXISTS idx_depreciation_asset_id ON depreciation_schedule(asset_id)`);

  // Run migrations for schema updates
  await runMigrations(database);
}

/**
 * Run database migrations for schema updates
 * Each migration checks if it needs to run before executing
 */
async function runMigrations(database: Database): Promise<void> {
  // Migration: Add bill_path column to assets table
  await addColumnIfNotExists(database, 'assets', 'bill_path', 'TEXT');

  // Migration: Transform old invoices schema to new accounting schema
  // The main lib/db.ts may have created invoices table with old column names
  // Check for 'amount' column which is from the old schema (new schema uses 'subtotal')
  const columns = await database.select<{ name: string }[]>(
    "PRAGMA table_info(invoices)"
  );
  const columnNames = columns.map((c) => c.name);
  const hasOldSchema = columnNames.includes('amount') || columnNames.includes('total_amount');

  if (hasOldSchema) {
    console.log('Migrating invoices table from old schema to new accounting schema...');

    // 1. Create new table with correct schema
    await database.execute(`
      CREATE TABLE invoices_new (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Copy data mapping old columns to new
    // Use COALESCE to handle cases where both old and new columns might exist
    await database.execute(`
      INSERT INTO invoices_new (
        id, invoice_number, invoice_date, due_date, status, client_id, project_id,
        subtotal, vat_rate, vat_amount, total, payment_date, notes, created_at
      )
      SELECT
        id,
        invoice_number,
        COALESCE(invoice_date, issue_date),
        due_date,
        status,
        client_id,
        project_id,
        COALESCE(subtotal, amount, 0),
        COALESCE(vat_rate, tax_rate, 19),
        COALESCE(vat_amount, tax_amount, 0),
        COALESCE(total, total_amount, 0),
        COALESCE(payment_date, paid_date),
        notes,
        created_at
      FROM invoices
    `);

    // 3. Drop old table and rename new
    await database.execute('DROP TABLE invoices');
    await database.execute('ALTER TABLE invoices_new RENAME TO invoices');

    // 4. Recreate indexes
    await database.execute('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
    await database.execute('CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)');

    console.log('Invoices table migration completed');
  }

  // Migration: Ensure invoices table has all required columns
  // This handles cases where columns are missing
  await addColumnIfNotExists(database, 'invoices', 'invoice_date', 'DATE');
  await addColumnIfNotExists(database, 'invoices', 'due_date', 'DATE');
  await addColumnIfNotExists(database, 'invoices', 'status', "TEXT DEFAULT 'draft'");
  await addColumnIfNotExists(database, 'invoices', 'client_id', 'TEXT');
  await addColumnIfNotExists(database, 'invoices', 'subtotal', 'DECIMAL(10,2)');
  await addColumnIfNotExists(database, 'invoices', 'vat_rate', 'INTEGER DEFAULT 19');
  await addColumnIfNotExists(database, 'invoices', 'vat_amount', 'DECIMAL(10,2)');
  await addColumnIfNotExists(database, 'invoices', 'total', 'DECIMAL(10,2)');
  await addColumnIfNotExists(database, 'invoices', 'payment_date', 'DATE');
  await addColumnIfNotExists(database, 'invoices', 'payment_method', 'TEXT');
  await addColumnIfNotExists(database, 'invoices', 'notes', 'TEXT');

  // Migration: Add project_id to invoices for project tracking
  await addColumnIfNotExists(database, 'invoices', 'project_id', 'TEXT');
}

/**
 * Safely add a column to a table if it doesn't exist
 */
async function addColumnIfNotExists(
  database: Database,
  table: string,
  column: string,
  type: string
): Promise<void> {
  try {
    // Check if column exists by querying table info
    const columns = await database.select<{ name: string }[]>(
      `PRAGMA table_info(${table})`
    );
    const columnExists = columns.some((col) => col.name === column);

    if (!columnExists) {
      await database.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`Migration: Added ${column} column to ${table} table`);
    }
  } catch (error) {
    console.error(`Migration failed for ${table}.${column}:`, error);
  }
}

/**
 * Close the database connection
 * Call this on application shutdown
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    initPromise = null;
  }
}
