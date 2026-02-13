/**
 * Second Brain API routes
 * Serves markdown documents, conversations, agent memories, and search
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { join, basename, extname } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors.js";

const execFileAsync = promisify(execFile);
const router = Router();
const log = createLogger("second-brain");

// Base paths
const SECOND_BRAIN_PATH = "/home/jd-server-admin/clawd/second-brain";
const MEMORY_PATH = "/home/jd-server-admin/clawd/memory";
const AGENTS_MEMORY_PATH = "/home/jd-server-admin/clawd/memory/agents";
const SESSIONS_BASE_PATH = "/home/jd-server-admin/.clawdbot/agents";
const MEMORY_READ_CMD = "/home/jd-server-admin/bin/memory-read";

// Valid folders for second brain documents
const VALID_FOLDERS = ["journal", "concepts", "decisions", "projects", "research"];

// ============================================
// Types
// ============================================

interface DocumentMeta {
  path: string;
  name: string;
  title: string;
  folder: string;
  lastModified: string;
  size?: number;
  preview?: string;
}

interface FolderGroup {
  name: string;
  documents: DocumentMeta[];
}

interface AgentMemory {
  id: string;
  name: string;
  filename: string;
  lastModified: string;
  size: number;
  sections: {
    principles: number;
    decisions: number;
    preferences: number;
  };
}

interface ConversationSession {
  id: string;
  agent: string;
  timestamp: string;
  messageCount: number;
  size: number;
  firstMessage?: string;
  lastMessage?: string;
  isLong: boolean;
}

interface SearchResult {
  type: "document" | "agent-memory" | "conversation";
  path: string;
  title: string;
  source: string;
  snippet: string;
  lastModified: string;
  score: number;
}

// ============================================
// Cache for decrypted memory files
// ============================================

const memoryCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function readMemoryFile(filePath: string): Promise<string> {
  const cached = memoryCache.get(filePath);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.content;
  }

  try {
    // First check if file is encrypted
    const rawContent = await fs.readFile(filePath, "utf-8");
    if (!rawContent.startsWith("JAMES_ENCRYPTED_V1")) {
      // Not encrypted, return as-is
      memoryCache.set(filePath, { content: rawContent, timestamp: Date.now() });
      return rawContent;
    }

    // Use memory-read CLI to decrypt
    const { stdout } = await execFileAsync(MEMORY_READ_CMD, [filePath], {
      timeout: 10000,
    });
    memoryCache.set(filePath, { content: stdout, timestamp: Date.now() });
    return stdout;
  } catch (err) {
    log.error({ err, filePath }, "Failed to read memory file");
    throw new Error(`Failed to decrypt memory file: ${filePath}`);
  }
}

// ============================================
// Helpers
// ============================================

function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  return basename(filename, extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractPreview(content: string, maxLength = 200): string {
  // Skip title line, get first meaningful paragraph
  const lines = content.split("\n");
  let preview = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("**Last Updated")) continue;
    if (trimmed.startsWith("---")) continue;
    preview = trimmed;
    break;
  }
  if (preview.length > maxLength) {
    return preview.substring(0, maxLength) + "...";
  }
  return preview;
}

function countSections(content: string): { principles: number; decisions: number; preferences: number } {
  const principlesMatch = content.match(/^[-*]\s+\*\*.+\*\*/gm);
  const principles = principlesMatch ? principlesMatch.length : 0;

  // Count decision entries (### headers under decisions section)
  const decisionsSection = content.match(/## Past Decisions([\s\S]*?)(?=\n## |$)/);
  const decisionsMatch = decisionsSection ? decisionsSection[1].match(/^###\s/gm) : null;
  const decisions = decisionsMatch ? decisionsMatch.length : 0;

  // Count preference items
  const prefsSection = content.match(/## Preferences & Patterns([\s\S]*?)(?=\n## |$)/);
  const prefsMatch = prefsSection ? prefsSection[1].match(/^[-*]\s/gm) : null;
  const preferences = prefsMatch ? prefsMatch.length : 0;

  return { principles, decisions, preferences };
}

function extractAgentName(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+?)(?:\s*[-–—]\s*.+)?$/m);
  if (h1Match) {
    const fullTitle = h1Match[1].trim();
    // Extract just the name part (before the dash/role)
    const dashMatch = fullTitle.match(/^(.+?)\s*[-–—]/);
    if (dashMatch) return dashMatch[1].trim();
    return fullTitle;
  }
  return basename(filename, ".md").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSnippet(content: string, query: string, contextChars = 80): string {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx === -1) return extractPreview(content, 150);

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);
  let snippet = content.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet.replace(/\n/g, " ");
}

