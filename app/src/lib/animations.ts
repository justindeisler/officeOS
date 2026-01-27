import { Variants } from "framer-motion";

// Easing curves (typed as tuples for Framer Motion)
export const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const easeOutBack: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

// Duration constants
export const duration = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
};

// Fade animations
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal, ease: easeOutExpo }
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast }
  }
};

// Slide up animation (for dialogs, modals)
export const slideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.normal,
      ease: easeOutExpo
    }
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.98,
    transition: { duration: duration.fast }
  }
};

// Slide from right (for sidebars, panels)
export const slideFromRight: Variants = {
  hidden: {
    opacity: 0,
    x: 20
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: duration.normal,
      ease: easeOutExpo
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: duration.fast }
  }
};

// Scale animation (for cards, buttons)
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: duration.normal,
      ease: easeOutBack
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: duration.fast }
  }
};

// Stagger children animation
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    }
  }
};

export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 10
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.normal,
      ease: easeOutExpo
    }
  }
};

// List item animation (for task cards, etc)
export const listItem: Variants = {
  hidden: {
    opacity: 0,
    x: -10
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: duration.normal,
      ease: easeOutExpo
    }
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: { duration: duration.fast }
  }
};

// Page transition
export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 8
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.normal,
      ease: easeOutExpo,
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast }
  }
};

// Hover animations (use with whileHover)
export const hoverScale = {
  scale: 1.02,
  transition: { duration: duration.fast }
};

export const hoverLift = {
  y: -2,
  transition: { duration: duration.fast }
};

// Tap animation (use with whileTap)
export const tapScale = {
  scale: 0.98
};
