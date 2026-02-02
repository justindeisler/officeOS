import { create } from "zustand";
import { settingsService } from "@/services";
import { toast } from "sonner";
import type { Settings, Area, BusinessProfile } from "@/types";

interface SettingsState extends Settings {
  isLoaded: boolean;

  // Lifecycle
  initialize: () => Promise<void>;

  // Actions
  setWorkspacePath: (path: string | undefined) => Promise<void>;
  setTheme: (theme: "light" | "dark" | "system") => Promise<void>;
  setDefaultArea: (area: Area) => Promise<void>;
  setDefaultCurrency: (currency: string) => Promise<void>;
  setUserName: (name: string) => Promise<void>;
  setBusinessProfile: (profile: BusinessProfile) => Promise<void>;
  resetSettings: () => Promise<void>;
}

const defaultSettings: Settings = {
  workspacePath: undefined,
  theme: "dark",
  defaultArea: "freelance",
  defaultCurrency: "EUR",
  userName: "Justin Deisler",
};

// Helper to apply theme to document
const applyTheme = (theme: "light" | "dark" | "system") => {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
};

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...defaultSettings,
  isLoaded: false,

  initialize: async () => {
    if (get().isLoaded) return;

    try {
      const settings = await settingsService.getAll();
      set({ ...settings, isLoaded: true });

      // Apply theme after loading
      applyTheme(settings.theme);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Failed to load settings");
      set({ isLoaded: true });

      // Apply default theme on error
      applyTheme(defaultSettings.theme);
    }
  },

  setWorkspacePath: async (path) => {
    const previousPath = get().workspacePath;
    set({ workspacePath: path });

    try {
      await settingsService.set("workspacePath", path);
    } catch (error) {
      set({ workspacePath: previousPath });
      console.error("Failed to save workspace path:", error);
      toast.error("Failed to save workspace path");
    }
  },

  setTheme: async (theme) => {
    const previousTheme = get().theme;

    // Apply theme immediately for responsive UX
    applyTheme(theme);
    set({ theme });

    try {
      await settingsService.set("theme", theme);
    } catch (error) {
      // Rollback
      applyTheme(previousTheme);
      set({ theme: previousTheme });
      console.error("Failed to save theme:", error);
      toast.error("Failed to save theme");
    }
  },

  setDefaultArea: async (area) => {
    const previousArea = get().defaultArea;
    set({ defaultArea: area });

    try {
      await settingsService.set("defaultArea", area);
    } catch (error) {
      set({ defaultArea: previousArea });
      console.error("Failed to save default area:", error);
      toast.error("Failed to save default area");
    }
  },

  setDefaultCurrency: async (currency) => {
    const previousCurrency = get().defaultCurrency;
    set({ defaultCurrency: currency });

    try {
      await settingsService.set("defaultCurrency", currency);
    } catch (error) {
      set({ defaultCurrency: previousCurrency });
      console.error("Failed to save default currency:", error);
      toast.error("Failed to save default currency");
    }
  },

  setUserName: async (name) => {
    const previousName = get().userName;
    set({ userName: name });

    try {
      await settingsService.set("userName", name);
    } catch (error) {
      set({ userName: previousName });
      console.error("Failed to save user name:", error);
      toast.error("Failed to save user name");
    }
  },

  setBusinessProfile: async (profile) => {
    const previousProfile = get().businessProfile;
    set({ businessProfile: profile });

    try {
      await settingsService.set("businessProfile", profile);
    } catch (error) {
      set({ businessProfile: previousProfile });
      console.error("Failed to save business profile:", error);
      toast.error("Failed to save business profile");
    }
  },

  resetSettings: async () => {
    const previousSettings = {
      workspacePath: get().workspacePath,
      theme: get().theme,
      defaultArea: get().defaultArea,
      defaultCurrency: get().defaultCurrency,
      userName: get().userName,
    };

    set(defaultSettings);
    applyTheme(defaultSettings.theme);

    try {
      await settingsService.reset();
    } catch (error) {
      set(previousSettings);
      applyTheme(previousSettings.theme);
      console.error("Failed to reset settings:", error);
      toast.error("Failed to reset settings");
    }
  },
}));

// Selectors
export const useWorkspacePath = () => {
  const { workspacePath } = useSettingsStore();
  return workspacePath;
};

export const useTheme = () => {
  const { theme } = useSettingsStore();
  return theme;
};

export const useUserName = () => {
  const { userName } = useSettingsStore();
  return userName;
};
