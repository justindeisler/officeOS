import { create } from "zustand";
import { captureService } from "@/services";
import { toast } from "sonner";
import type { Capture, CaptureType, ProcessingStatus } from "@/types";

interface CaptureState {
  captures: Capture[];
  isLoaded: boolean;
  processingCaptures: Set<string>; // IDs of captures being processed by James

  // Lifecycle
  initialize: () => Promise<void>;
  refreshCapture: (id: string) => Promise<void>;

  // Actions
  addCapture: (data: { content: string; type: CaptureType }) => Promise<void>;
  updateCapture: (id: string, updates: Partial<Capture>) => Promise<void>;
  deleteCapture: (id: string) => Promise<void>;
  markProcessed: (id: string, processedTo?: string) => Promise<void>;
  processWithJames: (id: string) => Promise<void>;
}

export const useCaptureStore = create<CaptureState>()((set, get) => ({
  captures: [],
  isLoaded: false,
  processingCaptures: new Set<string>(),

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

  refreshCapture: async (id: string) => {
    try {
      const status = await captureService.getProcessingStatus(id);
      set((state) => ({
        captures: state.captures.map((c) =>
          c.id === id
            ? {
                ...c,
                processingStatus: status.processingStatus as ProcessingStatus,
                processedBy: status.processedBy as "manual" | "james" | undefined,
                artifactType: status.artifactType as Capture["artifactType"],
                artifactId: status.artifactId,
                processed: status.processed,
              }
            : c
        ),
      }));
    } catch (error) {
      console.error("Failed to refresh capture:", error);
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
          ? { ...capture, processed: true, processedTo, processingStatus: "completed" as ProcessingStatus }
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

  processWithJames: async (id) => {
    // Optimistically update the processing status
    set((state) => ({
      captures: state.captures.map((capture) =>
        capture.id === id
          ? { ...capture, processingStatus: "processing" as ProcessingStatus }
          : capture
      ),
      processingCaptures: new Set([...state.processingCaptures, id]),
    }));

    try {
      await captureService.processWithJames(id);
      toast.success("James is processing your capture...");

      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const status = await captureService.getProcessingStatus(id);
          
          set((state) => ({
            captures: state.captures.map((c) =>
              c.id === id
                ? {
                    ...c,
                    processingStatus: status.processingStatus as ProcessingStatus,
                    processedBy: status.processedBy as "manual" | "james" | undefined,
                    artifactType: status.artifactType as Capture["artifactType"],
                    artifactId: status.artifactId,
                    processed: status.processed,
                  }
                : c
            ),
          }));

          // Stop polling when done
          if (status.processingStatus === "completed" || status.processingStatus === "failed") {
            clearInterval(pollInterval);
            set((state) => {
              const newSet = new Set(state.processingCaptures);
              newSet.delete(id);
              return { processingCaptures: newSet };
            });

            if (status.processingStatus === "completed") {
              toast.success("James finished processing your capture!");
            } else {
              toast.error("James failed to process your capture");
            }
          }
        } catch (error) {
          console.error("Failed to poll status:", error);
        }
      }, 2000); // Poll every 2 seconds

      // Stop polling after 2 minutes max
      setTimeout(() => {
        clearInterval(pollInterval);
        set((state) => {
          const newSet = new Set(state.processingCaptures);
          newSet.delete(id);
          return { processingCaptures: newSet };
        });
      }, 120000);

    } catch (error) {
      // Revert on error
      set((state) => ({
        captures: state.captures.map((capture) =>
          capture.id === id
            ? { ...capture, processingStatus: "failed" as ProcessingStatus }
            : capture
        ),
        processingCaptures: new Set([...state.processingCaptures].filter(cid => cid !== id)),
      }));
      console.error("Failed to start James processing:", error);
      toast.error("Failed to start James processing");
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
