import { User } from "lucide-react";
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

interface ProfileSectionProps {
  nameInput: string;
  setNameInput: (value: string) => void;
  onSave: () => void;
}

export function ProfileSection({ nameInput, setNameInput, onSave }: ProfileSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
        <CardDescription>
          Your personal information displayed in the sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="user-name">Display Name</Label>
          <div className="flex gap-2">
            <Input
              id="user-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="flex-1"
            />
            <Button onClick={onSave}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This name appears next to your profile icon in the sidebar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
