import { FolderOpen } from "lucide-react";
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

interface WorkspaceSectionProps {
  pathInput: string;
  setPathInput: (value: string) => void;
  workspacePath: string | undefined;
  onSave: () => void;
}

export function WorkspaceSection({
  pathInput,
  setPathInput,
  workspacePath,
  onSave,
}: WorkspaceSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Workspace
        </CardTitle>
        <CardDescription>
          Configure your Obsidian workspace location for markdown integration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-path">Workspace Path</Label>
          <div className="flex gap-2">
            <Input
              id="workspace-path"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/Users/you/Documents/Obsidian/Vault"
              className="flex-1"
            />
            <Button onClick={onSave}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Path to your Obsidian vault or markdown workspace. Used for
            exporting and linking files.
          </p>
        </div>

        {workspacePath && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">Current workspace:</p>
            <code className="text-xs text-muted-foreground">
              {workspacePath}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
