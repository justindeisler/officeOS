import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import {
  Lightbulb,
  Check,
  X,
  Play,
  RefreshCw,
  RotateCcw,
  Archive,
  CheckCircle2,
  MessageSquare,
  Trash2,
  Send,
  Sparkles,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { NewSuggestionsModal, GenerateParams } from "@/components/suggestions/NewSuggestionsModal";

interface Suggestion {
  id: string;
  project_name: string | null;
  project_id: string | null;
  type: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  prd_id: string | null;
  task_id: string | null;
  created_at: string;
  decided_at: string | null;
  canImplement: boolean;
  accessType: string;
}

interface SuggestionComment {
  id: string;
  suggestion_id: string;
  author: string;
  comment_text: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  approved: "bg-green-500/10 text-green-700 dark:text-green-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  implemented: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const typeColors: Record<string, string> = {
  improvement: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  feature: "bg-green-500/10 text-green-700 dark:text-green-400",
  fix: "bg-red-500/10 text-red-700 dark:text-red-400",
  refactor: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  security: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

const priorityLabels: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Minimal",
};

/** Check if a suggestion was created within the last 24 hours */
function isNewSuggestion(suggestion: Suggestion): boolean {
  const createdAt = new Date(suggestion.created_at);
  const now = new Date();
  const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

/** Animated dots: "" → "." → ".." → "..." → repeat */
function AnimatedDots() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Fixed-width span to prevent layout shift
  return <span className="inline-block w-[1.2em] text-left">{dots}</span>;
}

export function SuggestionsPage() {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatingPrd, setCreatingPrd] = useState(false);

  // Comments state
  const [comments, setComments] = useState<SuggestionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSuggestions({ limit: 100 });
      setSuggestions(data as Suggestion[]);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
      toast.error("Failed to load suggestions");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = useCallback(async (suggestionId: string) => {
    setCommentsLoading(true);
    try {
      const data = await api.getSuggestionComments(suggestionId);
      setComments(data);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const handleGenerate = async (params: GenerateParams) => {
    // Close modal immediately
    setGenerateModalOpen(false);
    setIsGenerating(true);

    try {
      const result = await api.generateSuggestions(params);

      if (result.success) {
        const duration = result.duration
          ? ` in ${(result.duration / 1000).toFixed(1)}s`
          : "";
        toast.success(
          `Generated 3 suggestions for ${params.projectName}${duration}`
        );
        await fetchSuggestions();
      } else {
        toast.error("Generation failed. Try again.");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      if (errMsg.includes("504") || errMsg.includes("timed out")) {
        toast.error("Generation took too long. Try without Deep Mode.");
      } else {
        toast.error(`Failed to generate suggestions: ${errMsg}`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedSuggestion || !newComment.trim()) return;

    setAddingComment(true);
    try {
      await api.addSuggestionComment(selectedSuggestion.id, newComment.trim());
      setNewComment("");
      await fetchComments(selectedSuggestion.id);
      toast.success("Comment added");
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedSuggestion) return;
    try {
      await api.deleteSuggestionComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  // Active = pending + approved (not yet implemented)
  const activeSuggestions = suggestions.filter(
    (s) => s.status === "pending" || s.status === "approved"
  );
  
  // Implemented = completed suggestions
  const implementedSuggestions = suggestions.filter((s) => s.status === "implemented");
  
  // Archived = rejected
  const archivedSuggestions = suggestions.filter((s) => s.status === "rejected");

  const handleApprove = async (id: string) => {
    try {
      await api.approveSuggestion(id);
      toast.success("Suggestion confirmed!");
      fetchSuggestions();
      setDetailOpen(false);
    } catch (error) {
      toast.error("Failed to confirm suggestion");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectSuggestion(id);
      toast.success("Suggestion archived");
      fetchSuggestions();
      setDetailOpen(false);
    } catch (error) {
      toast.error("Failed to archive suggestion");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      // Restore by setting status back to pending
      await api.updateSuggestion(id, { status: "pending" });
      toast.success("Suggestion restored");
      fetchSuggestions();
    } catch (error) {
      toast.error("Failed to restore suggestion");
    }
  };

  const handleImplement = async (id: string) => {
    try {
      await api.implementSuggestion(id);
      toast.success("Suggestion marked as implemented");
      fetchSuggestions();
      setDetailOpen(false);
    } catch (error) {
      toast.error("Failed to mark as implemented");
    }
  };

  const handleCreatePrd = async (id: string) => {
    setCreatingPrd(true);
    try {
      const result = await api.createPrdFromSuggestion(id);
      if (result.success) {
        toast.success("PRD created successfully!", {
          description: "Click to view the generated PRD",
          action: {
            label: "View PRD",
            onClick: () => navigate(`/prd/${result.prdId}`),
          },
          duration: 8000,
        });
        fetchSuggestions();
        setDetailOpen(false);
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      if (errMsg.includes("409") || errMsg.includes("already exists")) {
        toast.error("A PRD already exists for this suggestion");
      } else if (errMsg.includes("504") || errMsg.includes("timed out")) {
        toast.error("PRD generation timed out. Please try again.");
      } else {
        toast.error(`Failed to create PRD: ${errMsg}`);
      }
    } finally {
      setCreatingPrd(false);
    }
  };

  const openDetail = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setComments([]);
    setNewComment("");
    setDetailOpen(true);
    fetchComments(suggestion.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const SuggestionCard = ({ suggestion, showRestore = false }: { suggestion: Suggestion; showRestore?: boolean }) => (
    <div
      onClick={() => openDetail(suggestion)}
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
                handleApprove(suggestion.id);
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
                handleReject(suggestion.id);
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
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
              onClick={(e) => {
                e.stopPropagation();
                handleCreatePrd(suggestion.id);
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
                handleReject(suggestion.id);
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
              handleRestore(suggestion.id);
            }}
            title="Restore"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-7 w-7" />
            Suggestions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and manage James's improvement suggestions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSuggestions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setGenerateModalOpen(true)}
            disabled={isGenerating}
            className="min-w-[160px]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing<AnimatedDots />
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                New Suggestions
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Active ({activeSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="implemented" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Implemented ({implementedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived ({archivedSuggestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Active Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeSuggestions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No active suggestions. James will create suggestions based on project analysis.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeSuggestions.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="implemented" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Implemented Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {implementedSuggestions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No implemented suggestions yet. Completed improvements will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {implementedSuggestions.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Archived Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {archivedSuggestions.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  No archived suggestions. Declined suggestions will appear here.
                </p>
              ) : (
                <div className="space-y-3">
                  {archivedSuggestions.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} showRestore />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog — uses inner scroll wrapper for iOS Safari compatibility */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden p-0 sm:p-0 gap-0 flex flex-col">
          {selectedSuggestion && (
            <div
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <DialogHeader className="mb-4 pr-8">
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {selectedSuggestion.title}
                  <Badge variant="outline" className={typeColors[selectedSuggestion.type] || ""}>
                    {selectedSuggestion.type}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedSuggestion.project_name && (
                    <span>Project: {selectedSuggestion.project_name}</span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {isNewSuggestion(selectedSuggestion) && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                      New
                    </Badge>
                  )}
                  <Badge variant="outline" className={statusColors[selectedSuggestion.status] || ""}>
                    {selectedSuggestion.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Priority: {priorityLabels[selectedSuggestion.priority] || selectedSuggestion.priority}
                  </span>
                </div>
                
                {selectedSuggestion.description && (
                  <div>
                    <h4 className="font-medium text-sm mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 sm:max-h-none overflow-y-auto">
                      {selectedSuggestion.description}
                    </p>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Created: {format(new Date(selectedSuggestion.created_at), "PPpp")}</p>
                  {selectedSuggestion.decided_at && (
                    <p>Decided: {format(new Date(selectedSuggestion.decided_at), "PPpp")}</p>
                  )}
                </div>

                {selectedSuggestion.prd_id && (
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
                        setDetailOpen(false);
                        navigate(`/prd/${selectedSuggestion.prd_id}`);
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      View PRD
                    </Button>
                  </div>
                )}

                {/* Comments Section */}
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
                              onClick={() => handleDeleteComment(comment.id)}
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

                  {/* Add Comment Form — stacks vertically on mobile */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Textarea
                      placeholder="Add implementation notes or requirements..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="min-h-[60px] sm:min-h-[72px] resize-none text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 sm:self-end self-stretch"
                      disabled={!newComment.trim() || addingComment}
                      onClick={handleAddComment}
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

                {selectedSuggestion.status === "pending" && selectedSuggestion.canImplement && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => handleApprove(selectedSuggestion.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => handleReject(selectedSuggestion.id)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                )}

                {selectedSuggestion.status === "pending" && !selectedSuggestion.canImplement && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleCreatePrd(selectedSuggestion.id)}
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
                      onClick={() => handleReject(selectedSuggestion.id)}
                      disabled={creatingPrd}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Decline
                    </Button>
                  </div>
                )}

                {selectedSuggestion.status === "approved" && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => handleImplement(selectedSuggestion.id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Mark as Implemented
                    </Button>
                  </div>
                )}

                {selectedSuggestion.status === "rejected" && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                      onClick={() => {
                        handleRestore(selectedSuggestion.id);
                        setDetailOpen(false);
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

      {/* Generate New Suggestions Modal */}
      <NewSuggestionsModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onGenerate={handleGenerate}
      />
    </div>
  );
}
