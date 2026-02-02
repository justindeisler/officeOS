import { useState } from "react";
import { Plus, X, AlertTriangle, Link2, Lightbulb, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePRDStore } from "@/stores/prdStore";

interface ListInputProps {
  label: string;
  icon: React.ReactNode;
  items: string[];
  placeholder: string;
  onAdd: (item: string) => void;
  onRemove: (index: number) => void;
  description?: string;
  variant?: "default" | "warning";
}

function ListInput({
  label,
  icon,
  items,
  placeholder,
  onAdd,
  onRemove,
  description,
  variant = "default",
}: ListInputProps) {
  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (!newItem.trim()) return;
    onAdd(newItem.trim());
    setNewItem("");
  };

  const itemBg = variant === "warning" 
    ? "bg-yellow-500/10 border-yellow-200" 
    : "bg-muted/50";

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <Label>{label}</Label>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Existing items */}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-3 rounded-md ${itemBg}`}
          >
            <span className="flex-1 text-sm">{item}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleAdd}
          disabled={!newItem.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Step4Technical() {
  const { formData, updateFormData } = usePRDStore();

  const handleAddDependency = (item: string) => {
    updateFormData({
      dependencies: [...(formData.dependencies || []), item],
    });
  };

  const handleRemoveDependency = (index: number) => {
    updateFormData({
      dependencies: (formData.dependencies || []).filter((_, i) => i !== index),
    });
  };

  const handleAddRisk = (item: string) => {
    updateFormData({
      risks: [...(formData.risks || []), item],
    });
  };

  const handleRemoveRisk = (index: number) => {
    updateFormData({
      risks: (formData.risks || []).filter((_, i) => i !== index),
    });
  };

  const handleAddAssumption = (item: string) => {
    updateFormData({
      assumptions: [...(formData.assumptions || []), item],
    });
  };

  const handleRemoveAssumption = (index: number) => {
    updateFormData({
      assumptions: (formData.assumptions || []).filter((_, i) => i !== index),
    });
  };

  const handleAddConstraint = (item: string) => {
    updateFormData({
      constraints: [...(formData.constraints || []), item],
    });
  };

  const handleRemoveConstraint = (index: number) => {
    updateFormData({
      constraints: (formData.constraints || []).filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Technical Considerations</h2>
        <p className="text-muted-foreground text-sm">
          Document technical approach, dependencies, and risks. This step is optional but recommended.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Technical Approach */}
        <div className="grid gap-2">
          <Label htmlFor="technicalApproach">Technical Approach</Label>
          <Textarea
            id="technicalApproach"
            value={formData.technicalApproach || ""}
            onChange={(e) => updateFormData({ technicalApproach: e.target.value })}
            placeholder="Describe the high-level technical approach. What technologies, patterns, or architectures will be used?"
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Optional but helpful for implementation planning.
          </p>
        </div>

        {/* Dependencies */}
        <ListInput
          label="Dependencies"
          icon={<Link2 className="h-4 w-4 text-blue-500" />}
          items={formData.dependencies || []}
          placeholder="e.g., Requires Auth API v2.0"
          onAdd={handleAddDependency}
          onRemove={handleRemoveDependency}
          description="External systems, APIs, or features this depends on."
        />

        {/* Risks */}
        <ListInput
          label="Risks"
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          items={formData.risks || []}
          placeholder="e.g., Third-party API rate limits may affect performance"
          onAdd={handleAddRisk}
          onRemove={handleRemoveRisk}
          description="Potential issues that could impact success."
          variant="warning"
        />

        {/* Assumptions */}
        <ListInput
          label="Assumptions"
          icon={<Lightbulb className="h-4 w-4 text-yellow-500" />}
          items={formData.assumptions || []}
          placeholder="e.g., Users have modern browsers with ES6 support"
          onAdd={handleAddAssumption}
          onRemove={handleRemoveAssumption}
          description="What conditions are we assuming to be true?"
        />

        {/* Constraints */}
        <ListInput
          label="Constraints"
          icon={<Lock className="h-4 w-4 text-purple-500" />}
          items={formData.constraints || []}
          placeholder="e.g., Must be completed before Q2 release"
          onAdd={handleAddConstraint}
          onRemove={handleRemoveConstraint}
          description="Fixed limitations or boundaries to work within."
        />
      </div>
    </div>
  );
}
