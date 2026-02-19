import { useState, useRef } from "react";
import { Shield, HardDrive, Clock, RefreshCw, Download, FileDown, RotateCcw, Upload, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BackupStatus } from "@/services/web/backupService";

interface BackupSectionProps {
  backupStatus: BackupStatus | null;
  isBackingUp: boolean;
  isDownloadingBackup: boolean;
  isExportingJson: boolean;
  isRestoring: boolean;
  isImportingBackup: boolean;
  onTriggerBackup: () => void;
  onDownloadBackup: () => void;
  onExportJson: () => void;
  onRestoreBackup: (filename: string) => void;
  onImportBackupFile: (file: File) => void;
}

export function BackupSection({
  backupStatus,
  isBackingUp,
  isDownloadingBackup,
  isExportingJson,
  isRestoring,
  isImportingBackup,
  onTriggerBackup,
  onDownloadBackup,
  onExportJson,
  onRestoreBackup,
  onImportBackupFile,
}: BackupSectionProps) {
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmImport, setConfirmImport] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRestoreClick = (filename: string) => {
    setConfirmRestore(filename);
  };

  const handleConfirmRestore = () => {
    if (confirmRestore) {
      onRestoreBackup(confirmRestore);
      setConfirmRestore(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setConfirmImport(file);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = () => {
    if (confirmImport) {
      onImportBackupFile(confirmImport);
      setConfirmImport(null);
    }
  };

  const isBusy = isRestoring || isImportingBackup;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Backup & Export
        </CardTitle>
        <CardDescription>
          Automated encrypted backups and data export. Backups are encrypted with AES-256-GCM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backup Status */}
        {backupStatus && (
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Backup Status
              </h4>
              <Badge variant={backupStatus.encryptionKeyAvailable ? "default" : "destructive"}>
                {backupStatus.encryptionKeyAvailable ? "🔒 Encryption Active" : "⚠️ No Key"}
              </Badge>
            </div>

            {backupStatus.lastBackup ? (
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Last backup:{" "}
                    <span className="text-foreground font-medium">
                      {new Date(backupStatus.lastBackup.date).toLocaleString("de-DE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  {backupStatus.lastBackup.filename} ({(backupStatus.lastBackup.sizeBytes / 1024).toFixed(1)} KB)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No backups yet. Create your first backup below.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              📦 {backupStatus.totalBackups} backup(s) stored in <code className="text-xs">{backupStatus.backupDir}</code>
            </p>
          </div>
        )}

        {/* Backup History */}
        {backupStatus && backupStatus.recentBackups.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Backups</h4>
            <div className="rounded-lg border divide-y">
              {backupStatus.recentBackups.map((backup) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="truncate font-mono text-xs">
                      {backup.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{(backup.sizeBytes / 1024).toFixed(1)} KB</span>
                    <span>
                      {new Date(backup.date).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={isBusy}
                      onClick={() => handleRestoreClick(backup.filename)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Restore Confirmation Dialog */}
        {confirmRestore && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Confirm Restore
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This will replace your current database with the backup{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                    {confirmRestore}
                  </code>.
                  A safety backup of your current data will be created first.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-7">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmRestore}
                disabled={isBusy}
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Yes, Restore
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRestore(null)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Import Confirmation Dialog */}
        {confirmImport && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Confirm Import
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This will replace your current database with the uploaded file{" "}
                  <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                    {confirmImport.name}
                  </code>{" "}
                  ({(confirmImport.size / 1024).toFixed(1)} KB).
                  A safety backup of your current data will be created first.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-7">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmImport}
                disabled={isBusy}
              >
                {isImportingBackup ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Yes, Import
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmImport(null)}
                disabled={isBusy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="default"
            onClick={onTriggerBackup}
            disabled={isBackingUp || isBusy}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackingUp ? "animate-spin" : ""}`} />
            {isBackingUp ? "Backing up..." : "Create Backup"}
          </Button>

          <Button
            variant="outline"
            onClick={onDownloadBackup}
            disabled={isDownloadingBackup || !backupStatus?.lastBackup || isBusy}
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloadingBackup ? "Downloading..." : "Download Backup"}
          </Button>

          <Button
            variant="outline"
            onClick={onExportJson}
            disabled={isExportingJson || isBusy}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExportingJson ? "Exporting..." : "Export JSON"}
          </Button>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImportingBackup ? "Importing..." : "Import Backup"}
          </Button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".enc,.json,.backup,.db"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Create Backup:</strong> Encrypted backup saved on server (auto-rotated, 30 days).
          <br />
          <strong>Download Backup:</strong> Download the latest encrypted backup file.
          <br />
          <strong>Export JSON:</strong> Download all data as unencrypted JSON (for portability).
          <br />
          <strong>Import Backup:</strong> Upload an encrypted (.enc) or JSON backup file to restore.
          <br />
          <strong>Restore:</strong> Revert to a previous server-side backup. A safety backup is always created first.
        </p>
      </CardContent>
    </Card>
  );
}
