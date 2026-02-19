/**
 * Memory API routes
 * Tiered knowledge browser + editor for all AI agents
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join, basename, extname, resolve } from "path";
import { execSync } from "child_process";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors.js";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();
const log = createLogger("memory");

// ─── Agent Configuration ─────────────────────────────────────────────

const HOME = "/home/jd-server-admin";
const CLAWD_PATH = `${HOME}/clawd`;
const AGENTS_PATH = `${HOME}/.clawdbot/agents`;

interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  basePaths: string[];
  coreFiles: string[];
  scanDirs: string[];
}

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "james",
    name: "James",
    emoji: "🔧",
    basePaths: [CLAWD_PATH],
    coreFiles: [
      `${CLAWD_PATH}/MEMORY.md`,
      `${CLAWD_PATH}/LEARNING.md`,
      `${CLAWD_PATH}/LESSONS_LEARNED.md`,
      `${CLAWD_PATH}/MISTAKES.md`,
      `${CLAWD_PATH}/PATTERNS.md`,
      `${CLAWD_PATH}/SOUL.md`,
      `${CLAWD_PATH}/IDENTITY.md`,
    ],
    scanDirs: [
      `${CLAWD_PATH}/memory`,
      `${CLAWD_PATH}/second-brain`,
    ],
  },
  {
    id: "markus",
    name: "Markus",
    emoji: "⚙️",
    basePaths: [`${AGENTS_PATH}/markus`],
    coreFiles: [],
    scanDirs: [`${AGENTS_PATH}/markus/agent`],
  },
  {
    id: "rocky",
    name: "Rocky",
    emoji: "💼",
    basePaths: [`${AGENTS_PATH}/business-strategist`],
    coreFiles: [
      `${AGENTS_PATH}/business-strategist/IDENTITY.md`,
      `${AGENTS_PATH}/business-strategist/SOUL.md`,
      `${AGENTS_PATH}/business-strategist/TOOLS.md`,
      `${AGENTS_PATH}/business-strategist/USER.md`,
    ],
    scanDirs: [`${AGENTS_PATH}/business-strategist`],
  },
  {
    id: "prof",
    name: "Prof",
    emoji: "🔍",
    basePaths: [`${AGENTS_PATH}/research-analyst`],
    coreFiles: [
      `${AGENTS_PATH}/research-analyst/IDENTITY.md`,
      `${AGENTS_PATH}/research-analyst/SOUL.md`,
      `${AGENTS_PATH}/research-analyst/TOOLS.md`,
      `${AGENTS_PATH}/research-analyst/USER.md`,
    ],
    scanDirs: [`${AGENTS_PATH}/research-analyst`],
  },
];

// ─── Allowed Path Roots (security) ──────────────────────────────────

const ALLOWED_ROOTS = [
  `${HOME}/clawd/`,
  `${HOME}/.clawdbot/agents/`,
];

function isAllowedPath(filePath: string): boolean {
  const resolved = resolve(filePath);
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(root));
}

// ─── File Reading Helpers ───────────────────────────────────────────

function isEncryptedFile(filePath: string): boolean {
  try {
    const fd = readFileSync(filePath, { encoding: "utf8", flag: "r" });
    return fd.startsWith("JAMES_ENCRYPTED_V1");
  } catch {
    return false;
  }
}

function readMemoryFile(filePath: string): string {
  try {
    const raw = readFileSync(filePath, "utf8");
    if (raw.startsWith("JAMES_ENCRYPTED_V1")) {
      try {
        return execSync(`memory-read "${filePath}"`, {
          encoding: "utf8",
          timeout: 5000,
        });
      } catch {
        // Fallback to Python module
        return execSync(
          `python3 ${HOME}/clawd/scripts/memory_crypto.py decrypt "${filePath}"`,
          { encoding: "utf8", timeout: 5000 }
        );
      }
    }
    return raw;
  } catch (e) {
    throw new Error(`Failed to read ${filePath}: ${e}`);
  }
}

function writeMemoryFile(filePath: string, content: string): void {
  try {
    // Check if file already exists and is encrypted
    let needsEncryption = false;
    if (existsSync(filePath)) {
      needsEncryption = isEncryptedFile(filePath);
    } else {
      // New files in clawd/memory/ or clawd core files should be encrypted
      needsEncryption =
        filePath.startsWith(`${CLAWD_PATH}/memory/`) ||
        (filePath.startsWith(CLAWD_PATH) &&
          filePath.endsWith(".md") &&
          !filePath.includes("/second-brain/"));
    }

    if (needsEncryption) {
      try {
        execSync(`memory-write "${filePath}" -c "${content.replace(/"/g, '\\"')}"`, {
          encoding: "utf8",
          timeout: 5000,
        });
      } catch {
        // Fallback: pipe content through stdin
        execSync(`memory-write "${filePath}"`, {
          input: content,
          encoding: "utf8",
          timeout: 5000,
        });
      }
    } else {
      writeFileSync(filePath, content, "utf8");
    }
  } catch (e) {
    throw new Error(`Failed to write ${filePath}: ${e}`);
  }
}

// ─── Database Helpers ───────────────────────────────────────────────

function ensureMemoryTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      tier INTEGER NOT NULL DEFAULT 2 CHECK(tier IN (1, 2, 3)),
      label TEXT,
      description TEXT,
      tags TEXT,
      is_shared INTEGER DEFAULT 0,
      last_accessed TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(agent_id, file_path)
    );
  `);
}

// Ensure table exists on module load
try {
  ensureMemoryTable();
} catch (e) {
  log.warn({ err: e }, "Could not create memory_entries table on load (will retry)");
}

interface MemoryEntry {
  id: string;
  agent_id: string;
  file_path: string;
  tier: number;
  label: string | null;
  description: string | null;
  tags: string | null;
  is_shared: number;
  last_accessed: string | null;
  created_at: string;
  updated_at: string;
}

function getMetadata(agentId: string, filePath: string): MemoryEntry | null {
  const db = getDb();
  return (
    db
      .prepare("SELECT * FROM memory_entries WHERE agent_id = ? AND file_path = ?")
      .get(agentId, filePath) as MemoryEntry | undefined
  ) || null;
}

function getAllMetadataForAgent(agentId: string): MemoryEntry[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM memory_entries WHERE agent_id = ?")
    .all(agentId) as MemoryEntry[];
}

function upsertMetadata(
  agentId: string,
  filePath: string,
  tier: number,
  label?: string | null,
  description?: string | null,
  tags?: string[] | null,
  isShared?: boolean
): MemoryEntry {
  const db = getDb();
  const now = getCurrentTimestamp();
  const existing = getMetadata(agentId, filePath);

  if (existing) {
    db.prepare(
      `UPDATE memory_entries SET 
        tier = ?, label = ?, description = ?, tags = ?, is_shared = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      tier,
      label ?? existing.label,
      description ?? existing.description,
      tags ? JSON.stringify(tags) : existing.tags,
      isShared !== undefined ? (isShared ? 1 : 0) : existing.is_shared,
      now,
      existing.id
    );
    return { ...existing, tier, updated_at: now };
  } else {
    const id = generateId();
    db.prepare(
      `INSERT INTO memory_entries (id, agent_id, file_path, tier, label, description, tags, is_shared, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      agentId,
      filePath,
      tier,
      label || null,
      description || null,
      tags ? JSON.stringify(tags) : null,
      isShared ? 1 : 0,
      now,
      now
    );
    return {
      id,
      agent_id: agentId,
      file_path: filePath,
      tier,
      label: label || null,
      description: description || null,
      tags: tags ? JSON.stringify(tags) : null,
      is_shared: isShared ? 1 : 0,
      last_accessed: null,
      created_at: now,
      updated_at: now,
    };
  }
}

// ─── File Scanning ──────────────────────────────────────────────────

interface FileInfo {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  exists: boolean;
  encrypted: boolean;
  tier: number;
  label: string | null;
  description: string | null;
  tags: string[];
  isShared: boolean;
  category: string;
}

async function scanDirectoryRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip sessions/agent dirs that aren't relevant
        if (entry.name === "sessions" || entry.name === ".git") continue;
        const subFiles = await scanDirectoryRecursive(fullPath);
        results.push(...subFiles);
      } else if (entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory might not exist
  }
  return results;
}

function categorizeFile(filePath: string, agentId: string): string {
  if (agentId === "james") {
    if (filePath.startsWith(`${CLAWD_PATH}/memory/`)) return "daily-notes";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/journal/`)) return "journal";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/research/`)) return "research";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/decisions/`)) return "decisions";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/specs/`)) return "specs";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/drafts/`)) return "drafts";
    if (filePath.startsWith(`${CLAWD_PATH}/second-brain/`)) return "second-brain";
    // Core files
    const name = basename(filePath);
    if (["MEMORY.md", "SOUL.md", "IDENTITY.md"].includes(name)) return "core";
    if (["LEARNING.md", "LESSONS_LEARNED.md", "MISTAKES.md", "PATTERNS.md"].includes(name))
      return "learning";
  }
  // Agent persona files
  const name = basename(filePath);
  if (["IDENTITY.md", "SOUL.md"].includes(name)) return "persona";
  if (["TOOLS.md", "USER.md"].includes(name)) return "config";
  return "other";
}

async function getAgentFiles(agentConfig: AgentConfig): Promise<FileInfo[]> {
  const metadataMap = new Map<string, MemoryEntry>();
  try {
    const allMeta = getAllMetadataForAgent(agentConfig.id);
    for (const m of allMeta) {
      metadataMap.set(m.file_path, m);
    }
  } catch {
    // Table might not exist yet
  }

  const filePaths = new Set<string>();

  // Add core files
  for (const f of agentConfig.coreFiles) {
    filePaths.add(f);
  }

  // Scan directories
  for (const dir of agentConfig.scanDirs) {
    const found = await scanDirectoryRecursive(dir);
    for (const f of found) {
      filePaths.add(f);
    }
  }

  const files: FileInfo[] = [];

  for (const filePath of filePaths) {
    try {
      const stat = await fs.stat(filePath);
      const meta = metadataMap.get(filePath);
      const encrypted = isEncryptedFile(filePath);

      files.push({
        path: filePath,
        name: basename(filePath),
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        exists: true,
        encrypted,
        tier: meta?.tier ?? 2,
        label: meta?.label ?? null,
        description: meta?.description ?? null,
        tags: meta?.tags ? JSON.parse(meta.tags) : [],
        isShared: meta?.is_shared === 1,
        category: categorizeFile(filePath, agentConfig.id),
      });
    } catch {
      // File doesn't exist
      const meta = metadataMap.get(filePath);
      files.push({
        path: filePath,
        name: basename(filePath),
        size: 0,
        lastModified: "",
        exists: false,
        encrypted: false,
        tier: meta?.tier ?? 2,
        label: meta?.label ?? null,
        description: meta?.description ?? null,
        tags: meta?.tags ? JSON.parse(meta.tags) : [],
        isShared: meta?.is_shared === 1,
        category: categorizeFile(filePath, agentConfig.id),
      });
    }
  }

  // Sort: core files first, then by name
  files.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.name.localeCompare(b.name);
  });

  return files;
}

// ─── Health Calculation ─────────────────────────────────────────────

interface HealthWarning {
  type: "stale" | "bloated" | "missing" | "duplicate";
  message: string;
  filePath?: string;
  severity: "low" | "medium" | "high";
}

function calculateHealthScore(files: FileInfo[]): {
  score: number;
  warnings: HealthWarning[];
} {
  const warnings: HealthWarning[] = [];
  let deductions = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const file of files) {
    if (!file.exists) {
      warnings.push({
        type: "missing",
        message: `File not found: ${file.name}`,
        filePath: file.path,
        severity: file.tier === 1 ? "high" : "medium",
      });
      deductions += file.tier === 1 ? 15 : 5;
      continue;
    }

    // Stale files (not modified in 30+ days, only for tier 1 & 2)
    if (file.lastModified && file.tier <= 2) {
      const modDate = new Date(file.lastModified);
      if (modDate < thirtyDaysAgo) {
        warnings.push({
          type: "stale",
          message: `${file.name} not updated in 30+ days`,
          filePath: file.path,
          severity: "low",
        });
        deductions += 3;
      }
    }

    // Bloated tier 1 or 2 files (>50KB)
    if (file.size > 50 * 1024 && file.tier <= 2) {
      warnings.push({
        type: "bloated",
        message: `${file.name} is ${(file.size / 1024).toFixed(0)}KB (Tier ${file.tier})`,
        filePath: file.path,
        severity: "medium",
      });
      deductions += 5;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));
  return { score, warnings };
}

// ─── Routes ─────────────────────────────────────────────────────────

/**
 * GET /api/memory/agents
 * List all agents with memory stats
 */
