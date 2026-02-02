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
  Bot,
  Loader2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useCaptureStore } from "@/stores/captureStore";
import type { Capture, CaptureType } from "@/types";
import { useNavigate } from "react-router-dom";

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
  const { deleteCapture, markProcessed, processWithJames } = useCaptureStore();
  const config = typeConfig[capture.type];
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  const isProcessing = capture.processingStatus === "processing";
  const isCompleted = capture.processingStatus === "completed" || capture.processed;
  const isFailed = capture.processingStatus === "failed";

  const handleConfirmDelete = () => {
    deleteCapture(capture.id);
    setShowDeleteDialog(false);
  };

  const handleDismiss = () => {
    markProcessed(capture.id, "dismissed");
  };

  const handleProcessWithJames = () => {
    processWithJames(capture.id);
  };

  const handleViewArtifact = () => {
    if (capture.artifactType === "task" && capture.artifactId) {
      navigate(`/tasks?highlight=${capture.artifactId}`);
    } else if (capture.artifactType === "calendar_event") {
      // Calendar events don't have a view in the app yet
      // Could open iCloud calendar or show a toast
    }
  };

  return (
    <Card className={`group ${isCompleted ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={`p-2 rounded-lg ${config.color}`}>
            {config.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(capture.createdAt), { addSuffix: true })}
              </span>
              
              {/* Processing Status Badges */}
              {isProcessing && (
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  James is processing...
                </Badge>
              )}
              {isCompleted && capture.processedBy === "james" && (
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                  <Bot className="h-3 w-3 mr-1" />
                  Processed by James
                </Badge>
              )}
              {isCompleted && capture.processedBy !== "james" && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Processed
                </Badge>
              )}
              {isFailed && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Failed
                </Badge>
              )}
            </div>

            <p className="text-sm whitespace-pre-wrap">{capture.content}</p>

            {/* Artifact Link */}
            {isCompleted && capture.artifactId && capture.artifactType && (
              <div className="mt-2">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleViewArtifact}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View created {capture.artifactType === "calendar_event" ? "calendar event" : capture.artifactType}
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isCompleted && !isProcessing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onProcess(capture)}
                >
                  <ArrowRight className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Process</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleProcessWithJames}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Bot className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">James</span>
                </Button>
              </>
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Processing...</span>
              </div>
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
                {!isCompleted && !isProcessing && (
                  <>
                    <DropdownMenuItem onClick={handleProcessWithJames}>
                      <Bot className="h-4 w-4 mr-2" />
                      Process with James
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDismiss}>
                      <Check className="h-4 w-4 mr-2" />
                      Mark as Done
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isFailed && (
                  <>
                    <DropdownMenuItem onClick={handleProcessWithJames}>
                      <Bot className="h-4 w-4 mr-2" />
                      Retry with James
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
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
