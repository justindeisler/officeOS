import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Trash2, Download, Bot, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";
import { useClientStore } from "@/stores/clientStore";
import { usePRDStore } from "@/stores/prdStore";
import { useTagStore } from "@/stores/tagStore";
import { TagMultiSelect } from "@/components/tags";
import {
  exportTaskToMarkdown,
  downloadMarkdown,
  generateFilename,
} from "@/lib/markdown";
import { toast } from "sonner";
import type { Task, TaskStatus, TaskPriority, Area, Assignee } from "@/types";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  defaultStatus: TaskStatus | null;
  onClose: () => void;
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultStatus,
  onClose,
}: TaskDialogProps) {
  const { addTask, updateTask, deleteTask } = useTaskStore();
  const { projects } = useProjectStore();
  const { clients } = useClientStore();
  const { prds } = usePRDStore();
  const { taskTags, syncTaskTags } = useTagStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [area, setArea] = useState<Area>("freelance");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [prdId, setPrdId] = useState<string | undefined>(undefined);
  const [assignee, setAssignee] = useState<Assignee>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEditing = !!task;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setArea(task.area);
      setDueDate(task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "");
      setProjectId(task.projectId);
      setPrdId(task.prdId);
      setAssignee(task.assignee || null);
      // Load tags for this task
      const tags = taskTags[task.id] || [];
      setSelectedTagIds(tags.map((t) => t.id));
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "backlog");
      setPriority(2);
      setArea("freelance");
      setDueDate("");
      setProjectId(undefined);
      setPrdId(undefined);
      setAssignee(null);
      setSelectedTagIds([]);
    }
  }, [task, defaultStatus, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      area,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      projectId,
      prdId,
      assignee,
    };

    if (isEditing && task) {
      await updateTask(task.id, taskData);
      // Sync tags
      await syncTaskTags(task.id, selectedTagIds);
    } else {
      // For new tasks we need the ID from the store after creation
      await addTask(taskData);
      // Get the newly created task (last one added with matching title)
      const newTask = useTaskStore.getState().tasks.find(
        (t) => t.title === taskData.title && t.status === taskData.status
      );
      if (newTask && selectedTagIds.length > 0) {
        await syncTaskTags(newTask.id, selectedTagIds);
      }
    }

    onClose();
  };

  const handleConfirmDelete = () => {
    if (task) {
      deleteTask(task.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  const handleExport = () => {
    if (!task) return;

    const project = task.projectId
      ? projects.find((p) => p.id === task.projectId)
      : undefined;
    const client = project?.clientId
      ? clients.find((c) => c.id === project.clientId)
      : undefined;

    const markdown = exportTaskToMarkdown(task, { project, client });
    const filename = generateFilename(task.title);
    downloadMarkdown(markdown, filename);
    toast.success(`Exported "${task.title}" to markdown`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the task details below."
                : "Create a new task by filling out the form below."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                rows={3}
              />
            </div>

            {/* Project (optional) */}
            <div className="grid gap-2">
              <Label htmlFor="project">Project</Label>
              <Select
                value={projectId || "none"}
                onValueChange={(v) => setProjectId(v === "none" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PRD (optional) */}
            {prds.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="prd" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  PRD
                </Label>
                <Select
                  value={prdId || "none"}
                  onValueChange={(v) => setPrdId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Link to a PRD..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No PRD</SelectItem>
                    {prds.map((prd) => (
                      <SelectItem key={prd.id} value={prd.id}>
                        {prd.featureName} (v{prd.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Status and Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
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

              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={String(priority)}
                  onValueChange={(v) => setPriority(Number(v) as TaskPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">High</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Area and Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="area">Area</Label>
                <Select
                  value={area}
                  onValueChange={(v) => setArea(v as Area)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wellfy">Wellfy</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagMultiSelect
                selectedIds={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            </div>

            {/* Assign to James */}
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary" />
                <div className="space-y-0.5">
                  <Label htmlFor="assignJames" className="text-sm font-medium">
                    Assign to James
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    James will pick up this task automatically
                  </p>
                </div>
              </div>
              <Switch
                id="assignJames"
                checked={assignee === "james"}
                onCheckedChange={(checked) => setAssignee(checked ? "james" : null)}
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {isEditing && (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm">{isEditing ? "Save" : "Create"}</Button>
            </div>
          </DialogFooter>
        </form>

        <ConfirmDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Delete task?"
          description="This will permanently delete this task. This action cannot be undone."
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
