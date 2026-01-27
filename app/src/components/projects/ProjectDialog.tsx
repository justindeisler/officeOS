import { useEffect, useState } from "react";
import { format, addYears } from "date-fns";
import { Trash2, Download } from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useProjectStore } from "@/stores/projectStore";
import { useClientStore } from "@/stores/clientStore";
import { useTaskStore } from "@/stores/taskStore";
import {
  exportProjectToMarkdown,
  downloadMarkdown,
  generateFilename,
} from "@/lib/markdown";
import { toast } from "sonner";
import type { Project, ProjectStatus, Area } from "@/types";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  onClose: () => void;
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onClose,
}: ProjectDialogProps) {
  const { addProject, updateProject, deleteProject } = useProjectStore();
  const { clients } = useClientStore();
  const { tasks } = useTaskStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [status, setStatus] = useState<ProjectStatus>("pipeline");
  const [area, setArea] = useState<Area>("freelance");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("EUR");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEditing = !!project;

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description || "");
      setClientId(project.clientId || "none");
      setStatus(project.status);
      setArea(project.area);
      setBudgetAmount(project.budgetAmount?.toString() || "");
      setBudgetCurrency(project.budgetCurrency);
      setStartDate(
        project.startDate ? format(new Date(project.startDate), "yyyy-MM-dd") : ""
      );
      setTargetEndDate(
        project.targetEndDate
          ? format(new Date(project.targetEndDate), "yyyy-MM-dd")
          : ""
      );
    } else {
      setName("");
      setDescription("");
      setClientId("none");
      setStatus("pipeline");
      setArea("freelance");
      setBudgetAmount("");
      setBudgetCurrency("EUR");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setTargetEndDate(format(addYears(new Date(), 1), "yyyy-MM-dd"));
    }
  }, [project, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const projectData = {
      name: name.trim(),
      description: description.trim() || undefined,
      clientId: clientId === "none" ? undefined : clientId,
      status,
      area,
      budgetAmount: budgetAmount ? parseFloat(budgetAmount) : undefined,
      budgetCurrency,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      targetEndDate: targetEndDate
        ? new Date(targetEndDate).toISOString()
        : undefined,
    };

    if (isEditing && project) {
      updateProject(project.id, projectData);
    } else {
      addProject(projectData);
    }

    onClose();
  };

  const handleConfirmDelete = () => {
    if (project) {
      deleteProject(project.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  const handleExport = () => {
    if (!project) return;

    const client = project.clientId
      ? clients.find((c) => c.id === project.clientId)
      : undefined;
    const projectTasks = tasks.filter((t) => t.projectId === project.id);

    const markdown = exportProjectToMarkdown(project, { client, tasks: projectTasks });
    const filename = generateFilename(project.name);
    downloadMarkdown(markdown, filename);
    toast.success(`Exported "${project.name}" to markdown`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form key={project?.id ?? `new-${open}`} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the project details below."
                : "Create a new project to track work and time."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name..."
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
                placeholder="Project description..."
                rows={2}
              />
            </div>

            {/* Client */}
            <div className="grid gap-2">
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status and Area */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ProjectStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pipeline">Pipeline</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
            </div>

            {/* Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budgetAmount">Budget</Label>
                <Input
                  id="budgetAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="targetEndDate">Target End Date</Label>
                <Input
                  id="targetEndDate"
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {isEditing && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </div>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? "Save" : "Create"}</Button>
            </div>
          </DialogFooter>
        </form>

        <ConfirmDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={`Delete ${project?.name}?`}
          description="This will permanently delete the project. This action cannot be undone."
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
