/**
 * James (AI Assistant) trigger routes
 */

import { Router } from "express";
import { exec } from "child_process";

const router = Router();

// Cron job ID for James task checking
const JAMES_CRON_JOB_ID = "fdeaf0ee-e62b-44e8-8ee1-40d55e6a230d";

// Track last check request
let lastCheckRequest: string | null = null;

// Trigger James to check for assigned tasks
router.post("/check", (_req, res) => {
  lastCheckRequest = new Date().toISOString();
  console.log("[James] Task check requested at:", lastCheckRequest);

  // Trigger Clawdbot cron job immediately
  exec(`clawdbot cron run ${JAMES_CRON_JOB_ID} --force 2>&1`, (error, stdout, stderr) => {
    if (error) {
      console.error("[James] Failed to trigger cron run:", error.message);
    } else {
      console.log("[James] Cron triggered:", stdout);
    }
  });

  res.json({ 
    success: true, 
    message: "James is on it! Checking tasks now...",
    requestedAt: lastCheckRequest
  });
});

// Endpoint for James to poll for check requests
router.get("/pending", (_req, res) => {
  res.json({ 
    hasPending: !!lastCheckRequest,
    lastRequest: lastCheckRequest
  });
});

// Clear pending request after James checks
router.post("/acknowledge", (_req, res) => {
  const wasRequest = lastCheckRequest;
  lastCheckRequest = null;
  res.json({ 
    acknowledged: true,
    clearedRequest: wasRequest
  });
});

export default router;
