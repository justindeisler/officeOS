/**
 * File Storage Service Unit Tests
 *
 * Tests for file validation, sanitization, and checksum computation.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  computeChecksum,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "../fileStorageService.js";

describe("sanitizeFilename", () => {
  it("preserves simple filenames", () => {
    expect(sanitizeFilename("invoice.pdf")).toBe("invoice.pdf");
  });

  it("preserves filenames with hyphens and underscores", () => {
    expect(sanitizeFilename("my-invoice_2025.pdf")).toBe("my-invoice_2025.pdf");
  });

  it("removes path traversal characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
  });

  it("removes special characters", () => {
    expect(sanitizeFilename("invoice (copy) [final].pdf")).toBe("invoice_copy_final_.pdf");
  });

  it("removes directory path", () => {
    expect(sanitizeFilename("/home/user/documents/invoice.pdf")).toBe("invoice.pdf");
  });

  it("collapses multiple underscores", () => {
    expect(sanitizeFilename("a   b   c.pdf")).toBe("a_b_c.pdf");
  });

  it("truncates long filenames", () => {
    const longName = "a".repeat(150) + ".pdf";
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(104); // 96 + ".pdf"
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("handles unicode characters", () => {
    const result = sanitizeFilename("Rechnung_Büro.pdf");
    // Unicode chars are replaced with underscore
    expect(result).toMatch(/\.pdf$/);
  });
});

describe("computeChecksum", () => {
  it("computes SHA-256 checksum", () => {
    const buffer = Buffer.from("test content");
    const checksum = computeChecksum(buffer);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces consistent checksums", () => {
    const buffer = Buffer.from("same content");
    expect(computeChecksum(buffer)).toBe(computeChecksum(buffer));
  });

  it("produces different checksums for different content", () => {
    const buf1 = Buffer.from("content 1");
    const buf2 = Buffer.from("content 2");
    expect(computeChecksum(buf1)).not.toBe(computeChecksum(buf2));
  });

  it("handles empty buffer", () => {
    const checksum = computeChecksum(Buffer.alloc(0));
    expect(checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("constants", () => {
  it("MAX_FILE_SIZE is 10 MB", () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("allows PDF MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
  });

  it("allows JPEG MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
  });

  it("allows PNG MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
  });

  it("allows WebP MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);
  });

  it("allows HEIC MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("image/heic")).toBe(true);
  });

  it("rejects HTML MIME type", () => {
    expect(ALLOWED_MIME_TYPES.has("text/html")).toBe(false);
  });

  it("allows .pdf extension", () => {
    expect(ALLOWED_EXTENSIONS.has(".pdf")).toBe(true);
  });

  it("allows .jpg extension", () => {
    expect(ALLOWED_EXTENSIONS.has(".jpg")).toBe(true);
  });

  it("rejects .exe extension", () => {
    expect(ALLOWED_EXTENSIONS.has(".exe")).toBe(false);
  });
});
