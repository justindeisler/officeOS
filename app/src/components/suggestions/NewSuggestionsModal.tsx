/**
 * NewSuggestionsModal — Generate AI-powered improvement suggestions
 *
 * Opens a modal with two tabs (PA Projects / GitHub Projects),
 * lets the user pick a project, optionally enable Deep Mode,
 * then generates 3 suggestions via the backend.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  Github,
  FolderOpen,
  AlertCircle,
  Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PAProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  area: string;
  /** Resolved local path for analysis */
  path?: string;
}

interface GitHubRepo {
  name: string;
  description: string;
  url: string;
  updatedAt: string;
}

interface NewSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/* ------------------------------------------------------------------ */
/*  Known project path mappings (PA projects → local disk)             */
/* ------------------------------------------------------------------ */

const PROJECT_PATHS: Record<string, string> = {
  "32b4b44b-a6f9-46c1-bc56-0ec819d766a1": "~/projects/personal-assistant",
  "974c45ac-82f0-4e66-9403-94071d9da454": "~/projects/wellfy",
  "wellfy-lms": "~/projects/wellfy",
  "aba3c4c3-cdaa-466c-a7f3-210f70dbb852": "~/projects/backend-diabetesnotes",
  "022d19f7-e15d-4c65-ba85-528033ab5d44": "~/projects/dot1",
  "6fa57ff7-547a-48b7-bff9-cf27c333fc82": "~/projects/supplement-webshop",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NewSuggestionsModal({
  isOpen,
  onClose,
  onSuccess,
}: NewSuggestionsModalProps) {
  const [activeTab, setActiveTab] = useState<string>("pa-projects");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const [paProjects, setPaProjects] = useState<PAProject[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [paLoading, setPaLoading] = useState(false);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghMessage, setGhMessage] = useState<string | null>(null);

  /* ---- Fetch data when modal opens ---- */

  const fetchPAProjects = useCallback(async () => {
    setPaLoading(true);
    try {
      const data = (await api.getProjects()) as PAProject[];
      // Only show active projects
      const active = data.filter(
        (p) => p.status === "active" || p.status === "pipeline"
      );
      setPaProjects(active);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setPaLoading(false);
    }
  }, []);

  const fetchGitHubRepos = useCallback(async () => {
    setGhLoading(true);
    setGhMessage(null);
    try {
      const data = await api.getGitHubRepos();
      setGithubRepos(data.repos || []);
      if (data.message && (!data.repos || data.repos.length === 0)) {
        setGhMessage(data.message);
      }
    } catch {
      setGhMessage("Failed to fetch GitHub repos");
    } finally {
      setGhLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPAProjects();
      fetchGitHubRepos();
      setSelectedProject(null);
      setDeepMode(false);
      setProgress(null);
    }
  }, [isOpen, fetchPAProjects, fetchGitHubRepos]);

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedProject(null);
  }, [activeTab]);

  /* ---- Helpers ---- */

  function getProjectName(): string {
    if (activeTab === "pa-projects") {
      return paProjects.find((p) => p.id === selectedProject)?.name ?? "Unknown";
    }
    return selectedProject ?? "Unknown";
  }

  function getProjectPath(): string | undefined {
    if (activeTab === "pa-projects" && selectedProject) {
      return PROJECT_PATHS[selectedProject];
    }
    return undefined;
  }

  /* ---- Generate ---- */

  const handleGenerate = async () => {
    if (!selectedProject) return;

    setIsGenerating(true);
    setProgress("Analyzing project...");

    try {
      // Update progress after a short delay
      const progressTimer = setTimeout(() => {
        setProgress("Generating suggestions with AI...");
      }, 3000);

      const result = await api.generateSuggestions({
        source: activeTab === "pa-projects" ? "pa-project" : "github",
        projectId: selectedProject,
        projectName: getProjectName(),
        projectPath: getProjectPath(),
        deepMode,
        count: 3,
      });

      clearTimeout(progressTimer);

      if (result.success) {
        const duration = result.duration
          ? ` in ${(result.duration / 1000).toFixed(1)}s`
          : "";
        toast.success(`Generated 3 suggestions for ${getProjectName()}${duration}`);
        onSuccess();
        onClose();
      } else {
        toast.error("Generation failed. Try again.");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      if (errMsg.includes("504") || errMsg.includes("timed out")) {
        toast.error("Generation took too long. Try without Deep Mode.");
      } else {
        toast.error(`Failed to generate suggestions: ${errMsg}`);
      }
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  /* ---- Render ---- */

  const ProjectRadio = ({
    id,
    name,
    description,
    extra,
  }: {
    id: string;
    name: string;
    description?: string | null;
    extra?: string;
  }) => (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
        selectedProject === id
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:bg-muted/50"
      )}
    >
      <input
        type="radio"
        name="project-select"
        value={id}
        checked={selectedProject === id}
        onChange={() => setSelectedProject(id)}
        className="mt-1 h-4 w-4 accent-primary"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          {extra && (
            <span className="text-xs text-muted-foreground">{extra}</span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </label>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isGenerating && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate New Suggestions
          </DialogTitle>
          <DialogDescription>
            Select a project to analyze and generate 3 AI-powered improvement suggestions.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pa-projects" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              PA Projects
            </TabsTrigger>
            <TabsTrigger value="github" className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </TabsTrigger>
          </TabsList>

          {/* PA Projects Tab */}
          <TabsContent value="pa-projects" className="mt-3">
            {paLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : paProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No active projects found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {paProjects.map((project) => (
                  <ProjectRadio
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    description={project.description}
                    extra={PROJECT_PATHS[project.id] ? "📁" : undefined}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* GitHub Tab */}
          <TabsContent value="github" className="mt-3">
            {ghLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : ghMessage && githubRepos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>{ghMessage}</p>
              </div>
            ) : githubRepos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No repos found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {githubRepos.map((repo) => (
                  <ProjectRadio
                    key={repo.name}
                    id={repo.name}
                    name={repo.name}
                    description={repo.description || null}
                    extra={new Date(repo.updatedAt).toLocaleDateString()}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Deep Mode Checkbox */}
        <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={deepMode}
            onChange={(e) => setDeepMode(e.target.checked)}
            disabled={isGenerating}
            className="h-4 w-4 rounded accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            Deep Mode
            <span className="ml-1 text-xs opacity-75">
              (slower, more detailed analysis)
            </span>
          </span>
        </label>

        {/* Progress Indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            <span className="text-sm text-primary">{progress}</span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!selectedProject || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate (3)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
