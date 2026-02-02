import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp, User, Settings } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { usePRDStore } from "@/stores/prdStore";
import type { PRDPriority } from "@/types/prd";

export function Step3UsersRequirements() {
  const {
    formData,
    updateFormData,
    addUserStory,
    removeUserStory,
    addRequirement,
    removeRequirement,
  } = usePRDStore();

  // User Story form state
  const [storyExpanded, setStoryExpanded] = useState(true);
  const [newPersona, setNewPersona] = useState("");
  const [newAction, setNewAction] = useState("");
  const [newBenefit, setNewBenefit] = useState("");
  const [newCriteria, setNewCriteria] = useState("");
  const [criteriaList, setCriteriaList] = useState<string[]>([]);

  // Requirement form state
  const [reqExpanded, setReqExpanded] = useState(true);
  const [newReqDescription, setNewReqDescription] = useState("");
  const [newReqType, setNewReqType] = useState<"functional" | "non-functional">("functional");
  const [newReqPriority, setNewReqPriority] = useState<PRDPriority>("medium");

  const handleAddCriteria = () => {
    if (!newCriteria.trim()) return;
    setCriteriaList([...criteriaList, newCriteria.trim()]);
    setNewCriteria("");
  };

  const handleRemoveCriteria = (index: number) => {
    setCriteriaList(criteriaList.filter((_, i) => i !== index));
  };

  const handleAddUserStory = () => {
    if (!newPersona.trim() || !newAction.trim() || !newBenefit.trim()) return;
    
    addUserStory({
      persona: newPersona.trim(),
      action: newAction.trim(),
      benefit: newBenefit.trim(),
      acceptanceCriteria: criteriaList,
    });

    // Reset form
    setNewPersona("");
    setNewAction("");
    setNewBenefit("");
    setNewCriteria("");
    setCriteriaList([]);
  };

  const handleAddRequirement = () => {
    if (!newReqDescription.trim()) return;

    addRequirement({
      type: newReqType,
      description: newReqDescription.trim(),
      priority: newReqPriority,
    });

    // Reset form
    setNewReqDescription("");
    setNewReqType("functional");
    setNewReqPriority("medium");
  };

  const priorityColors: Record<PRDPriority, string> = {
    critical: "bg-red-500/10 text-red-700 border-red-200",
    high: "bg-orange-500/10 text-orange-700 border-orange-200",
    medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    low: "bg-green-500/10 text-green-700 border-green-200",
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Users & Requirements</h2>
        <p className="text-muted-foreground text-sm">
          Define who this is for and what they need.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Target Users */}
        <div className="grid gap-2">
          <Label htmlFor="targetUsers">Target Users *</Label>
          <Textarea
            id="targetUsers"
            value={formData.targetUsers || ""}
            onChange={(e) => updateFormData({ targetUsers: e.target.value })}
            placeholder="Describe the primary users of this feature. Who are they? What are their characteristics?"
            rows={3}
            className="resize-none"
          />
        </div>

        {/* User Stories Section */}
        <Collapsible open={storyExpanded} onOpenChange={setStoryExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-4 h-auto border rounded-lg"
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">User Stories</span>
                <Badge variant="secondary">{formData.userStories?.length || 0}</Badge>
              </div>
              {storyExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Existing user stories */}
            {(formData.userStories || []).map((story) => (
              <div
                key={story.id}
                className="p-4 rounded-lg bg-muted/30 border space-y-2"
              >
                <div className="flex justify-between items-start">
                  <div className="text-sm">
                    <span className="text-muted-foreground">As a </span>
                    <strong>{story.persona}</strong>
                    <span className="text-muted-foreground">, I want to </span>
                    <strong>{story.action}</strong>
                    <span className="text-muted-foreground">, so that </span>
                    <strong>{story.benefit}</strong>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeUserStory(story.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {story.acceptanceCriteria.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Criteria:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {story.acceptanceCriteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {/* Add new user story */}
            <div className="p-4 rounded-lg border border-dashed space-y-4">
              <p className="text-sm font-medium">Add User Story</p>
              <div className="grid gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">As a</span>
                  <Input
                    value={newPersona}
                    onChange={(e) => setNewPersona(e.target.value)}
                    placeholder="user type/persona"
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">I want to</span>
                  <Input
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    placeholder="action/goal"
                    className="flex-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0">So that</span>
                  <Input
                    value={newBenefit}
                    onChange={(e) => setNewBenefit(e.target.value)}
                    placeholder="benefit/value"
                    className="flex-1"
                  />
                </div>

                {/* Acceptance Criteria */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Acceptance Criteria (optional)</p>
                  {criteriaList.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 p-2 bg-muted rounded">{c}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveCriteria(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newCriteria}
                      onChange={(e) => setNewCriteria(e.target.value)}
                      placeholder="Add acceptance criteria"
                      className="text-sm"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCriteria();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCriteria}
                      disabled={!newCriteria.trim()}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleAddUserStory}
                  disabled={!newPersona.trim() || !newAction.trim() || !newBenefit.trim()}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User Story
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Requirements Section */}
        <Collapsible open={reqExpanded} onOpenChange={setReqExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-4 h-auto border rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Requirements</span>
                <Badge variant="secondary">{formData.requirements?.length || 0}</Badge>
              </div>
              {reqExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Existing requirements */}
            {(formData.requirements || []).map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-lg bg-muted/30 border flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Badge
                    variant="outline"
                    className={priorityColors[req.priority]}
                  >
                    {req.priority}
                  </Badge>
                  <Badge variant="secondary" className="shrink-0">
                    {req.type === "functional" ? "FR" : "NFR"}
                  </Badge>
                  <span className="text-sm">{req.description}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeRequirement(req.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add new requirement */}
            <div className="p-4 rounded-lg border border-dashed space-y-4">
              <p className="text-sm font-medium">Add Requirement</p>
              <div className="grid gap-3">
                <Textarea
                  value={newReqDescription}
                  onChange={(e) => setNewReqDescription(e.target.value)}
                  placeholder="Describe the requirement..."
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-3">
                  <Select
                    value={newReqType}
                    onValueChange={(v) => setNewReqType(v as "functional" | "non-functional")}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="functional">Functional</SelectItem>
                      <SelectItem value="non-functional">Non-Functional</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={newReqPriority}
                    onValueChange={(v) => setNewReqPriority(v as PRDPriority)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">🔴 Critical</SelectItem>
                      <SelectItem value="high">🟠 High</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="low">🟢 Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={handleAddRequirement}
                    disabled={!newReqDescription.trim()}
                    className="ml-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
