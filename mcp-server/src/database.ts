/**
 * Database connection for MCP server
 * Connects to the same SQLite database used by the Tauri app
 */

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

let db: Database.Database | null = null;

/**
 * Get the database path based on the platform
 */
function getDatabasePath(): string {
  const appId = "com.personal-assistant.app";
  const platform = process.platform;

  let basePath: string;

  switch (platform) {
    case "darwin":
      // macOS: ~/Library/Application Support/{appId}/
      basePath = join(homedir(), "Library", "Application Support", appId);
      break;
    case "win32":
      // Windows: %APPDATA%/{appId}/
      basePath = join(process.env.APPDATA || homedir(), appId);
      break;
    default:
      // Linux: ~/.local/share/{appId}/
      basePath = join(homedir(), ".local", "share", appId);
      break;
  }

  return join(basePath, "personal-assistant.db");
}

/**
 * Get or create the database connection
 */
export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath();

    if (!existsSync(dbPath)) {
      throw new Error(
        `Database not found at ${dbPath}. Please ensure the Personal Assistant app has been run at least once.`
      );
    }

    db = new Database(dbPath);

    // Enable foreign keys
    db.pragma("foreign_keys = ON");

    // Use WAL mode for better concurrent access
    db.pragma("journal_mode = WAL");

    console.error(`[MCP] Connected to database at: ${dbPath}`);
  }

  return db;
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.error("[MCP] Database connection closed");
  }
}

/**
 * Generate a UUID for new records
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Execute a read-only SQL query with safety checks
 */
export function executeReadOnlyQuery(
  sql: string
): Record<string, unknown>[] {
  const db = getDb();

  // Basic SQL injection prevention - only allow SELECT statements
  const normalizedSql = sql.trim().toUpperCase();

  if (!normalizedSql.startsWith("SELECT")) {
    throw new Error("Only SELECT queries are allowed for read-only access");
  }

  // Block dangerous keywords
  const dangerousKeywords = [
    "DROP",
    "DELETE",
    "INSERT",
    "UPDATE",
    "ALTER",
    "CREATE",
    "TRUNCATE",
    "REPLACE",
    "ATTACH",
    "DETACH",
  ];

  for (const keyword of dangerousKeywords) {
    if (normalizedSql.includes(keyword)) {
      throw new Error(`Query contains forbidden keyword: ${keyword}`);
    }
  }

  try {
    const stmt = db.prepare(sql);
    return stmt.all() as Record<string, unknown>[];
  } catch (error) {
    throw new Error(`Query execution failed: ${(error as Error).message}`);
  }
}
