/**
 * Web-safe database stub
 * In web builds, we don't use direct database access - everything goes through the API
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

let initialized = false;

export async function getDb(): Promise<Database> {
  // In web mode, we don't have a real database connection
  // This function exists to maintain API compatibility with the app initialization
  if (!initialized) {
    console.log("[DB-Web] Web mode - using REST API for data access");
    initialized = true;
  }
  
  // Return a dummy object that will never be used (all data goes through services/web/)
  return {
    select: async () => [],
    execute: async () => {},
  } as Database;
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
