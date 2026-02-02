import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FileText,
  ArrowLeft,
  ArrowRight,
  Download,
  Save,
  List,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  WizardSteps,
  Step1ProjectFeature,
  Step2ProblemGoals,
  Step3UsersRequirements,
  Step4Technical,
  Step5Review,
} from "@/components/prd";
import { usePRDStore } from "@/stores/prdStore";
import { useProjectStore } from "@/stores/projectStore";
import { PRD_WIZARD_STEPS } from "@/types/prd";
import type { PRD, PRDStatus } from "@/types/prd";
import {
  exportPRDToMarkdown,
  downloadMarkdown,
  generateFilename,
} from "@/lib/markdown";
import { format } from "date-fns";

type ViewMode = "list" | "create";
type PrdTab = "active" | "implemented";

export function PrdPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeTab, setActiveTab] = useState<PrdTab>("active");
  const {
    prds,
    isLoaded,
    initialize: initializePRDs,
    currentStep,
    formData,
    setCurrentStep,
    nextStep,
    prevStep,
    resetForm,
    addPRD,
    deletePRD,
  } = usePRDStore();

  const { projects, initialize: initializeProjects } = useProjectStore();

  // Initialize stores
  useEffect(() => {
    initializePRDs();
    initializeProjects();
  }, [initializePRDs, initializeProjects]);

  const currentStepConfig = PRD_WIZARD_STEPS.find((s) => s.id === currentStep);
  const isStepComplete = currentStepConfig?.isComplete(formData) ?? false;
  const canProceed = currentStep < 5 ? isStepComplete : true;

  // Check if all required steps are complete
  const requiredComplete = PRD_WIZARD_STEPS.slice(0, 3).every((step) =>
    step.isComplete(formData)
  );

  const handleStartNew = () => {
    resetForm();
    setViewMode("create");
  };

  const handleCancel = () => {
    resetForm();
    setViewMode("list");
  };

  const handleSaveDraft = async () => {
    if (!formData.featureName) {
      toast.error("Please enter a feature name first");
      return;
    }

    const prdData: Omit<PRD, "id" | "createdAt" | "updatedAt"> = {
      projectId: formData.projectId,
      featureName: formData.featureName || "Untitled PRD",
      version: formData.version || "1.0",
      author: formData.author || "Justin",
      assignee: formData.assignee,
      area: formData.area || "personal",
      status: "draft" as PRDStatus,
      problemStatement: formData.problemStatement || "",
      goals: formData.goals || [],
      nonGoals: formData.nonGoals,
      targetUsers: formData.targetUsers || "",
      userStories: formData.userStories || [],
      requirements: formData.requirements || [],
      technicalApproach: formData.technicalApproach,
      dependencies: formData.dependencies,
      risks: formData.risks,
      assumptions: formData.assumptions,
      constraints: formData.constraints,
      successMetrics: formData.successMetrics,
      milestones: formData.milestones,
      estimatedEffort: formData.estimatedEffort,
    };

    const result = await addPRD(prdData);
    if (result) {
      toast.success("PRD draft saved!");
      resetForm();
      setViewMode("list");
    }
  };

  const handleGenerateAndSave = async () => {
    if (!requiredComplete) {
      toast.error("Please complete all required steps first");
      return;
    }

    const prdData: Omit<PRD, "id" | "createdAt" | "updatedAt"> = {
      projectId: formData.projectId,
      featureName: formData.featureName!,
      version: formData.version || "1.0",
      author: formData.author || "Justin",
      assignee: formData.assignee,
      area: formData.area || "personal",
      status: "draft" as PRDStatus,
      problemStatement: formData.problemStatement!,
      goals: formData.goals!,
      nonGoals: formData.nonGoals,
      targetUsers: formData.targetUsers!,
      userStories: formData.userStories!,
      requirements: formData.requirements!,
      technicalApproach: formData.technicalApproach,
      dependencies: formData.dependencies,
      risks: formData.risks,
      assumptions: formData.assumptions,
      constraints: formData.constraints,
      successMetrics: formData.successMetrics,
      milestones: formData.milestones,
      estimatedEffort: formData.estimatedEffort,
    };

    const result = await addPRD(prdData);
    if (result) {
      // Generate and download markdown
      const project = formData.projectId
        ? projects.find((p) => p.id === formData.projectId)
        : undefined;

      const markdown = exportPRDToMarkdown(result, { project });
      const filename = `PRD-${generateFilename(result.featureName)}`;
      downloadMarkdown(markdown, filename);

      toast.success("PRD created and downloaded!");
      resetForm();
      setViewMode("list");
    }
  };

  const handleExportPRD = (prd: PRD) => {
    const project = prd.projectId
      ? projects.find((p) => p.id === prd.projectId)
      : undefined;

    const markdown = exportPRDToMarkdown(prd, { project });
    const filename = `PRD-${generateFilename(prd.featureName)}`;
    downloadMarkdown(markdown, filename);
    toast.success(`Exported "${prd.featureName}" to markdown`);
  };

  const handleDeletePRD = async (prd: PRD) => {
    if (!confirm(`Delete PRD "${prd.featureName}"?`)) return;
    await deletePRD(prd.id);
    toast.success("PRD deleted");
  };

  const statusColors: Record<PRDStatus, string> = {
    draft: "bg-gray-500/10 text-gray-700 border-gray-200",
    review: "bg-blue-500/10 text-blue-700 border-blue-200",
    approved: "bg-green-500/10 text-green-700 border-green-200",
    in_progress: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    completed: "bg-purple-500/10 text-purple-700 border-purple-200",
    implemented: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1ProjectFeature />;
      case 2:
        return <Step2ProblemGoals />;
      case 3:
        return <Step3UsersRequirements />;
      case 4:
        return <Step4Technical />;
      case 5:
        return <Step5Review />;
      default:
        return null;
    }
  };

  // Filter PRDs based on active tab
  const activePrds = prds.filter((prd) => 
    ["draft", "review", "approved", "in_progress"].includes(prd.status)
  );
  const implementedPrds = prds.filter((prd) => 
    prd.status === "completed" || prd.status === "implemented"
  );
  const displayedPrds = activeTab === "active" ? activePrds : implementedPrds;

  // List View
  if (viewMode === "list") {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              PRD Creator
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create and manage Product Requirements Documents
            </p>
          </div>
          <Button onClick={handleStartNew} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New PRD
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PrdTab)}>
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <FileText className="h-4 w-4" />
              Active
              {activePrds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {activePrds.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="implemented" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Implemented
              {implementedPrds.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {implementedPrds.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* PRD List */}
        {!isLoaded ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : displayedPrds.length === 0 ? (
          <Card className="text-center">
            <CardContent className="pt-12 pb-12">
              {activeTab === "active" ? (
                <>
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active PRDs</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Create your first Product Requirements Document to get started.
                  </p>
                  <Button onClick={handleStartNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create PRD
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No implemented PRDs</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    PRDs will appear here when their linked tasks are completed.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {displayedPrds.map((prd) => {
              const project = prd.projectId
                ? projects.find((p) => p.id === prd.projectId)
                : null;

              return (
                <Card 
                  key={prd.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/prd/${prd.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base sm:text-lg leading-tight">
                          {prd.featureName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                          {project && (
                            <>
                              <span>{project.name}</span>
                              <span>•</span>
                            </>
                          )}
                          <span className="capitalize">{prd.area}</span>
                          <span>•</span>
                          <span>v{prd.version}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={statusColors[prd.status]}
                        >
                          {prd.status.replace("_", " ")}
                        </Badge>
                        {prd.assignee && (
                          <Badge variant="secondary" className="capitalize">
                            {prd.assignee}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs sm:text-sm">
                        <span>{prd.userStories?.length || 0} stories</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{prd.requirements?.length || 0} req.</span>
                        {prd.estimatedEffort && (
                          <>
                            <span className="hidden sm:inline">•</span>
                            <span className="text-xs">{prd.estimatedEffort}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPRD(prd)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeletePRD(prd)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {format(new Date(prd.createdAt), "MMM d, yyyy")}
                      {prd.updatedAt !== prd.createdAt && (
                        <> • Updated {format(new Date(prd.updatedAt), "MMM d, yyyy")}</>
                      )}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Create View (Wizard)
  return (
    <div className="space-y-6 pb-24 sm:pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Create PRD</h1>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of 5: {currentStepConfig?.title}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleCancel}>
          <List className="h-4 w-4 mr-2" />
          View All
        </Button>
      </div>

      {/* Wizard Steps Indicator */}
      <div className="pt-4 pb-8">
        <WizardSteps
          currentStep={currentStep}
          formData={formData}
          onStepClick={setCurrentStep}
        />
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">{renderStepContent()}</CardContent>
      </Card>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 md:left-64">
        <div className="flex gap-2">
          {currentStep > 1 && (
            <Button variant="outline" size="sm" onClick={prevStep} className="sm:size-default">
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {formData.featureName && (
            <Button variant="outline" size="sm" onClick={handleSaveDraft} className="sm:size-default">
              <Save className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Save Draft</span>
            </Button>
          )}

          {currentStep < 5 ? (
            <Button size="sm" onClick={nextStep} disabled={!canProceed} className="sm:size-default">
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="h-4 w-4 sm:ml-2" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleGenerateAndSave} disabled={!requiredComplete} className="sm:size-default">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Generate PRD</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
