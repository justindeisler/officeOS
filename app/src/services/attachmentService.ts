/**
 * Attachment Service
 *
 * Handles file attachments for accounting records (assets, expenses).
 * Uses Tauri plugins for native file operations.
 *
 * NOTE: All Tauri imports are dynamic to avoid blocking React mount.
 */

// Lazy-loaded Tauri API modules
let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;
let tauriOpener: typeof import('@tauri-apps/plugin-opener') | null = null;
let tauriPath: typeof import('@tauri-apps/api/path') | null = null;

async function getTauriModules() {
  if (!tauriDialog || !tauriFs || !tauriOpener || !tauriPath) {
    const [dialog, fs, opener, path] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/plugin-opener'),
      import('@tauri-apps/api/path'),
    ]);
    tauriDialog = dialog;
    tauriFs = fs;
    tauriOpener = opener;
    tauriPath = path;
  }
  return {
    open: tauriDialog.open,
    copyFile: tauriFs.copyFile,
    remove: tauriFs.remove,
    exists: tauriFs.exists,
    mkdir: tauriFs.mkdir,
    readFile: tauriFs.readFile,
    writeFile: tauriFs.writeFile,
    openPath: tauriOpener.openPath,
    appDataDir: tauriPath.appDataDir,
    join: tauriPath.join,
  };
}

/**
 * Wraps a promise with a timeout to prevent indefinite hangs
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, operation: string): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
};

/** Information about a picked file */
export interface PickedFile {
  path: string;
  name: string;
}

/** Information about an attachment */
export interface AttachmentInfo {
  path: string;
  name: string;
  size?: number;
  exists: boolean;
}

/**
 * Attachment Service
 * Manages file attachments for accounting records
 */
class AttachmentService {
  private readonly ATTACHMENTS_DIR = 'attachments';
  private readonly ASSETS_SUBDIR = 'assets';

