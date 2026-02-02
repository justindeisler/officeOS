import { useState } from "react";
import { format } from "date-fns";
import {
  Plus,
  X,
  Calendar,
  Target,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePRDStore } from "@/stores/prdStore";
import { useProjectStore } from "@/stores/projectStore";
import { PRD_WIZARD_STEPS } from "@/types/prd";

export function Step5Review() {
  const { formData, updateFormData, addMilestone, removeMilestone } = usePRDStore();
  const { projects } = useProjectStore();

  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const [newMetric, setNewMetric] = useState("");
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDesc, setNewMilestoneDesc] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");

  const project = formData.projectId
    ? projects.find((p) => p.id === formData.projectId)
    : null;

  // Calculate completion status
  const completionStatus = PRD_WIZARD_STEPS.map((step) => ({
    ...step,
    isComplete: step.isComplete(formData),
  }));

  const requiredComplete = completionStatus
    .slice(0, 3)
    .every((s) => s.isComplete);

  const handleAddMetric = () => {
    if (!newMetric.trim()) return;
    updateFormData({
      successMetrics: [...(formData.successMetrics || []), newMetric.trim()],
    });
    setNewMetric("");
  };

  const handleRemoveMetric = (index: number) => {
    updateFormData({
      successMetrics: (formData.successMetrics || []).filter((_, i) => i !== index),
    });
  };

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    addMilestone({
      title: newMilestoneTitle.trim(),
      description: newMilestoneDesc.trim() || undefined,
      targetDate: newMilestoneDate || undefined,
    });
    setNewMilestoneTitle("");
    setNewMilestoneDesc("");
    setNewMilestoneDate("");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Review & Generate</h2>
        <p className="text-muted-foreground text-sm">
          Add success metrics and milestones, then review your PRD.
        </p>
      </div>

      {/* Success Metrics & Timeline */}
      <Collapsible open={metricsExpanded} onOpenChange={setMetricsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between p-4 h-auto border rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="font-medium">Success Metrics & Timeline</span>
            </div>
            {metricsExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          {/* Success Metrics */}
          <div className="grid gap-2">
            <Label>Success Metrics</Label>
            <p className="text-xs text-muted-foreground">
              How will you measure if this feature is successful?
            </p>

            <div className="space-y-2">
              {(formData.successMetrics || []).map((metric, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-200"
                >
                  <Target className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="flex-1 text-sm">{metric}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemoveMetric(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={newMetric}
                onChange={(e) => setNewMetric(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddMetric();
                  }
                }}
                placeholder="e.g., Increase user engagement by 20%"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddMetric}
                disabled={!newMetric.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Estimated Effort */}
          <div className="grid gap-2">
            <Label htmlFor="estimatedEffort">Estimated Effort</Label>
            <Select
              value={formData.estimatedEffort || ""}
              onValueChange={(v) => updateFormData({ estimatedEffort: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select effort estimate..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1-2 days">1-2 days (Small)</SelectItem>
                <SelectItem value="3-5 days">3-5 days (Medium)</SelectItem>
                <SelectItem value="1-2 weeks">1-2 weeks (Large)</SelectItem>
                <SelectItem value="2-4 weeks">2-4 weeks (XL)</SelectItem>
                <SelectItem value="1+ months">1+ months (Epic)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Milestones */}
          <div className="grid gap-2">
            <Label>Milestones</Label>
            <p className="text-xs text-muted-foreground">
              Break the work into key deliverables with target dates.
            </p>

            <div className="space-y-2">
              {(formData.milestones || []).map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                >
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{milestone.title}</p>
                    {milestone.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {milestone.description}
                      </p>
                    )}
                  </div>
                  {milestone.targetDate && (
                    <Badge variant="outline" className="shrink-0">
                      {format(new Date(milestone.targetDate), "MMM d")}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeMilestone(milestone.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg border border-dashed space-y-3">
              <Input
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                placeholder="Milestone title"
              />
              <div className="flex gap-2">
                <Input
                  value={newMilestoneDesc}
                  onChange={(e) => setNewMilestoneDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddMilestone}
                disabled={!newMilestoneTitle.trim()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Milestone
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* PRD Summary */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">PRD Summary</h3>
        </div>

        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Feature Name:</span>
            <span className="font-medium">{formData.featureName || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project:</span>
            <span className="font-medium">{project?.name || "Standalone"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Area:</span>
            <span className="font-medium capitalize">{formData.area || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned To:</span>
            <span className="font-medium capitalize">
              {formData.assignee || "Unassigned"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">User Stories:</span>
            <span className="font-medium">{formData.userStories?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Requirements:</span>
            <span className="font-medium">{formData.requirements?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated Effort:</span>
            <span className="font-medium">{formData.estimatedEffort || "—"}</span>
          </div>
        </div>

        {/* Completion checklist */}
        <div className="pt-4 border-t space-y-2">
          <p className="text-sm font-medium">Completion Status</p>
          {completionStatus.slice(0, 3).map((step) => (
            <div key={step.id} className="flex items-center gap-2 text-sm">
              {step.isComplete ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
              <span
                className={
                  step.isComplete ? "text-muted-foreground" : "text-yellow-600"
                }
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>

        {!requiredComplete && (
          <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-200 text-sm text-yellow-700">
            Please complete all required steps before generating your PRD.
          </div>
        )}
      </div>
    </div>
  );
}
