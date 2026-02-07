/**
 * James (AI Assistant) trigger routes
 */

import { Router } from "express";
import { exec } from "child_process";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const log = createLogger("james");

// Cron job ID for James task checking
const JAMES_CRON_JOB_ID = "fdeaf0ee-e62b-44e8-8ee1-40d55e6a230d";

// Track last check request
let lastCheckRequest: string | null = null;

// Trigger James to check for assigned tasks
router.post("/check", asyncHandler(async (_req, res) => {
  lastCheckRequest = new Date().toISOString();
  log.info({ requestedAt: lastCheckRequest }, "Task check requested");

  // Trigger Clawdbot cron job immediately
  exec(`clawdbot cron run ${JAMES_CRON_JOB_ID} --force 2>&1`, (error, stdout, _stderr) => {
    if (error) {
      log.error({ err: error }, "Failed to trigger cron run");
    } else {
      log.info({ output: stdout.trim() }, "Cron triggered successfully");
    }
  });

  res.json({ 
    success: true, 
    message: "James is on it! Checking tasks now...",
    requestedAt: lastCheckRequest
  });
}));

// Endpoint for James to poll for check requests
router.get("/pending", asyncHandler(async (_req, res) => {
  res.json({ 
    hasPending: !!lastCheckRequest,
    lastRequest: lastCheckRequest
  });
}));

// Clear pending request after James checks
router.post("/acknowledge", asyncHandler(async (_req, res) => {
  const wasRequest = lastCheckRequest;
  lastCheckRequest = null;
  res.json({ 
    acknowledged: true,
    clearedRequest: wasRequest
  });
}));

export default router;
