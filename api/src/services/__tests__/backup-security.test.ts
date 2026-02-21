/**
 * Backup Service Security Tests
 *
 * Regression tests for cryptographic vulnerabilities in backup encryption.
 * Tests that:
 * - GCM auth tag length is explicitly set to 16 bytes
 * - Encryption/decryption round-trips work correctly
 * - Tampered ciphertexts are rejected
 * - Short/truncated auth tags are rejected
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ============================================================================
// Direct Crypto Function Tests (testing the patterns used in backup.ts)
// ============================================================================

describe("Backup Encryption Security", () => {
  const MAGIC_HEADER = "JAMES_ENCRYPTED_V1";
  const testKey = randomBytes(32);

  /**
   * Encrypt function matching backup.ts (with security fix applied)
   */
  function encrypt(plaintext: string, key: Buffer): string {
    const nonce = randomBytes(12);
    // SECURITY: authTagLength explicitly set to 16 bytes
    const cipher = createCipheriv("aes-256-gcm", key, nonce, {
      authTagLength: 16,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const raw = Buffer.concat([nonce, encrypted, tag]);
    const b64 = raw.toString("base64");
    const lines: string[] = [MAGIC_HEADER];
    for (let i = 0; i < b64.length; i += 76) {
      lines.push(b64.slice(i, i + 76));
    }
    return lines.join("\n") + "\n";
  }

  /**
   * Decrypt function matching backup.ts (with security fix applied)
   */
  function decrypt(encryptedContent: string, key: Buffer): string {
    const lines = encryptedContent.trim().split("\n");
    if (!lines.length || lines[0].trim() !== MAGIC_HEADER) {
      throw new Error("Not an encrypted file (missing header)");
    }
    const b64Data = lines
      .slice(1)
      .map((l) => l.trim())
      .join("");
    const raw = Buffer.from(b64Data, "base64");
    if (raw.length < 28) {
      throw new Error("Encrypted data too short");
    }
    const nonce = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const ct = raw.subarray(12, raw.length - 16);

    // SECURITY: authTagLength explicitly set to 16 bytes
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
      authTagLength: 16,
    });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString("utf-8");
  }

  // ==========================================================================
  // Round-trip Tests
  // ==========================================================================

  describe("Encryption Round-trip", () => {
    it("encrypts and decrypts correctly", () => {
      const plaintext = "Hello, World! This is a test.";
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("handles large data", () => {
      const plaintext = "A".repeat(100000);
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it("handles JSON data", () => {
      const data = JSON.stringify({
        tables: { test: [{ id: 1, name: "test" }] },
        version: "1.0.0",
      });
      const encrypted = encrypt(data, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(data));
    });

    it("handles Unicode content", () => {
      const plaintext = "Ünïcödé tëst: 你好世界 🎉 ← → ≠";
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  // ==========================================================================
  // Auth Tag Security Tests
  // ==========================================================================

  describe("GCM Auth Tag Security", () => {
    it("produces a 16-byte auth tag", () => {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", testKey, nonce, {
        authTagLength: 16,
      });
      cipher.update("test", "utf-8");
      cipher.final();
      const tag = cipher.getAuthTag();

      expect(tag.length).toBe(16);
    });

    it("rejects tampered ciphertext", () => {
      const encrypted = encrypt("sensitive data", testKey);
      const lines = encrypted.trim().split("\n");
      const b64Data = lines
        .slice(1)
        .map((l) => l.trim())
        .join("");
      const raw = Buffer.from(b64Data, "base64");

      // Tamper with the ciphertext (flip a bit in the middle)
      const tampered = Buffer.from(raw);
      tampered[20] ^= 0xff;

      // Re-encode
      const tamperedB64 = tampered.toString("base64");
      const tamperedContent = `${MAGIC_HEADER}\n${tamperedB64}\n`;

      expect(() => decrypt(tamperedContent, testKey)).toThrow();
    });

    it("rejects tampered auth tag", () => {
      const encrypted = encrypt("sensitive data", testKey);
      const lines = encrypted.trim().split("\n");
      const b64Data = lines
        .slice(1)
        .map((l) => l.trim())
        .join("");
      const raw = Buffer.from(b64Data, "base64");

      // Tamper with the auth tag (last 16 bytes)
      const tampered = Buffer.from(raw);
      tampered[tampered.length - 1] ^= 0xff;

      const tamperedB64 = tampered.toString("base64");
      const tamperedContent = `${MAGIC_HEADER}\n${tamperedB64}\n`;

      expect(() => decrypt(tamperedContent, testKey)).toThrow();
    });

    it("rejects decryption with wrong key", () => {
      const encrypted = encrypt("sensitive data", testKey);
      const wrongKey = randomBytes(32);

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it("rejects data that is too short", () => {
      // Less than 28 bytes (12 nonce + 16 tag minimum)
      const shortData = randomBytes(20).toString("base64");
      const content = `${MAGIC_HEADER}\n${shortData}\n`;

      expect(() => decrypt(content, testKey)).toThrow("Encrypted data too short");
    });
  });

  // ==========================================================================
  // Header Validation
  // ==========================================================================

  describe("Header Validation", () => {
    it("rejects data without magic header", () => {
      const raw = randomBytes(100).toString("base64");
      expect(() => decrypt(raw, testKey)).toThrow("Not an encrypted file");
    });

    it("rejects data with wrong header", () => {
      const raw = randomBytes(100).toString("base64");
      const content = `WRONG_HEADER\n${raw}\n`;
      expect(() => decrypt(content, testKey)).toThrow("Not an encrypted file");
    });
  });

  // ==========================================================================
  // Source Code Verification
  // ==========================================================================

  describe("Source Code Patterns", () => {
    it("backup.ts uses authTagLength in createDecipheriv", async () => {
      // Read the actual source file to verify the fix is in place
      const fs = await import("fs");
      const path = await import("path");
      const backupSrc = fs.readFileSync(
        path.join(
          process.cwd(),
          "src/services/backup.ts"
        ),
        "utf-8"
      );

      // Verify createDecipheriv has authTagLength option
      const decipherMatch = backupSrc.match(
        /createDecipheriv\s*\(\s*"aes-256-gcm"[^)]*authTagLength\s*:\s*16/s
      );
      expect(decipherMatch).not.toBeNull();

      // Verify createCipheriv also has authTagLength for consistency
      const cipherMatch = backupSrc.match(
        /createCipheriv\s*\(\s*"aes-256-gcm"[^)]*authTagLength\s*:\s*16/s
      );
      expect(cipherMatch).not.toBeNull();
    });
  });
});
