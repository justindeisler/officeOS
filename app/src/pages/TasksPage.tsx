import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskDialog } from "@/components/tasks/TaskDialog";

export function TasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddTask = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your tasks with a Kanban board.
          </p>
        </div>
        <Button onClick={handleAddTask} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      <TaskFilters />

      <KanbanBoard />

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={null}
        defaultStatus="backlog"
        onClose={handleCloseDialog}
      />
    </div>
  );
}
