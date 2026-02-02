import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Bot, Calendar, FileText, FolderOpen, GripVertical, MoreHorizontal, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/stores/projectStore";
import { usePRDStore } from "@/stores/prdStore";
import type { Task } from "@/types";

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onAssignToJames?: (task: Task) => void;
  isDragging?: boolean;
}

const priorityColors = {
  1: "bg-destructive/20 text-destructive",
  2: "bg-warning/20 text-warning",
  3: "bg-muted text-muted-foreground",
};

const areaColors = {
  wellfy: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  freelance: "bg-green-500/20 text-green-600 dark:text-green-400",
  personal: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
};

// Distinct color palette for project badges - maximally different hues
const projectColors = [
  "bg-orange-500/20 text-orange-700 dark:text-orange-400",      // Warm orange
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",  // Rich green
  "bg-violet-500/20 text-violet-700 dark:text-violet-400",      // Deep violet
  "bg-rose-500/20 text-rose-700 dark:text-rose-400",              // Bold rose/red
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",              // Bright cyan
  "bg-amber-500/20 text-amber-700 dark:text-amber-400",          // Golden amber
  "bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400",  // Vivid fuchsia
  "bg-sky-600/20 text-sky-700 dark:text-sky-300",                  // Deep sky blue
];

// Generate consistent color index from project name (FNV-1a hash for better distribution)
function getProjectColorIndex(projectName: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < projectName.length; i++) {
    hash ^= projectName.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as unsigned 32-bit
  }
  return hash % projectColors.length;
}

export function TaskCard({ task, onEdit, onAssignToJames, isDragging }: TaskCardProps) {
  const { projects } = useProjectStore();
  const { prds } = usePRDStore();
  const project = task.projectId
    ? projects.find((p) => p.id === task.projectId)
    : null;
  const prd = task.prdId
    ? prds.find((p) => p.id === task.prdId)
    : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card p-3 shadow-sm transition-all",
        dragging && "opacity-50 shadow-lg ring-2 ring-primary",
        !dragging && "hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          className="mt-0.5 cursor-grab touch-none opacity-0 transition-opacity group-hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <button
            onClick={() => onEdit(task)}
            className="text-left w-full"
          >
            <h4 className="font-medium text-sm leading-tight hover:text-primary transition-colors">
              {task.title}
            </h4>
          </button>

          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Area badge */}
            <Badge
              variant="secondary"
              className={cn("text-xs capitalize inline-flex items-center gap-1", areaColors[task.area])}
            >
              <Users className="h-3 w-3" />
              {task.area}
            </Badge>

            {/* Project badge */}
            {project && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium max-w-[140px]",
                  projectColors[getProjectColorIndex(project.name)]
                )}
                title={project.name}
              >
                <FolderOpen className="h-3 w-3 shrink-0" />
                <span className="truncate">{project.name}</span>
              </span>
            )}

            {/* PRD badge */}
            {prd && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-700 dark:text-teal-400 max-w-[140px]"
                title={`PRD: ${prd.featureName}`}
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{prd.featureName}</span>
              </span>
            )}

            {/* James assignee badge */}
            {task.assignee === "james" && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
                title="Assigned to James"
              >
                <Bot className="h-3 w-3 shrink-0" />
                James
              </span>
            )}

            {/* Priority indicator */}
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                priorityColors[task.priority]
              )}
            >
              {task.priority === 1 ? "High" : task.priority === 2 ? "Med" : "Low"}
            </span>

            {/* Due date */}
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.dueDate), "MMM d")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Assign to James button - only show if not already assigned */}
          {task.assignee !== "james" && onAssignToJames && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAssignToJames(task);
              }}
              className="p-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              title="Assign to James"
            >
              <Bot className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </button>
          )}
          {/* Edit menu */}
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
