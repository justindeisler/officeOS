import { Building2, User, MapPin, FileText, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BusinessProfile } from "@/types";

interface BusinessProfileSectionProps {
  profileForm: BusinessProfile;
  isSavingProfile: boolean;
  onUpdateField: (field: keyof BusinessProfile, value: string) => void;
  onIbanChange: (value: string) => void;
  formatIban: (iban: string) => string;
  onSave: () => void;
}

export function BusinessProfileSection({
  profileForm,
  isSavingProfile,
  onUpdateField,
  onIbanChange,
  formatIban,
  onSave,
}: BusinessProfileSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Business Profile
        </CardTitle>
        <CardDescription>
          Your business information for invoices and official documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Personal Info */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bp-fullName">Full Name</Label>
              <Input
                id="bp-fullName"
                value={profileForm.fullName}
                onChange={(e) => onUpdateField("fullName", e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-jobTitle">Job Title</Label>
              <Input
                id="bp-jobTitle"
                value={profileForm.jobTitle}
                onChange={(e) => onUpdateField("jobTitle", e.target.value)}
                placeholder="Full-Stack Developer"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-email">Business Email</Label>
              <Input
                id="bp-email"
                type="email"
                value={profileForm.email}
                onChange={(e) => onUpdateField("email", e.target.value)}
                placeholder="kontakt@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-phone">Phone (optional)</Label>
              <Input
                id="bp-phone"
                type="tel"
                value={profileForm.phone || ""}
                onChange={(e) => onUpdateField("phone", e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </h4>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bp-street">Street Address</Label>
              <Input
                id="bp-street"
                value={profileForm.street}
                onChange={(e) => onUpdateField("street", e.target.value)}
                placeholder="Musterstraße 123"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-postalCode">Postal Code</Label>
                <Input
                  id="bp-postalCode"
                  value={profileForm.postalCode}
                  onChange={(e) => onUpdateField("postalCode", e.target.value)}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2 col-span-1 sm:col-span-2">
                <Label htmlFor="bp-city">City</Label>
                <Input
                  id="bp-city"
                  value={profileForm.city}
                  onChange={(e) => onUpdateField("city", e.target.value)}
                  placeholder="Berlin"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-country">Country</Label>
              <Input
                id="bp-country"
                value={profileForm.country}
                onChange={(e) => onUpdateField("country", e.target.value)}
                placeholder="Deutschland"
              />
            </div>
          </div>
        </div>

        {/* Tax Information */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tax Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bp-vatId">USt-IdNr (VAT ID)</Label>
              <Input
                id="bp-vatId"
                value={profileForm.vatId || ""}
                onChange={(e) => onUpdateField("vatId", e.target.value.toUpperCase())}
                placeholder="DE123456789"
              />
              <p className="text-xs text-muted-foreground">
                Required for EU B2B invoices
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-taxId">Steuernummer (Tax Number)</Label>
              <Input
                id="bp-taxId"
                value={profileForm.taxId || ""}
                onChange={(e) => onUpdateField("taxId", e.target.value)}
                placeholder="123/456/78901"
              />
              <p className="text-xs text-muted-foreground">
                Your local tax office number
              </p>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="space-y-4 pt-4 border-t">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Bank Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bp-bankAccountHolder">Account Holder</Label>
              <Input
                id="bp-bankAccountHolder"
                value={profileForm.bankAccountHolder}
                onChange={(e) => onUpdateField("bankAccountHolder", e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-bankName">Bank Name</Label>
              <Input
                id="bp-bankName"
                value={profileForm.bankName}
                onChange={(e) => onUpdateField("bankName", e.target.value)}
                placeholder="Sparkasse Berlin"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bp-bankIban">IBAN</Label>
              <Input
                id="bp-bankIban"
                value={formatIban(profileForm.bankIban)}
                onChange={(e) => onIbanChange(e.target.value)}
                placeholder="DE89 3704 0044 0532 0130 00"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-bankBic">BIC/SWIFT</Label>
              <Input
                id="bp-bankBic"
                value={profileForm.bankBic}
                onChange={(e) => onUpdateField("bankBic", e.target.value.toUpperCase())}
                placeholder="COBADEFFXXX"
                className="font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button onClick={onSave} disabled={isSavingProfile}>
            {isSavingProfile ? "Saving..." : "Save Business Profile"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This information will be used in your invoice PDFs.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
