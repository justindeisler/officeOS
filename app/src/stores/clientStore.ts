import { create } from "zustand";
import { clientService } from "@/services";
import { toast } from "sonner";
import type { Client } from "@/types";

interface ClientState {
  clients: Client[];
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  addClient: (
    client: Omit<Client, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
}

export const useClientStore = create<ClientState>()((set, get) => ({
  clients: [],
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const clients = await clientService.getAll();
      set({ clients, isLoaded: true });
    } catch (error) {
      console.error("Failed to load clients:", error);
      toast.error("Failed to load clients");
      set({ isLoaded: true });
    }
  },

  addClient: async (clientData) => {
    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();

    const optimisticClient: Client = {
      ...clientData,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ clients: [...state.clients, optimisticClient] }));

    try {
      const createdClient = await clientService.create(clientData);
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === tempId ? createdClient : c
        ),
      }));
    } catch (error) {
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== tempId),
      }));
      console.error("Failed to create client:", error);
      toast.error("Failed to create client");
    }
  },

  updateClient: async (id, updates) => {
    const previousClients = get().clients;
    const now = new Date().toISOString();

    set((state) => ({
      clients: state.clients.map((client) =>
        client.id === id ? { ...client, ...updates, updatedAt: now } : client
      ),
    }));

    try {
      await clientService.update(id, { ...updates, updatedAt: now });
    } catch (error) {
      set({ clients: previousClients });
      console.error("Failed to update client:", error);
      toast.error("Failed to update client");
    }
  },

  deleteClient: async (id) => {
    const previousClients = get().clients;

    set((state) => ({
      clients: state.clients.filter((client) => client.id !== id),
    }));

    try {
      await clientService.delete(id);
    } catch (error) {
      set({ clients: previousClients });
      console.error("Failed to delete client:", error);
      toast.error("Failed to delete client");
    }
  },
}));

// Selectors
export const useActiveClients = () => {
  const { clients } = useClientStore();
  return clients.filter((client) => client.status === "active");
};

export const useClientById = (id: string) => {
  const { clients } = useClientStore();
  return clients.find((client) => client.id === id);
};
