/**
 * Second Brain API routes
 * Serves markdown documents from the second-brain folder
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { join, basename, extname } from "path";
import { createLogger } from "../logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors.js";

const router = Router();
const log = createLogger("second-brain");

// Base path for second brain documents
const SECOND_BRAIN_PATH = "/home/jd-server-admin/clawd/second-brain";

// Valid folders
const VALID_FOLDERS = ["journal", "concepts", "decisions", "projects", "research"];

interface DocumentMeta {
  path: string;
  name: string;
  title: string;
  folder: string;
  lastModified: string;
}

interface FolderGroup {
  name: string;
  documents: DocumentMeta[];
}

/**
 * Extract title from markdown content (first H1 or filename)
 */
function extractTitle(content: string, filename: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  // Fall back to filename without extension
  return basename(filename, extname(filename))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        });
      }

      // Sort by last modified (newest first)
      documents.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    } catch (err) {
      // Folder might not exist yet, skip it
      log.debug({ folder }, "Folder not found, skipping");
    }

    folders.push({
      name: folder,
      documents,
    });
  }

  // Also check for files in root
  const rootDocs: DocumentMeta[] = [];
  try {
    const rootFiles = await fs.readdir(SECOND_BRAIN_PATH);
    for (const file of rootFiles) {
      if (!file.endsWith(".md")) continue;
      
      const filePath = join(SECOND_BRAIN_PATH, file);
      const stat = await fs.stat(filePath);
      
      // Skip if it's a directory
      if (stat.isDirectory()) continue;
      
      const content = await fs.readFile(filePath, "utf-8");
      
      rootDocs.push({
        path: file,
        name: file,
        title: extractTitle(content, file),
        folder: "",
        lastModified: stat.mtime.toISOString(),
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
  // Get the path from the URL (everything after /documents/)
  const docPath = (req.params as Record<string, string>)[0];
  
  if (!docPath) {
    throw new ValidationError("Document path required");
  }

  // Security: prevent directory traversal
  const normalizedPath = docPath.replace(/\.\./g, "");
  
  // Validate the folder if present
  const pathParts = normalizedPath.split("/");
  if (pathParts.length > 1) {
    const folder = pathParts[0];
    if (!VALID_FOLDERS.includes(folder)) {
      throw new ForbiddenError("Invalid folder");
    }
  }

  const fullPath = join(SECOND_BRAIN_PATH, normalizedPath);
  
  // Check if file exists and is within the second brain directory
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

/**
 * Search documents
 */
router.get("/search", asyncHandler(async (req, res) => {
  const { q } = req.query;
  
  if (!q || typeof q !== "string") {
    throw new ValidationError("Search query required");
  }

  const query = q.toLowerCase();
  const results: DocumentMeta[] = [];

  // Search in all folders
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
        
        // Search in title, filename, and content
        if (
          title.toLowerCase().includes(query) ||
          file.toLowerCase().includes(query) ||
          content.toLowerCase().includes(query)
        ) {
          results.push({
            path: folder ? `${folder}/${file}` : file,
            name: file,
            title,
            folder,
            lastModified: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      // Folder might not exist
    }
  }

  // Sort by relevance (title matches first, then by date)
  results.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(query);
    const bTitle = b.title.toLowerCase().includes(query);
    if (aTitle && !bTitle) return -1;
    if (!aTitle && bTitle) return 1;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  res.json({ results });
}));

export default router;
