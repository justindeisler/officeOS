/**
 * Hook for managing subtasks
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Subtask, SubtaskCounts } from "@/types";

// Transform snake_case to camelCase
function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function sanitizeSubtask(raw: Record<string, unknown>): Subtask {
  const camel = toCamelCase(raw);
  return {
    id: camel.id as string,
    taskId: camel.taskId as string,
    title: camel.title as string,
    completed: Boolean(camel.completed),
    sortOrder: (camel.sortOrder as number) ?? 0,
    createdAt: camel.createdAt as string,
  };
}

interface UseSubtasksOptions {
  taskId: string;
  enabled?: boolean;
}

interface UseSubtasksReturn {
  subtasks: Subtask[];
  isLoading: boolean;
  error: string | null;
  addSubtask: (title: string) => Promise<void>;
  toggleSubtask: (id: string, completed: boolean) => Promise<void>;
  updateSubtask: (id: string, title: string) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  reorderSubtasks: (subtaskIds: string[]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSubtasks({ taskId, enabled = true }: UseSubtasksOptions): UseSubtasksReturn {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchSubtasks = useCallback(async () => {
    if (!taskId || !enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.getSubtasks(taskId);
      const sanitized = (data as Record<string, unknown>[]).map(sanitizeSubtask);
      setSubtasks(sanitized);
      fetchedRef.current = true;
    } catch (err) {
      console.error("Failed to fetch subtasks:", err);
      setError("Failed to load subtasks");
    } finally {
      setIsLoading(false);
    }
  }, [taskId, enabled]);

  // Fetch on mount when enabled
  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      fetchSubtasks();
    }
  }, [enabled, fetchSubtasks]);

  // Reset when taskId changes
  useEffect(() => {
    fetchedRef.current = false;
    setSubtasks([]);
  }, [taskId]);

  const addSubtask = useCallback(async (title: string) => {
    if (!title.trim()) return;

    // Optimistic update
    const tempId = crypto.randomUUID();
    const optimisticSubtask: Subtask = {
      id: tempId,
      taskId,
      title: title.trim(),
      completed: false,
      sortOrder: subtasks.length,
      createdAt: new Date().toISOString(),
    };

    setSubtasks((prev) => [...prev, optimisticSubtask]);

    try {
      const created = await api.createSubtask(taskId, title.trim());
      const sanitized = sanitizeSubtask(created as Record<string, unknown>);
      setSubtasks((prev) =>
        prev.map((s) => (s.id === tempId ? sanitized : s))
      );
    } catch (err) {
      console.error("Failed to create subtask:", err);
      setSubtasks((prev) => prev.filter((s) => s.id !== tempId));
      toast.error("Failed to add subtask");
    }
  }, [taskId, subtasks.length]);

  const toggleSubtask = useCallback(async (id: string, completed: boolean) => {
    // Optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed } : s))
    );

    try {
      await api.updateSubtask(id, { completed: completed ? 1 : 0 });
    } catch (err) {
      console.error("Failed to toggle subtask:", err);
      // Revert
      setSubtasks((prev) =>
        prev.map((s) => (s.id === id ? { ...s, completed: !completed } : s))
      );
      toast.error("Failed to update subtask");
    }
  }, []);

  const updateSubtaskTitle = useCallback(async (id: string, title: string) => {
    if (!title.trim()) return;

    const previousTitle = subtasks.find((s) => s.id === id)?.title;

    // Optimistic update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: title.trim() } : s))
    );

    try {
      await api.updateSubtask(id, { title: title.trim() });
    } catch (err) {
      console.error("Failed to update subtask:", err);
      // Revert
      if (previousTitle) {
        setSubtasks((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title: previousTitle } : s))
        );
      }
      toast.error("Failed to update subtask");
    }
  }, [subtasks]);

  const deleteSubtaskItem = useCallback(async (id: string) => {
    const previousSubtasks = subtasks;

    // Optimistic update
    setSubtasks((prev) => prev.filter((s) => s.id !== id));

    try {
      await api.deleteSubtask(id);
    } catch (err) {
      console.error("Failed to delete subtask:", err);
      setSubtasks(previousSubtasks);
      toast.error("Failed to delete subtask");
    }
  }, [subtasks]);

  const reorderSubtasksItems = useCallback(async (subtaskIds: string[]) => {
    const previousSubtasks = subtasks;

    // Optimistic update - reorder locally
    const reordered = subtaskIds
      .map((id) => subtasks.find((s) => s.id === id))
      .filter((s): s is Subtask => s !== undefined)
      .map((s, idx) => ({ ...s, sortOrder: idx }));

    setSubtasks(reordered);

    try {
      await api.reorderSubtasks(taskId, subtaskIds);
    } catch (err) {
      console.error("Failed to reorder subtasks:", err);
      setSubtasks(previousSubtasks);
      toast.error("Failed to reorder subtasks");
    }
  }, [taskId, subtasks]);

  return {
    subtasks,
    isLoading,
    error,
    addSubtask,
    toggleSubtask,
    updateSubtask: updateSubtaskTitle,
    deleteSubtask: deleteSubtaskItem,
    reorderSubtasks: reorderSubtasksItems,
    refresh: fetchSubtasks,
  };
}

// Hook for fetching subtask counts for multiple tasks (for collapsed view)
export function useSubtaskCounts(taskIds: string[]): Record<string, SubtaskCounts> {
  const [counts, setCounts] = useState<Record<string, SubtaskCounts>>({});
  const prevTaskIdsRef = useRef<string>("");

  useEffect(() => {
    const taskIdsKey = taskIds.sort().join(",");
    if (taskIdsKey === prevTaskIdsRef.current || taskIds.length === 0) return;
    prevTaskIdsRef.current = taskIdsKey;

    const fetchCounts = async () => {
      try {
        const data = await api.getSubtaskCounts(taskIds);
        setCounts(data);
      } catch (err) {
        console.error("Failed to fetch subtask counts:", err);
      }
    };

    fetchCounts();
  }, [taskIds]);

  return counts;
}
