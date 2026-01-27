import { getDb } from "@/lib/db";
import type { Settings } from "@/types";

// Default settings
const defaultSettings: Settings = {
  theme: "dark",
  defaultArea: "freelance",
  defaultCurrency: "EUR",
};

class SettingsService {
  async get<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = ?",
      [key]
    );
    if (!rows[0]) return defaultSettings[key];
    try {
      return JSON.parse(rows[0].value) as Settings[K];
    } catch {
      return rows[0].value as Settings[K];
    }
  }

  async set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    const db = await getDb();
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    await db.execute(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, serialized]
    );
  }

  async getAll(): Promise<Settings> {
    const db = await getDb();
    const rows = await db.select<{ key: string; value: string }[]>(
      "SELECT key, value FROM settings"
    );

    const settings = { ...defaultSettings };

    for (const row of rows) {
      try {
        (settings as Record<string, unknown>)[row.key] = JSON.parse(row.value);
      } catch {
        (settings as Record<string, unknown>)[row.key] = row.value;
      }
    }

    return settings;
  }

  async setAll(settings: Partial<Settings>): Promise<void> {
    const db = await getDb();
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        await db.execute(
          `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
          [key, serialized]
        );
      }
    }
  }

  async reset(): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM settings");
  }
}

export const settingsService = new SettingsService();
