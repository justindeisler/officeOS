import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
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
import { useCaptureStore } from "@/stores/captureStore";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";
import type { Capture, TaskStatus, TaskPriority, Area } from "@/types";

interface ProcessCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capture: Capture | null;
  onClose: () => void;
}

export function ProcessCaptureDialog({
  open,
  onOpenChange,
  capture,
  onClose,
}: ProcessCaptureDialogProps) {
  const { markProcessed } = useCaptureStore();
  const { addTask } = useTaskStore();
  const { projects } = useProjectStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [area, setArea] = useState<Area>("freelance");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  // For client requests, store the metadata
  const isClientRequest = capture?.type === "client_request";
  const clientMetadata = capture?.metadata;

  useEffect(() => {
    if (capture) {
      // For client requests, use the original title/description from metadata
      if (capture.type === "client_request" && capture.metadata) {
        setTitle(capture.metadata.original_title || "");
        setDescription(capture.metadata.original_description || "");
        
        // Pre-fill project if specified
        if (capture.metadata.project_id) {
          const matchedProject = projects.find(p => p.id === capture.metadata!.project_id);
          if (matchedProject) {
            setProjectId(matchedProject.id);
            setArea(matchedProject.area);
          }
        }
        setPriority(2);
      } else {
        // Smart parsing: first line becomes title, rest becomes description
        const lines = capture.content.split("\n");
        const firstLine = lines[0] || "";
        const restLines = lines.slice(1).join("\n").trim();

        setTitle(firstLine);
        setDescription(restLines);
        setProjectId(undefined);

        // Default priority based on capture type
        if (capture.type === "meeting") {
          setPriority(1); // High priority for meeting action items
        } else {
          setPriority(2);
        }
      }
    }
  }, [capture, open, projects]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !capture) return;

    // Build task data
    const taskData: Parameters<typeof addTask>[0] = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      area,
      projectId,
    };

    // For client requests, mark as quick_capture and set created_by
    if (isClientRequest && clientMetadata) {
      taskData.quickCapture = true;
      taskData.createdBy = clientMetadata.client_email;
      taskData.originalCapture = capture.id;
    }

    // Create the task
    addTask(taskData);

    // Mark capture as processed
    markProcessed(capture.id, "task");

    // Reset and close
    setTitle("");
    setDescription("");
    setStatus("backlog");
    setPriority(2);
    setArea("freelance");
    setProjectId(undefined);
    onClose();
  };

  const handleDismiss = () => {
    if (capture) {
      markProcessed(capture.id, "dismissed");
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Process Capture
            </DialogTitle>
            <DialogDescription>
              Convert this capture into a task or dismiss it.
            </DialogDescription>
          </DialogHeader>

          {/* Client Request Banner */}
          {isClientRequest && clientMetadata && (
            <div className="bg-pink-500/10 border border-pink-500/20 rounded-lg p-3 my-4">
              <div className="flex items-center gap-2 text-sm text-pink-700 dark:text-pink-400">
                <span className="font-medium">Client Request</span>
                {clientMetadata.client_name && (
                  <span>from {clientMetadata.client_name}</span>
                )}
                {clientMetadata.client_email && (
                  <span className="text-muted-foreground">({clientMetadata.client_email})</span>
                )}
              </div>
            </div>
          )}

          {/* Original Capture Preview */}
          {capture && !isClientRequest && (
            <div className="bg-muted/50 rounded-lg p-3 my-4 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Original capture:</p>
              <p className="whitespace-pre-wrap">{capture.content}</p>
            </div>
          )}

          <div className="grid gap-4 py-2">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Task Title</Label>
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
                placeholder="Additional details..."
                rows={3}
              />
            </div>

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

            {/* Area */}
            <div className="grid gap-2">
              <Label htmlFor="area">Area</Label>
              <Select value={area} onValueChange={(v) => setArea(v as Area)}>
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

            {/* Project */}
            <div className="grid gap-2">
              <Label htmlFor="project">Project (optional)</Label>
              <Select 
                value={projectId || "none"} 
                onValueChange={(v) => {
                  if (v === "none") {
                    setProjectId(undefined);
                  } else {
                    setProjectId(v);
                    // Auto-set area based on project
                    const project = projects.find(p => p.id === v);
                    if (project) {
                      setArea(project.area);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects
                    .filter(p => p.status === 'active' || p.status === 'pipeline')
                    .map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between mt-4">
            <Button type="button" variant="ghost" onClick={handleDismiss}>
              Dismiss
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim()}>
                Create Task
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
