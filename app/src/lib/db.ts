// Type-only import - doesn't execute code at module load time
import type Database from "@tauri-apps/plugin-sql";

// Using `any` here because the actual Database class is loaded dynamically
let db: Database | null = null;

// Check if running in Tauri environment
// Note: Tauri v2 uses __TAURI__, not __TAURI_INTERNALS__ (which was v1)
function isTauri(): boolean {
  return typeof window !== 'undefined' &&
         '__TAURI__' in window &&
         !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

// Wait for Tauri IPC bridge to be ready
async function waitForTauri(timeout = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (isTauri()) {
      console.log("[DB] Tauri runtime detected");
      return true;
    }
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    console.log("[DB] Starting database initialization...");

    // Wait for Tauri IPC to be ready
    const ready = await waitForTauri();
    if (!ready) {
      // Web mode - return a stub that won't be used (data comes from API)
      console.log("[DB] Web mode detected - using REST API for data");
      return {
        select: async () => [],
        execute: async () => {},
      } as unknown as Database;
    }

    try {
      console.log("[DB] Loading database...");
      // Dynamic import - only loads when getDb() is called at runtime
      // This prevents the Tauri plugin from blocking React's initial render
      const { default: SqlDatabase } = await import("@tauri-apps/plugin-sql");
      db = await SqlDatabase.load("sqlite:personal-assistant.db");
      console.log("[DB] Database loaded, running migrations...");
      await runMigrations(db);
      console.log("[DB] Migrations complete!");
    } catch (error) {
      console.error("[DB] Database initialization failed:", error);
      throw error;
    }
  }
  return db;
}

// Migration system
interface Migration {
  version: number;
  description: string;
  up: (db: Database) => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: "Initial schema",
    up: async (database: Database) => {
      // Create all tables
      await database.execute(`
        -- Clients (freelance customers)
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          company TEXT,
          contact_info TEXT,
          notes TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Projects (can belong to client or be internal)
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
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Tasks (Kanban items)
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
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Tags for categorization
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT
        );

        -- Task-Tag relationship
        CREATE TABLE IF NOT EXISTS task_tags (
          task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
          tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, tag_id)
        );

        -- Time tracking entries
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

        -- Invoices
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          client_id TEXT REFERENCES clients(id) NOT NULL,
          project_id TEXT REFERENCES projects(id),
          invoice_number TEXT NOT NULL UNIQUE,
          amount REAL NOT NULL,
          currency TEXT DEFAULT 'EUR',
          tax_rate REAL DEFAULT 0,
          tax_amount REAL DEFAULT 0,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'draft',
          issue_date TEXT NOT NULL,
          due_date TEXT NOT NULL,
          paid_date TEXT,
          notes TEXT,
          line_items TEXT,
          markdown_path TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Quick captures (inbox)
        CREATE TABLE IF NOT EXISTS captures (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'note',
          processed INTEGER DEFAULT 0,
          processed_to TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );

        -- App settings
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        -- Weekly reviews
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
      `);

      // Create indexes for performance
      await database.execute(`
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_area ON tasks(area);
        CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(start_time);
        CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
        CREATE INDEX IF NOT EXISTS idx_projects_area ON projects(area);
        CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
      `);
    },
  },
  {
    version: 2,
    description: "Migrate invoices table to accounting schema",
    up: async (database: Database) => {
      // Check if we have the old schema (has 'issue_date' column) or new schema (has 'invoice_date')
      const columns = await database.select<{ name: string }[]>(
        "PRAGMA table_info(invoices)"
      );
      const columnNames = columns.map((c) => c.name);

      const hasOldSchema = columnNames.includes('issue_date') && !columnNames.includes('invoice_date');

      if (hasOldSchema) {
        console.log('Migrating invoices table from old schema to new accounting schema...');

        // SQLite doesn't support RENAME COLUMN in older versions, so we recreate the table
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

        // 2. Copy data from old table to new (mapping old column names to new)
        await database.execute(`
          INSERT INTO invoices_new (
            id, invoice_number, invoice_date, due_date, status, client_id, project_id,
            subtotal, vat_rate, vat_amount, total, payment_date, notes, created_at
          )
          SELECT
            id, invoice_number, issue_date, due_date, status, client_id, project_id,
            amount, tax_rate, tax_amount, total_amount, paid_date, notes, created_at
          FROM invoices
        `);

        // 3. Drop old table
        await database.execute('DROP TABLE invoices');

        // 4. Rename new table to invoices
        await database.execute('ALTER TABLE invoices_new RENAME TO invoices');

        // 5. Recreate indexes
        await database.execute('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
        await database.execute('CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id)');

        console.log('Invoices table migration completed');
      } else {
        // New schema or already migrated - just ensure all columns exist
        const addColumnIfMissing = async (column: string, type: string) => {
          if (!columnNames.includes(column)) {
            await database.execute(`ALTER TABLE invoices ADD COLUMN ${column} ${type}`);
            console.log(`Added missing column: invoices.${column}`);
          }
        };

        await addColumnIfMissing('invoice_date', 'DATE');
        await addColumnIfMissing('subtotal', 'DECIMAL(10,2)');
        await addColumnIfMissing('vat_rate', 'INTEGER DEFAULT 19');
        await addColumnIfMissing('vat_amount', 'DECIMAL(10,2)');
        await addColumnIfMissing('total', 'DECIMAL(10,2)');
        await addColumnIfMissing('payment_date', 'DATE');
        await addColumnIfMissing('payment_method', 'TEXT');
        await addColumnIfMissing('project_id', 'TEXT');
      }

      // Create invoice_items table if it doesn't exist (needed for line items)
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
    },
  },
];

async function runMigrations(database: Database): Promise<void> {
  // Create migrations table if not exists
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Get applied migrations
  const applied = await database.select<{ version: number }[]>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  const appliedVersions = new Set(applied.map((m) => m.version));

  // Run pending migrations
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Running migration ${migration.version}: ${migration.description}`);

      try {
        await migration.up(database);
        await database.execute(
          "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
          [migration.version, migration.description]
        );
        console.log(`Migration ${migration.version} completed`);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        throw error;
      }
    }
  }
}

// Get current schema version
export async function getSchemaVersion(): Promise<number> {
  const database = await getDb();
  const result = await database.select<{ version: number }[]>(
    "SELECT MAX(version) as version FROM schema_migrations"
  );
  return result[0]?.version || 0;
}

// Helper to generate UUID
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper to format date for SQLite
export function formatDate(date: Date): string {
  return date.toISOString();
}

// Helper to parse date from SQLite
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}
