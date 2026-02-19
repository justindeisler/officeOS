import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { backupService } from "@/services/backupService";
import { isWebBuild } from "@/api";
import * as webBackupApi from "@/services/web/backupService";
import type { BackupStatus } from "@/services/web/backupService";
import { toast } from "sonner";
import type { BusinessProfile } from "@/types";

export const defaultBusinessProfile: BusinessProfile = {
  fullName: "",
  jobTitle: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "Deutschland",
  vatId: "",
  taxId: "",
  bankAccountHolder: "",
  bankName: "",
  bankIban: "",
  bankBic: "",
};

export interface DataStats {
  clients: number;
  projects: number;
  tasks: number;
  timeEntries: number;
  invoices: number;
  captures: number;
}

export function useSettings() {
  const store = useSettingsStore();

  const [pathInput, setPathInput] = useState(store.workspacePath || "");
  const [nameInput, setNameInput] = useState(store.userName || "");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [profileForm, setProfileForm] = useState<BusinessProfile>(
    store.businessProfile || defaultBusinessProfile
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);

  // Backup & Export state (web mode only)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  // Sync profile form with store when loaded
  useEffect(() => {
    if (store.businessProfile) {
      setProfileForm(store.businessProfile);
    }
  }, [store.businessProfile]);

  // Load data stats
  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await backupService.getBackupStats();
        setDataStats(stats);
      } catch (error) {
        console.error("Failed to load data stats:", error);
      }
    }
    loadStats();
  }, []);

  // Load backup status (web mode)
  const loadBackupStatus = useCallback(async () => {
    if (!isWebBuild()) return;
    try {
      const status = await webBackupApi.getBackupStatus();
      setBackupStatus(status);
    } catch (error) {
      console.error("Failed to load backup status:", error);
    }
  }, []);

  useEffect(() => {
    loadBackupStatus();
  }, [loadBackupStatus]);

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const result = await webBackupApi.triggerBackup();
      if (result.success) {
        toast.success(`Backup created: ${result.backup?.filename}`);
        await loadBackupStatus();
      } else {
        toast.error(result.error || "Backup failed");
      }
    } catch (error) {
      console.error("Backup trigger failed:", error);
      toast.error("Failed to create backup");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsDownloadingBackup(true);
    try {
      await webBackupApi.downloadBackup();
      toast.success("Backup download started");
    } catch (error) {
      console.error("Backup download failed:", error);
      toast.error("Failed to download backup");
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      await webBackupApi.exportJson();
      toast.success("JSON export download started");
    } catch (error) {
      console.error("JSON export failed:", error);
      toast.error("Failed to export data");
    } finally {
      setIsExportingJson(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    setIsRestoring(true);
    try {
      const result = await webBackupApi.restoreFromBackup(filename);
      if (result.success) {
        toast.success(
          `Restored from ${result.restoredFrom}: ${result.totalRecords} records across ${result.tablesRestored} tables`
        );
        await loadBackupStatus();
      } else {
        toast.error(result.error || "Restore failed");
      }
    } catch (error) {
      console.error("Restore failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to restore backup");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleImportBackupFile = async (file: File) => {
    setIsImportingBackup(true);
    try {
      const result = await webBackupApi.importBackupFile(file);
      if (result.success) {
        toast.success(
          `Imported from ${result.restoredFrom}: ${result.totalRecords} records across ${result.tablesRestored} tables`
        );
        await loadBackupStatus();
      } else {
        toast.error(result.error || "Import failed");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to import backup");
    } finally {
      setIsImportingBackup(false);
    }
  };

  const handleSaveWorkspacePath = async () => {
    if (pathInput.trim()) {
      await store.setWorkspacePath(pathInput.trim());
      toast.success("Workspace path saved");
    } else {
      await store.setWorkspacePath(undefined);
      toast.success("Workspace path cleared");
    }
  };

  const handleSaveUserName = async () => {
    if (nameInput.trim()) {
      await store.setUserName(nameInput.trim());
      toast.success("Name saved");
    }
  };

  const handleSaveBusinessProfile = async () => {
    setIsSavingProfile(true);
    try {
      await store.setBusinessProfile(profileForm);
      toast.success("Business profile saved");
    } catch (error) {
      console.error("Failed to save business profile:", error);
      toast.error("Failed to save business profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const updateProfileField = (field: keyof BusinessProfile, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const formatIban = (iban: string) => {
    const cleaned = iban.replace(/\s/g, "").toUpperCase();
    return cleaned.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleIbanChange = (value: string) => {
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    updateProfileField("bankIban", cleaned);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const result = await backupService.exportBackup();
      if (result.success) {
        toast.success("Backup exported successfully");
      } else if (result.error !== "Export cancelled") {
        toast.error(result.error || "Export failed");
      }
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export backup");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    setIsImporting(true);
    try {
      const result = await backupService.importBackup();
      if (result.success) {
        toast.success(
          `Backup restored: ${result.stats?.records} records across ${result.stats?.tables} tables`
        );
        window.location.reload();
      } else if (result.error !== "Import cancelled") {
        toast.error(result.error || "Import failed");
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast.error("Failed to import backup");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      const { getDb } = await import("@/lib/db");
      const db = await getDb();

      await db.execute("DELETE FROM captures");
      await db.execute("DELETE FROM time_entries");
      await db.execute("DELETE FROM invoices");
      await db.execute("DELETE FROM tasks");
      await db.execute("DELETE FROM projects");
      await db.execute("DELETE FROM clients");
      await db.execute("DELETE FROM settings");

      toast.success("All data cleared");
      window.location.reload();
    } catch (error) {
      console.error("Clear data failed:", error);
      toast.error("Failed to clear data");
    }
  };

  const totalRecords = dataStats
    ? dataStats.clients +
      dataStats.projects +
      dataStats.tasks +
      dataStats.timeEntries +
      dataStats.invoices +
      dataStats.captures
    : 0;

  return {
    // Store values
    ...store,

    // Local state
    pathInput,
    setPathInput,
    nameInput,
    setNameInput,
    profileForm,
    isSavingProfile,
    dataStats,
    totalRecords,
    isExporting,
    isImporting,

    // Backup state
    backupStatus,
    isBackingUp,
    isDownloadingBackup,
    isExportingJson,
    isRestoring,
    isImportingBackup,

    // Handlers
    handleSaveWorkspacePath,
    handleSaveUserName,
    handleSaveBusinessProfile,
    updateProfileField,
    formatIban,
    handleIbanChange,
    handleTriggerBackup,
    handleDownloadBackup,
    handleExportJson,
    handleRestoreBackup,
    handleImportBackupFile,
    handleExportData,
    handleImportData,
    handleClearAllData,
  };
}
