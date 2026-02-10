/**
 * TagMultiSelect – a popover with checkboxes for selecting multiple tags.
 * Used in the TaskDialog for assigning tags to a task.
 */

import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTagStore } from "@/stores/tagStore";
import { TagBadge } from "./TagBadge";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

interface TagMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TagMultiSelect({ selectedIds, onChange }: TagMultiSelectProps) {
  const { tags, createTag } = useTagStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedTags = tags.filter((t) => selectedIds.includes(t.id));

  const toggle = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  };

  const handleQuickCreate = async () => {
    if (!search.trim() || isCreating) return;
    setIsCreating(true);
    const tag = await createTag({ name: search.trim() });
    if (tag) {
      onChange([...selectedIds, tag.id]);
      setSearch("");
    }
    setIsCreating(false);
  };

  const noMatch = search.trim() && filtered.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-10"
        >
          {selectedTags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  onRemove={() => toggle(tag.id)}
                />
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">Select tags...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <Input
          placeholder="Search or create tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && noMatch) {
              e.preventDefault();
              handleQuickCreate();
            }
          }}
        />

        <div className="max-h-48 overflow-y-auto">
          {filtered.map((tag) => (
            <TagOptionItem
              key={tag.id}
              tag={tag}
              selected={selectedIds.includes(tag.id)}
              onToggle={() => toggle(tag.id)}
            />
          ))}

          {noMatch && (
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={isCreating}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Create &quot;{search.trim()}&quot;
            </button>
          )}

          {!search && tags.length === 0 && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              No tags yet. Type to create one.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagOptionItem({
  tag,
  selected,
  onToggle,
}: {
  tag: Tag;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
        selected && "bg-accent/50",
      )}
    >
      <span
        className="h-3 w-3 rounded-full shrink-0 border border-white/20"
        style={{ backgroundColor: tag.color || "#6b7280" }}
      />
      <span className="flex-1 text-left truncate">{tag.name}</span>
      {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
    </button>
  );
}
