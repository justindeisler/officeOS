import { Database, Download, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { DataStats } from "@/hooks/useSettings";

interface DatabaseManagementSectionProps {
  dataStats: DataStats | null;
  totalRecords: number;
  isExporting: boolean;
  isImporting: boolean;
  onExport: () => void;
  onImport: () => void;
  onClearAll: () => void;
}

export function DatabaseManagementSection({
  dataStats,
  totalRecords,
  isExporting,
  isImporting,
  onExport,
  onImport,
  onClearAll,
}: DatabaseManagementSectionProps) {
  return (
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
            onClick={onExport}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Exporting..." : "Export Backup"}
          </Button>

          <Button
            variant="outline"
            onClick={onImport}
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
                  onClick={onClearAll}
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
  );
}
