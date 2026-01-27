import { create } from "zustand";
import { projectService } from "@/services";
import { toast } from "sonner";
import type { Project, ProjectStatus, Area } from "@/types";

interface ProjectFilter {
  status: ProjectStatus | "all";
  area: Area | "all";
  clientId: string | "all";
}

interface ProjectState {
  projects: Project[];
  isLoaded: boolean;
  filter: ProjectFilter;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  addProject: (
    project: Omit<Project, "id" | "createdAt" | "updatedAt">
  ) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Local-only
  setFilter: (filter: Partial<ProjectFilter>) => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  isLoaded: false,
  filter: {
    status: "all",
    area: "all",
    clientId: "all",
  },

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const projects = await projectService.getAll();
      set({ projects, isLoaded: true });
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error("Failed to load projects");
      set({ isLoaded: true });
    }
  },

  addProject: async (projectData) => {
    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();

    const optimisticProject: Project = {
      ...projectData,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ projects: [...state.projects, optimisticProject] }));

    try {
      const createdProject = await projectService.create(projectData);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === tempId ? createdProject : p
        ),
      }));
    } catch (error) {
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== tempId),
      }));
      console.error("Failed to create project:", error);
      toast.error("Failed to create project");
    }
  },

  updateProject: async (id, updates) => {
    const previousProjects = get().projects;
    const now = new Date().toISOString();

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id
          ? { ...project, ...updates, updatedAt: now }
          : project
      ),
    }));

    try {
      await projectService.update(id, { ...updates, updatedAt: now });
    } catch (error) {
      set({ projects: previousProjects });
      console.error("Failed to update project:", error);
      toast.error("Failed to update project");
    }
  },

  deleteProject: async (id) => {
    const previousProjects = get().projects;

    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
    }));

    try {
      await projectService.delete(id);
    } catch (error) {
      set({ projects: previousProjects });
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
    }
  },

  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },
}));

// Selectors
export const useFilteredProjects = () => {
  const { projects, filter } = useProjectStore();

  return projects.filter((project) => {
    if (filter.status !== "all" && project.status !== filter.status) {
      return false;
    }
    if (filter.area !== "all" && project.area !== filter.area) {
      return false;
    }
    if (filter.clientId !== "all" && project.clientId !== filter.clientId) {
      return false;
    }
    return true;
  });
};

export const useActiveProjects = () => {
  const { projects } = useProjectStore();
  return projects.filter((project) => project.status === "active");
};

export const useProjectById = (id: string) => {
  const { projects } = useProjectStore();
  return projects.find((project) => project.id === id);
};

export const useProjectsByClient = (clientId: string) => {
  const { projects } = useProjectStore();
  return projects.filter((project) => project.clientId === clientId);
};

export const useProjectsByStatus = (status: ProjectStatus) => {
  const { projects } = useProjectStore();
  return projects.filter((project) => project.status === status);
};
