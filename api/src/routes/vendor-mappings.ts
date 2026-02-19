/**
 * Vendor Mappings API Routes
 *
 * CRUD operations for vendor name mappings used by the OCR system.
 */

import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateVendorMappingSchema } from "../schemas/index.js";
import {
  getAllVendorMappings,
  saveVendorMapping,
  deleteVendorMapping,
} from "../services/vendorMappingService.js";

const router = Router();

/**
 * GET /api/vendor-mappings
 */
router.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const mappings = getAllVendorMappings();
    res.json(mappings);
  })
);

/**
 * POST /api/vendor-mappings
 */
router.post(
  "/",
  validateBody(CreateVendorMappingSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { ocr_name, display_name, default_category, default_vat_rate } = req.body;

    if (!ocr_name || !display_name) {
      throw new ValidationError("ocr_name and display_name are required");
    }

    const mapping = saveVendorMapping(
      ocr_name,
      display_name,
      default_category,
      default_vat_rate
    );

    res.status(201).json(mapping);
  })
);

/**
 * DELETE /api/vendor-mappings/:id
 */
router.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = deleteVendorMapping(req.params.id);
    if (!deleted) {
      throw new NotFoundError("Vendor mapping", req.params.id);
    }
    res.json({ success: true, message: "Vendor mapping deleted" });
  })
);

export default router;