// ============================================
// DOCUMENTS ROUTES (existing, enhanced)
// ============================================

/**
 * List all documents grouped by folder
 */
router.get("/documents", asyncHandler(async (_req, res) => {
  const folders: FolderGroup[] = [];

  for (const folder of VALID_FOLDERS) {
    const folderPath = join(SECOND_BRAIN_PATH, folder);
    const documents: DocumentMeta[] = [];

    try {
      const files = await fs.readdir(folderPath);

      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const filePath = join(folderPath, file);
        const stat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, "utf-8");

        documents.push({
          path: `${folder}/${file}`,
          name: file,
          title: extractTitle(content, file),
          folder,
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
          preview: extractPreview(content),
        });
      }

      documents.sort((a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    } catch (err) {
      log.debug({ folder }, "Folder not found, skipping");
    }

    folders.push({ name: folder, documents });
  }

  // Root docs
  const rootDocs: DocumentMeta[] = [];
  try {
    const rootFiles = await fs.readdir(SECOND_BRAIN_PATH);
    for (const file of rootFiles) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(SECOND_BRAIN_PATH, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;
      const content = await fs.readFile(filePath, "utf-8");
      rootDocs.push({
        path: file,
        name: file,
        title: extractTitle(content, file),
        folder: "",
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
        preview: extractPreview(content),
      });
    }
    if (rootDocs.length > 0) {
      rootDocs.sort((a, b) =>
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      folders.unshift({ name: "", documents: rootDocs });
    }
  } catch (err) {
    log.error({ err }, "Error reading second-brain root directory");
  }

  res.json({ folders });
}));

/**
 * Get a single document's content
 */
router.get("/documents/*", asyncHandler(async (req, res) => {
  const docPath = (req.params as Record<string, string>)[0];
  if (!docPath) throw new ValidationError("Document path required");

  const normalizedPath = docPath.replace(/\.\./g, "");
  const pathParts = normalizedPath.split("/");
  if (pathParts.length > 1) {
    const folder = pathParts[0];
    if (!VALID_FOLDERS.includes(folder)) {
      throw new ForbiddenError("Invalid folder");
    }
  }

  const fullPath = join(SECOND_BRAIN_PATH, normalizedPath);
  const realPath = await fs.realpath(fullPath).catch(() => null);
  if (!realPath || !realPath.startsWith(SECOND_BRAIN_PATH)) {
    throw new NotFoundError("Document");
  }

  const content = await fs.readFile(fullPath, "utf-8");
  const stat = await fs.stat(fullPath);

  res.json({
    path: normalizedPath,
    name: basename(normalizedPath),
    title: extractTitle(content, normalizedPath),
    content,
    lastModified: stat.mtime.toISOString(),
  });
}));

// ============================================
// JOURNAL ROUTES
// ============================================

/**
 * List journal entries with date info
 */
router.get("/journal", asyncHandler(async (_req, res) => {
  const journalPath = join(SECOND_BRAIN_PATH, "journal");
  const entries: Array<{
    date: string;
    filename: string;
    title: string;
    preview: string;
    lastModified: string;
    size: number;
  }> = [];

  try {
    const files = await fs.readdir(journalPath);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(journalPath, file);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, "utf-8");

      // Extract date from filename (YYYY-MM-DD.md)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : file.replace(".md", "");

      entries.push({
        date,
        filename: file,
        title: extractTitle(content, file),
        preview: extractPreview(content),
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
      });
    }

    entries.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    log.error({ err }, "Error reading journal directory");
  }

  res.json({ entries, total: entries.length });
}));

/**
 * Get a specific journal entry by date
 */
