/**
 * Centralized API Client Module
 *
 * Provides pre-configured HTTP client instances for the admin and client portal,
 * plus shared utility functions that were previously duplicated across 6+ files.
 *
 * Usage:
 *   import { adminClient, ApiError } from '@/api';
 *   const data = await adminClient.get<MyType>('/some/endpoint');
 *
 * For the client portal:
 *   import { clientPortalClient } from '@/api';
 */

export {
  HttpClient,
  ApiError,
  NetworkError,
  onLoadingChange,
  getActiveRequestCount,
  type HttpClientOptions,
  type RequestConfig,
  type RequestInterceptor,
  type ResponseInterceptor,
  type ErrorInterceptor,
} from './httpClient';

import { HttpClient } from './httpClient';

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/** API base URL from environment or default to '/api' */
export const API_BASE: string = import.meta.env.VITE_API_URL || '/api';

/** Full API URL (some modules use this without the /api prefix) */
export const API_URL: string = import.meta.env.VITE_API_URL || '';

/**
 * Check if running in a Tauri (desktop) environment.
 * Accounting modules use this to choose between REST API and direct DB access.
 */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    '__TAURI__' in window &&
    !!(window as unknown as { __TAURI__?: unknown }).__TAURI__
  );
}

/**
 * Check if we're in a web build (not Tauri).
 */
export function isWebBuild(): boolean {
  return typeof window !== 'undefined' && !('__TAURI__' in window);
}

/**
 * Get the admin auth token from localStorage (zustand persist store 'pa-auth').
 */
export function getAdminToken(): string | null {
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

/**
 * Get the client portal auth token from localStorage ('client-auth').
 */
export function getClientToken(): string | null {
  try {
    const stored = localStorage.getItem('client-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// ============================================================================
// PRE-CONFIGURED CLIENT INSTANCES
// ============================================================================

/**
 * Admin HTTP client — uses the `pa-auth` token for authentication.
 * Used by the main app (tasks, projects, accounting, settings, etc.).
 */
export const adminClient = new HttpClient({
  baseUrl: API_BASE,
  getToken: getAdminToken,
  onAuthError: () => {
    // Clear auth state on 401 to trigger re-login
    // This matches the existing behavior in authStore.verifyToken
    try {
      const stored = localStorage.getItem('pa-auth');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state) {
          parsed.state.token = null;
          parsed.state.user = null;
          parsed.state.isAuthenticated = false;
          localStorage.setItem('pa-auth', JSON.stringify(parsed));
        }
      }
    } catch {
      // Best-effort
    }
  },
});

/**
 * Client Portal HTTP client — uses the `client-auth` token.
 * Used by the client-facing portal (client dashboard, tasks, etc.).
 */
export const clientPortalClient = new HttpClient({
  baseUrl: API_URL,
  getToken: getClientToken,
  onAuthError: () => {
    localStorage.removeItem('client-auth');
  },
});

/**
 * Accounting API request helper.
 * Equivalent to the `apiRequest<T>()` that was duplicated in expenses.ts,
 * income.ts, assets.ts, and reports.ts — but backed by the shared client.
 *
 * Uses API_URL (no /api prefix) since accounting routes include '/api/' in their paths.
 */
const accountingClient = new HttpClient({
  baseUrl: API_URL,
  getToken: getAdminToken,
});

export { accountingClient };
