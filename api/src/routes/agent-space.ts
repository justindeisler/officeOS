/**
 * Agent Space API routes
 * Browse agent persona files, learning system, memory, and specialist docs
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { join, basename, extname, relative } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors.js";

const execFileAsync = promisify(execFile);
const router = Router();
const log = createLogger("agent-space");

// ============================================
// Agent definitions
// ============================================

const CLAWDBOT_AGENTS_PATH = "/home/jd-server-admin/.clawdbot/agents";
const CLAWD_PATH = "/home/jd-server-admin/clawd";
const MEMORY_AGENTS_PATH = "/home/jd-server-admin/clawd/memory/agents";
const SPECIALISTS_PATH = "/home/jd-server-admin/clawd/specialists";
const MEMORY_READ_CMD = "/home/jd-server-admin/bin/memory-read";

interface AgentDefinition {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
}

const AGENTS: AgentDefinition[] = [
  { id: "markus", name: "Markus", emoji: "🔧", role: "Senior Developer", color: "#3b82f6" },
  { id: "research-analyst", name: "Prof", emoji: "🔍", role: "Research Analyst", color: "#8b5cf6" },
  { id: "business-strategist", name: "Rocky", emoji: "💼", role: "Business Strategist", color: "#f59e0b" },
  { id: "main", name: "James", emoji: "🤖", role: "Team Manager", color: "#10b981" },
];

// ============================================
// Memory cache for decrypted files
// ============================================

const memoryCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function readPossiblyEncrypted(filePath: string): Promise<string> {
  const cached = memoryCache.get(filePath);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  try {
    const rawContent = await fs.readFile(filePath, "utf-8");
    if (!rawContent.startsWith("JAMES_ENCRYPTED_V1")) {
      memoryCache.set(filePath, { content: rawContent, timestamp: Date.now() });
      return rawContent;
    }

    // Decrypt
    const { stdout } = await execFileAsync(MEMORY_READ_CMD, [filePath], {
      timeout: 10000,
    });
    memoryCache.set(filePath, { content: stdout, timestamp: Date.now() });
    return stdout;
  } catch (err) {
    log.error({ err, filePath }, "Failed to read file");
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

// ============================================
// Helpers
// ============================================

function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1].trim();
  return basename(filename, extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FileInfo {
  name: string;
  path: string;
  category: string;
  title: string;
  size: number;
  lastModified: string;
  encrypted: boolean;
}

async function getFileInfo(filePath: string, category: string, basePath: string): Promise<FileInfo | null> {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) return null;

    const rawContent = await fs.readFile(filePath, "utf-8").catch(() => "");
    const encrypted = rawContent.startsWith("JAMES_ENCRYPTED_V1");
    const name = basename(filePath);
    const relPath = relative(basePath, filePath);

    let title = name;
    if (!encrypted && rawContent) {
      title = extractTitle(rawContent, name);
    }

    return {
      name,
      path: relPath,
      category,
      title,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      encrypted,
    };
  } catch {
    return null;
  }
}

async function countSessionMessages(agentId: string): Promise<number> {
  try {
    const sessionsPath = join(CLAWDBOT_AGENTS_PATH, agentId, "sessions");
    const files = await fs.readdir(sessionsPath);
    return files.filter(f => f.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

async function getLastActivity(agentId: string): Promise<string | null> {
  try {
    const sessionsPath = join(CLAWDBOT_AGENTS_PATH, agentId, "sessions");
    const files = await fs.readdir(sessionsPath);
    const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));
    if (jsonlFiles.length === 0) return null;

    let latestTime = 0;
    for (const file of jsonlFiles.slice(-5)) { // Check last 5 files
      const stat = await fs.stat(join(sessionsPath, file));
      if (stat.mtime.getTime() > latestTime) {
        latestTime = stat.mtime.getTime();
      }
    }
    return latestTime ? new Date(latestTime).toISOString() : null;
  } catch {
    return null;
  }
}

// ============================================
// ROUTES
// ============================================

/**
 * List all agents with status info
 */
router.get("/", asyncHandler(async (_req, res) => {
  const agents = await Promise.all(
    AGENTS.map(async (agent) => {
      const sessionCount = await countSessionMessages(agent.id);
      const lastActivity = await getLastActivity(agent.id);

      // Count files
      let fileCount = 0;
      const paths = [
        join(CLAWDBOT_AGENTS_PATH, agent.id),
        join(CLAWD_PATH, agent.id),
        join(MEMORY_AGENTS_PATH, `${agent.id}.md`),
        join(SPECIALISTS_PATH, agent.id),
      ];

      for (const p of paths) {
        try {
          const stat = await fs.stat(p);
          if (stat.isDirectory()) {
            const files = await fs.readdir(p);
            fileCount += files.filter(f => !f.startsWith(".") && f !== "sessions" && f !== "agent").length;
          } else {
            fileCount += 1;
          }
        } catch { /* path doesn't exist */ }
      }

      return {
        ...agent,
        status: lastActivity && (Date.now() - new Date(lastActivity).getTime() < 24 * 60 * 60 * 1000) ? "active" : "idle",
        sessionCount,
        fileCount,
        lastActivity,
      };
    })
  );

  res.json({ agents });
}));

/**
 * Get agent details
 */