router.get("/journal/:date", asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError("Invalid date format. Use YYYY-MM-DD");
  }

  const journalPath = join(SECOND_BRAIN_PATH, "journal");
  const filePath = join(journalPath, `${date}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);
    res.json({
      date,
      filename: `${date}.md`,
      title: extractTitle(content, `${date}.md`),
      content,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    });
  } catch {
    throw new NotFoundError(`Journal entry for ${date}`);
  }
}));

// ============================================
// RESEARCH ROUTES
// ============================================

/**
 * List research notes
 */
router.get("/research", asyncHandler(async (_req, res) => {
  const researchPath = join(SECOND_BRAIN_PATH, "research");
  const notes: Array<{
    filename: string;
    title: string;
    preview: string;
    date: string;
    lastModified: string;
    size: number;
    tags: string[];
  }> = [];

  try {
    const files = await fs.readdir(researchPath);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(researchPath, file);
      const stat = await fs.stat(filePath);
      const content = await fs.readFile(filePath, "utf-8");

      // Extract date from filename
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : stat.mtime.toISOString().split("T")[0];

      // Extract tags from filename
      const nameWithoutDate = file.replace(/^\d{4}-\d{2}-\d{2}-?/, "").replace(".md", "");
      const tags = nameWithoutDate.split("-").filter(t => t.length > 2);

      notes.push({
        filename: file,
        title: extractTitle(content, file),
        preview: extractPreview(content),
        date,
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
        tags,
      });
    }

    notes.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    log.error({ err }, "Error reading research directory");
  }

  res.json({ notes, total: notes.length });
}));

/**
 * Get a specific research note
 */
router.get("/research/:filename", asyncHandler(async (req, res) => {
  const { filename } = req.params;
  if (!filename.endsWith(".md")) {
    throw new ValidationError("Filename must end with .md");
  }
  if (filename.includes("..") || filename.includes("/")) {
    throw new ForbiddenError("Invalid filename");
  }

  const filePath = join(SECOND_BRAIN_PATH, "research", filename);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);
    res.json({
      filename,
      title: extractTitle(content, filename),
      content,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    });
  } catch {
    throw new NotFoundError(`Research note: ${filename}`);
  }
}));

// ============================================
// AGENT MEMORIES ROUTES
// ============================================

/**
 * List all agent memory files
 */
router.get("/agents", asyncHandler(async (_req, res) => {
  const agents: AgentMemory[] = [];

  try {
    const files = await fs.readdir(AGENTS_MEMORY_PATH);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(AGENTS_MEMORY_PATH, file);
      const stat = await fs.stat(filePath);

      // Try to decrypt and parse
      try {
        const content = await readMemoryFile(filePath);
        const name = extractAgentName(content, file);
        const sections = countSections(content);

        agents.push({
          id: basename(file, ".md"),
          name,
          filename: file,
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
          sections,
        });
      } catch (err) {
        // Can't decrypt, still list it
        agents.push({
          id: basename(file, ".md"),
          name: basename(file, ".md").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          filename: file,
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
          sections: { principles: 0, decisions: 0, preferences: 0 },
        });
      }
    }

    // Also check root memory files (non-agent)
    const rootMemoryFiles = await fs.readdir(MEMORY_PATH);
    for (const file of rootMemoryFiles) {
      if (!file.endsWith(".md")) continue;
      if (file === "TEMPLATE.md") continue;
      const filePath = join(MEMORY_PATH, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;

      try {
        const content = await readMemoryFile(filePath);
        const name = extractAgentName(content, file);
        const sections = countSections(content);

        agents.push({
          id: `root-${basename(file, ".md")}`,
          name,
          filename: file,
          lastModified: stat.mtime.toISOString(),
          size: stat.size,
          sections,
        });
      } catch {
        // Skip files we can't read
      }
    }

    agents.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  } catch (err) {
    log.error({ err }, "Error reading agent memories");
  }

  res.json({ agents, total: agents.length });
}));

/**
 * Get a specific agent's memory (decrypted)
 */
router.get("/agents/:agentId", asyncHandler(async (req, res) => {
  const { agentId } = req.params;

  if (agentId.includes("..") || agentId.includes("/")) {
    throw new ForbiddenError("Invalid agent ID");
  }

  // Check agents directory first, then root memory
  let filePath: string;
  let isRootMemory = false;

  if (agentId.startsWith("root-")) {
    const filename = agentId.replace("root-", "") + ".md";
    filePath = join(MEMORY_PATH, filename);
    isRootMemory = true;
  } else {
    filePath = join(AGENTS_MEMORY_PATH, `${agentId}.md`);
  }

  try {
    await fs.access(filePath);
  } catch {
    throw new NotFoundError(`Agent memory: ${agentId}`);
  }

  const content = await readMemoryFile(filePath);
  const stat = await fs.stat(filePath);
  const name = extractAgentName(content, basename(filePath));
  const sections = countSections(content);

  res.json({
    id: agentId,
    name,
    content,
    lastModified: stat.mtime.toISOString(),
    size: stat.size,
    sections,
    isRootMemory,
  });
}));

// ============================================
// CONVERSATIONS ROUTES
// ============================================

/**
 * List conversation sessions
 */
router.get("/conversations", asyncHandler(async (req, res) => {
  const { agent: agentFilter, limit: limitStr } = req.query;
  const limit = Math.min(parseInt(limitStr as string) || 50, 200);

  const sessions: ConversationSession[] = [];

  try {
    const agents = await fs.readdir(SESSIONS_BASE_PATH);

    for (const agentDir of agents) {
      if (agentFilter && agentDir !== agentFilter) continue;

      const sessionsPath = join(SESSIONS_BASE_PATH, agentDir, "sessions");
      try {
        const files = await fs.readdir(sessionsPath);

        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const filePath = join(sessionsPath, file);
          const stat = await fs.stat(filePath);

          // Parse first line for session metadata
          let timestamp = stat.mtime.toISOString();
          let messageCount = 0;

          try {
            const content = await fs.readFile(filePath, "utf-8");
            const lines = content.split("\n").filter((l) => l.trim());
            messageCount = lines.length;

            // Get session timestamp from first line
            const firstLine = JSON.parse(lines[0]);
            if (firstLine.timestamp) {
              timestamp = firstLine.timestamp;
            }
          } catch {
            // Can't parse, use file stats
          }

          sessions.push({
            id: basename(file, ".jsonl"),
            agent: agentDir,
            timestamp,
            messageCount,
            size: stat.size,
            isLong: messageCount > 20,
          });
        }
      } catch {
        // No sessions directory for this agent
      }
    }

    // Sort by timestamp (newest first)
    sessions.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    log.error({ err }, "Error listing conversations");
  }

  res.json({
    sessions: sessions.slice(0, limit),
    total: sessions.length,
    agents: [...new Set(sessions.map((s) => s.agent))],
  });
}));

/**
 * Get a specific conversation transcript
 */
router.get("/conversations/:agent/:sessionId", asyncHandler(async (req, res) => {
  const { agent, sessionId } = req.params;

  if (agent.includes("..") || sessionId.includes("..")) {
    throw new ForbiddenError("Invalid path");
  }

  const filePath = join(SESSIONS_BASE_PATH, agent, "sessions", `${sessionId}.jsonl`);

  try {
    await fs.access(filePath);
  } catch {
    throw new NotFoundError(`Conversation: ${agent}/${sessionId}`);
  }

  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const stat = await fs.stat(filePath);

  // Parse messages
  const messages: Array<{
    type: string;
    id: string;
    timestamp: string;
    role?: string;
    text?: string;
    toolName?: string;
  }> = [];

  let sessionMeta: Record<string, unknown> = {};

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);

      if (obj.type === "session") {
        sessionMeta = obj;
        continue;
      }

      if (obj.type === "message" && obj.message) {
        const msg = obj.message;
        let text = "";

        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "text") {
              text += block.text;
            } else if (block.type === "tool_use") {
              text += `[Tool: ${block.name}]`;
            } else if (block.type === "tool_result" || block.type === "toolResult") {
              text += "[Tool Result]";
            }
          }
        } else if (typeof msg.content === "string") {
          text = msg.content;
        }

        if (text) {
          messages.push({
            type: "message",
            id: obj.id,
            timestamp: obj.timestamp,
            role: msg.role,
            text: text.substring(0, 5000), // Limit text size
          });
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  res.json({
    id: sessionId,
    agent,
    timestamp: sessionMeta.timestamp || stat.mtime.toISOString(),
    messages,
    totalLines: lines.length,
    size: stat.size,
  });
}));

// ============================================
// UNIVERSAL SEARCH
// ============================================

router.get("/search", asyncHandler(async (req, res) => {
  const { q, source, limit: limitStr } = req.query;

  if (!q || typeof q !== "string") {
    throw new ValidationError("Search query required");
  }

  const query = q.toLowerCase().trim();
  const limit = Math.min(parseInt(limitStr as string) || 30, 100);
  const sourceFilter = source as string | undefined;
  const results: SearchResult[] = [];

  // Search documents
  if (!sourceFilter || sourceFilter === "documents") {
    const allFolders = ["", ...VALID_FOLDERS];
    for (const folder of allFolders) {
      const folderPath = folder ? join(SECOND_BRAIN_PATH, folder) : SECOND_BRAIN_PATH;
      try {
        const files = await fs.readdir(folderPath);
        for (const file of files) {
          if (!file.endsWith(".md")) continue;
          const filePath = join(folderPath, file);
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) continue;
          const content = await fs.readFile(filePath, "utf-8");
          const title = extractTitle(content, file);
          const lowerTitle = title.toLowerCase();
          const lowerFile = file.toLowerCase();
          const lowerContent = content.toLowerCase();

          if (lowerTitle.includes(query) || lowerFile.includes(query) || lowerContent.includes(query)) {
            let score = 0;
            if (lowerTitle.includes(query)) score += 10;
            if (lowerFile.includes(query)) score += 5;
            const contentMatches = (lowerContent.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
            score += Math.min(contentMatches, 10);

            results.push({
              type: "document",
              path: folder ? `${folder}/${file}` : file,
              title,
              source: folder || "root",
              snippet: getSnippet(content, query),
              lastModified: stat.mtime.toISOString(),
              score,
            });
          }
        }
      } catch { /* folder not found */ }
    }
  }

  // Search agent memories
  if (!sourceFilter || sourceFilter === "agent-memory") {
    try {
      const files = await fs.readdir(AGENTS_MEMORY_PATH);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        try {
          const content = await readMemoryFile(join(AGENTS_MEMORY_PATH, file));
          const title = extractAgentName(content, file);
          const lowerContent = content.toLowerCase();

          if (title.toLowerCase().includes(query) || lowerContent.includes(query)) {
            const stat = await fs.stat(join(AGENTS_MEMORY_PATH, file));
            let score = 0;
            if (title.toLowerCase().includes(query)) score += 10;
            const matches = (lowerContent.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;
            score += Math.min(matches, 10);

            results.push({
              type: "agent-memory",
              path: `agents/${basename(file, ".md")}`,
              title: `${title} (Agent Memory)`,
              source: "agent-memory",
              snippet: getSnippet(content, query),
              lastModified: stat.mtime.toISOString(),
              score,
            });
          }
        } catch { /* can't decrypt */ }
      }
    } catch { /* dir not found */ }
  }

  // Search conversations (search in larger session files only - they have actual content)
  if (!sourceFilter || sourceFilter === "conversation") {
    try {
      const agents = await fs.readdir(SESSIONS_BASE_PATH);
      for (const agentDir of agents) {
        const sessionsPath = join(SESSIONS_BASE_PATH, agentDir, "sessions");
        try {
          const files = await fs.readdir(sessionsPath);
          for (const file of files) {
            if (!file.endsWith(".jsonl")) continue;
            const filePath = join(sessionsPath, file);
            const stat = await fs.stat(filePath);

            // Only search larger sessions (likely have real content)
            if (stat.size < 10000) continue;

            try {
              const content = await fs.readFile(filePath, "utf-8");
              const lowerContent = content.toLowerCase();

              if (lowerContent.includes(query)) {
                // Extract a snippet from the message containing the query
                let snippet = "";
                const lines = content.split("\n");
                for (const line of lines) {
                  if (line.toLowerCase().includes(query)) {
                    try {
                      const obj = JSON.parse(line);
                      if (obj.message?.content) {
                        const textContent = Array.isArray(obj.message.content)
                          ? obj.message.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join(" ")
                          : String(obj.message.content);
                        if (textContent.toLowerCase().includes(query)) {
                          snippet = getSnippet(textContent, query);
                          break;
                        }
                      }
                    } catch { /* skip */ }
                  }
                }

                const matches = (lowerContent.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g")) || []).length;

                results.push({
                  type: "conversation",
                  path: `conversations/${agentDir}/${basename(file, ".jsonl")}`,
                  title: `${agentDir} session`,
                  source: agentDir,
                  snippet: snippet || `Found ${matches} matches in conversation`,
                  lastModified: stat.mtime.toISOString(),
                  score: Math.min(matches, 10),
                });
              }
            } catch { /* can't read */ }
          }
        } catch { /* no sessions dir */ }
      }
    } catch { /* base dir error */ }
  }

  // Sort by score (highest first), then by date
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  res.json({ results: results.slice(0, limit), total: results.length, query: q });
}));

// ============================================
// RECENT ACTIVITY
// ============================================

router.get("/activity", asyncHandler(async (req, res) => {
  const daysStr = req.query.days as string;
  const days = Math.min(parseInt(daysStr) || 7, 90);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  interface ActivityItem {
    type: "document" | "agent-memory" | "conversation";
    title: string;
    path: string;
    source: string;
    lastModified: string;
    action: "created" | "modified";
  }

  const activities: ActivityItem[] = [];

  // Scan documents
  const allFolders = ["", ...VALID_FOLDERS];
  for (const folder of allFolders) {
    const folderPath = folder ? join(SECOND_BRAIN_PATH, folder) : SECOND_BRAIN_PATH;
    try {
      const files = await fs.readdir(folderPath);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        const filePath = join(folderPath, file);
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) continue;
        if (stat.mtime < cutoff) continue;

        const content = await fs.readFile(filePath, "utf-8");
        activities.push({
          type: "document",
          title: extractTitle(content, file),
          path: folder ? `${folder}/${file}` : file,
          source: folder || "root",
          lastModified: stat.mtime.toISOString(),
          action: Math.abs(stat.mtime.getTime() - stat.birthtime.getTime()) < 60000 ? "created" : "modified",
        });
      }
    } catch { /* folder not found */ }
  }

  // Scan agent memories
  try {
    const files = await fs.readdir(AGENTS_MEMORY_PATH);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const filePath = join(AGENTS_MEMORY_PATH, file);
      const stat = await fs.stat(filePath);
      if (stat.mtime < cutoff) continue;

      try {
        const content = await readMemoryFile(filePath);
        const name = extractAgentName(content, file);
        activities.push({
          type: "agent-memory",
          title: `${name} (Agent Memory)`,
          path: `agents/${basename(file, ".md")}`,
          source: "agent-memory",
          lastModified: stat.mtime.toISOString(),
          action: "modified",
        });
      } catch { /* can't decrypt */ }
    }
  } catch { /* dir not found */ }

  // Recent conversations
  try {
    const agents = await fs.readdir(SESSIONS_BASE_PATH);
    for (const agentDir of agents) {
      const sessionsPath = join(SESSIONS_BASE_PATH, agentDir, "sessions");
      try {
        const files = await fs.readdir(sessionsPath);
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const filePath = join(sessionsPath, file);
          const stat = await fs.stat(filePath);
          if (stat.mtime < cutoff) continue;

          activities.push({
            type: "conversation",
            title: `${agentDir} session`,
            path: `conversations/${agentDir}/${basename(file, ".jsonl")}`,
            source: agentDir,
            lastModified: stat.mtime.toISOString(),
            action: "created",
          });
        }
      } catch { /* no sessions */ }
    }
  } catch { /* base dir error */ }

  // Sort by date (newest first)
  activities.sort((a, b) =>
    new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  res.json({
    activities: activities.slice(0, 50),
    total: activities.length,
    days,
  });
}));

export default router;
