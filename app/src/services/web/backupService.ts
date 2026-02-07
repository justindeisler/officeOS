/**
 * Web Backup Service
 *
 * Provides backup & export functionality via the REST API.
 * Used in web mode (non-Tauri) for the Settings page.
 */

import { adminClient } from "@/api";

// ============================================================================
// Types
// ============================================================================

export interface BackupInfo {
  filename: string;
  filepath: string;
  date: string;
  sizeBytes: number;
  encrypted: boolean;
}

export interface BackupStatus {
  backupDir: string;
  lastBackup: BackupInfo | null;
  recentBackups: BackupInfo[];
  totalBackups: number;
  encryptionKeyAvailable: boolean;
}

export interface TriggerBackupResult {
  success: boolean;
  backup?: {
    filename: string;
    date: string;
    sizeBytes: number;
    encrypted: boolean;
  };
  rotation?: {
    deletedCount: number;
    keptCount: number;
  };
  error?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get backup status and history
 */
export async function getBackupStatus(): Promise<BackupStatus> {
  return adminClient.get<BackupStatus>("/backups/status");
}

/**
 * Trigger a manual backup
 */
export async function triggerBackup(): Promise<TriggerBackupResult> {
  return adminClient.post<TriggerBackupResult>("/backups/trigger");
}

/**
 * Download the latest encrypted backup
 */
export async function downloadBackup(): Promise<void> {
  const blob = await adminClient.requestBlob("/backups/download");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // Try to get filename from status first
  try {
    const status = await getBackupStatus();
    link.download = status.lastBackup?.filename || "pa-backup.enc";
  } catch {
    link.download = "pa-backup.enc";
  }

  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all data as JSON download
 */
export async function exportJson(): Promise<void> {
  const blob = await adminClient.requestBlob("/backups/export?format=json");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  link.download = `pa-export-${dateStr}.json`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export a table as CSV download
 */
export async function exportTableCsv(tableName: string): Promise<void> {
  const blob = await adminClient.requestBlob(
    `/backups/export/csv/${encodeURIComponent(tableName)}`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  link.download = `pa-${tableName}-${dateStr}.csv`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get list of available tables for CSV export
 */
export async function getAvailableTables(): Promise<string[]> {
  const resp = await adminClient.get<{ tables: string[] }>("/backups/tables");
  return resp.tables;
}
