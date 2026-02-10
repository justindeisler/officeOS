/**
 * TagFilterDropdown – filter tasks by tags in the Kanban header.
 */

import { Tags, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTagStore } from "@/stores/tagStore";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function TagFilterDropdown() {
  const { tags, filterTagIds, setFilterTagIds } = useTagStore();
  const [open, setOpen] = useState(false);

  if (tags.length === 0) return null;

  const toggle = (id: string) => {
    if (filterTagIds.includes(id)) {
      setFilterTagIds(filterTagIds.filter((fid) => fid !== id));
    } else {
      setFilterTagIds([...filterTagIds, id]);
    }
  };

  const clearAll = () => setFilterTagIds([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 gap-2">
          <Tags className="h-4 w-4" />
          Tags
          {filterTagIds.length > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {filterTagIds.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Filter by tag
          </span>
          {filterTagIds.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {tags.map((tag) => {
            const active = filterTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggle(tag.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                  active && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "h-3 w-3 rounded-full shrink-0 border-2 transition-colors",
                    active ? "border-primary" : "border-transparent",
                  )}
                  style={{ backgroundColor: tag.color || "#6b7280" }}
                />
                <span className="flex-1 text-left truncate">{tag.name}</span>
                {active && (
                  <span className="text-xs text-primary font-medium">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
