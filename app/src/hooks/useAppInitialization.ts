import { useState, useEffect } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useClientStore } from "@/stores/clientStore";
import { useProjectStore } from "@/stores/projectStore";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useTimerStore } from "@/stores/timerStore";
import { useCaptureStore } from "@/stores/captureStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface InitializationState {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  progress: {
    database: boolean;
    stores: boolean;
  };
}

export function useAppInitialization(): InitializationState {
  const [state, setState] = useState<InitializationState>({
    isReady: false,
    isLoading: true,
    error: null,
    progress: {
      database: false,
      stores: false,
    },
  });

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        console.log("[App] Starting initialization...");
        // Step 1: Dynamically import and initialize database
        // This prevents the import from blocking React's initial mount
        console.log("[App] Step 1: Initializing database...");
        const { getDb } = await import("@/lib/db");
        await getDb();
        console.log("[App] Database initialized!");

        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          progress: { ...prev.progress, database: true },
        }));

        // Step 2: Initialize all stores in parallel
        console.log("[App] Step 2: Initializing stores...");
        await Promise.all([
          useSettingsStore.getState().initialize(), // Settings first for theme
          useClientStore.getState().initialize(),
          useProjectStore.getState().initialize(),
          useTaskStore.getState().initialize(),
          useTimerStore.getState().initialize(),
          useInvoiceStore.getState().initialize(),
          useCaptureStore.getState().initialize(),
        ]);

        console.log("[App] Stores initialized!");
        if (!mounted) return;
        console.log("[App] Initialization complete!");
        setState({
          isReady: true,
          isLoading: false,
          error: null,
          progress: {
            database: true,
            stores: true,
          },
        });
      } catch (error) {
        console.error("App initialization failed:", error);
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to initialize application",
        }));
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
