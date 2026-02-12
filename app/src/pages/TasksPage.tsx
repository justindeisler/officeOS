import { useState } from "react";
import { Plus, Bot, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TagManager } from "@/components/tags";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function TasksPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [jamesLoading, setJamesLoading] = useState(false);

  const handleAddTask = () => {
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleJamesCheck = async () => {
    setJamesLoading(true);
    try {
      await api.triggerJames();
      toast.success("James is checking for new tasks...", {
        description: "He'll start working on any assigned tasks.",
        icon: "🤖",
      });
    } catch {
      toast.error("Failed to ping James");
    } finally {
      setJamesLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tasks</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {/* James Button with Rainbow Shimmer */}
          <button
            onClick={handleJamesCheck}
            disabled={jamesLoading}
            className="relative inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-black bg-white border border-transparent rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group min-h-[44px]"
          >
            {/* Rainbow shimmer border */}
            <span className="absolute inset-0 rounded-md p-[2px] bg-gradient-to-r from-pink-500 via-purple-500 via-blue-500 via-cyan-500 via-green-500 via-yellow-500 to-pink-500 bg-[length:400%_100%] animate-shimmer" />
            <span className="absolute inset-[2px] rounded-[4px] bg-white" />
            <span className="relative flex items-center gap-2">
              {jamesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">James</span>
            </span>
          </button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTagManagerOpen(true)}
            title="Manage Tags"
            className="min-h-[44px] min-w-[44px]"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button onClick={handleAddTask} className="flex-1 sm:flex-none min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
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

      <TagManager
        open={tagManagerOpen}
        onOpenChange={setTagManagerOpen}
      />
    </div>
  );
}