router.get(
  "/agents",
  asyncHandler(async (_req, res) => {
    ensureMemoryTable();
    const agents = [];

    for (const config of AGENT_CONFIGS) {
      const files = await getAgentFiles(config);
      const existingFiles = files.filter((f) => f.exists);
      const tierBreakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
      for (const f of existingFiles) {
        tierBreakdown[String(f.tier)] = (tierBreakdown[String(f.tier)] || 0) + 1;
      }

      const { score } = calculateHealthScore(files);

      agents.push({
        id: config.id,
        name: config.name,
        emoji: config.emoji,
        coreFiles: config.coreFiles.map((f) => basename(f)),
        entryCount: existingFiles.length,
        tierBreakdown,
        healthScore: score,
      });
    }

    res.json(agents);
  })
);

/**
 * GET /api/memory/agents/:agentId/files
 * List all memory files for an agent
 */
router.get(
  "/agents/:agentId/files",
  asyncHandler(async (req, res) => {
    ensureMemoryTable();
    const { agentId } = req.params;
    const config = AGENT_CONFIGS.find((c) => c.id === agentId);
    if (!config) {
      throw new NotFoundError("Agent", agentId);
    }

    const files = await getAgentFiles(config);
    res.json({ agentId, files });
  })
);

/**
 * GET /api/memory/agents/:agentId/files/content?path=<encoded_path>
 * Read content of a memory file
 */