router.get("/:agentId", asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  if (agentId.includes("..") || agentId.includes("/")) {
    throw new ForbiddenError("Invalid agent ID");
  }

  const agentDef = AGENTS.find(a => a.id === agentId);
  if (!agentDef) {
    throw new NotFoundError(`Agent: ${agentId}`);
  }

  const sessionCount = await countSessionMessages(agentId);
  const lastActivity = await getLastActivity(agentId);

  // Gather all files organized by category
  const files: FileInfo[] = [];
  const basePaths: Record<string, string> = {};

  // Persona files (from ~/.clawdbot/agents/{id}/)
  const personaPath = join(CLAWDBOT_AGENTS_PATH, agentId);
  basePaths.persona = personaPath;
  try {
    const personaFiles = await fs.readdir(personaPath);
    for (const file of personaFiles) {
      if (file.startsWith(".") || file === "sessions" || file === "agent") continue;
      const info = await getFileInfo(join(personaPath, file), "persona", personaPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  // Learning files (from ~/clawd/{id}/)
  const learningPath = join(CLAWD_PATH, agentId);
  basePaths.learning = learningPath;
  try {
    const learningFiles = await fs.readdir(learningPath);
    for (const file of learningFiles) {
      if (file.startsWith(".") || file === "memory") continue;
      const filePath = join(learningPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;
      const info = await getFileInfo(filePath, "learning", learningPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  // Memory file (from ~/clawd/memory/agents/{id}.md)
  const memoryFile = join(MEMORY_AGENTS_PATH, `${agentId}.md`);
  try {
    const info = await getFileInfo(memoryFile, "memory", MEMORY_AGENTS_PATH);
    if (info) files.push(info);
  } catch { /* file doesn't exist */ }

  // Specialist docs (from ~/clawd/specialists/{id}/)
  const specialistPath = join(SPECIALISTS_PATH, agentId);
  basePaths.specialist = specialistPath;
  try {
    const specialistFiles = await fs.readdir(specialistPath);
    for (const file of specialistFiles) {
      if (file.startsWith(".")) continue;
      const info = await getFileInfo(join(specialistPath, file), "specialist", specialistPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  res.json({
    ...agentDef,
    status: lastActivity && (Date.now() - new Date(lastActivity).getTime() < 24 * 60 * 60 * 1000) ? "active" : "idle",
    sessionCount,
    lastActivity,
    files,
  });
}));

/**
 * List agent files
 */
router.get("/:agentId/files", asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  if (agentId.includes("..") || agentId.includes("/")) {
    throw new ForbiddenError("Invalid agent ID");
  }

  const agentDef = AGENTS.find(a => a.id === agentId);
  if (!agentDef) {
    throw new NotFoundError(`Agent: ${agentId}`);
  }

  const files: FileInfo[] = [];

  // Persona files
  const personaPath = join(CLAWDBOT_AGENTS_PATH, agentId);
  try {
    const personaFiles = await fs.readdir(personaPath);
    for (const file of personaFiles) {
      if (file.startsWith(".") || file === "sessions" || file === "agent") continue;
      const info = await getFileInfo(join(personaPath, file), "persona", personaPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  // Learning files
  const learningPath = join(CLAWD_PATH, agentId);
  try {
    const learningFiles = await fs.readdir(learningPath);
    for (const file of learningFiles) {
      if (file.startsWith(".") || file === "memory") continue;
      const filePath = join(learningPath, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;
      const info = await getFileInfo(filePath, "learning", learningPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  // Memory file
  const memoryFile = join(MEMORY_AGENTS_PATH, `${agentId}.md`);
  try {
    const info = await getFileInfo(memoryFile, "memory", MEMORY_AGENTS_PATH);
    if (info) files.push(info);
  } catch { /* file doesn't exist */ }

  // Specialist docs
  const specialistPath = join(SPECIALISTS_PATH, agentId);
  try {
    const specialistFiles = await fs.readdir(specialistPath);
    for (const file of specialistFiles) {
      if (file.startsWith(".")) continue;
      const info = await getFileInfo(join(specialistPath, file), "specialist", specialistPath);
      if (info) files.push(info);
    }
  } catch { /* dir doesn't exist */ }

  res.json({ files });
}));

/**
 * Get file content
 */
router.get("/:agentId/files/:category/*", asyncHandler(async (req, res) => {
  const { agentId, category } = req.params;
  const filename = (req.params as Record<string, string>)[0];

  if (agentId.includes("..") || category.includes("..") || filename.includes("..")) {
    throw new ForbiddenError("Invalid path");
  }

  const agentDef = AGENTS.find(a => a.id === agentId);
  if (!agentDef) {
    throw new NotFoundError(`Agent: ${agentId}`);
  }

  // Resolve the file path based on category
  let filePath: string;
  switch (category) {
    case "persona":
      filePath = join(CLAWDBOT_AGENTS_PATH, agentId, filename);
      break;
    case "learning":
      filePath = join(CLAWD_PATH, agentId, filename);
      break;
    case "memory":
      filePath = join(MEMORY_AGENTS_PATH, filename);
      break;
    case "specialist":
      filePath = join(SPECIALISTS_PATH, agentId, filename);
      break;
    default:
      throw new ValidationError(`Invalid category: ${category}`);
  }

  // Security: ensure resolved path is within expected directories
  const realPath = await fs.realpath(filePath).catch(() => null);
  if (!realPath) {
    throw new NotFoundError(`File: ${filename}`);
  }

  // Read file (handle encryption)
  let content: string;
  try {
    content = await readPossiblyEncrypted(filePath);
  } catch (err) {
    throw new NotFoundError(`File: ${filename}`);
  }

  const stat = await fs.stat(filePath);

  res.json({
    name: basename(filePath),
    path: filename,
    category,
    title: extractTitle(content, basename(filePath)),
    content,
    size: stat.size,
    lastModified: stat.mtime.toISOString(),
    encrypted: (await fs.readFile(filePath, "utf-8")).startsWith("JAMES_ENCRYPTED_V1"),
  });
}));

export default router;
