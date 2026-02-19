import { useEffect, useState } from "react";
import { Trash2, MapPin } from "lucide-react";
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

  // Structured address fields
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Deutschland");

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
      setStreet(client.address?.street || "");
      setZip(client.address?.zip || "");
      setCity(client.address?.city || "");
      setCountry(client.address?.country || "Deutschland");
    } else {
      setName("");
      setEmail("");
      setCompany("");
      setContactInfo("");
      setNotes("");
      setStatus("active");
      setStreet("");
      setZip("");
      setCity("");
      setCountry("Deutschland");
    }
  }, [client, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const hasAddress = street.trim() || zip.trim() || city.trim();

    const clientData = {
      name: name.trim(),
      email: email.trim() || undefined,
      company: company.trim() || undefined,
      contactInfo: contactInfo.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      address: hasAddress
        ? {
            street: street.trim() || undefined,
            zip: zip.trim() || undefined,
            city: city.trim() || undefined,
            country: country.trim() || "Deutschland",
          }
        : undefined,
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[540px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Client bearbeiten" : "Neuer Client"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Clientdaten aktualisieren."
                : "Neuen Client für Projekte und Rechnungen anlegen."}
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
                placeholder="Vor- und Nachname oder Firmenname"
                autoFocus
              />
            </div>

            {/* Company */}
            <div className="grid gap-2">
              <Label htmlFor="company">Firma</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Firmenname (optional)"
              />
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            {/* Phone / Other Contact */}
            <div className="grid gap-2">
              <Label htmlFor="contactInfo">Telefon / Sonstiges</Label>
              <Input
                id="contactInfo"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>

            {/* Address Section */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Adresse</Label>
              </div>

              {/* Street */}
              <div className="grid gap-2">
                <Label htmlFor="street" className="text-xs text-muted-foreground">Straße und Hausnummer</Label>
                <Input
                  id="street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Musterstraße 1"
                />
              </div>

              {/* ZIP + City — side by side */}
              <div className="grid grid-cols-[110px_1fr] gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="zip" className="text-xs text-muted-foreground">PLZ</Label>
                  <Input
                    id="zip"
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="10115"
                    maxLength={10}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city" className="text-xs text-muted-foreground">Stadt</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Berlin"
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid gap-2">
                <Label htmlFor="country" className="text-xs text-muted-foreground">Land</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Deutschland"
                />
              </div>
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
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Interne Notizen..."
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
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button type="submit">{isEditing ? "Speichern" : "Erstellen"}</Button>
            </div>
          </DialogFooter>
        </form>

        <ConfirmDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={`${client?.name} löschen?`}
          description="Der Client wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
          onConfirm={handleConfirmDelete}
        />
      </DialogContent>
    </Dialog>
  );
}
