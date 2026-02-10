import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  ListTodo,
  Plus,
  GripVertical,
  Trash2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface JamesTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  source: string | null;
  source_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type TaskStatus = "backlog" | "queue" | "in_progress" | "done";

const columns: { id: TaskStatus; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "border-t-slate-500" },
  { id: "queue", title: "Queue", color: "border-t-blue-500" },
  { id: "in_progress", title: "In Progress", color: "border-t-amber-500" },
  { id: "done", title: "Done", color: "border-t-emerald-500" },
];

const priorityColors: Record<number, string> = {
  1: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200",
  2: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200",
  3: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200",
  4: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200",
  5: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-200",
};

const priorityLabels: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Minimal",
};

export function TasksPage() {
  const [tasks, setTasks] = useState<JamesTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<JamesTask | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: 3,
    status: "backlog" as TaskStatus,
  });
  const [draggedTask, setDraggedTask] = useState<JamesTask | null>(null);

  const fetchTasks = async () => {
    try {
      const data = await api.getJamesTasks({ limit: 200 });
      setTasks(data as JamesTask[]);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openCreateDialog = () => {
    setEditingTask(null);
    setFormData({
      title: "",
      description: "",
      priority: 3,
      status: "backlog",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (task: JamesTask) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status as TaskStatus,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      if (editingTask) {
        await api.updateJamesTask(editingTask.id, formData);
        toast.success("Task updated");
      } else {
        await api.createJamesTask(formData);
        toast.success("Task created");
      }
      setDialogOpen(false);
      fetchTasks();
    } catch (error) {
      toast.error(editingTask ? "Failed to update task" : "Failed to create task");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    
    try {
      await api.deleteJamesTask(id);
      toast.success("Task deleted");
      fetchTasks();
    } catch (error) {
      toast.error("Failed to delete task");
    }
  };

  const handleDragStart = (e: React.DragEvent, task: JamesTask) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    try {
      await api.updateJamesTask(draggedTask.id, { status: newStatus });
      toast.success(`Moved to ${columns.find((c) => c.id === newStatus)?.title}`);
      fetchTasks();
    } catch (error) {
      toast.error("Failed to move task");
    }
    setDraggedTask(null);
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.priority - b.priority);
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ListTodo className="h-7 w-7" />
            James Tasks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kanban board for James's task queue
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((column) => (
          <Card
            key={column.id}
            className={cn("border-t-4", column.color)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                {column.title}
                <Badge variant="secondary" className="ml-2">
                  {getTasksByStatus(column.id).length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 min-h-[200px]">
              {getTasksByStatus(column.id).map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => openEditDialog(task)}
                  className={cn(
                    "p-3 rounded-lg border bg-card cursor-pointer transition-all hover:shadow-md",
                    draggedTask?.id === task.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", priorityColors[task.priority])}
                        >
                          {priorityLabels[task.priority]}
                        </Badge>
                        {task.source && (
                          <Badge variant="outline" className="text-xs">
                            {task.source}
                          </Badge>
                        )}
                      </div>
                      {task.status === "in_progress" && task.started_at && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Started {format(new Date(task.started_at), "MMM d")}
                        </div>
                      )}
                      {task.status === "done" && task.completed_at && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Completed {format(new Date(task.completed_at), "MMM d")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {getTasksByStatus(column.id).length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No tasks</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Update the task details below." : "Add a new task to James's queue."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={String(formData.priority)}
                  onValueChange={(v) => setFormData({ ...formData, priority: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Critical</SelectItem>
                    <SelectItem value="2">2 - High</SelectItem>
                    <SelectItem value="3">3 - Medium</SelectItem>
                    <SelectItem value="4">4 - Low</SelectItem>
                    <SelectItem value="5">5 - Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="queue">Queue</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingTask && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete(editingTask.id);
                  setDialogOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingTask ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      )}
    </>
  );
}
