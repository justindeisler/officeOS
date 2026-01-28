/**
 * Authentication store
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string, rememberMe: boolean) => {
        try {
          const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, rememberMe }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Login failed");
          }

          const data = await response.json();
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
          const response = await fetch(`${API_BASE}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            set({ token: null, user: null, isAuthenticated: false, isLoading: false });
            return false;
          }

          const data = await response.json();
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });

          return true;
        } catch {
          set({ token: null, user: null, isAuthenticated: false, isLoading: false });
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
