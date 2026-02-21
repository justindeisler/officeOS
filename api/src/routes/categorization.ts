/**
 * Auto-Categorization API Routes
 *
 * Provides endpoints for ML-based expense category suggestions,
 * model training, and model statistics.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ValidationError } from '../errors.js';
import {
  suggestCategory,
  trainModel,
  getModelStats,
} from '../services/autoCategorizeService.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/categorization/suggest
 *
 * Get category suggestions for a draft expense.
 *
 * Body: { vendor?: string, description?: string, amount?: number }
 * Response: { suggestions: CategorySuggestion[] }
 */
router.post(
  '/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const { vendor, description, amount } = req.body;

    if (!vendor && !description) {
      throw new ValidationError('At least one of vendor or description is required');
    }

    const db = getDb();
    const suggestions = suggestCategory(
      db,
      vendor || '',
      description || '',
      typeof amount === 'number' ? amount : 0,
    );

    res.json({ suggestions });
  }),
);

/**
 * POST /api/categorization/train
 *
 * Rebuild the ML model from historical data.
 * Admin-only endpoint.
 */
router.post(
  '/train',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const startTime = Date.now();

    trainModel(db);

    const stats = getModelStats(db);
    const elapsed = Date.now() - startTime;

    res.json({
      success: true,
      message: `Model trained with ${stats.totalRecords} records in ${elapsed}ms`,
      stats,
    });
  }),
);

/**
 * GET /api/categorization/stats
 *
 * Show model statistics (training samples, category coverage, top vendors).
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const stats = getModelStats(db);

    res.json(stats);
  }),
);

export default router;
