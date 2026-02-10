import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskStore } from "@/stores/taskStore";
import { TagFilterDropdown } from "@/components/tags";
import type { Area } from "@/types";

export function TaskFilters() {
  const { filter, setFilter } = useTaskStore();

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
      {/* Search */}
      <div className="relative flex-1 sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      {/* Area filter */}
      <Select
        value={filter.area}
        onValueChange={(value) => setFilter({ area: value as Area | "all" })}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All areas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Areas</SelectItem>
          <SelectItem value="wellfy">Wellfy</SelectItem>
          <SelectItem value="freelance">Freelance</SelectItem>
          <SelectItem value="personal">Personal</SelectItem>
        </SelectContent>
      </Select>

      {/* Tag filter */}
      <TagFilterDropdown />
    </div>
  );
}
