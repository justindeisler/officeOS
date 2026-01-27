import { useState } from "react";
import { Building2, Mail, MoreHorizontal, Trash2, Edit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useClientStore } from "@/stores/clientStore";
import { useProjectsByClient } from "@/stores/projectStore";
import type { Client } from "@/types";

interface ClientCardProps {
  client: Client;
  onEdit: (client: Client) => void;
}

const statusColors: Record<Client["status"], string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  archived: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ClientCard({ client, onEdit }: ClientCardProps) {
  const { deleteClient } = useClientStore();
  const clientProjects = useProjectsByClient(client.id);
  const activeProjects = clientProjects.filter((p) => p.status === "active").length;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleConfirmDelete = () => {
    deleteClient(client.id);
    setShowDeleteDialog(false);
  };

  return (
    <Card className="group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Name and Company */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{client.name}</h3>
              <Badge variant="outline" className={statusColors[client.status]}>
                {client.status}
              </Badge>
            </div>

            {/* Company */}
            {client.company && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate">{client.company}</span>
              </div>
            )}

            {/* Email */}
            {client.email && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                <Mail className="h-3.5 w-3.5" />
                <a
                  href={`mailto:${client.email}`}
                  className="truncate hover:text-foreground transition-colors"
                >
                  {client.email}
                </a>
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{clientProjects.length} projects</span>
              {activeProjects > 0 && (
                <span className="text-green-500">{activeProjects} active</span>
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
              <DropdownMenuItem onClick={() => onEdit(client)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
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
        title={`Delete ${client.name}?`}
        description="This will permanently delete the client. This action cannot be undone."
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}
