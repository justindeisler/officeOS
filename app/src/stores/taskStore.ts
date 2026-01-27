import { create } from "zustand";
import { taskService } from "@/services";
import { toast } from "sonner";
import type { Task, TaskStatus, Area } from "@/types";

interface TaskState {
  tasks: Task[];
  isLoaded: boolean;
  filter: {
    area: Area | "all";
    search: string;
  };

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  addTask: (
    task: Omit<Task, "id" | "createdAt" | "updatedAt" | "sortOrder">
  ) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (
    taskId: string,
    newStatus: TaskStatus,
    newIndex: number
  ) => Promise<void>;
  reorderTasks: (
    status: TaskStatus,
    startIndex: number,
    endIndex: number
  ) => Promise<void>;

  // Local-only (not persisted to DB)
  setFilter: (filter: Partial<TaskState["filter"]>) => void;
}

export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  isLoaded: false,
  filter: {
    area: "all",
    search: "",
  },

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const tasks = await taskService.getAll();
      set({ tasks, isLoaded: true });
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Failed to load tasks");
      set({ isLoaded: true });
    }
  },

  addTask: async (taskData) => {
    const now = new Date().toISOString();
    const statusTasks = get().tasks.filter((t) => t.status === taskData.status);
    const maxOrder = Math.max(0, ...statusTasks.map((t) => t.sortOrder));

    const tempId = crypto.randomUUID();
    const optimisticTask: Task = {
      ...taskData,
      id: tempId,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ tasks: [...state.tasks, optimisticTask] }));

    try {
      const createdTask = await taskService.create(taskData);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === tempId ? createdTask : t)),
      }));
    } catch (error) {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== tempId),
      }));
      console.error("Failed to create task:", error);
      toast.error("Failed to create task");
    }
  },

  updateTask: async (id, updates) => {
    const previousTasks = get().tasks;
    const now = new Date().toISOString();

    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates, updatedAt: now } : task
      ),
    }));

    try {
      await taskService.update(id, { ...updates, updatedAt: now });
    } catch (error) {
      set({ tasks: previousTasks });
      console.error("Failed to update task:", error);
      toast.error("Failed to update task");
    }
  },

  deleteTask: async (id) => {
    const previousTasks = get().tasks;

    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));

    try {
      await taskService.delete(id);
    } catch (error) {
      set({ tasks: previousTasks });
      console.error("Failed to delete task:", error);
      toast.error("Failed to delete task");
    }
  },

  moveTask: async (taskId, newStatus, newIndex) => {
    const previousTasks = get().tasks;
    const now = new Date().toISOString();

    set((state) => {
      const tasks = [...state.tasks];
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return state;

      const task = { ...tasks[taskIndex] };
      const oldStatus = task.status;

      task.status = newStatus;
      task.updatedAt = now;

      if (newStatus === "done" && oldStatus !== "done") {
        task.completedAt = now;
      } else if (newStatus !== "done") {
        task.completedAt = undefined;
      }

      const columnTasks = tasks
        .filter((t) => t.status === newStatus && t.id !== taskId)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      columnTasks.splice(newIndex, 0, task);

      columnTasks.forEach((t, index) => {
        const taskInAll = tasks.find((x) => x.id === t.id);
        if (taskInAll) {
          taskInAll.sortOrder = index;
          if (taskInAll.id === taskId) {
            taskInAll.status = newStatus;
            taskInAll.updatedAt = now;
            if (newStatus === "done" && oldStatus !== "done") {
              taskInAll.completedAt = now;
            } else if (newStatus !== "done") {
              taskInAll.completedAt = undefined;
            }
          }
        }
      });

      return { tasks };
    });

    try {
      await taskService.moveTask(taskId, newStatus, newIndex);
    } catch (error) {
      set({ tasks: previousTasks });
      console.error("Failed to move task:", error);
      toast.error("Failed to move task");
    }
  },

  reorderTasks: async (status, startIndex, endIndex) => {
    const previousTasks = get().tasks;
    const now = new Date().toISOString();

    set((state) => {
      const tasks = [...state.tasks];
      const columnTasks = tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const [moved] = columnTasks.splice(startIndex, 1);
      columnTasks.splice(endIndex, 0, moved);

      columnTasks.forEach((task, index) => {
        const taskInAll = tasks.find((t) => t.id === task.id);
        if (taskInAll) {
          taskInAll.sortOrder = index;
          taskInAll.updatedAt = now;
        }
      });

      return { tasks };
    });

    try {
      const columnTasks = get()
        .tasks.filter((t) => t.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const taskIds = columnTasks.map((t) => t.id);
      await taskService.reorderTasks(taskIds, status);
    } catch (error) {
      set({ tasks: previousTasks });
      console.error("Failed to reorder tasks:", error);
      toast.error("Failed to reorder tasks");
    }
  },

  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },
}));

// Selectors
export const useFilteredTasks = () => {
  const { tasks, filter } = useTaskStore();

  return tasks.filter((task) => {
    if (filter.area !== "all" && task.area !== filter.area) {
      return false;
    }
    if (
      filter.search &&
      !task.title.toLowerCase().includes(filter.search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
};

export const useTasksByStatus = (status: TaskStatus) => {
  const filteredTasks = useFilteredTasks();
  return filteredTasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.sortOrder - b.sortOrder);
};
