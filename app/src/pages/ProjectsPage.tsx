import { useState, useMemo } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { useProjectStore } from "@/stores/projectStore";
import { useClientStore } from "@/stores/clientStore";
import type { Project, ProjectStatus, Area } from "@/types";

const pipelineColumns: { id: ProjectStatus; title: string; color: string }[] = [
  { id: "pipeline", title: "Pipeline", color: "bg-blue-500" },
  { id: "active", title: "Active", color: "bg-green-500" },
  { id: "on_hold", title: "On Hold", color: "bg-yellow-500" },
  { id: "completed", title: "Completed", color: "bg-gray-500" },
];

export function ProjectsPage() {
  const { projects, filter, setFilter } = useProjectStore();
  const { clients } = useClientStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleAddProject = () => {
    setEditingProject(null);
    setDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProject(null);
  };

  // Group projects by status
  const projectsByStatus = useMemo(() => {
    const filtered = projects.filter((project) => {
      if (filter.area !== "all" && project.area !== filter.area) return false;
      if (filter.clientId !== "all" && project.clientId !== filter.clientId)
        return false;
      return true;
    });

    const grouped: Record<ProjectStatus, Project[]> = {
      pipeline: [],
      active: [],
      on_hold: [],
      completed: [],
      cancelled: [],
    };

    filtered.forEach((project) => {
      if (project.status !== "cancelled") {
        grouped[project.status].push(project);
      }
    });

    return grouped;
  }, [projects, filter]);

  const totalProjects = projects.filter((p) => p.status !== "cancelled").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Projects</h1>
        </div>
        <Button onClick={handleAddProject} className="w-full sm:w-auto min-h-[44px]">
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <Select
          value={filter.area}
          onValueChange={(value) => setFilter({ area: value as Area | "all" })}
        >
          <SelectTrigger className="w-full sm:w-[150px] min-h-[44px]">
            <SelectValue placeholder="All Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            <SelectItem value="wellfy">Wellfy</SelectItem>
            <SelectItem value="freelance">Freelance</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
          </SelectContent>
        </Select>

        {clients.length > 0 && (
          <Select
            value={filter.clientId}
            onValueChange={(value) => setFilter({ clientId: value })}
          >
            <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Pipeline View */}
      {totalProjects === 0 ? (
        <div className="rounded-lg border bg-card p-8 sm:p-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No projects yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create your first project to start tracking work.
          </p>
          <Button onClick={handleAddProject} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:pb-0">
          {pipelineColumns.map((column) => (
            <div
              key={column.id}
              className="min-w-[280px] flex-shrink-0 md:min-w-0 rounded-lg border bg-muted/30 p-4 min-h-[400px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${column.color}`} />
                  <h3 className="font-medium">{column.title}</h3>
                </div>
                <Badge variant="secondary">
                  {projectsByStatus[column.id].length}
                </Badge>
              </div>

              {/* Projects */}
              <div className="space-y-3">
                {projectsByStatus[column.id].length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No projects
                  </p>
                ) : (
                  projectsByStatus[column.id].map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onEdit={handleEditProject}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