router.get(
  "/agents/:agentId/files/content",
  asyncHandler(async (req, res) => {
    const { agentId } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      throw new ValidationError("path query parameter is required");
    }

    if (!isAllowedPath(filePath)) {
      throw new ForbiddenError("File path not in allowed directory");
    }

    if (!existsSync(filePath)) {
      throw new NotFoundError("File", filePath);
    }

    // Update last_accessed
    try {
      const db = getDb();
      db.prepare(
        "UPDATE memory_entries SET last_accessed = ? WHERE agent_id = ? AND file_path = ?"
      ).run(getCurrentTimestamp(), agentId, filePath);
    } catch {
      // Non-critical
    }

    const content = readMemoryFile(filePath);

    res.json({
      path: filePath,
      name: basename(filePath),
      content,
      encrypted: isEncryptedFile(filePath),
    });
  })
);

/**
 * PUT /api/memory/agents/:agentId/files/content
 * Write content to a memory file
 */
router.put(
  "/agents/:agentId/files/content",
  asyncHandler(async (req, res) => {
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      throw new ValidationError("path and content are required");
    }

    if (!isAllowedPath(filePath)) {
      throw new ForbiddenError("File path not in allowed directory");
    }

    writeMemoryFile(filePath, content);

    res.json({ success: true, path: filePath });
  })
);