  /**
   * Open file picker dialog to select a PDF file
   * @returns Selected file info or null if cancelled
   */
  async pickBillFile(): Promise<PickedFile | null> {
    try {
      const { open } = await getTauriModules();
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'PDF Documents',
            extensions: ['pdf'],
          },
        ],
        title: 'Select Bill/Invoice PDF',
      });

      if (!selected || Array.isArray(selected)) {
        return null;
      }

      // Extract filename from path
      const pathParts = selected.split(/[/\\]/);
      const fileName = pathParts[pathParts.length - 1];

      return {
        path: selected,
        name: fileName,
      };
    } catch (error) {
      console.error('Failed to pick file:', error);
      throw new Error('Failed to open file picker');
    }
  }

  /**
   * Save an attachment to the app data directory
   * @param assetId The asset ID to associate with the attachment
   * @param sourcePath Path to the source file
   * @param originalName Original filename
   * @returns Path to the saved attachment
   */
  async saveAttachment(
    assetId: string,
    sourcePath: string,
    originalName: string
  ): Promise<string> {
    try {
      const { appDataDir, join, copyFile, readFile, writeFile, exists } = await getTauriModules();
      console.log(`[Attachment] Starting save for asset ${assetId}`);
      console.log(`[Attachment] Source path: ${sourcePath}`);
      // Note: We trust the file dialog gave us a valid path - explicit exists check
      // fails due to Tauri permission scoping even for valid dialog-selected files

      // Create attachments directory structure with timeouts on all Tauri operations
      const baseDir = await withTimeout(appDataDir(), 5000, 'Get app data dir');
      console.log(`[Attachment] App data dir: ${baseDir}`);

      const attachmentsPath = await withTimeout(join(baseDir, this.ATTACHMENTS_DIR), 1000, 'Join path');
      const assetsPath = await withTimeout(join(attachmentsPath, this.ASSETS_SUBDIR), 1000, 'Join path');
      const assetDir = await withTimeout(join(assetsPath, assetId), 1000, 'Join path');

      // Ensure directories exist with timeouts
      await withTimeout(this.ensureDirectory(attachmentsPath), 5000, 'Create attachments dir');
      await withTimeout(this.ensureDirectory(assetsPath), 5000, 'Create assets dir');
      await withTimeout(this.ensureDirectory(assetDir), 5000, 'Create asset dir');
      console.log(`[Attachment] Directories created: ${assetDir}`);

      // Generate unique filename to prevent collisions
      const timestamp = Date.now();
      const sanitizedName = this.sanitizeFilename(originalName);
      const targetFileName = `${timestamp}_${sanitizedName}`;
      const targetPath = await withTimeout(join(assetDir, targetFileName), 1000, 'Join target path');
      console.log(`[Attachment] Target path: ${targetPath}`);

      // Copy file to app data with timeout to prevent hanging
      console.log(`[Attachment] Starting file copy...`);
      console.log(`[Attachment] From: ${sourcePath}`);
      console.log(`[Attachment] To: ${targetPath}`);

      // Try copyFile first, fall back to readFile + writeFile if it fails
      // (Tauri permission scoping can cause copyFile to fail even for valid paths)
      try {
        await withTimeout(
          copyFile(sourcePath, targetPath),
          30000,
          'File copy'
        );
        console.log(`[Attachment] File copy completed via copyFile`);
      } catch (copyError) {
        console.warn(`[Attachment] copyFile failed, trying readFile + writeFile:`, copyError);
        try {
          // Read the source file as binary
          const fileData = await withTimeout(
            readFile(sourcePath),
            30000,
            'Read source file'
          );
          console.log(`[Attachment] Read ${fileData.byteLength} bytes from source`);

          // Write to destination
          await withTimeout(
            writeFile(targetPath, fileData),
            30000,
            'Write destination file'
          );
          console.log(`[Attachment] File written to destination`);
        } catch (rwError) {
          console.error(`[Attachment] Read/Write also failed:`, rwError);
          throw new Error(`Failed to copy file: ${rwError instanceof Error ? rwError.message : 'Unknown error'}`);
        }
      }

      // Verify the file was actually copied - but don't fail if exists() is unreliable
      // (Tauri permission scoping can cause exists() to return false even for valid files)
      let targetExists = false;
      try {
        targetExists = await withTimeout(exists(targetPath), 5000, 'Verify copy');
        console.log(`[Attachment] Post-copy exists() check: ${targetExists}`);
      } catch (existsError) {
        // exists() check failed - assume success since copy didn't throw
        console.warn(`[Attachment] Post-copy exists() check failed, assuming success:`, existsError);
        targetExists = true;
      }

      if (!targetExists) {
        // Log warning but don't throw - exists() is unreliable with Tauri permissions
        // The file operation (openPath) will fail later if there's a real issue
        console.warn(`[Attachment] exists() returned false for target, but copy may have succeeded`);
      }
      console.log(`[Attachment] File save completed (exists check may be unreliable)`);

      console.log(`[Attachment] Successfully saved: ${targetPath}`);
      return targetPath;
    } catch (error) {
      console.error('[Attachment] Failed to save attachment:', error);
      const message = error instanceof Error ? error.message : 'Failed to save attachment';
      throw new Error(message);
    }
  }

  /**
   * Delete an attachment file
   * @param filePath Path to the attachment
   * @returns true if deleted, false if not found
   */
  async deleteAttachment(filePath: string): Promise<boolean> {
    try {
      const { exists, remove } = await getTauriModules();
      const fileExists = await exists(filePath);
      if (!fileExists) {
        console.warn(`Attachment not found: ${filePath}`);
        return false;
      }

      await remove(filePath);
      console.log(`Attachment deleted: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      throw new Error('Failed to delete attachment');
    }
  }

  /**
   * Open an attachment in the system's default viewer
   * @param filePath Path to the attachment
   */
  async openAttachment(filePath: string): Promise<void> {
    try {
      const { openPath } = await getTauriModules();
      console.log(`[Attachment] Opening attachment: ${filePath}`);

      // Skip exists check - it can fail due to permission scoping even when file exists
      // The openPath call will fail naturally if the file doesn't exist
      console.log(`[Attachment] Calling openPath directly...`);
      await withTimeout(openPath(filePath), 10000, 'Open file');
      console.log(`[Attachment] File opened successfully`);
    } catch (error) {
      console.error('[Attachment] Failed to open attachment:', error);
      // Provide more context in error message
      const errorDetail = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not open file at ${filePath}: ${errorDetail}`);
    }
  }

  /**
   * Get information about an attachment
   * @param filePath Path to the attachment
   * @returns Attachment info or null if not found
   */
  async getAttachmentInfo(filePath: string): Promise<AttachmentInfo | null> {
    try {
      const { exists } = await getTauriModules();
      console.log(`[Attachment] Getting info for: ${filePath}`);

      // Try to check if file exists, but don't fail if the check itself fails
      // (Tauri permission scoping can cause exists() to fail even for valid files)
      let fileExists = true; // Assume exists by default
      try {
        fileExists = await withTimeout(exists(filePath), 5000, 'Check exists for info');
        console.log(`[Attachment] File exists check: ${fileExists}`);
      } catch (existsError) {
        console.warn(`[Attachment] exists() check failed, assuming file exists:`, existsError);
        // If exists check fails, assume the file exists (let openPath handle it)
        fileExists = true;
      }

      // Extract filename from path
      const pathParts = filePath.split(/[/\\]/);
      const fullName = pathParts[pathParts.length - 1];
      // Remove timestamp prefix if present (format: timestamp_filename.pdf)
      const name = fullName.replace(/^\d+_/, '');

      const info: AttachmentInfo = {
        path: filePath,
        name: name,
        exists: fileExists,
      };
      console.log(`[Attachment] Info result:`, info);

      return info;
    } catch (error) {
      console.error('[Attachment] Failed to get attachment info:', error);
      return null;
    }
  }

  /**
   * Validate a file for attachment
   * @param filePath Path to the file
   * @returns Validation result
   */
  validateFile(fileName: string): { valid: boolean; error?: string } {
    // Check file extension
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf') {
      return {
        valid: false,
        error: 'Only PDF files are supported',
      };
    }

    return { valid: true };
  }

  /**
   * Clean up all attachments for an asset
   * Called when an asset is deleted
   * @param assetId The asset ID
   */
  async cleanupAssetAttachments(assetId: string): Promise<void> {
    try {
      const { appDataDir, join, exists, remove } = await getTauriModules();
      const baseDir = await appDataDir();
      const assetDir = await join(
        baseDir,
        this.ATTACHMENTS_DIR,
        this.ASSETS_SUBDIR,
        assetId
      );

      const dirExists = await exists(assetDir);
      if (dirExists) {
        await remove(assetDir, { recursive: true });
        console.log(`Cleaned up attachments for asset: ${assetId}`);
      }
    } catch (error) {
      console.error('Failed to cleanup attachments:', error);
      // Don't throw - cleanup failures shouldn't block asset deletion
    }
  }

  /**
   * Ensure a directory exists, create if not
   */
  private async ensureDirectory(path: string): Promise<void> {
    const { exists, mkdir } = await getTauriModules();
    // Try to check if directory exists, but don't fail if check fails
    // (Tauri permission scoping can cause exists() to fail even for valid paths)
    let dirExists = false;
    try {
      dirExists = await exists(path);
    } catch {
      // exists() can fail due to permission scoping - assume doesn't exist
      dirExists = false;
    }

    if (!dirExists) {
      try {
        await mkdir(path, { recursive: true });
      } catch (mkdirError) {
        // mkdir with recursive:true may fail if dir already exists, that's OK
        // Only log, don't throw - the subsequent file operation will fail if there's a real issue
        console.warn(`[Attachment] mkdir warning (may be OK if dir exists):`, mkdirError);
      }
    }
  }

  /**
   * Sanitize a filename by removing/replacing unsafe characters
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace unsafe characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit length
  }
}

export const attachmentService = new AttachmentService();
