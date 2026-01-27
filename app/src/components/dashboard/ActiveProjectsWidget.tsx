import { Briefcase, ArrowRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/stores/projectStore";
import { useClientById } from "@/stores/clientStore";
import type { Project, ProjectStatus } from "@/types";

const statusColors: Record<ProjectStatus, string> = {
  pipeline: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

function ProjectItem({ project }: { project: Project }) {
  const client = useClientById(project.clientId || "");

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div>
        <p className="text-sm font-medium">{project.name}</p>
        {client && (
          <p className="text-xs text-muted-foreground">{client.name}</p>
        )}
      </div>
      <Badge variant="outline" className={statusColors[project.status]}>
        {project.status.replace("_", " ")}
      </Badge>
    </div>
  );
}

export function ActiveProjectsWidget() {
  const { projects } = useProjectStore();

  // Get active and pipeline projects
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "pipeline"
  );
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Projects
          </CardTitle>
          {activeCount > 0 && (
            <Badge variant="secondary">{activeCount} active</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {activeProjects.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No active projects.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/projects">
                <Plus className="h-4 w-4 mr-1" />
                Add Project
              </a>
            </Button>
          </div>
        ) : (
          <>
            {activeProjects.slice(0, 3).map((project) => (
              <ProjectItem key={project.id} project={project} />
            ))}
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <a href="/projects">
                View all projects
                <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
