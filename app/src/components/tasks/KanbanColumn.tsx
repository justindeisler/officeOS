import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus, SubtaskCounts, Tag } from "@/types";
import type { Project } from "@/types";
import type { PRD } from "@/types/prd";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onAddTask: (status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onAssignToJames?: (task: Task) => void;
  subtaskCounts?: Record<string, SubtaskCounts>;
  projects: Project[];
  prds: PRD[];
  taskTags: Record<string, Tag[]>;
}

const columnColors: Record<TaskStatus, string> = {
  backlog: "border-t-slate-400",
  queue: "border-t-blue-400",
  in_progress: "border-t-amber-400",
  done: "border-t-green-400",
};

export function KanbanColumn({
  id,
  title,
  tasks,
  onAddTask,
  onEditTask,
  onAssignToJames,
  subtaskCounts,
  projects,
  prds,
  taskTags,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-t-4 bg-muted/30",
        columnColors[id]
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(id)}
          className="rounded p-2 hover:bg-accent transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Add task"
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Tasks list */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 min-h-[200px] transition-colors",
          isOver && "bg-accent/50"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onEdit={onEditTask}
              onAssignToJames={onAssignToJames}
              subtaskCounts={subtaskCounts?.[task.id]}
              projects={projects}
              prds={prds}
              taskTags={taskTags}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
