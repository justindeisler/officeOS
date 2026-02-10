import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuggestionFilters } from "./SuggestionFilters";
import { SuggestionCard } from "./SuggestionCard";
import type { Suggestion } from "@/hooks/useSuggestions";

interface SuggestionListCardProps {
  title: string;
  suggestions: Suggestion[];
  emptyMessage: string;
  emptyFilterMessage: string;
  showRestore?: boolean;
  creatingPrd: boolean;
  projectFilter: string;
  sortOrder: "newest" | "oldest";
  uniqueProjects: string[];
  onProjectFilterChange: (value: string) => void;
  onSortOrderChange: (value: "newest" | "oldest") => void;
  onOpen: (suggestion: Suggestion) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRestore: (id: string) => void;
  onCreatePrd: (id: string) => void;
}

export function SuggestionListCard({
  title,
  suggestions,
  emptyMessage,
  emptyFilterMessage,
  showRestore = false,
  creatingPrd,
  projectFilter,
  sortOrder,
  uniqueProjects,
  onProjectFilterChange,
  onSortOrderChange,
  onOpen,
  onApprove,
  onReject,
  onRestore,
  onCreatePrd,
}: SuggestionListCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          <SuggestionFilters
            projectFilter={projectFilter}
            sortOrder={sortOrder}
            uniqueProjects={uniqueProjects}
            onProjectFilterChange={onProjectFilterChange}
            onSortOrderChange={onSortOrderChange}
          />
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            {projectFilter !== "all" ? emptyFilterMessage : emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                showRestore={showRestore}
                creatingPrd={creatingPrd}
                onOpen={onOpen}
                onApprove={onApprove}
                onReject={onReject}
                onRestore={onRestore}
                onCreatePrd={onCreatePrd}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
