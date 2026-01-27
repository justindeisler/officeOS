import { useEffect, useCallback } from "react";

type KeyCombo = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
};

type ShortcutHandler = () => void;

type ShortcutMap = Record<string, ShortcutHandler>;

function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const ctrlMatch = combo.ctrl ? event.ctrlKey : !event.ctrlKey;
  const metaMatch = combo.meta ? event.metaKey : !event.metaKey;
  const shiftMatch = combo.shift ? event.shiftKey : !event.shiftKey;
  const altMatch = combo.alt ? event.altKey : !event.altKey;
  const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase();

  return ctrlMatch && metaMatch && shiftMatch && altMatch && keyMatch;
}

function parseShortcut(shortcut: string): KeyCombo {
  const parts = shortcut.toLowerCase().split("+");
  const combo: KeyCombo = {
    key: parts[parts.length - 1],
  };

  for (const part of parts.slice(0, -1)) {
    if (part === "ctrl" || part === "control") combo.ctrl = true;
    if (part === "meta" || part === "cmd" || part === "command") combo.meta = true;
    if (part === "shift") combo.shift = true;
    if (part === "alt" || part === "option") combo.alt = true;
  }

  return combo;
}

/**
 * Hook for handling keyboard shortcuts
 *
 * @example
 * useKeyboardShortcuts({
 *   "meta+k": () => openSearch(),
 *   "meta+n": () => createNew(),
 *   "escape": () => closeDialog(),
 * });
 */
export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  enabled: boolean = true
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow escape in inputs
      if (isInput && event.key !== "Escape") return;

      for (const [shortcut, handler] of Object.entries(shortcuts)) {
        const combo = parseShortcut(shortcut);
        if (matchesCombo(event, combo)) {
          event.preventDefault();
          handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Hook for a single keyboard shortcut
 */
export function useKeyboardShortcut(
  shortcut: string,
  handler: ShortcutHandler,
  enabled: boolean = true
) {
  useKeyboardShortcuts({ [shortcut]: handler }, enabled);
}

// Common shortcuts for reference
export const SHORTCUTS = {
  // Global
  SEARCH: "meta+k",
  NEW_TASK: "meta+n",
  NEW_CAPTURE: "meta+shift+space",

  // Navigation
  GO_DASHBOARD: "meta+1",
  GO_TASKS: "meta+2",
  GO_TIME: "meta+3",
  GO_PROJECTS: "meta+4",
  GO_CLIENTS: "meta+5",
  GO_INVOICES: "meta+6",
  GO_INBOX: "meta+7",
  GO_SETTINGS: "meta+,",

  // Actions
  SAVE: "meta+s",
  CLOSE: "escape",
  DELETE: "meta+backspace",
} as const;
