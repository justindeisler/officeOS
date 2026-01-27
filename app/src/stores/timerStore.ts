import { create } from "zustand";
import { timeEntryService } from "@/services";
import { toast } from "sonner";
import type { TimeEntry, TimeCategory } from "@/types";

interface TimerState {
  entries: TimeEntry[];
  activeEntryId: string | null;
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  startTimer: (data: {
    category: TimeCategory;
    description?: string;
    taskId?: string;
    projectId?: string;
    clientId?: string;
  }) => Promise<void>;
  stopTimer: () => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  addManualEntry: (
    entry: Omit<TimeEntry, "id" | "createdAt" | "isRunning">
  ) => Promise<void>;
  updateEntry: (id: string, updates: Partial<TimeEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  entries: [],
  activeEntryId: null,
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const entries = await timeEntryService.getAll();
      const runningEntry = entries.find((e) => e.isRunning);
      set({
        entries,
        activeEntryId: runningEntry?.id || null,
        isLoaded: true,
      });
    } catch (error) {
      console.error("Failed to load time entries:", error);
      toast.error("Failed to load time entries");
      set({ isLoaded: true });
    }
  },

  startTimer: async (data) => {
    const state = get();

    // Stop any active timer first
    if (state.activeEntryId) {
      await state.stopTimer();
    }

    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();

    const optimisticEntry: TimeEntry = {
      id: tempId,
      category: data.category,
      description: data.description,
      taskId: data.taskId,
      projectId: data.projectId,
      clientId: data.clientId,
      startTime: now,
      isRunning: true,
      createdAt: now,
    };

    set((state) => ({
      entries: [...state.entries, optimisticEntry],
      activeEntryId: tempId,
    }));

    try {
      const createdEntry = await timeEntryService.startTimer({
        category: data.category,
        description: data.description,
        taskId: data.taskId,
        projectId: data.projectId,
        clientId: data.clientId,
        startTime: now,
      });
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === tempId ? createdEntry : e
        ),
        activeEntryId: createdEntry.id,
      }));
    } catch (error) {
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== tempId),
        activeEntryId: null,
      }));
      console.error("Failed to start timer:", error);
      toast.error("Failed to start timer");
    }
  },

  stopTimer: async () => {
    const { entries, activeEntryId } = get();
    if (!activeEntryId) return;

    const activeEntry = entries.find((e) => e.id === activeEntryId);
    if (!activeEntry) return;

    const endTime = new Date();
    const startTime = new Date(activeEntry.startTime);
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60000
    );

    // Optimistic update
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === activeEntryId
          ? {
              ...entry,
              endTime: endTime.toISOString(),
              durationMinutes,
              isRunning: false,
            }
          : entry
      ),
      activeEntryId: null,
    }));

    try {
      await timeEntryService.stopTimer(activeEntryId);
    } catch (error) {
      // Rollback
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === activeEntryId
            ? { ...entry, endTime: undefined, durationMinutes: undefined, isRunning: true }
            : entry
        ),
        activeEntryId,
      }));
      console.error("Failed to stop timer:", error);
      toast.error("Failed to stop timer");
    }
  },

  pauseTimer: () => {
    const { entries, activeEntryId } = get();
    if (!activeEntryId) return;

    const pauseTime = new Date();

    set({
      entries: entries.map((entry) => {
        if (entry.id === activeEntryId && entry.isRunning) {
          const startTime = new Date(entry.startTime);
          const currentDuration = entry.durationMinutes || 0;
          const additionalMinutes = Math.round(
            (pauseTime.getTime() - startTime.getTime()) / 60000
          );
          return {
            ...entry,
            durationMinutes: currentDuration + additionalMinutes,
            isRunning: false,
          };
        }
        return entry;
      }),
    });
  },

  resumeTimer: () => {
    const { entries, activeEntryId } = get();
    if (!activeEntryId) return;

    set({
      entries: entries.map((entry) => {
        if (entry.id === activeEntryId && !entry.isRunning) {
          return {
            ...entry,
            startTime: new Date().toISOString(),
            isRunning: true,
          };
        }
        return entry;
      }),
    });
  },

  addManualEntry: async (entryData) => {
    const tempId = crypto.randomUUID();
    const now = new Date().toISOString();

    const optimisticEntry: TimeEntry = {
      ...entryData,
      id: tempId,
      isRunning: false,
      createdAt: now,
    };

    set((state) => ({ entries: [...state.entries, optimisticEntry] }));

    try {
      const db = await import("@/lib/db").then((m) => m.getDb());
      const id = crypto.randomUUID();

      await db.execute(
        `INSERT INTO time_entries (id, task_id, project_id, client_id, category, description, start_time, end_time, duration_minutes, is_running, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          id,
          entryData.taskId || null,
          entryData.projectId || null,
          entryData.clientId || null,
          entryData.category,
          entryData.description || null,
          entryData.startTime,
          entryData.endTime || null,
          entryData.durationMinutes || null,
          now,
        ]
      );

      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === tempId ? { ...e, id, createdAt: now } : e
        ),
      }));
    } catch (error) {
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== tempId),
      }));
      console.error("Failed to add manual entry:", error);
      toast.error("Failed to add time entry");
    }
  },

  updateEntry: async (id, updates) => {
    const previousEntries = get().entries;

    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      ),
    }));

    try {
      await timeEntryService.update(id, updates);
    } catch (error) {
      set({ entries: previousEntries });
      console.error("Failed to update entry:", error);
      toast.error("Failed to update time entry");
    }
  },

  deleteEntry: async (id) => {
    const { activeEntryId, entries } = get();
    const previousEntries = entries;

    set({
      entries: entries.filter((entry) => entry.id !== id),
      activeEntryId: activeEntryId === id ? null : activeEntryId,
    });

    try {
      await timeEntryService.delete(id);
    } catch (error) {
      set({ entries: previousEntries, activeEntryId });
      console.error("Failed to delete entry:", error);
      toast.error("Failed to delete time entry");
    }
  },
}));

// Selectors
export const useActiveEntry = () => {
  const { entries, activeEntryId } = useTimerStore();
  return entries.find((entry) => entry.id === activeEntryId) || null;
};

export const useTodayEntries = () => {
  const { entries } = useTimerStore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return entries.filter((entry) => {
    const entryDate = new Date(entry.startTime);
    entryDate.setHours(0, 0, 0, 0);
    return entryDate.getTime() === today.getTime();
  });
};

export const useWeekEntries = () => {
  const { entries } = useTimerStore();
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);

  return entries.filter((entry) => {
    const entryDate = new Date(entry.startTime);
    return entryDate >= weekStart;
  });
};

export const useTodayTotalMinutes = () => {
  const todayEntries = useTodayEntries();
  return todayEntries.reduce((total, entry) => {
    if (entry.durationMinutes) {
      return total + entry.durationMinutes;
    }
    if (entry.isRunning) {
      const startTime = new Date(entry.startTime);
      const now = new Date();
      return total + Math.round((now.getTime() - startTime.getTime()) / 60000);
    }
    return total;
  }, 0);
};

export const useWeekTotalMinutes = () => {
  const weekEntries = useWeekEntries();
  return weekEntries.reduce((total, entry) => {
    if (entry.durationMinutes) {
      return total + entry.durationMinutes;
    }
    if (entry.isRunning) {
      const startTime = new Date(entry.startTime);
      const now = new Date();
      return total + Math.round((now.getTime() - startTime.getTime()) / 60000);
    }
    return total;
  }, 0);
};

export const useCategoryBreakdown = (entries: TimeEntry[]) => {
  const breakdown: Record<TimeCategory, number> = {
    coding: 0,
    meetings: 0,
    admin: 0,
    planning: 0,
    other: 0,
  };

  entries.forEach((entry) => {
    const minutes = entry.durationMinutes || 0;
    breakdown[entry.category] += minutes;
  });

  return breakdown;
};
