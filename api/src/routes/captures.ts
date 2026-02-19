/**
 * Captures (inbox) API routes
 */

import { Router } from "express";
import { spawn } from "child_process";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateCaptureSchema, ProcessCaptureSchema } from "../schemas/index.js";

const router = Router();
const log = createLogger("captures");

// Helper to parse metadata JSON
function parseCapture(capture: any) {
  if (capture && capture.metadata && typeof capture.metadata === 'string') {
    try {
      capture.metadata = JSON.parse(capture.metadata);
    } catch (e) {
      // Keep as string if parsing fails
    }
  }
  return capture;
}

// List captures
router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const { processed, type, limit = 100 } = req.query;

  let sql = "SELECT * FROM captures WHERE 1=1";
  const params: unknown[] = [];

  if (processed !== undefined) {
    sql += " AND processed = ?";
    params.push(processed === "true" || processed === "1" ? 1 : 0);
  }
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(Number(limit));

  const captures = db.prepare(sql).all(...params).map(parseCapture);
  res.json(captures);
}));

// Get single capture
router.get("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(req.params.id);
  if (!capture) {
    throw new NotFoundError("Capture", req.params.id);
  }
  res.json(parseCapture(capture));
}));

// Create capture
router.post("/", validateBody(CreateCaptureSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { content, type = "note" } = req.body;

  if (!content) {
    throw new ValidationError("Content is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO captures (id, content, type, processed, created_at)
     VALUES (?, ?, ?, 0, ?)`
  ).run(id, content, type, now);

  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  res.status(201).json(capture);
}));

// Mark capture as processed
router.post("/:id/process", validateBody(ProcessCaptureSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { processed_to, processed_by, artifact_type, artifact_id } = req.body;

  const existing = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Capture", id);
  }

  db.prepare(`
    UPDATE captures 
    SET processed = 1, 
        processed_to = ?, 
        processing_status = 'completed',
        processed_by = ?,
        artifact_type = ?,
        artifact_id = ?
    WHERE id = ?
  `).run(
    processed_to || null, 
    processed_by || 'manual',
    artifact_type || null,
    artifact_id || null,
    id
  );

  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  res.json(capture);
}));

// Process capture with James AI
router.post("/:id/process-with-james", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM captures WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    throw new NotFoundError("Capture", id);
  }

  // Mark as processing
  db.prepare("UPDATE captures SET processing_status = 'processing' WHERE id = ?").run(id);

  // Return immediately - processing happens in background
  res.json({
    status: "processing",
    message: "James is processing your capture...",
    captureId: id,
  });

  // Process in background
  const captureContent = existing.content as string;
  const captureType = existing.type as string;
  
  // Fetch projects for context
  const projects = db.prepare("SELECT id, name, area, description FROM projects WHERE status IN ('active', 'pipeline')").all();
  const projectList = projects.map((p: any) => `  - "${p.name}" (${p.area}) → project_id: ${p.id}`).join('\n');
  
  const message = `Process this capture from the PA app inbox (ID: ${id}):

**Type:** ${captureType}
**Content:** ${captureContent}

**Available Projects:**
${projectList}

**Area Mapping:**
- wellfy = anything related to Wellfy GmbH, course platform, admin cms
- freelance = client work, website projects, paid external work
- personal = Personal Assistant app, TEO, Diabetes Notes, personal projects, James/Clawdbot improvements

**Instructions:**
${captureType === 'task' ? `
1. Generate a detailed task:
   - Clear, actionable title
   - Comprehensive description with implementation details
   - Acceptance criteria as checkboxes
   - Priority (1=low, 2=medium, 3=high, 4=urgent)
   - Area: MUST match one of (wellfy/freelance/personal) based on content context
   - project_id: MUST set if content clearly relates to a specific project from the list above
2. Create the task via mcporter: mcporter call personal-assistant.create_task title="..." description="..." area="..." project_id="..." priority=2 status="backlog"
3. Mark capture processed via: mcporter call personal-assistant.query_database sql="..." (or curl if needed)
   POST to http://localhost:3005/api/captures/${id}/process with body: {"processed_to":"task","processed_by":"james","artifact_type":"task","artifact_id":"<task-id>"}
` : captureType === 'meeting' ? `
1. Parse meeting details: title, date/time, duration (default 1h), attendees, location
2. Create iCloud calendar event via CalDAV (account: justin.deisler@me.com)
3. Mark capture processed via curl POST to http://localhost:3005/api/captures/${id}/process with body: {"processed_to":"calendar_event","processed_by":"james","artifact_type":"calendar_event","artifact_id":"<event-uid>"}
` : captureType === 'idea' ? `
**IMPORTANT: Ideas require PRD creation first!**
1. Create a comprehensive PRD:
   - Save to ~/clawd/second-brain/projects/PRD-<slug>.md
   - Insert into prds table in database at ~/.local/share/com.personal-assistant.app/personal-assistant.db
2. Create implementation task linked to the PRD:
   - Title: "Implement <feature name>"
   - Include prd_id linking to the PRD
   - Area: MUST match (wellfy/freelance/personal) - for PA app improvements use "personal"
   - project_id: Set to "32b4b44b-a6f9-46c1-bc56-0ec819d766a1" for Personal Assistant features
3. Mark capture processed with artifact_type="prd" and artifact_id=<prd-id>
` : `
1. Analyze content and create appropriate artifact (task/event/note)
2. Set area correctly: wellfy/freelance/personal based on context
3. Set project_id if content relates to a specific project
4. Mark capture processed via the API
`}

If processing fails, update the capture's processing_status to 'failed' via:
curl -X POST http://localhost:3005/api/captures/${id}/process -H "Content-Type: application/json" -d '{"processing_status":"failed"}'`;

  try {
    // Spawn clawdbot agent in background using spawn (detached)
    const child = spawn('clawdbot', [
      'agent',
      '--session-id', 'pa-capture-processor',
      '--message', message,
      '--timeout', '120'
    ], {
      cwd: "/home/jd-server-admin/clawd",
      env: { ...process.env, HOME: "/home/jd-server-admin" },
      detached: true,
      stdio: 'ignore'
    });
    
    // Allow the parent process to exit independently
    child.unref();
    
    log.info({ captureId: id, pid: child.pid }, "Started James processing for capture");
  } catch (error) {
    // Mark as failed if we can't even start the agent
    db.prepare("UPDATE captures SET processing_status = 'failed' WHERE id = ?").run(id);
    log.error({ err: error, captureId: id }, "Failed to start James processing");
  }
}));

// Get processing status
router.get("/:id/processing-status", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const capture = db.prepare("SELECT * FROM captures WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!capture) {
    throw new NotFoundError("Capture", id);
  }

  res.json({
    captureId: id,
    processingStatus: capture.processing_status || 'pending',
    processedBy: capture.processed_by,
    artifactType: capture.artifact_type,
    artifactId: capture.artifact_id,
    processed: Boolean(capture.processed),
  });
}));

// Delete capture
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM captures WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Capture", id);
  }

  db.prepare("DELETE FROM captures WHERE id = ?").run(id);
  res.json({ success: true, message: "Capture deleted" });
}));

export default router;
