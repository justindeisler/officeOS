/**
 * Personal Assistant REST API + Static File Server
 */

// Load environment variables first (before any other imports)
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { closeDb } from "./database.js";
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

// Environment validation — fail fast if critical vars are missing
function validateEnvironment() {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    logger.fatal({ missing }, 'Missing required environment variables. Check your .env file.');
    process.exit(1);
  }

  // Warn if JWT_SECRET looks like a default/example value
  const jwtSecret = process.env.JWT_SECRET!;
  const suspiciousDefaults = [
    'your-secret-key',
    'change-in-production',
    'secret',
    'password',
    'example',
  ];
  if (jwtSecret.length < 32 || suspiciousDefaults.some(d => jwtSecret.toLowerCase().includes(d))) {
    logger.warn('JWT_SECRET appears weak or default-like. Use a strong random value (32+ chars). Generate one with: openssl rand -base64 32');
  }

  logger.info('Environment validation passed');
}

validateEnvironment();

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

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) => req.path === "/health", // Skip health checks
  // Disable X-Forwarded-For validation since we're behind nginx proxy
  validate: { xForwardedForHeader: false },
});
app.use("/api/", limiter);

// CORS and body parsing
app.use(cors());
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
app.use("/api/social-media", authMiddleware, socialMediaRouter);

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
  closeDb();
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down (SIGTERM)");
  closeDb();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Personal Assistant API running");
});
