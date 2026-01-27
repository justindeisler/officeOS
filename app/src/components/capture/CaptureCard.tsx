import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ListTodo,
  StickyNote,
  Lightbulb,
  Calendar,
  MoreHorizontal,
  Trash2,
  ArrowRight,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useCaptureStore } from "@/stores/captureStore";
import type { Capture, CaptureType } from "@/types";

interface CaptureCardProps {
  capture: Capture;
  onProcess: (capture: Capture) => void;
}

const typeConfig: Record<CaptureType, { icon: React.ReactNode; color: string; label: string }> = {
  task: {
    icon: <ListTodo className="h-4 w-4" />,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    label: "Task",
  },
  note: {
    icon: <StickyNote className="h-4 w-4" />,
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    label: "Note",
  },
  idea: {
    icon: <Lightbulb className="h-4 w-4" />,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    label: "Idea",
  },
  meeting: {
    icon: <Calendar className="h-4 w-4" />,
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    label: "Meeting",
  },
};

export function CaptureCard({ capture, onProcess }: CaptureCardProps) {
  const { deleteCapture, markProcessed } = useCaptureStore();
  const config = typeConfig[capture.type];
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleConfirmDelete = () => {
    deleteCapture(capture.id);
    setShowDeleteDialog(false);
  };

  const handleDismiss = () => {
    markProcessed(capture.id, "dismissed");
  };

  return (
    <Card className={`group ${capture.processed ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={`p-2 rounded-lg ${config.color}`}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(capture.createdAt), { addSuffix: true })}
              </span>
              {capture.processed && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Processed
                </Badge>
              )}
            </div>

            <p className="text-sm whitespace-pre-wrap">{capture.content}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {!capture.processed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onProcess(capture)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                Process
              </Button>
            )}

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
                {!capture.processed && (
                  <DropdownMenuItem onClick={handleDismiss}>
                    <Check className="h-4 w-4 mr-2" />
                    Mark as Done
                  </DropdownMenuItem>
                )}
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
        title="Delete capture?"
        description="This will permanently delete this capture. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
