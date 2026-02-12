import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite config for web builds
 * Uses REST API instead of Tauri SQL plugin
 *
 * Bundle optimization strategy:
 * - Route-based code splitting via React.lazy() in App.tsx
 * - Manual chunks for heavy vendor libraries
 * - Tree-shaking via ES module imports
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'app-icon.png', 'vite.svg'],
      manifest: {
        name: 'Personal Assistant',
        short_name: 'PA',
        description: 'Personal productivity assistant for tasks, projects, time tracking, and more',
        theme_color: '#3b82f6',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache-v2',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache-v2',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Enable background sync for offline task creation
        skipWaiting: true,
        clientsClaim: true
      },
      devOptions: {
        enabled: false // Disable in dev mode to avoid confusion
      }
    })
  ],
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
    // Only preload chunks that are needed for the initial render.
    // Lazy-loaded vendor chunks (recharts, markdown, etc.) should NOT be
    // preloaded — they load on-demand when the user navigates.
    modulePreload: {
      resolveDependencies: (filename, deps, { hostId, hostType }) => {
        // Only keep preloads for the entry chunk's direct dependencies
        // (vendor-react, vendor-router) — skip heavy lazy vendor chunks
        const lazyVendors = [
          "vendor-recharts",
          "vendor-markdown",
          "vendor-framer-motion",
          "vendor-dnd",
          "vendor-forms",
          "vendor-radix",
          "vendor-floating-ui",
        ];
        return deps.filter(
          (dep) => !lazyVendors.some((v) => dep.includes(v))
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Vendor chunking strategy ──────────────────────────

          // React core — loaded on every page
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }

          // React Router — loaded on every page
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }

          // Recharts + D3 dependencies — only needed by chart pages
          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/decimal.js-light") ||
            id.includes("node_modules/react-smooth") ||
            id.includes("node_modules/recharts-scale") ||
            id.includes("node_modules/eventemitter3") ||
            id.includes("node_modules/lodash") ||
            id.includes("node_modules/fast-equals")
          ) {
            return "vendor-recharts";
          }

          // Framer Motion — only a few components use animations
          if (
            id.includes("node_modules/framer-motion") ||
            id.includes("node_modules/motion-dom") ||
            id.includes("node_modules/motion-utils")
          ) {
            return "vendor-framer-motion";
          }

          // Markdown ecosystem — only SecondBrainPage
          // Note: react-markdown depends on react/react-dom but those are
          // already in vendor-react, so we only chunk the markdown-specific
          // parsing/rendering libraries here (no circular dependency).
          if (
            id.includes("node_modules/remark-") ||
            id.includes("node_modules/rehype-") ||
            id.includes("node_modules/micromark") ||
            id.includes("node_modules/mdast-") ||
            id.includes("node_modules/hast-") ||
            id.includes("node_modules/unified") ||
            id.includes("node_modules/unist-") ||
            id.includes("node_modules/vfile") ||
            id.includes("node_modules/markdown-table") ||
            id.includes("node_modules/property-information") ||
            id.includes("node_modules/decode-named-character-reference") ||
            id.includes("node_modules/estree-util-") ||
            id.includes("node_modules/inline-style-parser") ||
            id.includes("node_modules/style-to-") ||
            id.includes("node_modules/comma-separated-tokens") ||
            id.includes("node_modules/trim-lines") ||
            id.includes("node_modules/trough") ||
            id.includes("node_modules/@ungap/structured-clone")
          ) {
            return "vendor-markdown";
          }

          // react-markdown itself (kept separate from parsing libs to avoid
          // circular dependency with vendor-react)
          if (id.includes("node_modules/react-markdown")) {
            return "vendor-markdown";
          }

          // Form handling
          if (
            id.includes("node_modules/react-hook-form") ||
            id.includes("node_modules/@hookform") ||
            id.includes("node_modules/zod")
          ) {
            return "vendor-forms";
          }

          // DnD Kit — only tasks/kanban
          if (id.includes("node_modules/@dnd-kit")) {
            return "vendor-dnd";
          }

          // Radix UI primitives — keep tiny/always-needed packages in
          // the main chunk; heavy interactive components go to vendor-radix
          if (id.includes("node_modules/@radix-ui/react-slot") ||
              id.includes("node_modules/@radix-ui/react-primitive") ||
              id.includes("node_modules/@radix-ui/react-context") ||
              id.includes("node_modules/@radix-ui/react-collapsible") ||
              id.includes("node_modules/@radix-ui/primitive")) {
            // These are tiny and used in the app shell — stay in the main chunk
            return undefined;
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }

          // date-fns
          if (id.includes("node_modules/date-fns")) {
            return "vendor-date-fns";
          }

          // Floating UI (used by Radix/popovers)
          if (id.includes("node_modules/@floating-ui")) {
            return "vendor-floating-ui";
          }
        },
      },
    },
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
