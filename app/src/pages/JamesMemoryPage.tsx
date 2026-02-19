import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  FileText,
  Lock,
  Unlock,
  ChevronRight,
  Shield,
  AlertTriangle,
  CheckCircle,
  Brain,
  Save,
  X,
  Tag,
  Share2,
  ArrowLeft,
  RefreshCw,
  Pencil,
  Eye,
  HardDrive,
  Activity,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  MemoryAgent,
  MemoryFile,
  MemoryHealthReport,
  MemorySearchResult,
} from "@/lib/api";

// Animation easing from design system
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Agent tab config
const AGENT_TABS = [
  { id: "james", label: "James", emoji: "🔧" },
  { id: "markus", label: "Markus", emoji: "⚙️" },
  { id: "rocky", label: "Rocky", emoji: "💼" },
  { id: "prof", label: "Prof", emoji: "🔍" },
] as const;

// Tier config
const TIER_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Tier 1 — Core", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  2: { label: "Tier 2 — Active", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  3: { label: "Tier 3 — Archive", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  "core": "🧠 Core Identity",
  "learning": "📚 Learning & Growth",
  "daily-notes": "📅 Daily Notes",
  "journal": "📓 Journal",
  "research": "🔬 Research",
  "decisions": "⚖️ Decisions",
  "specs": "📋 Specs",
  "drafts": "✏️ Drafts",
  "second-brain": "🧠 Second Brain",
  "persona": "👤 Persona",
  "config": "⚙️ Configuration",
  "other": "📄 Other",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// Custom hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export function JamesMemoryPage() {
  const [agents, setAgents] = useState<MemoryAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("james");
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [healthReport, setHealthReport] = useState<MemoryHealthReport | null>(null);

  // Editor state
  const [editingFile, setEditingFile] = useState<MemoryFile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemorySearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // View mode for mobile
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const isMobile = useIsMobile();

  // Show health panel
  const [showHealth, setShowHealth] = useState(false);

  // ─── Data Loading ───────────────────────────────────────────────

  const loadAgents = useCallback(async () => {
    try {
      const data = await api.getMemoryAgents();
      setAgents(data);
    } catch (e) {
      toast.error("Failed to load agents");
      console.error(e);
    }
  }, []);

  const loadFiles = useCallback(async (agentId: string) => {
    setIsLoadingFiles(true);
    try {
      const data = await api.getMemoryFiles(agentId);
      setFiles(data.files);
    } catch (e) {
      toast.error("Failed to load files");
      console.error(e);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getMemoryHealth();
      setHealthReport(data);
    } catch (e) {
      console.error("Failed to load health:", e);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadAgents(), loadFiles("james"), loadHealth()]);
      setIsLoading(false);
    };
    init();
  }, [loadAgents, loadFiles, loadHealth]);

  useEffect(() => {
    if (!isLoading) {
      loadFiles(selectedAgent);
    }
  }, [selectedAgent, loadFiles, isLoading]);

  // ─── Search ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchMemory(searchQuery);
        setSearchResults(results);
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── File Operations ────────────────────────────────────────────

  const openEditor = async (file: MemoryFile) => {
    setEditingFile(file);
    setIsLoadingContent(true);
    setHasChanges(false);
    if (isMobile) setMobileView("editor");

    try {
      const data = await api.getMemoryFileContent(selectedAgent, file.path);
      setEditContent(data.content);
    } catch (e) {
      toast.error("Failed to load file content");
      console.error(e);
      setEditContent("# Error loading file\n\nCould not read file content.");
    } finally {
      setIsLoadingContent(false);
    }
  };

  const saveFile = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    try {
      await api.updateMemoryFileContent(selectedAgent, editingFile.path, editContent);
      toast.success("File saved");
      setHasChanges(false);
      // Refresh file list to update sizes
      loadFiles(selectedAgent);
    } catch (e) {
      toast.error("Failed to save file");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const closeEditor = () => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard?")) return;
    }
    setEditingFile(null);
    setEditContent("");
    setHasChanges(false);
    if (isMobile) setMobileView("list");
  };

  const updateTier = async (file: MemoryFile, tier: number) => {
    try {
      await api.updateMemoryFileMetadata(selectedAgent, {
        path: file.path,
        tier: tier as 1 | 2 | 3,
      });
      toast.success(`Updated to ${TIER_CONFIG[tier].label}`);
      loadFiles(selectedAgent);
      loadAgents();
    } catch (e) {
      toast.error("Failed to update tier");
      console.error(e);
    }
  };

  // ─── Derived Data ───────────────────────────────────────────────

  const currentAgent = agents.find((a) => a.id === selectedAgent);

  const filesByTier = useMemo(() => {
    const grouped: Record<number, MemoryFile[]> = { 1: [], 2: [], 3: [] };
    for (const f of files) {
      if (grouped[f.tier]) {
        grouped[f.tier].push(f);
      } else {
        grouped[2].push(f);
      }
    }
    return grouped;
  }, [files]);

  const agentHealth = healthReport?.agents.find((a) => a.agent === selectedAgent);

  // ─── Render ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Agent Memory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            View, track, and edit the knowledge system of all AI agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showHealth ? "default" : "outline"}
            size="sm"
            onClick={() => setShowHealth(!showHealth)}
          >
            <Activity className="h-4 w-4 mr-1" />
            Health
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadAgents();
              loadFiles(selectedAgent);
              loadHealth();
              toast.success("Refreshed");
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agent Tabs */}
      <div className="flex gap-2 border-b pb-0">
        {AGENT_TABS.map((tab) => {
          const agent = agents.find((a) => a.id === tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedAgent(tab.id);
                setEditingFile(null);
                if (isMobile) setMobileView("list");
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors -mb-px",
                selectedAgent === tab.id
                  ? "bg-background text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
              )}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
              {agent && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {agent.entryCount}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Agent Stats Row */}
      {currentAgent && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="col-span-1">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="text-3xl">{currentAgent.emoji}</div>
              <div>
                <div className="text-sm font-medium">{currentAgent.name}</div>
                <div className="text-xs text-muted-foreground">
                  {currentAgent.entryCount} files
                </div>
              </div>
            </CardContent>
          </Card>
          {[1, 2, 3].map((tier) => (
            <Card key={tier}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">
                  {TIER_CONFIG[tier].label}
                </div>
                <div className={cn("text-xl font-semibold", TIER_CONFIG[tier].color)}>
                  {currentAgent.tierBreakdown[String(tier)] || 0}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">Health</div>
              <div
                className={cn(
                  "text-xl font-semibold",
                  currentAgent.healthScore >= 80
                    ? "text-green-500"
                    : currentAgent.healthScore >= 50
                    ? "text-amber-500"
                    : "text-red-500"
                )}
              >
                {currentAgent.healthScore}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Panel */}
      <AnimatePresence>
        {showHealth && healthReport && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <HealthPanel report={healthReport} selectedAgent={selectedAgent} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search across all agent memory files..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults && (
        <SearchResultsPanel
          results={searchResults}
          onOpenFile={(agentId, filePath) => {
            setSelectedAgent(agentId);
            const file = files.find((f) => f.path === filePath);
            if (file) {
              openEditor(file);
            } else {
              // Load the agent's files first, then open
              loadFiles(agentId).then(() => {
                openEditor({
                  path: filePath,
                  name: filePath.split("/").pop() || filePath,
                  size: 0,
                  lastModified: "",
                  exists: true,
                  encrypted: false,
                  tier: 2,
                  label: null,
                  description: null,
                  tags: [],
                  isShared: false,
                  category: "other",
                });
              });
            }
          }}
          onClear={() => {
            setSearchQuery("");
            setSearchResults(null);
          }}
        />
      )}

      {/* Main Content */}
      {!searchResults && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
          {/* File Browser (left panel) */}
          {(!isMobile || mobileView === "list") && (
            <div className="space-y-4">
              {isLoadingFiles ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : (
                [1, 2, 3].map((tier) => {
                  const tierFiles = filesByTier[tier];
                  if (!tierFiles?.length) return null;
                  return (
                    <TierGroup
                      key={tier}
                      tier={tier}
                      files={tierFiles}
                      selectedFile={editingFile}
                      onSelectFile={openEditor}
                      onChangeTier={updateTier}
                    />
                  );
                })
              )}
              {!isLoadingFiles && files.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <HardDrive className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No memory files found for this agent</p>
                </div>
              )}
            </div>
          )}

          {/* Editor Panel (right panel) */}
          {(!isMobile || mobileView === "editor") && (
            <div className="lg:sticky lg:top-6 lg:self-start">
              {editingFile ? (
                <FileEditorPanel
                  file={editingFile}
                  content={editContent}
                  isLoading={isLoadingContent}
                  isSaving={isSaving}
                  hasChanges={hasChanges}
                  onContentChange={(c) => {
                    setEditContent(c);
                    setHasChanges(true);
                  }}
                  onSave={saveFile}
                  onClose={closeEditor}
                  isMobile={isMobile}
                />
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Eye className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Select a file to view or edit</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function TierGroup({
  tier,
  files,
  selectedFile,
  onSelectFile,
  onChangeTier,
}: {
  tier: number;
  files: MemoryFile[];
  selectedFile: MemoryFile | null;
  onSelectFile: (f: MemoryFile) => void;
  onChangeTier: (f: MemoryFile, tier: number) => void;
}) {
  const config = TIER_CONFIG[tier];

  // Group files by category
  const byCategory = useMemo(() => {
    const groups = new Map<string, MemoryFile[]>();
    for (const f of files) {
      const cat = f.category || "other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(f);
    }
    return groups;
  }, [files]);

  return (
    <div className={cn("rounded-lg border p-3", config.bg)}>
      <div className="flex items-center gap-2 mb-3">
        <Shield className={cn("h-4 w-4", config.color)} />
        <h3 className={cn("text-sm font-semibold", config.color)}>
          {config.label}
        </h3>
        <Badge variant="outline" className="text-xs ml-auto">
          {files.length} {files.length === 1 ? "file" : "files"}
        </Badge>
      </div>
      <div className="space-y-1">
        {Array.from(byCategory.entries()).map(([cat, catFiles]) => (
          <div key={cat}>
            {byCategory.size > 1 && (
              <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
                {CATEGORY_LABELS[cat] || cat}
              </div>
            )}
            {catFiles.map((file) => (
              <FileRow
                key={file.path}
                file={file}
                isSelected={selectedFile?.path === file.path}
                onClick={() => onSelectFile(file)}
                onChangeTier={(t) => onChangeTier(file, t)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FileRow({
  file,
  isSelected,
  onClick,
  onChangeTier,
}: {
  file: MemoryFile;
  isSelected: boolean;
  onClick: () => void;
  onChangeTier: (tier: number) => void;
}) {
  return (
    <motion.button
      layout
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
        isSelected
          ? "bg-primary/10 text-primary border border-primary/20"
          : "hover:bg-background/60"
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {file.encrypted ? (
          <Lock className="h-4 w-4 text-amber-500" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Name + Label */}
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">
          {file.label || file.name}
        </div>
        {file.label && (
          <div className="text-xs text-muted-foreground truncate">{file.name}</div>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {file.isShared && (
          <Share2 className="h-3 w-3 text-blue-500" />
        )}
        {file.exists && (
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
        )}
        {!file.exists && (
          <Badge variant="destructive" className="text-xs">
            Missing
          </Badge>
        )}

        {/* Tier quick-change (stop propagation) */}
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            value={String(file.tier)}
            onValueChange={(v) => onChangeTier(Number(v))}
          >
            <SelectTrigger className="h-6 w-16 text-xs border-0 bg-transparent px-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">T1</SelectItem>
              <SelectItem value="2">T2</SelectItem>
              <SelectItem value="3">T3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </motion.button>
  );
}

function FileEditorPanel({
  file,
  content,
  isLoading,
  isSaving,
  hasChanges,
  onContentChange,
  onSave,
  onClose,
  isMobile,
}: {
  file: MemoryFile;
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={onClose} className="flex-shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0">
              <CardTitle className="text-base truncate flex items-center gap-2">
                {file.encrypted ? (
                  <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                  <Unlock className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                {file.label || file.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {file.path}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasChanges && (
              <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                Unsaved
              </Badge>
            )}
            <Button
              size="sm"
              onClick={onSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
            {!isMobile && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* File metadata */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant="secondary" className={cn("text-xs", TIER_CONFIG[file.tier]?.color)}>
            {TIER_CONFIG[file.tier]?.label || "Unknown Tier"}
          </Badge>
          {file.encrypted && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Encrypted
            </Badge>
          )}
          {file.lastModified && (
            <span className="text-xs text-muted-foreground">
              Modified {formatDistanceToNow(new Date(file.lastModified), { addSuffix: true })}
            </span>
          )}
          {file.tags.length > 0 && file.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-[300px] w-full mt-4" />
          </div>
        ) : (
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="font-mono text-sm min-h-[400px] lg:min-h-[500px] resize-y"
            placeholder="File content..."
          />
        )}
      </CardContent>
    </Card>
  );
}

function HealthPanel({
  report,
  selectedAgent,
}: {
  report: MemoryHealthReport;
  selectedAgent: string;
}) {
  const agentReport = report.agents.find((a) => a.agent === selectedAgent);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Health Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* All agents overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {report.agents.map((a) => {
            const agentConfig = AGENT_TABS.find((t) => t.id === a.agent);
            return (
              <div
                key={a.agent}
                className={cn(
                  "rounded-lg border p-3 text-center",
                  a.agent === selectedAgent && "ring-2 ring-primary"
                )}
              >
                <div className="text-lg">{agentConfig?.emoji}</div>
                <div
                  className={cn(
                    "text-xl font-bold",
                    a.score >= 80
                      ? "text-green-500"
                      : a.score >= 50
                      ? "text-amber-500"
                      : "text-red-500"
                  )}
                >
                  {a.score}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.fileCount} files
                </div>
              </div>
            );
          })}
        </div>

        {/* Warnings for selected agent */}
        {agentReport && agentReport.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Warnings</h4>
            {agentReport.warnings.map((w, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 text-sm rounded-md px-3 py-2",
                  w.severity === "high"
                    ? "bg-red-500/10 text-red-500"
                    : w.severity === "medium"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {w.severity === "high" ? (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                )}
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {agentReport && agentReport.warnings.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle className="h-4 w-4" />
            All clear — no warnings for this agent
          </div>
        )}

        {/* Cross-agent duplicates */}
        {report.duplicates.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">Cross-Agent Duplicates</h4>
            {report.duplicates.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm bg-muted rounded-md px-3 py-2 text-muted-foreground"
              >
                <Share2 className="h-4 w-4 flex-shrink-0" />
                <span>{d.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SearchResultsPanel({
  results,
  onOpenFile,
  onClear,
}: {
  results: MemorySearchResult;
  onOpenFile: (agentId: string, filePath: string) => void;
  onClear: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Search Results — {results.resultCount} matches for "{results.query}"
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {results.results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No matches found
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.results.map((r, i) => {
              const agentConfig = AGENT_TABS.find((t) => t.id === r.agentId);
              return (
                <button
                  key={i}
                  onClick={() => onOpenFile(r.agentId, r.filePath)}
                  className="w-full text-left rounded-md border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{agentConfig?.emoji}</span>
                    <span className="text-sm font-medium">{r.fileName}</span>
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {r.matchCount} {r.matchCount === 1 ? "match" : "matches"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {r.snippet}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
