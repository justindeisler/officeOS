import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { GenerateParams } from "@/components/suggestions/NewSuggestionsModal";

export interface Suggestion {
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

export interface SuggestionComment {
  id: string;
  suggestion_id: string;
  author: string;
  comment_text: string;
  created_at: string;
}

export const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  approved: "bg-green-500/10 text-green-700 dark:text-green-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  implemented: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export const typeColors: Record<string, string> = {
  improvement: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  feature: "bg-green-500/10 text-green-700 dark:text-green-400",
  fix: "bg-red-500/10 text-red-700 dark:text-red-400",
  refactor: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  security: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export const priorityLabels: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Minimal",
};

/** Check if a suggestion was created within the last 24 hours */
export function isNewSuggestion(suggestion: Suggestion): boolean {
  const createdAt = new Date(suggestion.created_at);
  const now = new Date();
  const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

export function useSuggestions() {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatingPrd, setCreatingPrd] = useState(false);

  // Filter and sort state
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [projectFilter, setProjectFilter] = useState<string>("all");

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

  // Get unique project names for filter
  const uniqueProjects = Array.from(
    new Set(suggestions.map((s) => s.project_name).filter(Boolean))
  ).sort() as string[];

  // Helper: Apply project filter and sort
  const filterAndSort = (list: Suggestion[]) => {
    let filtered = list;

    if (projectFilter !== "all") {
      filtered = filtered.filter((s) => s.project_name === projectFilter);
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  };

  const activeSuggestions = filterAndSort(
    suggestions.filter((s) => s.status === "pending" || s.status === "approved")
  );

  const implementedSuggestions = filterAndSort(
    suggestions.filter((s) => s.status === "implemented")
  );

  const archivedSuggestions = filterAndSort(
    suggestions.filter((s) => s.status === "rejected")
  );

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

  return {
    // State
    suggestions,
    isLoading,
    selectedSuggestion,
    detailOpen,
    setDetailOpen,
    activeTab,
    setActiveTab,
    generateModalOpen,
    setGenerateModalOpen,
    isGenerating,
    creatingPrd,
    sortOrder,
    setSortOrder,
    projectFilter,
    setProjectFilter,
    comments,
    commentsLoading,
    newComment,
    setNewComment,
    addingComment,

    // Derived
    uniqueProjects,
    activeSuggestions,
    implementedSuggestions,
    archivedSuggestions,

    // Actions
    fetchSuggestions,
    handleGenerate,
    handleAddComment,
    handleDeleteComment,
    handleApprove,
    handleReject,
    handleRestore,
    handleImplement,
    handleCreatePrd,
    openDetail,
    navigate,
  };
}
