import { useState, useEffect, useCallback } from "react";
import { FolderOpen, Trash2, Download, Upload, Database, User, Building2, CreditCard, MapPin, FileText, Shield, Clock, HardDrive, RefreshCw, FileDown, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSettingsStore } from "@/stores/settingsStore";
import { backupService } from "@/services/backupService";
import { isWebBuild } from "@/api";
import * as webBackupApi from "@/services/web/backupService";
import type { BackupStatus, BackupInfo } from "@/services/web/backupService";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { Area, BusinessProfile } from "@/types";

const defaultBusinessProfile: BusinessProfile = {
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

export function SettingsPage() {
  const {
    workspacePath,
    theme,
    defaultArea,
    defaultCurrency,
    userName,
    businessProfile,
    setWorkspacePath,
    setTheme,
    setDefaultArea,
    setDefaultCurrency,
    setUserName,
    setBusinessProfile,
  } = useSettingsStore();

  const [pathInput, setPathInput] = useState(workspacePath || "");
  const [nameInput, setNameInput] = useState(userName || "");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [profileForm, setProfileForm] = useState<BusinessProfile>(
    businessProfile || defaultBusinessProfile
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [dataStats, setDataStats] = useState<{
    clients: number;
    projects: number;
    tasks: number;
    timeEntries: number;
    invoices: number;
    captures: number;
  } | null>(null);

  // Backup & Export state (web mode only)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  // Sync profile form with store when loaded
  useEffect(() => {
    if (businessProfile) {
      setProfileForm(businessProfile);
    }
  }, [businessProfile]);

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

  const handleSaveWorkspacePath = async () => {
    if (pathInput.trim()) {
      await setWorkspacePath(pathInput.trim());
      toast.success("Workspace path saved");
    } else {
      await setWorkspacePath(undefined);
      toast.success("Workspace path cleared");
    }
  };

  const handleSaveUserName = async () => {
    if (nameInput.trim()) {
      await setUserName(nameInput.trim());
      toast.success("Name saved");
    }
  };

  const handleSaveBusinessProfile = async () => {
    setIsSavingProfile(true);
    try {
      await setBusinessProfile(profileForm);
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

  // Format IBAN with spaces for display
  const formatIban = (iban: string) => {
    const cleaned = iban.replace(/\s/g, "").toUpperCase();
    return cleaned.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleIbanChange = (value: string) => {
    // Remove spaces and convert to uppercase for storage
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
        // Reload the app to refresh all stores
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
      // Import to clear all data by importing an empty backup
      const { getDb } = await import("@/lib/db");
      const db = await getDb();

      // Delete all data from tables
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Your personal information displayed in the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="user-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your name"
                className="flex-1"
              />
              <Button onClick={handleSaveUserName}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This name appears next to your profile icon in the sidebar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Business Profile / Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Profile
          </CardTitle>
          <CardDescription>
            Your business information for invoices and official documents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-fullName">Full Name</Label>
                <Input
                  id="bp-fullName"
                  value={profileForm.fullName}
                  onChange={(e) => updateProfileField("fullName", e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-jobTitle">Job Title</Label>
                <Input
                  id="bp-jobTitle"
                  value={profileForm.jobTitle}
                  onChange={(e) => updateProfileField("jobTitle", e.target.value)}
                  placeholder="Full-Stack Developer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-email">Business Email</Label>
                <Input
                  id="bp-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => updateProfileField("email", e.target.value)}
                  placeholder="kontakt@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-phone">Phone (optional)</Label>
                <Input
                  id="bp-phone"
                  type="tel"
                  value={profileForm.phone || ""}
                  onChange={(e) => updateProfileField("phone", e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Address
            </h4>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-street">Street Address</Label>
                <Input
                  id="bp-street"
                  value={profileForm.street}
                  onChange={(e) => updateProfileField("street", e.target.value)}
                  placeholder="Musterstraße 123"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bp-postalCode">Postal Code</Label>
                  <Input
                    id="bp-postalCode"
                    value={profileForm.postalCode}
                    onChange={(e) => updateProfileField("postalCode", e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <Label htmlFor="bp-city">City</Label>
                  <Input
                    id="bp-city"
                    value={profileForm.city}
                    onChange={(e) => updateProfileField("city", e.target.value)}
                    placeholder="Berlin"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-country">Country</Label>
                <Input
                  id="bp-country"
                  value={profileForm.country}
                  onChange={(e) => updateProfileField("country", e.target.value)}
                  placeholder="Deutschland"
                />
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tax Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-vatId">USt-IdNr (VAT ID)</Label>
                <Input
                  id="bp-vatId"
                  value={profileForm.vatId || ""}
                  onChange={(e) => updateProfileField("vatId", e.target.value.toUpperCase())}
                  placeholder="DE123456789"
                />
                <p className="text-xs text-muted-foreground">
                  Required for EU B2B invoices
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-taxId">Steuernummer (Tax Number)</Label>
                <Input
                  id="bp-taxId"
                  value={profileForm.taxId || ""}
                  onChange={(e) => updateProfileField("taxId", e.target.value)}
                  placeholder="123/456/78901"
                />
                <p className="text-xs text-muted-foreground">
                  Your local tax office number
                </p>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Bank Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-bankAccountHolder">Account Holder</Label>
                <Input
                  id="bp-bankAccountHolder"
                  value={profileForm.bankAccountHolder}
                  onChange={(e) => updateProfileField("bankAccountHolder", e.target.value)}
                  placeholder="Max Mustermann"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-bankName">Bank Name</Label>
                <Input
                  id="bp-bankName"
                  value={profileForm.bankName}
                  onChange={(e) => updateProfileField("bankName", e.target.value)}
                  placeholder="Sparkasse Berlin"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bp-bankIban">IBAN</Label>
                <Input
                  id="bp-bankIban"
                  value={formatIban(profileForm.bankIban)}
                  onChange={(e) => handleIbanChange(e.target.value)}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-bankBic">BIC/SWIFT</Label>
                <Input
                  id="bp-bankBic"
                  value={profileForm.bankBic}
                  onChange={(e) => updateProfileField("bankBic", e.target.value.toUpperCase())}
                  placeholder="COBADEFFXXX"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button onClick={handleSaveBusinessProfile} disabled={isSavingProfile}>
              {isSavingProfile ? "Saving..." : "Save Business Profile"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This information will be used in your invoice PDFs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(t)}
                  className="capitalize"
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Workspace
          </CardTitle>
          <CardDescription>
            Configure your Obsidian workspace location for markdown integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspace-path">Workspace Path</Label>
            <div className="flex gap-2">
              <Input
                id="workspace-path"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder="/Users/you/Documents/Obsidian/Vault"
                className="flex-1"
              />
              <Button onClick={handleSaveWorkspacePath}>Save</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Path to your Obsidian vault or markdown workspace. Used for
              exporting and linking files.
            </p>
          </div>

          {workspacePath && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Current workspace:</p>
              <code className="text-xs text-muted-foreground">
                {workspacePath}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Defaults</CardTitle>
          <CardDescription>
            Set default values for new items.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Area</Label>
              <Select
                value={defaultArea}
                onValueChange={(v) => setDefaultArea(v as Area)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wellfy">Wellfy</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Currency</Label>
              <Select
                value={defaultCurrency}
                onValueChange={setDefaultCurrency}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup & Export (Web mode) */}
      {isWebBuild() && (
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
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isBackingUp ? "animate-spin" : ""}`} />
                {isBackingUp ? "Backing up..." : "Create Backup"}
              </Button>

              <Button
                variant="outline"
                onClick={handleDownloadBackup}
                disabled={isDownloadingBackup || !backupStatus?.lastBackup}
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloadingBackup ? "Downloading..." : "Download Backup"}
              </Button>

              <Button
                variant="outline"
                onClick={handleExportJson}
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
      )}

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Your data is stored locally in SQLite. Export backups to keep your data safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Stats */}
          {dataStats && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-2">Current Data ({totalRecords} total)</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{dataStats.clients} clients</span>
                <span>{dataStats.projects} projects</span>
                <span>{dataStats.tasks} tasks</span>
                <span>{dataStats.timeEntries} time entries</span>
                <span>{dataStats.invoices} invoices</span>
                <span>{dataStats.captures} captures</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? "Exporting..." : "Export Backup"}
            </Button>

            <Button
              variant="outline"
              onClick={handleImportData}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? "Importing..." : "Import Backup"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    all your tasks, time entries, clients, projects, invoices,
                    and captures from the database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearAllData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <p className="text-xs text-muted-foreground">
            Export creates a JSON backup of all your data. Import restores from a previous backup.
            <strong className="block mt-1">
              Tip: Export backups regularly to protect your data.
            </strong>
          </p>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Personal Assistant Dashboard v0.1.0
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Built with Tauri, React, and TypeScript
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Data stored in: ~/Library/Application Support/com.personal-assistant.app/
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
