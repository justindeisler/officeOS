import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePRDStore } from "@/stores/prdStore";

export function Step2ProblemGoals() {
  const { formData, updateFormData } = usePRDStore();
  const [newGoal, setNewGoal] = useState("");
  const [newNonGoal, setNewNonGoal] = useState("");

  const handleAddGoal = () => {
    if (!newGoal.trim()) return;
    updateFormData({
      goals: [...(formData.goals || []), newGoal.trim()],
    });
    setNewGoal("");
  };

  const handleRemoveGoal = (index: number) => {
    updateFormData({
      goals: (formData.goals || []).filter((_, i) => i !== index),
    });
  };

  const handleAddNonGoal = () => {
    if (!newNonGoal.trim()) return;
    updateFormData({
      nonGoals: [...(formData.nonGoals || []), newNonGoal.trim()],
    });
    setNewNonGoal("");
  };

  const handleRemoveNonGoal = (index: number) => {
    updateFormData({
      nonGoals: (formData.nonGoals || []).filter((_, i) => i !== index),
    });
  };

  const handleKeyPress = (
    e: React.KeyboardEvent,
    addFn: () => void
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFn();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Problem & Goals</h2>
        <p className="text-muted-foreground text-sm">
          Define the problem you're solving and what success looks like.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Problem Statement */}
        <div className="grid gap-2">
          <Label htmlFor="problemStatement">Problem Statement *</Label>
          <Textarea
            id="problemStatement"
            value={formData.problemStatement || ""}
            onChange={(e) => updateFormData({ problemStatement: e.target.value })}
            placeholder="Describe the problem or opportunity this feature addresses. What pain points exist? Why is this important?"
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Be specific about the current state and why change is needed.
          </p>
        </div>

        {/* Goals */}
        <div className="grid gap-2">
          <Label>Goals *</Label>
          <p className="text-xs text-muted-foreground mb-2">
            What are the specific outcomes you want to achieve? Add at least one goal.
          </p>

          {/* Existing goals */}
          <div className="space-y-2">
            {(formData.goals || []).map((goal, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 rounded-md bg-muted/50"
              >
                <span className="flex-1 text-sm">{goal}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveGoal(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add new goal */}
          <div className="flex gap-2">
            <Input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleAddGoal)}
              placeholder="e.g., Reduce user onboarding time by 50%"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddGoal}
              disabled={!newGoal.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Non-Goals (Optional) */}
        <div className="grid gap-2">
          <Label>Non-Goals (Optional)</Label>
          <p className="text-xs text-muted-foreground mb-2">
            What is explicitly out of scope? This helps set clear boundaries.
          </p>

          {/* Existing non-goals */}
          <div className="space-y-2">
            {(formData.nonGoals || []).map((nonGoal, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-dashed"
              >
                <span className="flex-1 text-sm text-muted-foreground">{nonGoal}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveNonGoal(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Add new non-goal */}
          <div className="flex gap-2">
            <Input
              value={newNonGoal}
              onChange={(e) => setNewNonGoal(e.target.value)}
              onKeyPress={(e) => handleKeyPress(e, handleAddNonGoal)}
              placeholder="e.g., Mobile app support (future phase)"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddNonGoal}
              disabled={!newNonGoal.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
