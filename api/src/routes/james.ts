/**
 * James (AI Assistant) trigger routes
 */

import { Router } from "express";

const router = Router();

// Track last check request
let lastCheckRequest: string | null = null;

// Trigger James to check for assigned tasks
router.post("/check", (_req, res) => {
  lastCheckRequest = new Date().toISOString();
  console.log("[James] Task check requested at:", lastCheckRequest);

  res.json({ 
    success: true, 
    message: "James will check for tasks shortly...",
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
