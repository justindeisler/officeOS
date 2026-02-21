/**
 * Personal Assistant REST API + Static File Server
 */

// Load environment variables first (before any other imports)
import "dotenv/config";

// Validate secrets immediately after env loading, before any app setup
import { validateStartupSecrets } from "./startup-validation.js";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { closeDb } from "./database.js";
import { cache } from "./cache.js";
import { logger } from "./logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import tasksRouter from "./routes/tasks.js";
import projectsRouter from "./routes/projects.js";
import clientsRouter from "./routes/clients.js";
import timeRouter from "./routes/time.js";
import capturesRouter from "./routes/captures.js";
import authRouter, { authMiddleware } from "./routes/auth.js";
import jamesRouter from "./routes/james.js";
import invoicesRouter from "./routes/invoices.js";
import secondBrainRouter from "./routes/second-brain.js";
import settingsRouter from "./routes/settings.js";
import incomeRouter from "./routes/income.js";
import expensesRouter from "./routes/expenses.js";
import assetsRouter from "./routes/assets.js";
import prdsRouter from "./routes/prds.js";
import suggestionsRouter from "./routes/suggestions.js";
import githubRouter from "./routes/github.js";
import jamesActionsRouter from "./routes/james-actions.js";
import jamesAutomationsRouter from "./routes/james-automations.js";
import jamesTasksRouter from "./routes/james-tasks.js";
import reportsRouter from "./routes/reports.js";
import subtasksRouter from "./routes/subtasks.js";
import clientAuthRouter from "./routes/clientAuth.js";
import clientDashboardRouter from "./routes/clientDashboard.js";
import usageRouter from "./routes/usage.js";
import apiUsageRouter from "./routes/api-usage.js";
import backupsRouter from "./routes/backups.js";
import socialMediaRouter from "./routes/social-media.js";
import tagsRouter from "./routes/tags.js";
import cacheRouter from "./routes/cache.js";
import officeRouter from "./routes/office.js";
import memoryRouter from "./routes/memory.js";
import auditRouter from "./routes/audit.js";
import elsterRouter from "./routes/elster.js";
import datevRouter from "./routes/datev.js";
import bankingRouter from "./routes/banking.js";
import bookingRulesRouter from "./routes/booking-rules.js";
import recurringInvoicesRouter from "./routes/recurring-invoices.js";
import dunningRouter from "./routes/dunning.js";

// Environment validation — fail fast if critical vars are missing or weak
// (Full validation logic in startup-validation.ts)
validateStartupSecrets();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (needed for rate limiting behind nginx/reverse proxy)
app.set('trust proxy', 1);

// Static files path (web build)
const STATIC_PATH = process.env.STATIC_PATH || join(__dirname, "../../app/dist-web");

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for SPA compatibility
  crossOriginEmbedderPolicy: false,
}));

// Global rate limiting - 300 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => req.path === "/health", // Skip health checks
  // Disable X-Forwarded-For validation since we're behind nginx proxy
  validate: { xForwardedForHeader: false },
});

// Stricter rate limiting for auth endpoints - 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
  skipSuccessfulRequests: true, // Only count failed attempts
  validate: { xForwardedForHeader: false },
});

app.use("/api/", limiter);
app.use("/api/auth/login", authLimiter);

