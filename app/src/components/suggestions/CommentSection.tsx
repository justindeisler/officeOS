import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SuggestionComment } from "@/hooks/useSuggestions";

interface CommentSectionProps {
  comments: SuggestionComment[];
  commentsLoading: boolean;
  newComment: string;
  addingComment: boolean;
  onNewCommentChange: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
}

export function CommentSection({
  comments,
  commentsLoading,
  newComment,
  addingComment,
  onNewCommentChange,
  onAddComment,
  onDeleteComment,
}: CommentSectionProps) {
  return (
    <div className="border-t pt-4">
      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Comments {!commentsLoading && `(${comments.length})`}
      </h4>

      {commentsLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-3">
          No comments yet
        </p>
      ) : (
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto overscroll-contain">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="group rounded-lg border bg-muted/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm whitespace-pre-wrap flex-1">
                  {comment.comment_text}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => onDeleteComment(comment.id)}
                  title="Delete comment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground font-medium">
                  {comment.author}
                </span>
                <span className="text-xs text-muted-foreground">
                  · {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Textarea
          placeholder="Add implementation notes or requirements..."
          value={newComment}
          onChange={(e) => onNewCommentChange(e.target.value)}
          className="min-h-[60px] sm:min-h-[72px] resize-none text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onAddComment();
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 sm:self-end self-stretch"
          disabled={!newComment.trim() || addingComment}
          onClick={onAddComment}
          title="Add comment (⌘+Enter)"
        >
          {addingComment ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Send className="h-4 w-4 sm:mr-0 mr-2" />
              <span className="sm:hidden">Add Comment</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
