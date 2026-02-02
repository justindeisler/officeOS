import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/stores/projectStore";
import { usePRDStore } from "@/stores/prdStore";
import type { Area, Assignee } from "@/types";

export function Step1ProjectFeature() {
  const { formData, updateFormData } = usePRDStore();
  const { projects } = useProjectStore();

  // Filter to active projects only
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "pipeline"
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Project & Feature Info</h2>
        <p className="text-muted-foreground text-sm">
          Start by selecting a project and naming your feature.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Project Selection */}
        <div className="grid gap-2">
          <Label htmlFor="project">Project (Optional)</Label>
          <Select
            value={formData.projectId || "none"}
            onValueChange={(value) =>
              updateFormData({ projectId: value === "none" ? undefined : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project (standalone feature)</SelectItem>
              {activeProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Link this PRD to an existing project, or leave standalone.
          </p>
        </div>

        {/* Feature Name */}
        <div className="grid gap-2">
          <Label htmlFor="featureName">Feature Name *</Label>
          <Input
            id="featureName"
            value={formData.featureName || ""}
            onChange={(e) => updateFormData({ featureName: e.target.value })}
            placeholder="e.g., User Authentication System"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            A clear, descriptive name for this feature.
          </p>
        </div>

        {/* Version */}
        <div className="grid gap-2">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            value={formData.version || "1.0"}
            onChange={(e) => updateFormData({ version: e.target.value })}
            placeholder="1.0"
          />
        </div>

        {/* Area */}
        <div className="grid gap-2">
          <Label htmlFor="area">Area *</Label>
          <Select
            value={formData.area || "personal"}
            onValueChange={(value) => updateFormData({ area: value as Area })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wellfy">Wellfy</SelectItem>
              <SelectItem value="freelance">Freelance</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Author & Assignee Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={formData.author || "Justin"}
              onChange={(e) => updateFormData({ author: e.target.value })}
              placeholder="Your name"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assignee">Assign To</Label>
            <Select
              value={formData.assignee || "none"}
              onValueChange={(value) =>
                updateFormData({
                  assignee: value === "none" ? undefined : (value as Assignee),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                <SelectItem value="justin">Justin</SelectItem>
                <SelectItem value="james">James</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign to James for AI-assisted implementation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
