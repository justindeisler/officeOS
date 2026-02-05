/**
 * Authentication store
 *
 * Uses the centralized admin HTTP client for login/verify requests.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { adminClient, ApiError } from "@/api";

interface User {
  username: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => void;
  verifyToken: () => Promise<boolean>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string, rememberMe: boolean) => {
        try {
          const data = await adminClient.post<{ token: string; user: User }>(
            "/auth/login",
            { username, password, rememberMe },
          );

          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error) {
          console.error("Login failed:", error);
          set({ isLoading: false });
          return false;
        }
      },

      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      verifyToken: async () => {
        const { token } = get();

        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return false;
        }

        try {
          const data = await adminClient.get<{ user: User }>("/auth/verify");

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch (error) {
          // ApiError (401/403) or NetworkError — clear auth state
          if (error instanceof ApiError) {
            set({ token: null, user: null, isAuthenticated: false, isLoading: false });
          } else {
            // Network error — keep token but mark as not loading
            set({ isLoading: false });
          }
          return false;
        }
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: "pa-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);

// Helper to get auth header for API calls
export function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
