/**
 * Cache management API routes
 *
 * Provides endpoints to inspect and manage the in-memory cache.
 */

import { Router } from "express";
import { cache } from "../cache.js";

const router = Router();

/**
 * GET /api/cache/stats
 * Returns cache statistics: hit rate, size, keys, config.
 */
router.get("/stats", (_req, res) => {
  res.json(cache.getStats());
});

/**
 * POST /api/cache/clear
 * Clears the entire cache.
 */
router.post("/clear", (_req, res) => {
  cache.clear();
  res.json({ success: true, message: "Cache cleared" });
});

/**
 * POST /api/cache/invalidate
 * Invalidate cache entries matching a pattern.
 * Body: { pattern: "tasks:*" }
 */
router.post("/invalidate", (req, res) => {
  const { pattern } = req.body;
  if (!pattern || typeof pattern !== "string") {
    return res.status(400).json({ error: "pattern is required" });
  }
  const count = cache.invalidate(pattern);
  res.json({ success: true, invalidated: count });
});

export default router;
