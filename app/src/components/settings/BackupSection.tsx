import { Shield, HardDrive, Clock, RefreshCw, Download, FileDown } from "lucide-react";
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
  onTriggerBackup: () => void;
  onDownloadBackup: () => void;
  onExportJson: () => void;
}

export function BackupSection({
  backupStatus,
  isBackingUp,
  isDownloadingBackup,
  isExportingJson,
  onTriggerBackup,
  onDownloadBackup,
  onExportJson,
}: BackupSectionProps) {
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="default"
            onClick={onTriggerBackup}
            disabled={isBackingUp}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isBackingUp ? "animate-spin" : ""}`} />
            {isBackingUp ? "Backing up..." : "Create Backup"}
          </Button>

          <Button
            variant="outline"
            onClick={onDownloadBackup}
            disabled={isDownloadingBackup || !backupStatus?.lastBackup}
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloadingBackup ? "Downloading..." : "Download Backup"}
          </Button>

          <Button
            variant="outline"
            onClick={onExportJson}
            disabled={isExportingJson}
          >
            <FileDown className="h-4 w-4 mr-2" />
            {isExportingJson ? "Exporting..." : "Export JSON"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Create Backup:</strong> Encrypted backup saved on server (auto-rotated, 30 days).
          <br />
          <strong>Download Backup:</strong> Download the latest encrypted backup file.
          <br />
          <strong>Export JSON:</strong> Download all data as unencrypted JSON (for portability).
        </p>
      </CardContent>
    </Card>
  );
}
