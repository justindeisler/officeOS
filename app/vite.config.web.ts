import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vite config for web builds
 * Uses REST API instead of Tauri SQL plugin
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Specific aliases MUST come before generic ones
      { find: "@/lib/db", replacement: path.resolve(__dirname, "./src/lib/db.web.ts") },
      { find: "@/services/taskService", replacement: path.resolve(__dirname, "./src/services/web/taskService.ts") },
      { find: "@/services/projectService", replacement: path.resolve(__dirname, "./src/services/web/projectService.ts") },
      { find: "@/services/clientService", replacement: path.resolve(__dirname, "./src/services/web/clientService.ts") },
      { find: "@/services/timeEntryService", replacement: path.resolve(__dirname, "./src/services/web/timeEntryService.ts") },
      { find: "@/services/captureService", replacement: path.resolve(__dirname, "./src/services/web/captureService.ts") },
      { find: "@/services/settingsService", replacement: path.resolve(__dirname, "./src/services/web/settingsService.ts") },
      { find: "@/services/tagService", replacement: path.resolve(__dirname, "./src/services/web/tagService.ts") },
      { find: "@/services/invoiceService", replacement: path.resolve(__dirname, "./src/services/web/invoiceService.ts") },
      { find: "@/services/base", replacement: path.resolve(__dirname, "./src/services/web/base.ts") },
      { find: /^@\/services$/, replacement: path.resolve(__dirname, "./src/services/web/index.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  define: {
    // Remove Tauri-specific globals
    "__TAURI__": "undefined",
  },
  build: {
    outDir: "dist-web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
