/**
 * Captures API Security Tests
 *
 * Regression tests for XSS vulnerabilities in the captures route.
 * Tests that user-controlled data is sanitized before interpolation
 * into message templates.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, resetIdCounter, testId } from "../../test/setup.js";
import { createTestApp } from "../../test/app.js";
import request from "supertest";

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

// Track spawn calls to verify sanitization
const spawnMock = vi.fn(() => ({
  unref: vi.fn(),
  pid: 12345,
}));

vi.mock("child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import capturesRouter from "../captures.js";

const app = createTestApp(capturesRouter, "/api/captures");

// ============================================================================
// Helpers
// ============================================================================

function insertTestCapture(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    content: string;
    type: string;
    processed: number;
    processing_status: string;
  }> = {}
): string {
  const id = overrides.id ?? testId("capture");
  db.prepare(
    `INSERT INTO captures (id, content, type, processed, processing_status, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id,
    overrides.content ?? "Test capture content",
    overrides.type ?? "note",
    overrides.processed ?? 0,
    overrides.processing_status ?? "pending"
  );
  return id;
}

// ============================================================================
// Tests
// ============================================================================

describe("Captures API Security", () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import("../../database.js")) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
    spawnMock.mockClear();

    // Insert a projects table entry for context
    testDb
      .prepare(
        `INSERT INTO projects (id, name, area, description, status)
       VALUES (?, ?, ?, ?, ?)`
      )
      .run("proj-1", "Test Project", "personal", "A test project", "active");
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // XSS Prevention in Message Templates
  // ==========================================================================

  describe("XSS Prevention", () => {
    it("sanitizes HTML in capture content before processing", async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const id = insertTestCapture(testDb, {
        content: xssPayload,
        type: "note",
      });

      await request(app).post(`/api/captures/${id}/process-with-james`);

      // Verify spawn was called
      expect(spawnMock).toHaveBeenCalled();

      // Get the message argument passed to spawn
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      // Verify HTML entities are escaped
      expect(message).not.toContain("<script>");
      expect(message).not.toContain("</script>");
      expect(message).toContain("&lt;script&gt;");
      expect(message).toContain("&lt;/script&gt;");
    });

    it("sanitizes HTML in capture content with tag attributes", async () => {
      const xssPayload = '<img src=x onerror="alert(1)">';
      const id = insertTestCapture(testDb, {
        content: xssPayload,
        type: "task",
      });

      await request(app).post(`/api/captures/${id}/process-with-james`);

      expect(spawnMock).toHaveBeenCalled();
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      // HTML angle brackets must be escaped so the tag is not functional
      expect(message).not.toContain("<img");
      expect(message).toContain("&lt;img");
      // Quotes around attribute values must be escaped
      expect(message).toContain("&quot;alert(1)&quot;");
      // The raw onerror= text is fine as long as it's not inside an HTML tag
      // (angle brackets are escaped, so no tag context exists)
    });

    it("sanitizes event-handler XSS in content", async () => {
      const xssPayload = 'test" onmouseover="alert(document.cookie)"';
      const id = insertTestCapture(testDb, {
        content: xssPayload,
        type: "note",
      });

      await request(app).post(`/api/captures/${id}/process-with-james`);

      expect(spawnMock).toHaveBeenCalled();
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      // Double quotes should be escaped
      expect(message).toContain("&quot;");
    });

    it("handles null bytes in capture content", async () => {
      const id = insertTestCapture(testDb, {
        content: "test\0malicious",
        type: "note",
      });

      await request(app).post(`/api/captures/${id}/process-with-james`);

      expect(spawnMock).toHaveBeenCalled();
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      // Null bytes should be stripped
      expect(message).not.toContain("\0");
      expect(message).toContain("testmalicious");
    });
  });

  // ==========================================================================
  // Capture Type Validation
  // ==========================================================================

  describe("Capture Type Validation", () => {
    it("accepts valid capture types", async () => {
      for (const type of ["note", "task", "meeting", "idea"]) {
        const id = insertTestCapture(testDb, {
          content: `Test ${type}`,
          type,
        });

        spawnMock.mockClear();
        await request(app).post(`/api/captures/${id}/process-with-james`);

        expect(spawnMock).toHaveBeenCalled();
        const spawnArgs = spawnMock.mock.calls[0];
        const cliArgs = spawnArgs[1] as string[];
        const messageIdx = cliArgs.indexOf("--message");
        const message = cliArgs[messageIdx + 1];

        expect(message).toContain(`**Type:** ${type}`);
      }
    });

    it("defaults invalid capture type to 'note'", async () => {
      // Insert directly with invalid type to bypass create validation
      const id = testId("capture");
      // SECURITY: XSS payload is intentionally used as the TYPE field (not content)
      // to test that invalid types are sanitized to "note". The id is a safe
      // deterministic test ID from testId(), not user input.
      const xssType = '<script>alert("xss")</script>';
      testDb
        .prepare(
          `INSERT INTO captures (id, content, type, processed, processing_status, created_at)
         VALUES (?, ?, ?, 0, 'pending', datetime('now'))`
        )
        .run(id, "Test content", xssType);

      await request(app).post(`/api/captures/${encodeURIComponent(id)}/process-with-james`);

      expect(spawnMock).toHaveBeenCalled();
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      // Type should default to "note", not contain the script tag
      expect(message).toContain("**Type:** note");
    });
  });

  // ==========================================================================
  // CRUD operations still work
  // ==========================================================================

  describe("Normal Operations", () => {
    it("creates and retrieves captures normally", async () => {
      const createRes = await request(app)
        .post("/api/captures")
        .send({ content: "Normal capture content" });

      expect(createRes.status).toBe(201);

      const getRes = await request(app).get(
        `/api/captures/${createRes.body.id}`
      );
      expect(getRes.status).toBe(200);
      expect(getRes.body.content).toBe("Normal capture content");
    });

    it("processes captures with safe content", async () => {
      const id = insertTestCapture(testDb, {
        content: "Build the login page with React components",
        type: "task",
      });

      const res = await request(app).post(
        `/api/captures/${id}/process-with-james`
      );
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("processing");

      expect(spawnMock).toHaveBeenCalled();
      const spawnArgs = spawnMock.mock.calls[0];
      const cliArgs = spawnArgs[1] as string[];
      const messageIdx = cliArgs.indexOf("--message");
      const message = cliArgs[messageIdx + 1];

      expect(message).toContain(
        "Build the login page with React components"
      );
    });
  });
});
