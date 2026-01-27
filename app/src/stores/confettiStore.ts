import { create } from "zustand";

interface ConfettiState {
  isActive: boolean;
  trigger: () => void;
  reset: () => void;
}

const ANIMATION_DURATION = 2500; // ms

export const useConfettiStore = create<ConfettiState>()((set) => ({
  isActive: false,

  trigger: () => {
    set({ isActive: true });

    // Auto-reset after animation completes
    setTimeout(() => {
      set({ isActive: false });
    }, ANIMATION_DURATION);
  },

  reset: () => {
    set({ isActive: false });
  },
}));
