import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCard } from "@/components/clients/ClientCard";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { useClientStore } from "@/stores/clientStore";
import type { Client } from "@/types";

export function ClientsPage() {
  const { clients } = useClientStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleAddClient = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingClient(null);
  };

  const activeClients = clients.filter((c) => c.status === "active");
  const inactiveClients = clients.filter((c) => c.status !== "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your freelance clients.
          </p>
        </div>
        <Button onClick={handleAddClient} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No clients yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Add your first client to start managing projects and invoices.
          </p>
          <Button onClick={handleAddClient}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Clients */}
          {activeClients.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Active ({activeClients.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onEdit={handleEditClient}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive/Archived Clients */}
          {inactiveClients.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Inactive/Archived ({inactiveClients.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactiveClients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    onEdit={handleEditClient}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
