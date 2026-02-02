/**
 * Second Brain API routes
 * Serves markdown documents from the second-brain folder
 */

import { Router } from "express";
import { promises as fs } from "fs";
import { join, basename, extname, relative } from "path";

const router = Router();

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
router.get("/documents", async (_req, res) => {
  try {
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
        console.log(`[Second Brain] Folder not found: ${folder}`);
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
      console.error("[Second Brain] Error reading root:", err);
    }

    res.json({ folders });
  } catch (err) {
    console.error("[Second Brain] Error listing documents:", err);
    res.status(500).json({ error: "Failed to list documents" });
  }
});

/**
 * Get a single document's content
 */
router.get("/documents/*", async (req, res) => {
  try {
    // Get the path from the URL (everything after /documents/)
    const docPath = (req.params as Record<string, string>)[0];
    
    if (!docPath) {
      return res.status(400).json({ error: "Document path required" });
    }

    // Security: prevent directory traversal
    const normalizedPath = docPath.replace(/\.\./g, "");
    
    // Validate the folder if present
    const pathParts = normalizedPath.split("/");
    if (pathParts.length > 1) {
      const folder = pathParts[0];
      if (!VALID_FOLDERS.includes(folder)) {
        return res.status(403).json({ error: "Invalid folder" });
      }
    }

    const fullPath = join(SECOND_BRAIN_PATH, normalizedPath);
    
    // Check if file exists and is within the second brain directory
    const realPath = await fs.realpath(fullPath).catch(() => null);
    if (!realPath || !realPath.startsWith(SECOND_BRAIN_PATH)) {
      return res.status(404).json({ error: "Document not found" });
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
  } catch (err) {
    console.error("[Second Brain] Error reading document:", err);
    res.status(404).json({ error: "Document not found" });
  }
});

/**
 * Search documents
 */
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== "string") {
      return res.status(400).json({ error: "Search query required" });
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
  } catch (err) {
    console.error("[Second Brain] Error searching:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
