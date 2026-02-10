import { format } from "date-fns";
import {
  Check,
  X,
  Play,
  RotateCcw,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Suggestion, SuggestionComment } from "@/hooks/useSuggestions";
import { statusColors, typeColors, priorityLabels, isNewSuggestion } from "@/hooks/useSuggestions";
import { CommentSection } from "./CommentSection";

interface SuggestionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: Suggestion | null;
  creatingPrd: boolean;
  comments: SuggestionComment[];
  commentsLoading: boolean;
  newComment: string;
  addingComment: boolean;
  onNewCommentChange: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRestore: (id: string) => void;
  onImplement: (id: string) => void;
  onCreatePrd: (id: string) => void;
  onNavigateToPrd: (prdId: string) => void;
}

export function SuggestionDetailDialog({
  open,
  onOpenChange,
  suggestion,
  creatingPrd,
  comments,
  commentsLoading,
  newComment,
  addingComment,
  onNewCommentChange,
  onAddComment,
  onDeleteComment,
  onApprove,
  onReject,
  onRestore,
  onImplement,
  onCreatePrd,
  onNavigateToPrd,
}: SuggestionDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 sm:p-0 gap-0 flex flex-col">
        {suggestion && (
          <div
            className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <DialogHeader className="mb-4 pr-8">
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {suggestion.title}
                <Badge variant="outline" className={typeColors[suggestion.type] || ""}>
                  {suggestion.type}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {suggestion.project_name && (
                  <span>Project: {suggestion.project_name}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {isNewSuggestion(suggestion) && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                    New
                  </Badge>
                )}
                <Badge variant="outline" className={statusColors[suggestion.status] || ""}>
                  {suggestion.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Priority: {priorityLabels[suggestion.priority] || suggestion.priority}
                </span>
              </div>

              {suggestion.description && (
                <div>
                  <h4 className="font-medium text-sm mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 sm:max-h-none overflow-y-auto">
                    {suggestion.description}
                  </p>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {format(new Date(suggestion.created_at), "PPpp")}</p>
                {suggestion.decided_at && (
                  <p>Decided: {format(new Date(suggestion.decided_at), "PPpp")}</p>
                )}
              </div>

              {suggestion.prd_id && (
                <div className="flex items-center gap-2 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-3">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">
                    A PRD has been generated for this suggestion.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    onClick={() => {
                      onOpenChange(false);
                      onNavigateToPrd(suggestion.prd_id!);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    View PRD
                  </Button>
                </div>
              )}

              {/* Comments */}
              <CommentSection
                comments={comments}
                commentsLoading={commentsLoading}
                newComment={newComment}
                addingComment={addingComment}
                onNewCommentChange={onNewCommentChange}
                onAddComment={onAddComment}
                onDeleteComment={onDeleteComment}
              />

              {/* Action buttons based on status */}
              {suggestion.status === "pending" && suggestion.canImplement && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => onApprove(suggestion.id)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => onReject(suggestion.id)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              )}

              {suggestion.status === "pending" && !suggestion.canImplement && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => onCreatePrd(suggestion.id)}
                    disabled={creatingPrd}
                  >
                    {creatingPrd ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating PRD…
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Create PRD
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => onReject(suggestion.id)}
                    disabled={creatingPrd}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              )}

              {suggestion.status === "approved" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => onImplement(suggestion.id)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Mark as Implemented
                  </Button>
                </div>
              )}

              {suggestion.status === "rejected" && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                    onClick={() => {
                      onRestore(suggestion.id);
                      onOpenChange(false);
                    }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restore
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
