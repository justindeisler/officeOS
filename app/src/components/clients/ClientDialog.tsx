import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { useClientStore } from "@/stores/clientStore";
import type { Client } from "@/types";

interface ClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onClose: () => void;
}

export function ClientDialog({
  open,
  onOpenChange,
  client,
  onClose,
}: ClientDialogProps) {
  const { addClient, updateClient, deleteClient } = useClientStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Client["status"]>("active");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isEditing = !!client;

  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email || "");
      setCompany(client.company || "");
      setContactInfo(client.contactInfo || "");
      setNotes(client.notes || "");
      setStatus(client.status);
    } else {
      setName("");
      setEmail("");
      setCompany("");
      setContactInfo("");
      setNotes("");
      setStatus("active");
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const clientData = {
      name: name.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      contactInfo: contactInfo.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    };

    if (isEditing && client) {
      updateClient(client.id, clientData);
    } else {
      addClient(clientData);
    }

    onClose();
  };

  const handleConfirmDelete = () => {
    if (client) {
      deleteClient(client.id);
      setShowDeleteDialog(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Client" : "New Client"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the client details below."
                : "Add a new client to manage projects and invoices."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client name..."
                autoFocus
              />
            </div>

            {/* Company */}
            <div className="grid gap-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name..."
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            {/* Contact Info */}
            <div className="grid gap-2">
              <Label htmlFor="contactInfo">Contact Info</Label>
              <Input
                id="contactInfo"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Phone, address, etc."
              />
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Client["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
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
          title={`Delete ${client?.name}?`}
          description="This will permanently delete the client. This action cannot be undone."
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
