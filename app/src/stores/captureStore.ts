import { create } from "zustand";
import { captureService } from "@/services";
import { toast } from "sonner";
import type { Capture, CaptureType } from "@/types";

interface CaptureState {
  captures: Capture[];
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  addCapture: (data: { content: string; type: CaptureType }) => Promise<void>;
  updateCapture: (id: string, updates: Partial<Capture>) => Promise<void>;
  deleteCapture: (id: string) => Promise<void>;
  markProcessed: (id: string, processedTo?: string) => Promise<void>;
}

export const useCaptureStore = create<CaptureState>()((set, get) => ({
  captures: [],
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const captures = await captureService.getAll();
      set({ captures, isLoaded: true });
    } catch (error) {
      console.error("Failed to load captures:", error);
      toast.error("Failed to load captures");
      set({ isLoaded: true });
    }
  },

  addCapture: async (data) => {
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();

    const optimisticCapture: Capture = {
      id: tempId,
      content: data.content,
      type: data.type,
      processed: false,
      createdAt: now,
    };

    set((state) => ({ captures: [optimisticCapture, ...state.captures] }));

    try {
      const createdCapture = await captureService.create({
        content: data.content,
        type: data.type,
      });
      set((state) => ({
        captures: state.captures.map((c) =>
          c.id === tempId ? createdCapture : c
        ),
      }));
    } catch (error) {
      set((state) => ({
        captures: state.captures.filter((c) => c.id !== tempId),
      }));
      console.error("Failed to add capture:", error);
      toast.error("Failed to add capture");
    }
  },

  updateCapture: async (id, updates) => {
    const previousCaptures = get().captures;

    set((state) => ({
      captures: state.captures.map((capture) =>
        capture.id === id ? { ...capture, ...updates } : capture
      ),
    }));

    try {
      await captureService.update(id, updates);
    } catch (error) {
      set({ captures: previousCaptures });
      console.error("Failed to update capture:", error);
      toast.error("Failed to update capture");
    }
  },

  deleteCapture: async (id) => {
    const previousCaptures = get().captures;

    set((state) => ({
      captures: state.captures.filter((capture) => capture.id !== id),
    }));

    try {
      await captureService.delete(id);
    } catch (error) {
      set({ captures: previousCaptures });
      console.error("Failed to delete capture:", error);
      toast.error("Failed to delete capture");
    }
  },

  markProcessed: async (id, processedTo) => {
    const previousCaptures = get().captures;

    set((state) => ({
      captures: state.captures.map((capture) =>
        capture.id === id
          ? { ...capture, processed: true, processedTo }
          : capture
      ),
    }));

    try {
      await captureService.markProcessed(id, processedTo);
    } catch (error) {
      set({ captures: previousCaptures });
      console.error("Failed to mark capture as processed:", error);
      toast.error("Failed to mark capture as processed");
    }
  },
}));

// Selectors
export const useUnprocessedCaptures = () => {
  const { captures } = useCaptureStore();
  return captures.filter((capture) => !capture.processed);
};

export const useProcessedCaptures = () => {
  const { captures } = useCaptureStore();
  return captures.filter((capture) => capture.processed);
};

export const useCapturesByType = (type: CaptureType) => {
  const { captures } = useCaptureStore();
  return captures.filter((capture) => capture.type === type);
};

export const useUnprocessedCount = () => {
  const { captures } = useCaptureStore();
  return captures.filter((capture) => !capture.processed).length;
};
