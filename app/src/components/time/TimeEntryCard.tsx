import { useState } from "react";
import { format } from "date-fns";
import { Trash2, Clock, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTimerStore } from "@/stores/timerStore";
import type { TimeEntry, TimeCategory } from "@/types";

interface TimeEntryCardProps {
  entry: TimeEntry;
}

const categoryColors: Record<TimeCategory, string> = {
  coding: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  meetings: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  admin: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  planning: "bg-green-500/10 text-green-500 border-green-500/20",
  other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const categoryLabels: Record<TimeCategory, string> = {
  coding: "Coding",
  meetings: "Meetings",
  admin: "Admin",
  planning: "Planning",
  other: "Other",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function TimeEntryCard({ entry }: TimeEntryCardProps) {
  const { deleteEntry } = useTimerStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleConfirmDelete = () => {
    deleteEntry(entry.id);
    setShowDeleteDialog(false);
  };

  const startTime = new Date(entry.startTime);
  const duration = entry.durationMinutes || 0;

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Time and Duration */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{format(startTime, "h:mm a")}</span>
              {entry.endTime && (
                <>
                  <span>→</span>
                  <span>{format(new Date(entry.endTime), "h:mm a")}</span>
                </>
              )}
              <span className="font-medium text-foreground">
                {formatDuration(duration)}
              </span>
              {entry.isRunning && (
                <Badge variant="outline" className="animate-pulse text-xs">
                  Running
                </Badge>
              )}
            </div>

            {/* Description */}
            {entry.description ? (
              <p className="text-sm font-medium truncate">{entry.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Category Badge */}
            <Badge variant="outline" className={categoryColors[entry.category]}>
              {categoryLabels[entry.category]}
            </Badge>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>

      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete time entry?"
        description="This will permanently delete this time entry. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
