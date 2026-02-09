/**
 * Social Media Posts API routes
 * Manages LinkedIn and Instagram post pipeline:
 *   suggested → approved → scheduled → published
 */

import { Router } from "express";
import { existsSync, statSync } from "fs";
import path from "path";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ValidationError, NotFoundError } from "../errors.js";
import { createLogger } from "../logger.js";

const router = Router();
const log = createLogger("social-media");

// ─── Types ─────────────────────────────────────────────────────────

interface SocialMediaPost {
  id: string;
  platform: string;
  status: string;
  content_text: string;
  visual_path: string | null;
  visual_type: string | null;
  scheduled_date: string | null;
  published_date: string | null;
  source: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

// ─── List Posts ────────────────────────────────────────────────────

router.get("/posts", asyncHandler(async (req, res) => {
  const db = getDb();
  const { platform, status, source, limit = 100, offset = 0 } = req.query;

  let sql = "SELECT * FROM social_media_posts WHERE 1=1";
  const params: unknown[] = [];

  if (platform) {
    sql += " AND platform = ?";
    params.push(platform);
  }
  if (status) {
    // Support comma-separated statuses
    const statuses = (status as string).split(",");
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (source) {
    sql += " AND source = ?";
    params.push(source);
  }

  sql += " ORDER BY CASE status WHEN 'suggested' THEN 1 WHEN 'approved' THEN 2 WHEN 'scheduled' THEN 3 WHEN 'published' THEN 4 WHEN 'rejected' THEN 5 END, scheduled_date ASC, created_at DESC";
  sql += " LIMIT ? OFFSET ?";
  params.push(Number(limit), Number(offset));

  const posts = db.prepare(sql).all(...params);

  // Parse metadata JSON for each post
  const parsed = (posts as SocialMediaPost[]).map((p) => ({
    ...p,
    metadata: p.metadata ? JSON.parse(p.metadata) : null,
  }));

  res.json(parsed);
}));

// ─── Get Single Post ───────────────────────────────────────────────

router.get("/posts/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const post = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(req.params.id) as SocialMediaPost | undefined;

  if (!post) {
    throw new NotFoundError("Social media post", req.params.id);
  }

  res.json({
    ...post,
    metadata: post.metadata ? JSON.parse(post.metadata) : null,
  });
}));

// ─── Create Post ───────────────────────────────────────────────────

router.post("/posts", asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    platform,
    content_text,
    visual_path,
    visual_type,
    scheduled_date,
    source,
    metadata,
    status = "suggested",
  } = req.body;

  if (!platform || !["linkedin", "instagram"].includes(platform)) {
    throw new ValidationError("platform must be 'linkedin' or 'instagram'");
  }
  if (!content_text || !content_text.trim()) {
    throw new ValidationError("content_text is required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(`
    INSERT INTO social_media_posts (id, platform, status, content_text, visual_path, visual_type, scheduled_date, source, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    platform,
    status,
    content_text.trim(),
    visual_path || null,
    visual_type || null,
    scheduled_date || null,
    source || null,
    metadata ? JSON.stringify(metadata) : null,
    now,
    now
  );

  const post = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(id) as SocialMediaPost;
  log.info({ postId: id, platform, status }, "Social media post created");

  res.status(201).json({
    ...post,
    metadata: post.metadata ? JSON.parse(post.metadata) : null,
  });
}));

// ─── Update Post ───────────────────────────────────────────────────

