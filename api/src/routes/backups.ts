/**
 * Backup & Export API Routes
 *
 * GET  /api/backups/status     - Get backup status and history
 * GET  /api/backups/list       - List all available backups
 * POST /api/backups/trigger     - Manually trigger a backup
 * GET  /api/backups/download    - Download latest encrypted backup
 * GET  /api/backups/export      - Export all data as JSON
 * GET  /api/backups/export/csv/:table - Export a single table as CSV
 * GET  /api/backups/tables      - List available table names
 * POST /api/backups/restore/:filename - Restore from a server-side backup
 * POST /api/backups/import      - Restore from an uploaded backup file
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  getBackupStatus,
  createBackup,
  rotateBackups,
  getLatestBackupContent,
  exportAllTablesJson,
  exportTableCsv,
  getAvailableTables,
  getAllBackups,
  restoreFromBackup,
  restoreFromUpload,
  runDailyBackup,
} from "../services/backup.js";
import { createLogger } from "../logger.js";

// Multer config for file upload (memory storage, max 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();
const log = createLogger("backups");

/**
 * GET /status - Get backup status and history
 */
router.get(
  "/status",
  asyncHandler(async (_req: Request, res: Response) => {
    const status = getBackupStatus();
    res.json(status);
  })
);

/**
 * POST /trigger - Manually trigger a backup
 */
router.post(
  "/trigger",
  asyncHandler(async (_req: Request, res: Response) => {
    log.info("Manual backup triggered via API");
    try {
      const result = runDailyBackup();
      res.json({
        success: true,
        backup: {
          filename: result.backup.filename,
          date: result.backup.date,
          sizeBytes: result.backup.sizeBytes,
          encrypted: result.backup.encrypted,
        },
        rotation: {
          deletedCount: result.rotation.deleted.length,
          keptCount: result.rotation.kept,
        },
      });
    } catch (err) {
      log.error({ err }, "Backup trigger failed");
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Backup failed",
      });
    }
  })
);

/**
 * GET /download - Download latest encrypted backup
 */
router.get(
  "/download",
  asyncHandler(async (_req: Request, res: Response) => {
    const backup = getLatestBackupContent();

    if (!backup) {
      return res.status(404).json({
        error: "No backups available",
        message: "Run a backup first using POST /api/backups/trigger",
      });
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${backup.filename}"`
    );
    res.setHeader("Content-Length", backup.content.length);
    res.send(backup.content);
  })
);

/**
 * GET /export - Export all data as JSON (unencrypted, for user download)
 */
router.get(
  "/export",
  asyncHandler(async (req: Request, res: Response) => {
    const format = (req.query.format as string) || "json";

    if (format === "json") {
      const exportData = exportAllTablesJson();
      const jsonStr = JSON.stringify(exportData, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `pa-export-${dateStr}.json`;

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(jsonStr);
    } else {
      res.status(400).json({ error: "Invalid format. Use 'json' or export CSV per table via /export/csv/:table" });
    }
  })
);

/**
 * GET /export/csv/:table - Export a single table as CSV
 */
router.get(
  "/export/csv/:table",
  asyncHandler(async (req: Request, res: Response) => {
    const { table } = req.params;

    try {
      const csv = exportTableCsv(table);

      if (!csv) {
        return res.status(200).send("");
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `pa-${table}-${dateStr}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(csv);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Invalid table")) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  })
);

/**
 * GET /tables - List available table names
 */
router.get(
  "/tables",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ tables: getAvailableTables() });
  })
);

/**
 * GET /list - List all available backups (not just recent 7)
 */
router.get(
  "/list",
  asyncHandler(async (_req: Request, res: Response) => {
    const backups = getAllBackups();
    res.json({ backups });
  })
);

/**
 * POST /restore/:filename - Restore from a server-side backup
 */
router.post(
  "/restore/:filename",
  asyncHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;

    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    log.info({ filename }, "Restore requested via API");

    try {
      const result = restoreFromBackup(filename);
      res.json(result);
    } catch (err) {
      log.error({ err, filename }, "Restore failed");
      const message = err instanceof Error ? err.message : "Restore failed";
      const status = message.includes("not found") ? 404
        : message.includes("Invalid") ? 400
        : 500;
      res.status(status).json({
        success: false,
        error: message,
      });
    }
  })
);

/**
 * POST /import - Restore from an uploaded backup file
 */
router.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded. Send a file with field name 'file'.",
      });
    }

    const { buffer, originalname } = req.file;
    log.info({ originalname, size: buffer.length }, "Import upload received");

    try {
      const result = restoreFromUpload(buffer, originalname);
      res.json(result);
    } catch (err) {
      log.error({ err, originalname }, "Import failed");
      const message = err instanceof Error ? err.message : "Import failed";
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  })
);

export default router;