/**
 * PATCH /api/memory/agents/:agentId/files/metadata
 * Update metadata (tier, label, tags, etc.) for a file
 */
router.patch(
  "/agents/:agentId/files/metadata",
  asyncHandler(async (req, res) => {
    ensureMemoryTable();
    const { agentId } = req.params;
    const { path: filePath, tier, label, tags, description, is_shared } = req.body;

    if (!filePath) {
      throw new ValidationError("path is required");
    }

    if (tier !== undefined && ![1, 2, 3].includes(tier)) {
      throw new ValidationError("tier must be 1, 2, or 3");
    }

    const config = AGENT_CONFIGS.find((c) => c.id === agentId);
    if (!config) {
      throw new NotFoundError("Agent", agentId);
    }

    const entry = upsertMetadata(
      agentId,
      filePath,
      tier ?? 2,
      label,
      description,
      tags,
      is_shared
    );

    res.json(entry);
  })
);

/**
 * GET /api/memory/health
 * Health report across all agents
 */
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    ensureMemoryTable();
    const report: Array<{
      agent: string;
      score: number;
      warnings: HealthWarning[];
      fileCount: number;
    }> = [];

    // Check for duplicate filenames across agents
    const allFileNames = new Map<string, string[]>();

    for (const config of AGENT_CONFIGS) {
      const files = await getAgentFiles(config);
      const { score, warnings } = calculateHealthScore(files);

      for (const f of files) {
        const existing = allFileNames.get(f.name) || [];
        existing.push(config.id);
        allFileNames.set(f.name, existing);
      }

      report.push({
        agent: config.id,
        score,
        warnings,
        fileCount: files.filter((f) => f.exists).length,
      });
    }

    // Add duplicate warnings
    const duplicateWarnings: HealthWarning[] = [];
    for (const [name, agents] of allFileNames) {
      if (agents.length > 1) {
        duplicateWarnings.push({
          type: "duplicate",
          message: `${name} exists in agents: ${agents.join(", ")}`,
          severity: "low",
        });
      }
    }

    res.json({ agents: report, duplicates: duplicateWarnings });
  })
);

