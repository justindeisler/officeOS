/**
 * TagManager – full tag management dialog with color picker.
 * Accessible from a button on the Tasks page.
 */

import { useState } from "react";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTagStore } from "@/stores/tagStore";
import { TagBadge } from "./TagBadge";
import { toast } from "sonner";
import type { Tag } from "@/types";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#6b7280", // grey
  "#1e293b", // slate dark
];

interface TagManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagManager({ open, onOpenChange }: TagManagerProps) {
  const { tags, createTag, updateTag, deleteTag } = useTagStore();
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setEditingTag(null);
    setName("");
    setColor(PRESET_COLORS[0]);
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color || PRESET_COLORS[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editingTag) {
        await updateTag(editingTag.id, { name: name.trim(), color });
        toast.success(`Tag "${name.trim()}" updated`);
      } else {
        const tag = await createTag({ name: name.trim(), color });
        if (tag) {
          toast.success(`Tag "${name.trim()}" created`);
        }
      }
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTag(deleteTarget.id);
    toast.success(`Tag "${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
    if (editingTag?.id === deleteTarget.id) {
      resetForm();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Manage Tags
            </DialogTitle>
            <DialogDescription>
              Create, edit, and delete tags used to organize your tasks.
            </DialogDescription>
          </DialogHeader>

          {/* Form: create or edit */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="tag-name">
                {editingTag ? "Edit Tag" : "New Tag"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tag-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tag name..."
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" size="sm" disabled={!name.trim() || isSubmitting}>
                  {editingTag ? (
                    <>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Save
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </>
                  )}
                </Button>
                {editingTag && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Color picker */}
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "var(--primary)" : "transparent",
                      boxShadow: color === c ? "0 0 0 2px var(--background), 0 0 0 4px var(--primary)" : undefined,
                    }}
                    title={c}
                  />
                ))}
                {/* Custom color input */}
                <label
                  className="relative h-7 w-7 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-muted-foreground/70 transition-colors"
                  title="Custom color"
                >
                  <span className="text-[10px] font-bold text-muted-foreground">#</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
              </div>
              {/* Preview */}
              {name.trim() && (
                <div className="pt-1">
                  <span className="text-xs text-muted-foreground mr-2">Preview:</span>
                  <TagBadge tag={{ id: "preview", name: name.trim(), color }} size="md" />
                </div>
              )}
            </div>
          </form>

          {/* Existing tags list */}
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-medium mb-3">
              Existing Tags ({tags.length})
            </h4>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags yet. Create one above!
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                  >
                    <TagBadge tag={tag} size="md" />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(tag)}
                        className="p-1 rounded hover:bg-muted"
                        title="Edit tag"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tag)}
                        className="p-1 rounded hover:bg-destructive/10"
                        title="Delete tag"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title={`Delete tag "${deleteTarget?.name}"?`}
        description="This will remove the tag from all tasks. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
