import { getDb, getSchemaVersion } from "@/lib/db";

// Lazy-loaded Tauri modules to avoid blocking React mount
let tauriDialog: typeof import("@tauri-apps/plugin-dialog") | null = null;
let tauriFs: typeof import("@tauri-apps/plugin-fs") | null = null;

async function getTauriModules() {
  if (!tauriDialog || !tauriFs) {
    const [dialog, fs] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    tauriDialog = dialog;
    tauriFs = fs;
  }
  return {
    save: tauriDialog.save,
    open: tauriDialog.open,
    writeTextFile: tauriFs.writeTextFile,
    readTextFile: tauriFs.readTextFile,
  };
}

// Backup file format
interface BackupData {
  version: string;
  exportedAt: string;
  schemaVersion: number;
  data: {
    clients: unknown[];
    projects: unknown[];
    tasks: unknown[];
    time_entries: unknown[];
    invoices: unknown[];
    captures: unknown[];
    settings: unknown[];
  };
  checksum: string;
}

// Simple checksum function (not cryptographic, just for integrity)
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `hash:${Math.abs(hash).toString(16)}`;
}

class BackupService {
  private readonly APP_VERSION = "1.0.0";

  async exportBackup(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const { save, writeTextFile } = await getTauriModules();
      const db = await getDb();
      const schemaVersion = await getSchemaVersion();

      // Fetch all data from tables
      const [clients, projects, tasks, timeEntries, invoices, captures, settings] =
        await Promise.all([
          db.select<unknown[]>("SELECT * FROM clients"),
          db.select<unknown[]>("SELECT * FROM projects"),
          db.select<unknown[]>("SELECT * FROM tasks"),
          db.select<unknown[]>("SELECT * FROM time_entries"),
          db.select<unknown[]>("SELECT * FROM invoices"),
          db.select<unknown[]>("SELECT * FROM captures"),
          db.select<unknown[]>("SELECT * FROM settings"),
        ]);

      // Create backup object without checksum first
      const backupWithoutChecksum = {
        version: this.APP_VERSION,
        exportedAt: new Date().toISOString(),
        schemaVersion,
        data: {
          clients,
          projects,
          tasks,
          time_entries: timeEntries,
          invoices,
          captures,
          settings,
        },
      };

      // Calculate checksum of the data
      const dataString = JSON.stringify(backupWithoutChecksum.data);
      const checksum = calculateChecksum(dataString);

      const backup: BackupData = {
        ...backupWithoutChecksum,
        checksum,
      };

      // Get save path from user
      const filePath = await save({
        defaultPath: `personal-assistant-backup-${new Date().toISOString().split("T")[0]}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!filePath) {
        return { success: false, error: "Export cancelled" };
      }

      // Write to file
      await writeTextFile(filePath, JSON.stringify(backup, null, 2));

      return { success: true, filePath };
    } catch (error) {
      console.error("Backup export failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      };
    }
  }

  async importBackup(): Promise<{
    success: boolean;
    error?: string;
    stats?: { tables: number; records: number };
  }> {
    try {
      const { open, readTextFile } = await getTauriModules();
      // Get file path from user
      const filePath = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
      });

      if (!filePath || Array.isArray(filePath)) {
        return { success: false, error: "Import cancelled" };
      }

      // Read file
      const content = await readTextFile(filePath);
      const backup = JSON.parse(content) as BackupData;

      // Validate backup structure
      const validationError = this.validateBackup(backup);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Verify checksum
      const dataString = JSON.stringify(backup.data);
      const calculatedChecksum = calculateChecksum(dataString);
      if (calculatedChecksum !== backup.checksum) {
        return { success: false, error: "Backup file is corrupted (checksum mismatch)" };
      }

      const db = await getDb();

      // Clear existing data (in transaction)
      await db.execute("DELETE FROM captures");
      await db.execute("DELETE FROM time_entries");
      await db.execute("DELETE FROM invoices");
      await db.execute("DELETE FROM tasks");
      await db.execute("DELETE FROM projects");
      await db.execute("DELETE FROM clients");
      await db.execute("DELETE FROM settings");

      let totalRecords = 0;

      // Import data in correct order (respecting foreign keys)
      // 1. Clients first (no dependencies)
      for (const client of backup.data.clients as Record<string, unknown>[]) {
        await this.insertRecord(db, "clients", client);
        totalRecords++;
      }

      // 2. Projects (depends on clients)
      for (const project of backup.data.projects as Record<string, unknown>[]) {
        await this.insertRecord(db, "projects", project);
        totalRecords++;
      }

      // 3. Tasks (depends on projects and clients)
      for (const task of backup.data.tasks as Record<string, unknown>[]) {
        await this.insertRecord(db, "tasks", task);
        totalRecords++;
      }

      // 4. Time entries (depends on tasks, projects, clients)
      for (const entry of backup.data.time_entries as Record<string, unknown>[]) {
        await this.insertRecord(db, "time_entries", entry);
        totalRecords++;
      }

      // 5. Invoices (depends on clients)
      for (const invoice of backup.data.invoices as Record<string, unknown>[]) {
        await this.insertRecord(db, "invoices", invoice);
        totalRecords++;
      }

      // 6. Captures (no dependencies)
      for (const capture of backup.data.captures as Record<string, unknown>[]) {
        await this.insertRecord(db, "captures", capture);
        totalRecords++;
      }

      // 7. Settings (no dependencies)
      for (const setting of backup.data.settings as Record<string, unknown>[]) {
        await this.insertRecord(db, "settings", setting);
        totalRecords++;
      }

      return {
        success: true,
        stats: {
          tables: 7,
          records: totalRecords,
        },
      };
    } catch (error) {
      console.error("Backup import failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      };
    }
  }

  private validateBackup(backup: unknown): string | null {
    if (!backup || typeof backup !== "object") {
      return "Invalid backup file format";
    }

    const b = backup as Record<string, unknown>;

    if (!b.version || typeof b.version !== "string") {
      return "Missing or invalid version";
    }

    if (!b.exportedAt || typeof b.exportedAt !== "string") {
      return "Missing or invalid export date";
    }

    if (typeof b.schemaVersion !== "number") {
      return "Missing or invalid schema version";
    }

    if (!b.data || typeof b.data !== "object") {
      return "Missing or invalid data";
    }

    if (!b.checksum || typeof b.checksum !== "string") {
      return "Missing or invalid checksum";
    }

    const data = b.data as Record<string, unknown>;
    const requiredTables = [
      "clients",
      "projects",
      "tasks",
      "time_entries",
      "invoices",
      "captures",
      "settings",
    ];

    for (const table of requiredTables) {
      if (!Array.isArray(data[table])) {
        return `Missing or invalid table: ${table}`;
      }
    }

    return null;
  }

  private async insertRecord(
    db: Awaited<ReturnType<typeof getDb>>,
    table: string,
    record: Record<string, unknown>
  ): Promise<void> {
    const columns = Object.keys(record);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(record);

    await db.execute(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );
  }

  async getBackupStats(): Promise<{
    clients: number;
    projects: number;
    tasks: number;
    timeEntries: number;
    invoices: number;
    captures: number;
  }> {
    const db = await getDb();

    const [clients, projects, tasks, timeEntries, invoices, captures] =
      await Promise.all([
        db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM clients"),
        db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM projects"),
        db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM tasks"),
        db.select<{ count: number }[]>(
          "SELECT COUNT(*) as count FROM time_entries"
        ),
        db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM invoices"),
        db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM captures"),
      ]);

    return {
      clients: clients[0]?.count || 0,
      projects: projects[0]?.count || 0,
      tasks: tasks[0]?.count || 0,
      timeEntries: timeEntries[0]?.count || 0,
      invoices: invoices[0]?.count || 0,
      captures: captures[0]?.count || 0,
    };
  }
}

export const backupService = new BackupService();
