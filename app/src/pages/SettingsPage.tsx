import { useState, useEffect } from "react";
import { FolderOpen, Trash2, Download, Upload, Database, User } from "lucide-react";
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
import { toast } from "sonner";
import type { Area } from "@/types";

export function SettingsPage() {
  const {
    workspacePath,
    theme,
    defaultArea,
    defaultCurrency,
    userName,
    setWorkspacePath,
    setTheme,
    setDefaultArea,
    setDefaultCurrency,
    setUserName,
  } = useSettingsStore();

  const [pathInput, setPathInput] = useState(workspacePath || "");
  const [nameInput, setNameInput] = useState(userName || "");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dataStats, setDataStats] = useState<{
    clients: number;
    projects: number;
    tasks: number;
    timeEntries: number;
    invoices: number;
    captures: number;
  } | null>(null);

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
              <p className="font-medium mb-2">Current Data ({totalRecords} total records)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
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
