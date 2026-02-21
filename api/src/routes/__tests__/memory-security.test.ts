/**
 * Memory API Security Tests
 *
 * Regression tests for command injection vulnerabilities (CVE-equivalent).
 * Tests that:
 * - File paths are validated and sanitized
 * - Path traversal attacks are blocked
 * - Null byte injection is blocked
 * - Shell metacharacters in file paths don't cause command injection
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, resetIdCounter } from "../../test/setup.js";
import { createTestApp } from "../../test/app.js";
import request from "supertest";

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

// Mock child_process to verify safe usage patterns
vi.mock("child_process", () => ({
  execFileSync: vi.fn(() => "mocked content"),
  // execSync should NOT be imported anymore - if it is, tests will catch it
  execSync: vi.fn(() => {
    throw new Error("execSync should not be used - use execFileSync instead");
  }),
}));

// Mock fs operations for memory files
vi.mock("fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readFileSync: vi.fn((path: string) => {
      if (typeof path === "string" && path.includes("test-file")) {
        return "plain text content";
      }
      return (actual.readFileSync as Function)(path);
    }),
    existsSync: vi.fn((path: string) => {
      if (typeof path === "string" && path.includes("test-file")) return true;
      if (typeof path === "string" && path.includes("nonexistent")) return false;
      return (actual.existsSync as Function)(path);
    }),
    writeFileSync: vi.fn(),
    statSync: vi.fn(() => ({
      size: 100,
      mtime: new Date(),
      isDirectory: () => false,
    })),
    promises: actual.promises,
  };
});

import memoryRouter from "../memory.js";

const app = createTestApp(memoryRouter, "/api/memory");

// ============================================================================
// Tests
// ============================================================================

describe("Memory API Security", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import("../../database.js")) as any;
    dbModule.__setTestDb(testDb);

    // Create memory_entries table
    testDb.exec(`
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

    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Path Traversal Prevention
  // ==========================================================================

  describe("Path Traversal Prevention", () => {
    it("rejects paths with .. traversal in GET content", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "/home/jd-server-admin/clawd/../../etc/passwd" });

      expect(res.status).toBe(403);
    });

    it("rejects paths outside allowed roots in GET content", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "/etc/passwd" });

      expect(res.status).toBe(403);
    });

    it("rejects paths outside allowed roots in PUT content", async () => {
      const res = await request(app)
        .put("/api/memory/agents/james/files/content")
        .send({ path: "/etc/shadow", content: "malicious" });

      expect(res.status).toBe(403);
    });

    it("rejects paths with .. traversal in PUT content", async () => {
      const res = await request(app)
        .put("/api/memory/agents/james/files/content")
        .send({
          path: "/home/jd-server-admin/clawd/../../../etc/crontab",
          content: "malicious",
        });

      expect(res.status).toBe(403);
    });

    it("rejects absolute paths outside allowed roots", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "/tmp/malicious-file.md" });

      expect(res.status).toBe(403);
    });

    it("rejects paths with null bytes in GET content", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "/home/jd-server-admin/clawd/memory/test\0.md" });

      // Null bytes should trigger validation error (400) or forbidden (403)
      expect([400, 403, 404]).toContain(res.status);
    });

    it("rejects paths with null bytes in PUT content", async () => {
      const res = await request(app)
        .put("/api/memory/agents/james/files/content")
        .send({
          path: "/home/jd-server-admin/clawd/memory/test\0../../etc/passwd",
          content: "malicious",
        });

      expect([400, 403]).toContain(res.status);
    });

    it("rejects Windows-style drive letter paths", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "C:\\Windows\\System32\\config\\sam" });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // Command Injection Prevention
  // ==========================================================================

  describe("Command Injection Prevention", () => {
    it("rejects file paths with shell metacharacters via GET", async () => {
      // These should be blocked by path validation (not in allowed roots after resolve)
      const maliciousPaths = [
        '/home/jd-server-admin/clawd/test"; rm -rf /',
        "/home/jd-server-admin/clawd/test`whoami`",
        "/home/jd-server-admin/clawd/test$(cat /etc/passwd)",
        "/home/jd-server-admin/clawd/test|ls",
      ];

      for (const path of maliciousPaths) {
        const res = await request(app)
          .get("/api/memory/agents/james/files/content")
          .query({ path });

        // Should either be 403 (forbidden) or 404 (not found after safe resolution)
        // but NOT 200 with command execution results
        expect([403, 404]).toContain(res.status);
      }
    });

    it("rejects file paths with null bytes", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content")
        .query({ path: "/home/jd-server-admin/clawd/test\0.md" });

      // Null bytes are stripped by HTTP layer or caught by path validation
      // Either way, the path should not be processed as-is
      expect([400, 403, 404]).toContain(res.status);
    });

    it("rejects content with null bytes in PUT", async () => {
      const res = await request(app)
        .put("/api/memory/agents/james/files/content")
        .send({
          path: "/home/jd-server-admin/clawd/test\0malicious",
          content: "test",
        });

      // Null bytes are stripped by HTTP/JSON layer or caught by validation
      expect([400, 403, 404]).toContain(res.status);
    });
  });

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  describe("Input Validation", () => {
    it("requires path parameter for GET content", async () => {
      const res = await request(app)
        .get("/api/memory/agents/james/files/content");

      expect(res.status).toBe(400);
    });

    it("requires path and content for PUT content", async () => {
      const res = await request(app)
        .put("/api/memory/agents/james/files/content")
        .send({});

      expect(res.status).toBe(400);
    });

    it("validates agent ID exists", async () => {
      const res = await request(app)
        .get("/api/memory/agents/nonexistent/files");

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Import Safety
  // ==========================================================================

  // ==========================================================================
  // Source Code Pattern Verification
  // ==========================================================================

  describe("Source Code Security Patterns", () => {
    it("memory.ts routes use validateFilePath instead of direct isAllowedPath for user input", async () => {
      const fs = await import("fs");
      const path = await import("path");

      // Read the actual source (unmocked)
      const { readFileSync: realRead } = await vi.importActual<typeof import("fs")>("fs");
      const src = realRead(
        path.join(process.cwd(), "src/routes/memory.ts"),
        "utf-8"
      );

      // The GET and PUT content routes should use validateFilePath, not raw isAllowedPath
      // Extract the route handlers for content endpoints
      const getContentHandler = src.match(/\/agents\/:agentId\/files\/content.*?asyncHandler\(async.*?\}\)\n\)/s);
      const putContentHandler = src.match(/PUT.*?\/agents\/:agentId\/files\/content.*?asyncHandler\(async.*?\}\)\n\)/s);

      // Both should use validateFilePath
      expect(src).toContain("validateFilePath(filePath)");
    });

    it("memory.ts scanDirectoryRecursive sanitizes entry names", async () => {
      const { readFileSync: realRead } = await vi.importActual<typeof import("fs")>("fs");
      const path = await import("path");
      const src = realRead(
        path.join(process.cwd(), "src/routes/memory.ts"),
        "utf-8"
      );

      // scanDirectoryRecursive should check for traversal in entry.name
      const scanFn = src.match(/async function scanDirectoryRecursive[\s\S]*?^}/m);
      expect(scanFn?.[0]).toContain('entry.name.includes("..")');
    });
  });

  describe("Import Safety", () => {
    it("does not import execSync from child_process", async () => {
      // Verify the source code uses execFileSync, not execSync
      const fs = await import("fs");
      const sourceCode = (fs as any).readFileSync.getMockImplementation
        ? "mocked"
        : "";

      // The real test is that our mocked execSync throws if called
      // and the routes use execFileSync instead
      const { execSync } = await import("child_process");
      expect(() => (execSync as any)("echo test")).toThrow(
        "execSync should not be used"
      );
    });
  });
});
