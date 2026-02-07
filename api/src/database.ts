/**
 * Database connection for API server
 */

import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { createLogger } from "./logger.js";

const log = createLogger("database");

let db: Database.Database | null = null;

function getDatabasePath(): string {
  const appId = "com.personal-assistant.app";
  const platform = process.platform;

  let basePath: string;
  switch (platform) {
    case "darwin":
      basePath = join(homedir(), "Library", "Application Support", appId);
      break;
    case "win32":
      basePath = join(process.env.APPDATA || homedir(), appId);
      break;
    default:
      basePath = join(homedir(), ".local", "share", appId);
      break;
  }

  return join(basePath, "personal-assistant.db");
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDatabasePath();

    if (!existsSync(dbPath)) {
      throw new Error(`Database not found at ${dbPath}`);
    }

    db = new Database(dbPath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");

    log.info({ path: dbPath }, "Connected to database");
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
