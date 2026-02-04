import { create } from 'zustand';
import { ClientInfo, clientLogin, clientLogout, getClientInfo } from '../api/client';

interface ClientAuthState {
  client: ClientInfo | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useClientAuthStore = create<ClientAuthState>((set) => ({
  client: null,
  loading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const { client } = await clientLogin(email, password);
      set({ client, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Login failed',
        loading: false
      });
      throw error;
    }
  },

  logout: () => {
    clientLogout();
    set({ client: null });
  },

  checkAuth: async () => {
    try {
      const client = await getClientInfo();
      set({ client });
    } catch (error) {
      set({ client: null });
    }
  }
}));
