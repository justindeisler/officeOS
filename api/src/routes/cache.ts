/**
 * Cache management API routes
 *
 * Provides endpoints to inspect and manage the in-memory cache.
 */

import { Router } from "express";
import { cache } from "../cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { CacheInvalidateSchema } from "../schemas/index.js";

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
router.post("/invalidate", validateBody(CacheInvalidateSchema), (req, res) => {
  const { pattern } = req.body;
  const count = cache.invalidate(pattern);
  res.json({ success: true, invalidated: count });
});

export default router;
