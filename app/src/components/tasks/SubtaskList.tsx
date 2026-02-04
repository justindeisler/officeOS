/**
 * SubtaskList - Collapsible subtask checklist with drag-to-reorder
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubtasks } from "@/hooks/useSubtasks";
import type { Subtask, SubtaskCounts } from "@/types";

interface SubtaskListProps {
  taskId: string;
  counts?: SubtaskCounts;
  onCountChange?: (counts: SubtaskCounts) => void;
}

// Single subtask row component
interface SubtaskRowProps {
  subtask: Subtask;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function SubtaskRow({ subtask, onToggle, onDelete }: SubtaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 py-1.5 px-1 rounded-md transition-colors",
        isDragging && "opacity-50 bg-muted",
        !isDragging && "hover:bg-muted/50"
      )}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-none opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(subtask.id, !subtask.completed)}
        className={cn(
          "shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-200",
          subtask.completed
            ? "bg-green-500 border-green-500"
            : "border-muted-foreground/50 hover:border-green-500"
        )}
      >
        {subtask.completed && (
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        )}
      </button>

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-sm transition-all",
          subtask.completed && "text-muted-foreground line-through"
        )}
      >
        {subtask.title}
      </span>

      {/* Delete button */}
      <button
        onClick={() => onDelete(subtask.id)}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Inline add subtask input
interface AddSubtaskInputProps {
  onAdd: (title: string) => void;
  onCancel: () => void;
}

function AddSubtaskInput({ onAdd, onCancel }: AddSubtaskInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <div className="w-3.5" /> {/* Spacer for drag handle alignment */}
      <div className="shrink-0 w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!value.trim()) onCancel();
        }}
        placeholder="Add subtask..."
        className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
      />
      <button
        onClick={handleSubmit}
        className="p-0.5 text-green-500 hover:text-green-600 transition-colors"
        disabled={!value.trim()}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function SubtaskList({ taskId, counts, onCountChange }: SubtaskListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const {
    subtasks,
    isLoading,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
  } = useSubtasks({ taskId, enabled: isExpanded });

  // Update counts when subtasks change
  useEffect(() => {
    if (onCountChange && subtasks.length > 0) {
      const newCounts = {
        total: subtasks.length,
        completed: subtasks.filter((s) => s.completed).length,
      };
      onCountChange(newCounts);
    }
  }, [subtasks, onCountChange]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = subtasks.findIndex((s) => s.id === active.id);
      const newIndex = subtasks.findIndex((s) => s.id === over.id);

      if (oldIndex !== newIndex) {
        const newOrder = arrayMove(subtasks, oldIndex, newIndex);
        reorderSubtasks(newOrder.map((s) => s.id));
      }
    },
    [subtasks, reorderSubtasks]
  );

  const handleAddSubtask = useCallback(
    async (title: string) => {
      await addSubtask(title);
      // Keep input open for adding more
    },
    [addSubtask]
  );

  // Use provided counts or calculate from loaded subtasks
  const displayCounts = isExpanded
    ? { total: subtasks.length, completed: subtasks.filter((s) => s.completed).length }
    : counts || { total: 0, completed: 0 };

  // Don't show anything if no subtasks and collapsed
  if (!isExpanded && displayCounts.total === 0) {
    return null;
  }

  return (
    <div className="mt-2">
      {/* Collapsed badge */}
      {!isExpanded && displayCounts.total > 0 && (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
            "hover:bg-slate-200 dark:hover:bg-slate-700"
          )}
        >
          <ChevronRight className="h-3 w-3" />
          <span>
            {displayCounts.completed}/{displayCounts.total} Sub-Tasks
          </span>
        </button>
      )}

      {/* Expanded list */}
      {isExpanded && (
        <div className="rounded-lg border bg-card/50 p-2">
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-90" />
              Subtasks
            </button>
            <span className="text-xs text-muted-foreground">
              {displayCounts.completed}/{displayCounts.total}
            </span>
          </div>

          {isLoading && subtasks.length === 0 ? (
            <div className="py-2 text-center text-xs text-muted-foreground">
              Loading...
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={subtasks.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {subtasks.map((subtask) => (
                    <SubtaskRow
                      key={subtask.id}
                      subtask={subtask}
                      onToggle={toggleSubtask}
                      onDelete={deleteSubtask}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add subtask */}
          {isAdding ? (
            <AddSubtaskInput
              onAdd={handleAddSubtask}
              onCancel={() => setIsAdding(false)}
            />
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 py-1.5 px-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <div className="w-3.5" />
              <Plus className="h-3.5 w-3.5" />
              <span>Add subtask</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Collapsed badge only component for task cards
interface SubtaskBadgeProps {
  counts: SubtaskCounts;
  onClick: () => void;
}

export function SubtaskBadge({ counts, onClick }: SubtaskBadgeProps) {
  if (counts.total === 0) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors",
        "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
        "hover:bg-slate-200 dark:hover:bg-slate-700"
      )}
    >
      <ChevronRight className="h-3 w-3" />
      <span>
        {counts.completed}/{counts.total} Sub-Tasks
      </span>
    </button>
  );
}
