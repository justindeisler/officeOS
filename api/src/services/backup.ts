/**
 * Backup & Export Service
 *
 * Provides:
 * - Encrypted daily database backups (AES-256-GCM)
 * - Full JSON export of all tables
 * - CSV export per table
 * - Backup rotation (keep last 30 days)
 * - Backup status & history
 *
 * Encryption format matches ~/clawd/scripts/memory_crypto.py:
 *   Line 1: JAMES_ENCRYPTED_V1
 *   Line 2+: Base64-encoded (nonce[12] + ciphertext + tag[16])
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { getDb } from "../database.js";
import { createLogger } from "../logger.js";

const log = createLogger("backup");

// ============================================================================
// Constants
// ============================================================================

const MAGIC_HEADER = "JAMES_ENCRYPTED_V1";
const B64_LINE_WIDTH = 76;
const DEFAULT_KEY_PATH = join(homedir(), ".config/james/memory.key");
const DEFAULT_BACKUP_DIR = join(homedir(), "backups/personal-assistant");
const MAX_BACKUP_DAYS = 30;

// All tables to include in exports/backups
const ALL_TABLES = [
  "clients",
  "projects",
  "tasks",
  "tags",
  "task_tags",
  "time_entries",
  "invoices",
  "invoice_items",
  "captures",
  "settings",
  "income",
  "expenses",
  "assets",
  "depreciation_schedule",
  "prds",
  "suggestions",
  "suggestion_comments",
  "james_actions",
  "james_tasks",
  "james_automations",
  "subtasks",
  "weekly_reviews",
  "api_usage",
  "schema_migrations",
] as const;

// ============================================================================
// Encryption (Node.js equivalent of memory_crypto.py)
// ============================================================================

function loadEncryptionKey(keyPath?: string): Buffer {
  const path = keyPath || DEFAULT_KEY_PATH;
  if (!existsSync(path)) {
    throw new Error(`Encryption key not found: ${path}. Generate one with memory_crypto.py keygen`);
  }
  const hexKey = readFileSync(path, "utf-8").trim();
  const key = Buffer.from(hexKey, "hex");
  if (key.length !== 32) {
    throw new Error(`Invalid key length: ${key.length} bytes (expected 32)`);
  }
  return key;
}

function encrypt(plaintext: string, key: Buffer): string {
  const nonce = randomBytes(12);
  // SECURITY: Explicitly set authTagLength for GCM to enforce 128-bit (16 byte) tags
  const cipher = createCipheriv("aes-256-gcm", key, nonce, {
    authTagLength: 16,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Combine: nonce + ciphertext + tag (matches Python format)
  const raw = Buffer.concat([nonce, encrypted, tag]);
  const b64 = raw.toString("base64");

  // Format with line wrapping
  const lines: string[] = [MAGIC_HEADER];
  for (let i = 0; i < b64.length; i += B64_LINE_WIDTH) {
    lines.push(b64.slice(i, i + B64_LINE_WIDTH));
  }
  return lines.join("\n") + "\n";
}

function decrypt(encryptedContent: string, key: Buffer): string {
  const lines = encryptedContent.trim().split("\n");

  if (!lines.length || lines[0].trim() !== MAGIC_HEADER) {
    throw new Error("Not an encrypted file (missing header)");
  }

  const b64Data = lines.slice(1).map((l) => l.trim()).join("");
  const raw = Buffer.from(b64Data, "base64");

  if (raw.length < 28) {
    // 12 (nonce) + 16 (tag) minimum
    throw new Error("Encrypted data too short");
  }

  const nonce = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const ct = raw.subarray(12, raw.length - 16);

  // SECURITY: Specify authTagLength (16 bytes) for GCM mode to prevent
  // authentication tag truncation attacks. Without this, an attacker could
  // potentially spoof ciphertexts or recover the GCM authentication key.
  const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
    authTagLength: 16,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
  return decrypted.toString("utf-8");
}

// ============================================================================
// Export Functions
// ============================================================================

export interface ExportData {
  version: string;
  exportedAt: string;
  tables: Record<string, unknown[]>;
  tableCount: number;
  totalRecords: number;
  checksum: string;
}

function calculateChecksum(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Export all database tables as a JSON object
 */
export function exportAllTablesJson(): ExportData {
  const db = getDb();
  const tables: Record<string, unknown[]> = {};
  let totalRecords = 0;

  for (const table of ALL_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      tables[table] = rows;
      totalRecords += rows.length;
    } catch (err) {
      // Table might not exist in older schemas
      log.warn({ table, err }, "Skipping table (may not exist)");
      tables[table] = [];
    }
  }

  const dataStr = JSON.stringify(tables);
  const checksum = calculateChecksum(dataStr);

  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    tables,
    tableCount: Object.keys(tables).filter((k) => tables[k].length > 0).length,
    totalRecords,
    checksum,
  };
}

