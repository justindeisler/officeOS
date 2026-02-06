/**
 * Web-safe database stub
 * In web builds, we don't use direct database access - everything goes through the API
 */

/** Minimal database interface for web-mode compatibility */
interface WebDatabase {
  select: <T = unknown>(...args: unknown[]) => Promise<T[]>;
  execute: (...args: unknown[]) => Promise<void>;
}

let initialized = false;

export async function getDb(): Promise<WebDatabase> {
  // In web mode, we don't have a real database connection
  // This function exists to maintain API compatibility with the app initialization
  if (!initialized) {
    console.log("[DB-Web] Web mode - using REST API for data access");
    initialized = true;
  }
  
  // Return a stub object — all data goes through services/web/
  return {
    select: async () => [],
    execute: async () => {},
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

export async function getSchemaVersion(): Promise<number> {
  return 2; // Current schema version
}
