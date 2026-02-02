import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Calendar, DollarSign, MoreHorizontal, Trash2, Edit2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useProjectStore } from "@/stores/projectStore";
import { useClientById } from "@/stores/clientStore";
import type { Project, ProjectStatus, Area } from "@/types";

interface ProjectCardProps {
  project: Project;
  onEdit: (project: Project) => void;
}

const statusColors: Record<ProjectStatus, string> = {
  pipeline: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<ProjectStatus, string> = {
  pipeline: "Pipeline",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const areaColors: Record<Area, string> = {
  wellfy: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  freelance: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  personal: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const { deleteProject } = useProjectStore();
  const client = useClientById(project.clientId || "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleConfirmDelete = () => {
    deleteProject(project.id);
    setShowDeleteDialog(false);
  };

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/projects/${project.id}`}
                className="font-medium truncate hover:underline hover:text-primary"
              >
                {project.name}
              </Link>
            </div>

            {/* Client */}
            {client && (
              <p className="text-sm text-muted-foreground mb-2">{client.name}</p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className={statusColors[project.status]}>
                {statusLabels[project.status]}
              </Badge>
              <Badge variant="outline" className={areaColors[project.area]}>
                {project.area}
              </Badge>
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {project.budgetAmount && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(project.budgetAmount, project.budgetCurrency)}
                </div>
              )}
              {project.targetEndDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(project.targetEndDate), "MMM d, yyyy")}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/projects/${project.id}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(project)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>

      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete "${project.name}"?`}
        description="This will permanently delete the project. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
