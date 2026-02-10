import {
  Lightbulb,
  RefreshCw,
  CheckCircle2,
  Archive,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuggestions } from "@/hooks/useSuggestions";
import {
  AnimatedDots,
  SuggestionListCard,
  SuggestionDetailDialog,
  NewSuggestionsModal,
} from "@/components/suggestions";

export function SuggestionsPage() {
  const s = useSuggestions();

  return (
    <>
      {s.isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
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
          <Button variant="outline" size="sm" onClick={s.fetchSuggestions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => s.setGenerateModalOpen(true)}
            disabled={s.isGenerating}
            className="min-w-[160px]"
          >
            {s.isGenerating ? (
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
      <Tabs value={s.activeTab} onValueChange={s.setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Active ({s.activeSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="implemented" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Implemented ({s.implementedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived ({s.archivedSuggestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <SuggestionListCard
            title="Active Suggestions"
            suggestions={s.activeSuggestions}
            emptyMessage="No active suggestions. James will create suggestions based on project analysis."
            emptyFilterMessage={`No active suggestions for ${s.projectFilter}. Try a different filter.`}
            creatingPrd={s.creatingPrd}
            projectFilter={s.projectFilter}
            sortOrder={s.sortOrder}
            uniqueProjects={s.uniqueProjects}
            onProjectFilterChange={s.setProjectFilter}
            onSortOrderChange={s.setSortOrder}
            onOpen={s.openDetail}
            onApprove={s.handleApprove}
            onReject={s.handleReject}
            onRestore={s.handleRestore}
            onCreatePrd={s.handleCreatePrd}
          />
        </TabsContent>

        <TabsContent value="implemented" className="mt-6">
          <SuggestionListCard
            title="Implemented Suggestions"
            suggestions={s.implementedSuggestions}
            emptyMessage="No implemented suggestions yet. Completed improvements will appear here."
            emptyFilterMessage={`No implemented suggestions for ${s.projectFilter}. Try a different filter.`}
            creatingPrd={s.creatingPrd}
            projectFilter={s.projectFilter}
            sortOrder={s.sortOrder}
            uniqueProjects={s.uniqueProjects}
            onProjectFilterChange={s.setProjectFilter}
            onSortOrderChange={s.setSortOrder}
            onOpen={s.openDetail}
            onApprove={s.handleApprove}
            onReject={s.handleReject}
            onRestore={s.handleRestore}
            onCreatePrd={s.handleCreatePrd}
          />
        </TabsContent>

        <TabsContent value="archived" className="mt-6">
          <SuggestionListCard
            title="Archived Suggestions"
            suggestions={s.archivedSuggestions}
            emptyMessage="No archived suggestions. Declined suggestions will appear here."
            emptyFilterMessage={`No archived suggestions for ${s.projectFilter}. Try a different filter.`}
            showRestore
            creatingPrd={s.creatingPrd}
            projectFilter={s.projectFilter}
            sortOrder={s.sortOrder}
            uniqueProjects={s.uniqueProjects}
            onProjectFilterChange={s.setProjectFilter}
            onSortOrderChange={s.setSortOrder}
            onOpen={s.openDetail}
            onApprove={s.handleApprove}
            onReject={s.handleReject}
            onRestore={s.handleRestore}
            onCreatePrd={s.handleCreatePrd}
          />
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <SuggestionDetailDialog
        open={s.detailOpen}
        onOpenChange={s.setDetailOpen}
        suggestion={s.selectedSuggestion}
        creatingPrd={s.creatingPrd}
        comments={s.comments}
        commentsLoading={s.commentsLoading}
        newComment={s.newComment}
        addingComment={s.addingComment}
        onNewCommentChange={s.setNewComment}
        onAddComment={s.handleAddComment}
        onDeleteComment={s.handleDeleteComment}
        onApprove={s.handleApprove}
        onReject={s.handleReject}
        onRestore={s.handleRestore}
        onImplement={s.handleImplement}
        onCreatePrd={s.handleCreatePrd}
        onNavigateToPrd={(prdId) => s.navigate(`/prd/${prdId}`)}
      />

      {/* Generate New Suggestions Modal */}
      <NewSuggestionsModal
        isOpen={s.generateModalOpen}
        onClose={() => s.setGenerateModalOpen(false)}
        onGenerate={s.handleGenerate}
      />
        </div>
      )}
    </>
  );
}