/**
 * Export a single table as CSV
 */
export function exportTableCsv(tableName: string): string {
  const db = getDb();

  // Validate table name to prevent SQL injection
  if (!ALL_TABLES.includes(tableName as (typeof ALL_TABLES)[number])) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];

  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);

  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Quote fields that contain commas, newlines, or quotes
          if (str.includes(",") || str.includes("\n") || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    ),
  ];

  return csvRows.join("\n") + "\n";
}

// ============================================================================
// Backup Functions
// ============================================================================

export interface BackupInfo {
  filename: string;
  filepath: string;
  date: string;
  sizeBytes: number;
  encrypted: boolean;
}

export interface BackupStatus {
  backupDir: string;
  lastBackup: BackupInfo | null;
  recentBackups: BackupInfo[];
  totalBackups: number;
  encryptionKeyAvailable: boolean;
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir(dir?: string): string {
  const backupDir = dir || DEFAULT_BACKUP_DIR;
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    log.info({ dir: backupDir }, "Created backup directory");
  }
  return backupDir;
}

/**
 * Create an encrypted backup of the entire database
 */
export function createBackup(options?: {
  backupDir?: string;
  keyPath?: string;
}): BackupInfo {
  const backupDir = ensureBackupDir(options?.backupDir);
  const key = loadEncryptionKey(options?.keyPath);

  // Export all data
  const exportData = exportAllTablesJson();
  const jsonStr = JSON.stringify(exportData, null, 2);

  // Encrypt
  const encryptedContent = encrypt(jsonStr, key);

  // Write backup file
  const dateStr = new Date().toISOString().split("T")[0];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `pa-backup-${timestamp}.enc`;
  const filepath = join(backupDir, filename);

  writeFileSync(filepath, encryptedContent, { mode: 0o600 });

  const stats = statSync(filepath);

  log.info(
    {
      filename,
      records: exportData.totalRecords,
      tables: exportData.tableCount,
      sizeBytes: stats.size,
    },
    "Backup created successfully"
  );

  return {
    filename,
    filepath,
    date: exportData.exportedAt,
    sizeBytes: stats.size,
    encrypted: true,
  };
}

/**
 * Rotate old backups (keep last N days)
 */
export function rotateBackups(options?: {
  backupDir?: string;
  maxDays?: number;
}): { deleted: string[]; kept: number } {
  const backupDir = options?.backupDir || DEFAULT_BACKUP_DIR;
  const maxDays = options?.maxDays || MAX_BACKUP_DAYS;

  if (!existsSync(backupDir)) {
    return { deleted: [], kept: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);

  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("pa-backup-") && f.endsWith(".enc"))
    .sort();

  const deleted: string[] = [];
  let kept = 0;

  for (const file of files) {
    const filepath = join(backupDir, file);
    const stat = statSync(filepath);

    if (stat.mtime < cutoff) {
      unlinkSync(filepath);
      deleted.push(file);
      log.info({ file }, "Deleted old backup");
    } else {
      kept++;
    }
  }

  if (deleted.length > 0) {
    log.info({ deleted: deleted.length, kept }, "Backup rotation complete");
  }

  return { deleted, kept };
}

/**
 * Get backup status and history
 */
