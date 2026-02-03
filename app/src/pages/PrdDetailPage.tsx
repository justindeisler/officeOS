import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  FileText,
  Target,
  Users,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Milestone,
  ListChecks,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { usePRDStore, usePRDById } from "@/stores/prdStore";
import { useProjectStore } from "@/stores/projectStore";
import type { PRD, PRDStatus, UserStory, Requirement, Milestone as MilestoneType } from "@/types/prd";
import {
  exportPRDToMarkdown,
  downloadMarkdown,
  generateFilename,
} from "@/lib/markdown";

const statusColors: Record<PRDStatus, string> = {
  draft: "bg-gray-500/10 text-gray-700 border-gray-200",
  review: "bg-blue-500/10 text-blue-700 border-blue-200",
  approved: "bg-green-500/10 text-green-700 border-green-200",
  in_progress: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  completed: "bg-purple-500/10 text-purple-700 border-purple-200",
  implemented: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-700 border-red-200",
  high: "bg-orange-500/10 text-orange-700 border-orange-200",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  low: "bg-gray-500/10 text-gray-700 border-gray-200",
};

// Collapsible Section Component
function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base sm:text-lg">{title}</CardTitle>
                {badge !== undefined && (
                  <Badge variant="secondary" className="ml-2">
                    {badge}
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// User Story Card
function UserStoryCard({ story, index }: { story: UserStory; index: number }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm">
            <span className="font-medium">As a</span> {story.persona},{" "}
            <span className="font-medium">I want</span> {story.action},{" "}
            <span className="font-medium">so that</span> {story.benefit}
          </p>
          {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Acceptance Criteria
              </p>
              <ul className="space-y-1">
                {story.acceptanceCriteria.map((criterion, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Requirement Card
function RequirementCard({ req }: { req: Requirement }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge variant="outline" className="text-xs capitalize">
            {req.type}
          </Badge>
          <Badge variant="outline" className={`text-xs ${priorityColors[req.priority]}`}>
            {req.priority}
          </Badge>
        </div>
        <p className="text-sm">{req.description}</p>
      </div>
    </div>
  );
}

// Milestone Card
function MilestoneCard({ milestone, index }: { milestone: MilestoneType; index: number }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{milestone.title}</p>
        {milestone.description && (
          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
        )}
        {milestone.targetDate && (
          <p className="text-xs text-muted-foreground mt-2">
            Target: {format(new Date(milestone.targetDate), "MMM d, yyyy")}
          </p>
        )}
      </div>
    </div>
  );
}

export function PrdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prd = usePRDById(id || "");
  const { initialize: initializePRDs, deletePRD, isLoaded } = usePRDStore();
  const { projects, initialize: initializeProjects } = useProjectStore();

  useEffect(() => {
    initializePRDs();
    initializeProjects();
  }, [initializePRDs, initializeProjects]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!prd) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/prd")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to PRDs
        </Button>
        <Card className="text-center">
          <CardContent className="pt-12 pb-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">PRD not found</h3>
            <p className="text-muted-foreground text-sm">
              This PRD may have been deleted or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = prd.projectId ? projects.find((p) => p.id === prd.projectId) : null;

  const handleExport = () => {
    const markdown = exportPRDToMarkdown(prd, { project: project || undefined });
    const filename = `PRD-${generateFilename(prd.featureName)}`;
    downloadMarkdown(markdown, filename);
    toast.success("PRD exported to markdown");
  };

  const handleDelete = async () => {
    if (!confirm(`Delete PRD "${prd.featureName}"?`)) return;
    await deletePRD(prd.id);
    toast.success("PRD deleted");
    navigate("/prd");
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="w-fit -ml-2"
          onClick={() => navigate("/prd")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to PRDs
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {prd.featureName}
            </h1>
            <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
              {project && <span>{project.name}</span>}
              {project && <span>•</span>}
              <span className="capitalize">{prd.area}</span>
              <span>•</span>
              <span>v{prd.version}</span>
              <span>•</span>
              <span>by {prd.author}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={statusColors[prd.status]}>
                {prd.status.replace("_", " ")}
              </Badge>
              {prd.assignee && (
                <Badge variant="secondary" className="capitalize">
                  {prd.assignee}
                </Badge>
              )}
              {prd.estimatedEffort && (
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {prd.estimatedEffort}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Created {format(new Date(prd.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
        {prd.updatedAt !== prd.createdAt && (
          <span>• Updated {format(new Date(prd.updatedAt), "MMM d, yyyy 'at' h:mm a")}</span>
        )}
      </div>

      {/* Problem Statement */}
      {prd.problemStatement && (
        <Section title="Problem Statement" icon={AlertTriangle} defaultOpen={true}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {prd.problemStatement}
          </p>
        </Section>
      )}

      {/* Goals */}
      {prd.goals && prd.goals.length > 0 && (
        <Section title="Goals" icon={Target} badge={prd.goals.length}>
          <ul className="space-y-2">
            {prd.goals.map((goal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Non-Goals */}
      {prd.nonGoals && prd.nonGoals.length > 0 && (
        <Section title="Non-Goals" icon={Ban} badge={prd.nonGoals.length} defaultOpen={false}>
          <ul className="space-y-2">
            {prd.nonGoals.map((nonGoal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Ban className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>{nonGoal}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Target Users */}
      {prd.targetUsers && (
        <Section title="Target Users" icon={Users} defaultOpen={true}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {prd.targetUsers}
          </p>
        </Section>
      )}

      {/* User Stories */}
      {prd.userStories && prd.userStories.length > 0 && (
        <Section title="User Stories" icon={ListChecks} badge={prd.userStories.length}>
          <div className="space-y-4">
            {prd.userStories.map((story, i) => (
              <UserStoryCard key={story.id || i} story={story} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Requirements */}
      {prd.requirements && prd.requirements.length > 0 && (
        <Section title="Requirements" icon={ListChecks} badge={prd.requirements.length}>
          <div className="space-y-3">
            {prd.requirements.map((req, i) => (
              <RequirementCard key={req.id || i} req={req} />
            ))}
          </div>
        </Section>
      )}

      {/* Technical Approach */}
      {prd.technicalApproach && (
        <Section title="Technical Approach" icon={Wrench} defaultOpen={false}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {prd.technicalApproach}
          </p>
        </Section>
      )}

      {/* Dependencies */}
      {prd.dependencies && prd.dependencies.length > 0 && (
        <Section title="Dependencies" icon={FileText} badge={prd.dependencies.length} defaultOpen={false}>
          <ul className="space-y-2">
            {prd.dependencies.map((dep, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">•</span>
                <span>{dep}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Risks */}
      {prd.risks && prd.risks.length > 0 && (
        <Section title="Risks" icon={AlertTriangle} badge={prd.risks.length} defaultOpen={false}>
          <ul className="space-y-2">
            {prd.risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Milestones */}
      {prd.milestones && prd.milestones.length > 0 && (
        <Section title="Milestones" icon={Milestone} badge={prd.milestones.length}>
          <div className="space-y-3">
            {prd.milestones.map((milestone, i) => (
              <MilestoneCard key={milestone.id || i} milestone={milestone} index={i} />
            ))}
          </div>
        </Section>
      )}

      {/* Success Metrics */}
      {prd.successMetrics && prd.successMetrics.length > 0 && (
        <Section title="Success Metrics" icon={Target} badge={prd.successMetrics.length} defaultOpen={false}>
          <ul className="space-y-2">
            {prd.successMetrics.map((metric, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>{metric}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
