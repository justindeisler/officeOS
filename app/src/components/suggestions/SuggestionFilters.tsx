import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SuggestionFiltersProps {
  projectFilter: string;
  sortOrder: "newest" | "oldest";
  uniqueProjects: string[];
  onProjectFilterChange: (value: string) => void;
  onSortOrderChange: (value: "newest" | "oldest") => void;
}

export function SuggestionFilters({
  projectFilter,
  sortOrder,
  uniqueProjects,
  onProjectFilterChange,
  onSortOrderChange,
}: SuggestionFiltersProps) {
  return (
    <div className="flex items-center gap-2">
      <Select value={projectFilter} onValueChange={onProjectFilterChange}>
        <SelectTrigger className="w-[180px]">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue placeholder="All Projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {uniqueProjects.map((project) => (
            <SelectItem key={project} value={project}>
              {project}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortOrder} onValueChange={(value: "newest" | "oldest") => onSortOrderChange(value)}>
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest First</SelectItem>
          <SelectItem value="oldest">Oldest First</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
