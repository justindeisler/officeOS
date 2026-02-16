/**
 * File Storage Service
 *
 * Handles file uploads, storage, retrieval, thumbnails, and validation
 * for invoice attachments. Files are stored on the local filesystem
 * organized by year/month with UUID-based names.
 */

import { existsSync, mkdirSync, unlinkSync, readFileSync, statSync, createReadStream } from "fs";
import { writeFile, chmod } from "fs/promises";
import { join, extname, basename, resolve, normalize } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import sharp from "sharp";
import { generateId } from "../database.js";
import { createLogger } from "../logger.js";

const log = createLogger("file-storage");

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "com.personal-assistant.app";
const UPLOAD_BASE = join(homedir(), ".local", "share", APP_ID, "uploads");

/** Max file size: 10 MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Allowed extensions */
export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

/** Thumbnail dimensions */
const THUMBNAIL_MAX_WIDTH = 400;
const THUMBNAIL_MAX_HEIGHT = 400;
const THUMBNAIL_QUALITY = 80;

// ============================================================================
// Types
// ============================================================================

export interface StoredFile {
  id: string;
  originalFilename: string;
  storedFilename: string;
  storedPath: string;
  fileSize: number;
  mimeType: string;
  thumbnailPath: string | null;
  checksum: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Ensure the upload directory for a given year/month exists
 */
function ensureUploadDir(year: string, month: string): string {
  const dir = join(UPLOAD_BASE, year, month);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o750 });
  }
  return dir;
}

/**
 * Ensure the thumbnails directory exists
 */
function ensureThumbnailDir(year: string, month: string): string {
  const dir = join(UPLOAD_BASE, year, month, "thumbnails");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o750 });
  }
  return dir;
}

/**
 * Sanitize a filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Get just the base filename (no path traversal)
  let clean = basename(filename);
  // Remove any non-alphanumeric chars except dots, hyphens, underscores
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Collapse multiple underscores
  clean = clean.replace(/_+/g, "_");
  // Limit length
  if (clean.length > 100) {
    const ext = extname(clean);
    clean = clean.substring(0, 96) + ext;
  }
  return clean;
}

/**
 * Compute SHA-256 checksum of a buffer
 */
export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validate a file buffer using magic bytes detection
 */