// CORS — restrict to known origins only (no wildcard)
const allowedOrigins = [
  "https://pa.justin-deisler.com",
  // Development origins
  "http://localhost:3005",
  "http://localhost:3006",
  "http://127.0.0.1:3005",
  "http://127.0.0.1:3006",
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use(requestLogger);

// Health check (public)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use("/api/auth", authRouter);

// Client auth routes (public)
app.use("/api/auth/client", clientAuthRouter);

// Client dashboard routes (protected by client auth)
app.use("/api/client", clientDashboardRouter);

// James trigger (public - called from webapp)
app.use("/api/james", jamesRouter);

// Social media visuals (public static files - for <img> tags in UI)
app.use("/api/social-media/visuals", express.static("/home/jd-server-admin/clawd/social-media/visuals", {
  maxAge: "1d",
  immutable: false,
}));

// James usage/cost tracking (protected)
app.use("/api/james", authMiddleware, usageRouter);
app.use("/api/james", authMiddleware, apiUsageRouter);

// Protected API Routes
app.use("/api/tasks", authMiddleware, tasksRouter);
app.use("/api/projects", authMiddleware, projectsRouter);
app.use("/api/clients", authMiddleware, clientsRouter);
app.use("/api/time", authMiddleware, timeRouter);
app.use("/api/captures", authMiddleware, capturesRouter);
app.use("/api/invoices", authMiddleware, invoicesRouter);
app.use("/api/second-brain", authMiddleware, secondBrainRouter);
app.use("/api/settings", authMiddleware, settingsRouter);
app.use("/api/income", authMiddleware, incomeRouter);
app.use("/api/expenses", authMiddleware, expensesRouter);
app.use("/api/assets", authMiddleware, assetsRouter);
app.use("/api/prds", authMiddleware, prdsRouter);
app.use("/api/suggestions", authMiddleware, suggestionsRouter);
app.use("/api/github", authMiddleware, githubRouter);
app.use("/api/james-actions", authMiddleware, jamesActionsRouter);
app.use("/api/james-automations", authMiddleware, jamesAutomationsRouter);
app.use("/api/james-tasks", authMiddleware, jamesTasksRouter);
app.use("/api/reports", authMiddleware, reportsRouter);
app.use("/api", authMiddleware, subtasksRouter);
app.use("/api/backups", authMiddleware, backupsRouter);
// Social media routes
app.use("/api/social-media", authMiddleware, socialMediaRouter);
// Tag routes
app.use("/api/tags", authMiddleware, tagsRouter);
// Cache management routes
app.use("/api/cache", authMiddleware, cacheRouter);

// Office visualization routes (protected)
app.use("/api/office", authMiddleware, officeRouter);

// Memory management routes (protected)
app.use("/api/memory", authMiddleware, memoryRouter);

// GoBD audit trail and period locking routes (protected)
app.use("/api/audit", authMiddleware, auditRouter);

// ELSTER tax filing routes (protected)
app.use("/api/tax/elster", authMiddleware, elsterRouter);

// DATEV export routes (protected)
app.use("/api/exports/datev", authMiddleware, datevRouter);

// Banking integration routes (protected)
app.use("/api/banking", authMiddleware, bankingRouter);

// Booking rules routes (protected)
app.use("/api/booking-rules", authMiddleware, bookingRulesRouter);

// Recurring invoices routes (protected)
app.use("/api/invoices/recurring", authMiddleware, recurringInvoicesRouter);

// Dunning (Mahnwesen) routes (protected)
app.use("/api/dunning", authMiddleware, dunningRouter);

// 404 handler for unmatched API routes (must come after all API routes, before static files)
app.all("/api/*", notFoundHandler);

// Global error handler for API routes
app.use(errorHandler);

// Serve static files from the web build
if (existsSync(STATIC_PATH)) {
  logger.info({ path: STATIC_PATH }, "Serving static files");

  // Static assets (JS/CSS with hashes) - cache for 1 year
  app.use("/assets", express.static(join(STATIC_PATH, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // Other static files (icons, etc.) - cache for 1 day
  app.use(express.static(STATIC_PATH, {
    maxAge: "1d",
    index: false, // Don't serve index.html automatically
  }));

  // SPA fallback - serve index.html with no-cache for all non-API routes
  app.get("*", (_req, res) => {
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });
    res.sendFile(join(STATIC_PATH, "index.html"));
  });
} else {
  logger.warn({ path: STATIC_PATH }, "Static path not found");
}

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down (SIGINT)");
  cache.destroy();
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down (SIGTERM)");
  cache.destroy();
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Personal Assistant API running");
});
