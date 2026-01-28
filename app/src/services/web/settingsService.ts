/**
 * Web-based Settings Service
 * For now, uses localStorage since settings API isn't implemented yet
 */

interface Settings {
  theme: 'light' | 'dark' | 'system';
  defaultArea: string;
  weekStartsOn: number;
  [key: string]: unknown;
}

const STORAGE_KEY = 'pa-settings';

function getStoredSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { theme: 'system', defaultArea: 'freelance', weekStartsOn: 1 };
  } catch {
    return { theme: 'system', defaultArea: 'freelance', weekStartsOn: 1 };
  }
}

function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

class SettingsService {
  async get(key: string): Promise<unknown> {
    const settings = getStoredSettings();
    return settings[key];
  }

  async set(key: string, value: unknown): Promise<void> {
    const settings = getStoredSettings();
    settings[key] = value;
    saveSettings(settings);
  }

  async getAll(): Promise<Settings> {
    return getStoredSettings();
  }

  async setAll(settings: Partial<Settings>): Promise<void> {
    const current = getStoredSettings();
    saveSettings({ ...current, ...settings });
  }
}

export const settingsService = new SettingsService();