/**
 * GET /api/memory/search?q=<query>&agents=<comma-separated>
 * Search across memory files
 */
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = (req.query.q as string)?.toLowerCase();
    const agentFilter = (req.query.agents as string)
      ?.split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    if (!query) {
      throw new ValidationError("Search query (q) is required");
    }

    const results: Array<{
      agentId: string;
      agentName: string;
      filePath: string;
      fileName: string;
      snippet: string;
      matchCount: number;
    }> = [];

    const configs = agentFilter
      ? AGENT_CONFIGS.filter((c) => agentFilter.includes(c.id))
      : AGENT_CONFIGS;

    for (const config of configs) {
      const files = await getAgentFiles(config);

      for (const file of files) {
        if (!file.exists) continue;

        try {
          const content = readMemoryFile(file.path);
          const lowerContent = content.toLowerCase();
          const idx = lowerContent.indexOf(query);

          if (idx >= 0) {
            // Extract snippet around match
            const start = Math.max(0, idx - 60);
            const end = Math.min(content.length, idx + query.length + 60);
            let snippet = content.slice(start, end).trim();
            if (start > 0) snippet = "..." + snippet;
            if (end < content.length) snippet = snippet + "...";

            // Count total matches
            let matchCount = 0;
            let searchIdx = 0;
            while ((searchIdx = lowerContent.indexOf(query, searchIdx)) !== -1) {
              matchCount++;
              searchIdx += query.length;
            }

            results.push({
              agentId: config.id,
              agentName: config.name,
              filePath: file.path,
              fileName: file.name,
              snippet,
              matchCount,
            });
          }
        } catch (e) {
          log.debug({ file: file.path, err: e }, "Could not read file for search");
        }
      }
    }

    // Sort by match count descending
    results.sort((a, b) => b.matchCount - a.matchCount);

    res.json({ query, resultCount: results.length, results: results.slice(0, 50) });
  })
);

export default router;
