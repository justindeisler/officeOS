/**
 * Web-based Settings Service
 * Syncs settings with the REST API and uses localStorage as cache
 */

import { api } from "@/lib/api";

interface Settings {
  theme: 'light' | 'dark' | 'system';
  defaultArea: string;
  defaultCurrency: string;
  userName: string;
  workspacePath?: string;
  businessProfile?: {
    fullName: string;
    jobTitle: string;
    email: string;
    phone?: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    vatId?: string;
    taxId?: string;
    bankAccountHolder: string;
    bankName: string;
    bankIban: string;
    bankBic: string;
  };
  [key: string]: unknown;
}

const STORAGE_KEY = 'pa-settings';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Get auth token from localStorage (zustand persist)
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('pa-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

function getStoredSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { theme: 'system', defaultArea: 'freelance', defaultCurrency: 'EUR', userName: '' };
  } catch {
    return { theme: 'system', defaultArea: 'freelance', defaultCurrency: 'EUR', userName: '' };
  }
}

function saveLocalSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

class SettingsService {
  async get(key: string): Promise<unknown> {
    // Try API first, fall back to local
    try {
      const result = await apiRequest<{ key: string; value: unknown }>(`/settings/${key}`);
      return result.value;
    } catch {
      const settings = getStoredSettings();
      return settings[key];
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    // Save to API
    try {
      await apiRequest(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    } catch (error) {
      console.error('Failed to save setting to API:', error);
      // Continue to save locally as fallback
    }

    // Also save locally for immediate access
    const settings = getStoredSettings();
    settings[key] = value;
    saveLocalSettings(settings);
  }

  async getAll(): Promise<Settings> {
    // Try to get from API first
    try {
      const apiSettings = await apiRequest<Record<string, unknown>>('/settings');
      const merged = { ...getStoredSettings(), ...apiSettings } as Settings;
      saveLocalSettings(merged); // Update local cache
      return merged;
    } catch (error) {
      console.warn('Failed to fetch settings from API, using local:', error);
      return getStoredSettings();
    }
  }

  async setAll(settings: Partial<Settings>): Promise<void> {
    // Save to API
    try {
      await apiRequest('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Failed to save settings to API:', error);
    }

    // Also save locally
    const current = getStoredSettings();
    saveLocalSettings({ ...current, ...settings });
  }

  async reset(): Promise<void> {
    const defaults: Settings = {
      theme: 'system',
      defaultArea: 'freelance',
      defaultCurrency: 'EUR',
      userName: '',
    };
    await this.setAll(defaults);
  }
}

export const settingsService = new SettingsService();