export function getBackupStatus(backupDir?: string): BackupStatus {
  const dir = backupDir || DEFAULT_BACKUP_DIR;
  let keyAvailable = false;

  try {
    loadEncryptionKey();
    keyAvailable = true;
  } catch {
    // Key not available
  }

  if (!existsSync(dir)) {
    return {
      backupDir: dir,
      lastBackup: null,
      recentBackups: [],
      totalBackups: 0,
      encryptionKeyAvailable: keyAvailable,
    };
  }

  const files = readdirSync(dir)
    .filter((f) => f.startsWith("pa-backup-") && f.endsWith(".enc"))
    .sort()
    .reverse();

  const backups: BackupInfo[] = files.map((filename) => {
    const filepath = join(dir, filename);
    const stat = statSync(filepath);
    // Extract date from filename: pa-backup-YYYY-MM-DDTHH-MM-SS.enc
    const dateMatch = filename.match(/pa-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    const date = dateMatch
      ? dateMatch[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") + ".000Z"
      : stat.mtime.toISOString();

    return {
      filename,
      filepath,
      date,
      sizeBytes: stat.size,
      encrypted: true,
    };
  });

  return {
    backupDir: dir,
    lastBackup: backups[0] || null,
    recentBackups: backups.slice(0, 7),
    totalBackups: backups.length,
    encryptionKeyAvailable: keyAvailable,
  };
}

/**
 * Get the latest backup file content (for download)
 */
export function getLatestBackupContent(backupDir?: string): {
  content: Buffer;
  filename: string;
} | null {
  const dir = backupDir || DEFAULT_BACKUP_DIR;

  if (!existsSync(dir)) {
    return null;
  }

  const files = readdirSync(dir)
    .filter((f) => f.startsWith("pa-backup-") && f.endsWith(".enc"))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  const filepath = join(dir, files[0]);
  return {
    content: readFileSync(filepath),
    filename: files[0],
  };
}

/**
 * Run daily backup: create backup + rotate old ones
 */
export function runDailyBackup(options?: {
  backupDir?: string;
  keyPath?: string;
  maxDays?: number;
}): { backup: BackupInfo; rotation: { deleted: string[]; kept: number } } {
  log.info("Starting daily backup...");

  const backup = createBackup({
    backupDir: options?.backupDir,
    keyPath: options?.keyPath,
  });

  const rotation = rotateBackups({
    backupDir: options?.backupDir,
    maxDays: options?.maxDays,
  });

  log.info(
    {
      backup: backup.filename,
      deletedOld: rotation.deleted.length,
      totalKept: rotation.kept,
    },
    "Daily backup complete"
  );

  return { backup, rotation };
}

/**
 * Get list of available table names for CSV export
 */
export function getAvailableTables(): string[] {
  return [...ALL_TABLES];
}

// ============================================================================
// Restore Functions
// ============================================================================

export interface RestoreResult {
  success: boolean;
  restoredFrom: string;
  safetyBackup: string;
  tablesRestored: number;
  totalRecords: number;
  error?: string;
}

/**
 * Get all backup files (not just recent 7)
 */
export function getAllBackups(backupDir?: string): BackupInfo[] {
  const dir = backupDir || DEFAULT_BACKUP_DIR;

  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir)
    .filter((f) => f.startsWith("pa-backup-") && f.endsWith(".enc"))
    .sort()
    .reverse();

  return files.map((filename) => {
    const filepath = join(dir, filename);
    const stat = statSync(filepath);
    const dateMatch = filename.match(/pa-backup-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    const date = dateMatch
      ? dateMatch[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") + ".000Z"
      : stat.mtime.toISOString();

    return {
      filename,
      filepath,
      date,
      sizeBytes: stat.size,
      encrypted: true,
    };
  });
}

/**
 * Decrypt a backup file and return the parsed ExportData
 */
export function decryptBackupFile(filepath: string, keyPath?: string): ExportData {
  const key = loadEncryptionKey(keyPath);
  const encryptedContent = readFileSync(filepath, "utf-8");
  const jsonStr = decrypt(encryptedContent, key);
  const data = JSON.parse(jsonStr) as ExportData;

  // Validate checksum
  const tablesStr = JSON.stringify(data.tables);
  const expectedChecksum = calculateChecksum(tablesStr);
  if (data.checksum && data.checksum !== expectedChecksum) {
    throw new Error("Backup data checksum mismatch — file may be corrupted");
  }

  return data;
}

/**
 * Try to decrypt uploaded content; if it fails, try parsing as raw JSON ExportData
 */
export function parseBackupContent(content: Buffer, keyPath?: string): ExportData {
  const contentStr = content.toString("utf-8");

  // Check if it's an encrypted file
  if (contentStr.trimStart().startsWith(MAGIC_HEADER)) {
    const key = loadEncryptionKey(keyPath);
    const jsonStr = decrypt(contentStr, key);
    const data = JSON.parse(jsonStr) as ExportData;
    return data;
  }

  // Try parsing as raw JSON export
  try {
    const data = JSON.parse(contentStr) as ExportData;
    if (data.tables && data.version) {
      return data;
    }
    throw new Error("Invalid backup format: missing 'tables' or 'version' field");
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error("Unrecognized backup format: not encrypted and not valid JSON");
    }
    throw err;
  }
}

/**
 * Create a safety backup of the current database (as JSON export, encrypted)
 */
function createSafetyBackup(backupDir?: string, keyPath?: string): string {
  const dir = ensureBackupDir(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `pa-pre-restore-${timestamp}.enc`;
  const filepath = join(dir, filename);

  const key = loadEncryptionKey(keyPath);
  const exportData = exportAllTablesJson();
  const jsonStr = JSON.stringify(exportData, null, 2);
  const encryptedContent = encrypt(jsonStr, key);

  writeFileSync(filepath, encryptedContent, { mode: 0o600 });
  log.info({ filename, records: exportData.totalRecords }, "Safety backup created before restore");

  return filename;
}

/**
 * Restore the database from parsed ExportData
 * This replaces all table contents with the backup data.
 */
function restoreFromExportData(exportData: ExportData): { tablesRestored: number; totalRecords: number } {
  const db = getDb();
  let tablesRestored = 0;
  let totalRecords = 0;

  // Run everything in a transaction for atomicity
  const restoreTransaction = db.transaction(() => {
    // Disable foreign keys temporarily for the restore
    db.pragma("foreign_keys = OFF");

    for (const table of ALL_TABLES) {
      const rows = exportData.tables[table];
      if (!rows || !Array.isArray(rows)) continue;

      // Clear existing data
      try {
        db.prepare(`DELETE FROM ${table}`).run();
      } catch (err) {
        log.warn({ table, err }, "Could not clear table (may not exist)");
        continue;
      }

      if (rows.length === 0) {
        tablesRestored++;
        continue;
      }

      // Insert rows
      const columns = Object.keys(rows[0] as Record<string, unknown>);
      const placeholders = columns.map(() => "?").join(", ");
      const insertSql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

      try {
        const insertStmt = db.prepare(insertSql);
        for (const row of rows) {
          const values = columns.map((col) => (row as Record<string, unknown>)[col] ?? null);
          insertStmt.run(...values);
        }
        tablesRestored++;
        totalRecords += rows.length;
      } catch (err) {
        log.warn({ table, err, rowCount: rows.length }, "Error restoring table rows — skipping");
      }
    }

    // Re-enable foreign keys
    db.pragma("foreign_keys = ON");
  });

  restoreTransaction();

  // Verify DB integrity after restore
  const integrityResult = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
  if (integrityResult[0]?.integrity_check !== "ok") {
    throw new Error(`Database integrity check failed after restore: ${JSON.stringify(integrityResult)}`);
  }

  return { tablesRestored, totalRecords };
}

/**
 * Restore from a named server-side backup file
 */
export function restoreFromBackup(filename: string, options?: {
  backupDir?: string;
  keyPath?: string;
}): RestoreResult {
  const dir = options?.backupDir || DEFAULT_BACKUP_DIR;

  // Security: prevent path traversal
  const sanitized = basename(filename);
  if (sanitized !== filename || filename.includes("..")) {
    throw new Error("Invalid backup filename");
  }

  const filepath = join(dir, sanitized);
  if (!existsSync(filepath)) {
    throw new Error(`Backup file not found: ${sanitized}`);
  }

  log.info({ filename: sanitized }, "Starting restore from server backup");

  // 1. Create safety backup
  const safetyBackup = createSafetyBackup(options?.backupDir, options?.keyPath);

  try {
    // 2. Decrypt and parse the backup
    const exportData = decryptBackupFile(filepath, options?.keyPath);

    // 3. Restore the data
    const { tablesRestored, totalRecords } = restoreFromExportData(exportData);

    log.info({ filename: sanitized, tablesRestored, totalRecords, safetyBackup }, "Restore completed successfully");

    return {
      success: true,
      restoredFrom: sanitized,
      safetyBackup,
      tablesRestored,
      totalRecords,
    };
  } catch (err) {
    log.error({ err, filename: sanitized }, "Restore failed — safety backup available");
    throw err;
  }
}

/**
 * Restore from uploaded file content
 */
export function restoreFromUpload(fileBuffer: Buffer, originalFilename: string, options?: {
  keyPath?: string;
  backupDir?: string;
}): RestoreResult {
  log.info({ originalFilename, size: fileBuffer.length }, "Starting restore from uploaded file");

  // 1. Create safety backup
  const safetyBackup = createSafetyBackup(options?.backupDir, options?.keyPath);

  try {
    // 2. Parse the uploaded content (auto-detects encrypted vs raw JSON)
    const exportData = parseBackupContent(fileBuffer, options?.keyPath);

    // 3. Restore the data
    const { tablesRestored, totalRecords } = restoreFromExportData(exportData);

    log.info({ originalFilename, tablesRestored, totalRecords, safetyBackup }, "Restore from upload completed");

    return {
      success: true,
      restoredFrom: originalFilename,
      safetyBackup,
      tablesRestored,
      totalRecords,
    };
  } catch (err) {
    log.error({ err, originalFilename }, "Restore from upload failed — safety backup available");
    throw err;
  }
}
