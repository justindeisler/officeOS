import { create } from "zustand";
import { prdService } from "@/services";
import { toast } from "sonner";
import type { PRD, PRDStatus, PRDFormData, UserStory, Requirement, Milestone } from "@/types/prd";
import type { Area } from "@/types";

interface PRDFilter {
  status: PRDStatus | "all";
  area: Area | "all";
  projectId: string | "all";
}

interface PRDState {
  prds: PRD[];
  isLoaded: boolean;
  filter: PRDFilter;
  
  // Wizard state
  currentStep: number;
  formData: PRDFormData;

  // Lifecycle
  initialize: () => Promise<void>;

  // CRUD Actions
  addPRD: (prd: Omit<PRD, "id" | "createdAt" | "updatedAt">) => Promise<PRD | null>;
  updatePRD: (id: string, updates: Partial<PRD>) => Promise<void>;
  deletePRD: (id: string) => Promise<void>;

  // Wizard Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (data: Partial<PRDFormData>) => void;
  resetForm: () => void;
  
  // Form helpers
  addUserStory: (story: Omit<UserStory, "id">) => void;
  updateUserStory: (id: string, story: Partial<UserStory>) => void;
  removeUserStory: (id: string) => void;
  
  addRequirement: (req: Omit<Requirement, "id">) => void;
  updateRequirement: (id: string, req: Partial<Requirement>) => void;
  removeRequirement: (id: string) => void;
  
  addMilestone: (milestone: Omit<Milestone, "id">) => void;
  updateMilestone: (id: string, milestone: Partial<Milestone>) => void;
  removeMilestone: (id: string) => void;

  // Filter
  setFilter: (filter: Partial<PRDFilter>) => void;
}

const initialFormData: PRDFormData = {
  version: "1.0",
  author: "Justin",
  assignee: "james",
  area: "personal",
  goals: [],
  nonGoals: [],
  userStories: [],
  requirements: [],
  dependencies: [],
  risks: [],
  assumptions: [],
  constraints: [],
  successMetrics: [],
  milestones: [],
};

export const usePRDStore = create<PRDState>()((set, get) => ({
  prds: [],
  isLoaded: false,
  filter: {
    status: "all",
    area: "all",
    projectId: "all",
  },
  currentStep: 1,
  formData: { ...initialFormData },

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const prds = await prdService.getAll();
      set({ prds, isLoaded: true });
    } catch (error) {
      console.error("Failed to load PRDs:", error);
      toast.error("Failed to load PRDs");
      set({ isLoaded: true });
    }
  },

  addPRD: async (prdData) => {
    const now = new Date().toISOString();
    const tempId = crypto.randomUUID();

    const optimisticPRD: PRD = {
      ...prdData,
      id: tempId,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({ prds: [...state.prds, optimisticPRD] }));

    try {
      const createdPRD = await prdService.create(prdData);
      set((state) => ({
        prds: state.prds.map((p) => (p.id === tempId ? createdPRD : p)),
      }));
      return createdPRD;
    } catch (error) {
      set((state) => ({
        prds: state.prds.filter((p) => p.id !== tempId),
      }));
      console.error("Failed to create PRD:", error);
      toast.error("Failed to create PRD");
      return null;
    }
  },

  updatePRD: async (id, updates) => {
    const previousPRDs = get().prds;
    const now = new Date().toISOString();

    set((state) => ({
      prds: state.prds.map((prd) =>
        prd.id === id ? { ...prd, ...updates, updatedAt: now } : prd
      ),
    }));

    try {
      await prdService.update(id, { ...updates, updatedAt: now });
    } catch (error) {
      set({ prds: previousPRDs });
      console.error("Failed to update PRD:", error);
      toast.error("Failed to update PRD");
    }
  },

  deletePRD: async (id) => {
    const previousPRDs = get().prds;

    set((state) => ({
      prds: state.prds.filter((prd) => prd.id !== id),
    }));

    try {
      await prdService.delete(id);
    } catch (error) {
      set({ prds: previousPRDs });
      console.error("Failed to delete PRD:", error);
      toast.error("Failed to delete PRD");
    }
  },

  // Wizard navigation
  setCurrentStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => ({ 
    currentStep: Math.min(state.currentStep + 1, 5) 
  })),
  
  prevStep: () => set((state) => ({ 
    currentStep: Math.max(state.currentStep - 1, 1) 
  })),

  updateFormData: (data) => set((state) => ({
    formData: { ...state.formData, ...data },
  })),

  resetForm: () => set({
    currentStep: 1,
    formData: { ...initialFormData },
  }),

  // User Stories
  addUserStory: (story) => set((state) => ({
    formData: {
      ...state.formData,
      userStories: [
        ...(state.formData.userStories || []),
        { ...story, id: crypto.randomUUID() },
      ],
    },
  })),

  updateUserStory: (id, updates) => set((state) => ({
    formData: {
      ...state.formData,
      userStories: (state.formData.userStories || []).map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    },
  })),

  removeUserStory: (id) => set((state) => ({
    formData: {
      ...state.formData,
      userStories: (state.formData.userStories || []).filter((s) => s.id !== id),
    },
  })),

  // Requirements
  addRequirement: (req) => set((state) => ({
    formData: {
      ...state.formData,
      requirements: [
        ...(state.formData.requirements || []),
        { ...req, id: crypto.randomUUID() },
      ],
    },
  })),

  updateRequirement: (id, updates) => set((state) => ({
    formData: {
      ...state.formData,
      requirements: (state.formData.requirements || []).map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    },
  })),

  removeRequirement: (id) => set((state) => ({
    formData: {
      ...state.formData,
      requirements: (state.formData.requirements || []).filter((r) => r.id !== id),
    },
  })),

  // Milestones
  addMilestone: (milestone) => set((state) => ({
    formData: {
      ...state.formData,
      milestones: [
        ...(state.formData.milestones || []),
        { ...milestone, id: crypto.randomUUID() },
      ],
    },
  })),

  updateMilestone: (id, updates) => set((state) => ({
    formData: {
      ...state.formData,
      milestones: (state.formData.milestones || []).map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    },
  })),

  removeMilestone: (id) => set((state) => ({
    formData: {
      ...state.formData,
      milestones: (state.formData.milestones || []).filter((m) => m.id !== id),
    },
  })),

  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter },
  })),
}));

// Selectors
export const useFilteredPRDs = () => {
  const { prds, filter } = usePRDStore();

  return prds.filter((prd) => {
    if (filter.status !== "all" && prd.status !== filter.status) return false;
    if (filter.area !== "all" && prd.area !== filter.area) return false;
    if (filter.projectId !== "all" && prd.projectId !== filter.projectId) return false;
    return true;
  });
};

export const usePRDById = (id: string) => {
  const { prds } = usePRDStore();
  return prds.find((prd) => prd.id === id);
};

export const usePRDsByProject = (projectId: string) => {
  const { prds } = usePRDStore();
  return prds.filter((prd) => prd.projectId === projectId);
};
