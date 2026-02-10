/**
 * Tag store – manages tags and task-tag associations.
 *
 * Tags are loaded once at app init and kept in sync via CRUD operations.
 * Task-tag mappings (taskTags) are loaded in bulk for the Kanban board.
 */

import { create } from "zustand";
import { tagService } from "@/services";
import { toast } from "sonner";
import type { Tag } from "@/types";

interface TagState {
  /** All available tags */
  tags: Tag[];
  /** Map of taskId → Tag[] */
  taskTags: Record<string, Tag[]>;
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Tag CRUD
  createTag: (data: Omit<Tag, "id">) => Promise<Tag | null>;
  updateTag: (id: string, updates: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  // Task-Tag associations
  loadTaskTags: (taskIds: string[]) => Promise<void>;
  syncTaskTags: (taskId: string, tagIds: string[]) => Promise<void>;

  /** Filter helper: currently selected tag IDs for filtering */
  filterTagIds: string[];
  setFilterTagIds: (ids: string[]) => void;
}

export const useTagStore = create<TagState>()((set, get) => ({
  tags: [],
  taskTags: {},
  isLoaded: false,
  filterTagIds: [],

  initialize: async () => {
    if (get().isLoaded) return;
    try {
      const tags = await tagService.getAll();
      set({ tags, isLoaded: true });
    } catch (error) {
      console.error("Failed to load tags:", error);
      set({ isLoaded: true });
    }
  },

  createTag: async (data) => {
    try {
      const tag = await tagService.create(data);
      set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }));
      return tag;
    } catch (error: unknown) {
      console.error("Failed to create tag:", error);
      const message = error instanceof Error ? error.message : "Failed to create tag";
      toast.error(message);
      return null;
    }
  },

  updateTag: async (id, updates) => {
    const prev = get().tags;
    // Optimistic update
    set((state) => ({
      tags: state.tags
        .map((t) => (t.id === id ? { ...t, ...updates } : t))
        .sort((a, b) => a.name.localeCompare(b.name)),
      // Also update taskTags references
      taskTags: Object.fromEntries(
        Object.entries(state.taskTags).map(([taskId, tags]) => [
          taskId,
          tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        ])
      ),
    }));

    try {
      await tagService.update(id, updates);
    } catch (error) {
      set({ tags: prev });
      console.error("Failed to update tag:", error);
      toast.error("Failed to update tag");
    }
  },

  deleteTag: async (id) => {
    const prev = get().tags;
    const prevTaskTags = get().taskTags;

    // Optimistic update – remove tag everywhere
    set((state) => ({
      tags: state.tags.filter((t) => t.id !== id),
      taskTags: Object.fromEntries(
        Object.entries(state.taskTags).map(([taskId, tags]) => [
          taskId,
          tags.filter((t) => t.id !== id),
        ])
      ),
      filterTagIds: state.filterTagIds.filter((fid) => fid !== id),
    }));

    try {
      await tagService.delete(id);
    } catch (error) {
      set({ tags: prev, taskTags: prevTaskTags });
      console.error("Failed to delete tag:", error);
      toast.error("Failed to delete tag");
    }
  },

  loadTaskTags: async (taskIds) => {
    if (taskIds.length === 0) return;
    try {
      const bulk = await tagService.getTaskTagsBulk(taskIds);
      set((state) => ({
        taskTags: { ...state.taskTags, ...bulk },
      }));
    } catch (error) {
      console.error("Failed to load task tags:", error);
    }
  },

  syncTaskTags: async (taskId, tagIds) => {
    try {
      const tags = await tagService.syncTaskTags(taskId, tagIds);
      set((state) => ({
        taskTags: { ...state.taskTags, [taskId]: tags },
      }));
    } catch (error) {
      console.error("Failed to sync task tags:", error);
      toast.error("Failed to update task tags");
    }
  },

  setFilterTagIds: (ids) => set({ filterTagIds: ids }),
}));
