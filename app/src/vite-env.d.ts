/// <reference types="vite/client" />

// Extend Window interface for Tauri internals
interface Window {
  __TAURI_INTERNALS__?: unknown;
}
