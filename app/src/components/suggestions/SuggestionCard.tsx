import { format } from "date-fns";
import { Check, X, RotateCcw, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/hooks/useSuggestions";
import { statusColors, typeColors, priorityLabels, isNewSuggestion } from "@/hooks/useSuggestions";

interface SuggestionCardProps {
  suggestion: Suggestion;
  showRestore?: boolean;
  creatingPrd: boolean;
  onOpen: (suggestion: Suggestion) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRestore: (id: string) => void;
  onCreatePrd: (id: string) => void;
}

export function SuggestionCard({
  suggestion,
  showRestore = false,
  creatingPrd,
  onOpen,
  onApprove,
  onReject,
  onRestore,
  onCreatePrd,
}: SuggestionCardProps) {
  return (
    <div
      onClick={() => onOpen(suggestion)}
      className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="space-y-1 flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{suggestion.title}</span>
          {isNewSuggestion(suggestion) && (
            <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
              New
            </Badge>
          )}
          <Badge variant="outline" className={typeColors[suggestion.type] || ""}>
            {suggestion.type}
          </Badge>
          <Badge variant="outline" className={statusColors[suggestion.status] || ""}>
            {suggestion.status}
          </Badge>
        </div>
        {suggestion.project_name && (
          <p className="text-sm text-muted-foreground">
            Project: {suggestion.project_name}
          </p>
        )}
        {suggestion.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {suggestion.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>Priority: {priorityLabels[suggestion.priority] || suggestion.priority}</span>
          <span>Created: {format(new Date(suggestion.created_at), "MMM d, yyyy")}</span>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {suggestion.status === "pending" && suggestion.canImplement && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(suggestion.id);
              }}
              title="Approve (auto-implement)"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={(e) => {
                e.stopPropagation();
                onReject(suggestion.id);
              }}
              title="Decline"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {suggestion.status === "pending" && !suggestion.canImplement && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              onClick={(e) => {
                e.stopPropagation();
                onApprove(suggestion.id);
              }}
              title="Approve"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={(e) => {
                e.stopPropagation();
                onCreatePrd(suggestion.id);
              }}
              title="Create PRD"
              disabled={creatingPrd}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={(e) => {
                e.stopPropagation();
                onReject(suggestion.id);
              }}
              title="Decline"
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {showRestore && (
          <Button
            size="sm"
            variant="outline"
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
            onClick={(e) => {
              e.stopPropagation();
              onRestore(suggestion.id);
            }}
            title="Restore"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