router.patch("/posts/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(id) as SocialMediaPost | undefined;
  if (!existing) {
    throw new NotFoundError("Social media post", id);
  }

  const allowedFields = ["platform", "status", "content_text", "visual_path", "visual_type", "scheduled_date", "source", "metadata"];
  const updates: string[] = ["updated_at = ?"];
  const params: unknown[] = [now];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === "metadata") {
        params.push(req.body[field] ? JSON.stringify(req.body[field]) : null);
      } else {
        params.push(req.body[field]);
      }
    }
  }

  // If status changes to 'published', set published_date
  if (req.body.status === "published" && existing.status !== "published") {
    updates.push("published_date = ?");
    params.push(now);
  }

  params.push(id);
  db.prepare(`UPDATE social_media_posts SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const post = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(id) as SocialMediaPost;
  log.info({ postId: id, updates: Object.keys(req.body) }, "Social media post updated");

  res.json({
    ...post,
    metadata: post.metadata ? JSON.parse(post.metadata) : null,
  });
}));

// ─── Delete Post ───────────────────────────────────────────────────

router.delete("/posts/:id", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT id FROM social_media_posts WHERE id = ?").get(id);
  if (!existing) {
    throw new NotFoundError("Social media post", id);
  }

  db.prepare("DELETE FROM social_media_posts WHERE id = ?").run(id);
  log.info({ postId: id }, "Social media post deleted");

  res.json({ success: true });
}));

// ─── Publish Post ──────────────────────────────────────────────────

router.post("/posts/:id/publish", asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const now = getCurrentTimestamp();

  const existing = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(id) as SocialMediaPost | undefined;
  if (!existing) {
    throw new NotFoundError("Social media post", id);
  }

  if (existing.status === "published") {
    throw new ValidationError("Post is already published");
  }

  // Mark as published
  db.prepare("UPDATE social_media_posts SET status = 'published', published_date = ?, updated_at = ? WHERE id = ?")
    .run(now, now, id);

  const post = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(id) as SocialMediaPost;
  log.info({ postId: id, platform: post.platform }, "Social media post marked as published");

  res.json({
    ...post,
    metadata: post.metadata ? JSON.parse(post.metadata) : null,
  });
}));

// ─── Serve Visual ──────────────────────────────────────────────────

router.get("/posts/:id/visual", asyncHandler(async (req, res) => {
  const db = getDb();
  const post = db.prepare("SELECT visual_path, visual_type FROM social_media_posts WHERE id = ?").get(req.params.id) as Pick<SocialMediaPost, "visual_path" | "visual_type"> | undefined;

  if (!post) {
    throw new NotFoundError("Social media post", req.params.id);
  }

  if (!post.visual_path) {
    res.status(404).json({ error: "No visual generated for this post" });
    return;
  }

  const filePath = post.visual_path;
  if (!existsSync(filePath)) {
    log.warn({ postId: req.params.id, path: filePath }, "Visual file missing from filesystem");
    res.status(404).json({ error: "Visual file not found" });
    return;
  }

  // Security: ensure the path is within the expected directory
  const resolvedPath = path.resolve(filePath);
  const allowedDir = path.resolve("/home/jd-server-admin/clawd/social-media/visuals");
  if (!resolvedPath.startsWith(allowedDir)) {
    log.warn({ postId: req.params.id, path: resolvedPath }, "Visual path outside allowed directory");
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Set cache headers (visuals don't change once generated)
  const stat = statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  
  res.set({
    "Content-Type": contentType,
    "Content-Length": stat.size.toString(),
    "Cache-Control": "public, max-age=86400",
    "ETag": `"${stat.mtime.getTime().toString(36)}-${stat.size.toString(36)}"`,
  });

  res.sendFile(resolvedPath);
}));

// ─── Generate Visual (trigger) ─────────────────────────────────────

router.post("/posts/:id/generate-visual", asyncHandler(async (req, res) => {
  const db = getDb();
  const post = db.prepare("SELECT * FROM social_media_posts WHERE id = ?").get(req.params.id) as SocialMediaPost | undefined;

  if (!post) {
    throw new NotFoundError("Social media post", req.params.id);
  }

  // Spawn Python visual generator
  const { execSync } = await import("child_process");
  try {
    const result = execSync(
      `python3 /home/jd-server-admin/clawd/scripts/generate_post_visual.py --post-id "${req.params.id}" --output-json`,
      { timeout: 30000, encoding: "utf-8" }
    );
    const parsed = JSON.parse(result.trim());

    res.json({
      success: parsed.success,
      visual_path: parsed.path,
      visual_type: parsed.type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error({ postId: req.params.id, error: message }, "Visual generation failed");
    res.status(500).json({ error: "Visual generation failed", details: message });
  }
}));

// ─── Stats ─────────────────────────────────────────────────────────

router.get("/stats", asyncHandler(async (_req, res) => {
  const db = getDb();

  const byPlatform = db.prepare(`
    SELECT platform, status, COUNT(*) as count
    FROM social_media_posts
    GROUP BY platform, status
  `).all() as Array<{ platform: string; status: string; count: number }>;

  const total = db.prepare("SELECT COUNT(*) as count FROM social_media_posts").get() as { count: number };

  const upcoming = db.prepare(`
    SELECT * FROM social_media_posts
    WHERE status = 'scheduled' AND scheduled_date >= date('now')
    ORDER BY scheduled_date ASC
    LIMIT 10
  `).all() as SocialMediaPost[];

  res.json({
    total: total.count,
    byPlatform,
    upcoming: upcoming.map((p) => ({
      ...p,
      metadata: p.metadata ? JSON.parse(p.metadata) : null,
    })),
  });
}));

export default router;