export async function validateFile(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType?: string
): Promise<FileValidationResult> {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`,
    };
  }

  if (buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  // Check extension
  const ext = extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File extension '${ext}' not allowed. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
    };
  }

  // Detect MIME type from magic bytes
  const fileTypeModule = await import("file-type");
  const fileType = await fileTypeModule.default.fromBuffer(buffer);

  let detectedMime: string;

  if (fileType) {
    detectedMime = fileType.mime;
  } else {
    // file-type can't detect PDFs by magic bytes sometimes, check manually
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      detectedMime = "application/pdf";
    } else {
      return {
        valid: false,
        error: "Could not determine file type. The file may be corrupted.",
      };
    }
  }

  // Verify the detected MIME is allowed
  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    return {
      valid: false,
      error: `File type '${detectedMime}' not allowed. Accepted: PDF, JPEG, PNG, WebP, HEIC`,
    };
  }

  // Optional: validate PDF structure
  if (detectedMime === "application/pdf") {
    const header = buffer.subarray(0, 1024).toString("ascii");
    if (!header.includes("%PDF-")) {
      return { valid: false, error: "Invalid PDF structure" };
    }
    // Check for encryption (password protection)
    const content = buffer.toString("ascii");
    if (content.includes("/Encrypt")) {
      return {
        valid: false,
        error: "This PDF is password-protected. Please provide an unprotected version.",
      };
    }
  }

  // Validate images can be decoded
  if (detectedMime.startsWith("image/")) {
    try {
      await sharp(buffer).metadata();
    } catch {
      return { valid: false, error: "Image file appears to be corrupted and cannot be decoded." };
    }
  }

  return { valid: true, mimeType: detectedMime };
}

/**
 * Convert HEIC/HEIF to JPEG
 */
export async function convertHeicToJpeg(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const converted = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
  return { buffer: converted, mimeType: "image/jpeg" };
}

/**
 * Generate a thumbnail for an image file
 */
export async function generateThumbnail(
  buffer: Buffer,
  mimeType: string,
  outputPath: string
): Promise<string | null> {
  if (!mimeType.startsWith("image/")) {
    return null;
  }

  try {
    await sharp(buffer)
      .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    log.warn({ err }, "Failed to generate thumbnail");
    return null;
  }
}

/**
 * Save a file to the upload directory
 */
export async function saveFile(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<StoredFile> {
  const id = generateId();
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");

  // Build storage paths
  const uploadDir = ensureUploadDir(year, month);
  const sanitized = sanitizeFilename(originalFilename);
  
  // Determine stored extension
  let storedExt = extname(sanitized).toLowerCase();
  // If HEIC was converted, use .jpg
  if (mimeType === "image/jpeg" && (storedExt === ".heic" || storedExt === ".heif")) {
    storedExt = ".jpg";
  }
  
  const storedFilename = `${id}-${sanitized.replace(extname(sanitized), "")}${storedExt}`;
  const storedPath = join(uploadDir, storedFilename);

  // Compute checksum
  const checksum = computeChecksum(buffer);

  // Write file
  await writeFile(storedPath, buffer);
  await chmod(storedPath, 0o640);

  // Generate thumbnail for images
  let thumbnailPath: string | null = null;
  if (mimeType.startsWith("image/")) {
    const thumbDir = ensureThumbnailDir(year, month);
    const thumbFilename = `${id}-thumb.jpg`;
    const thumbPath = join(thumbDir, thumbFilename);
    thumbnailPath = await generateThumbnail(buffer, mimeType, thumbPath);
  }

  const fileSize = buffer.length;

  log.info(
    { id, originalFilename, storedPath, fileSize, mimeType, checksum: checksum.substring(0, 16) },
    "File saved"
  );

  return {
    id,
    originalFilename,
    storedFilename,
    storedPath,
    fileSize,
    mimeType,
    thumbnailPath,
    checksum,
  };
}

/**
 * Validate that a file path is safely within the upload directory.
 * Prevents path traversal attacks by normalizing and checking the resolved path.
 */
function isPathWithinUploadBase(filePath: string): boolean {
  const resolvedBase = resolve(UPLOAD_BASE);
  const resolvedPath = resolve(normalize(filePath));
  return resolvedPath.startsWith(resolvedBase + "/") || resolvedPath === resolvedBase;
}

/**
 * Retrieve a file from storage
 */
export function getFile(storedPath: string): { stream: ReturnType<typeof createReadStream>; size: number } | null {
  // Security: normalize and ensure the path is within the upload directory BEFORE any fs operations
  if (!isPathWithinUploadBase(storedPath)) {
    log.warn({ storedPath }, "Attempted path traversal");
    return null;
  }

  if (!existsSync(storedPath)) {
    return null;
  }

  const stats = statSync(storedPath);
  return {
    stream: createReadStream(storedPath),
    size: stats.size,
  };
}

/**
 * Delete a file from storage
 */
export function deleteFile(storedPath: string, thumbnailPath?: string | null): boolean {
  try {
    // Security: validate paths are within upload directory before deletion
    if (storedPath && isPathWithinUploadBase(storedPath) && existsSync(storedPath)) {
      unlinkSync(storedPath);
    } else if (storedPath && !isPathWithinUploadBase(storedPath)) {
      log.warn({ storedPath }, "Attempted path traversal on delete");
      return false;
    }
    if (thumbnailPath && isPathWithinUploadBase(thumbnailPath) && existsSync(thumbnailPath)) {
      unlinkSync(thumbnailPath);
    } else if (thumbnailPath && !isPathWithinUploadBase(thumbnailPath)) {
      log.warn({ thumbnailPath }, "Attempted path traversal on thumbnail delete");
      return false;
    }
    return true;
  } catch (err) {
    log.error({ err, storedPath }, "Failed to delete file");
    return false;
  }
}

/**
 * Get upload base directory (for testing)
 */
export function getUploadBase(): string {
  return UPLOAD_BASE;
}
