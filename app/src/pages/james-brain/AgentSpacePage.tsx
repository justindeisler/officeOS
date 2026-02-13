/**
 * Agent Space Page
 * Browse all agents, their profiles, and files
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Hash,
  Loader2,
  Lock,
  Search,
  Shield,
  BookOpen,
  GraduationCap,
  Brain,
  Briefcase,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import { api } from "@/lib/api";
import type { AgentInfo, AgentFileInfo } from "@/types";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  persona: { icon: Shield, label: "Persona", color: "text-blue-500" },
  learning: { icon: GraduationCap, label: "Learning System", color: "text-purple-500" },
  memory: { icon: Brain, label: "Memory", color: "text-amber-500" },
  specialist: { icon: Briefcase, label: "Specialist Docs", color: "text-emerald-500" },
};

// Views: grid → profile → file
type View = "grid" | "profile" | "file";

export function AgentSpacePage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<(AgentInfo & { files?: AgentFileInfo[] }) | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ content: string; title: string; category: string; name: string; encrypted: boolean } | null>(null);
  const [view, setView] = useState<View>("grid");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getAgents();
      setAgents(result.agents);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Failed to load agents.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAgentProfile = async (agent: AgentInfo) => {
    try {
      setIsLoadingProfile(true);
      const detail = await api.getAgentDetail(agent.id);
      setSelectedAgent({
        ...agent,
        ...detail,
        files: detail.files as AgentFileInfo[],
      });
      setView("profile");
    } catch (err) {
      console.error("Failed to load agent profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadFile = async (agentId: string, file: AgentFileInfo) => {
    try {
      setIsLoadingFile(true);
      const result = await api.getAgentFileContent(agentId, file.category, file.name);
      setSelectedFile({
        content: result.content,
        title: result.title,
        category: file.category,
        name: file.name,
        encrypted: result.encrypted,
      });
      setView("file");
    } catch (err) {
      console.error("Failed to load file:", err);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const navigateBack = () => {
    if (view === "file") {
      setSelectedFile(null);
      setView("profile");
    } else if (view === "profile") {
      setSelectedAgent(null);
      setView("grid");
    }
  };

  // Filter files by search
  const filteredFiles = useMemo(() => {
    if (!selectedAgent?.files) return [];
    if (!searchQuery.trim()) return selectedAgent.files;
    const q = searchQuery.toLowerCase();
    return selectedAgent.files.filter(
      f => f.name.toLowerCase().includes(q) || f.title.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  }, [selectedAgent?.files, searchQuery]);

  // Group files by category
  const groupedFiles = useMemo(() => {
    const groups: Record<string, AgentFileInfo[]> = {};
    for (const file of filteredFiles) {
      if (!groups[file.category]) groups[file.category] = [];
      groups[file.category].push(file);
    }
    return groups;
  }, [filteredFiles]);

  // Breadcrumb
  const breadcrumb = useMemo(() => {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: "Agent Space", onClick: () => { setView("grid"); setSelectedAgent(null); setSelectedFile(null); } },
    ];
    if (selectedAgent) {
      parts.push({
        label: `${selectedAgent.emoji} ${selectedAgent.name}`,
        onClick: view === "file" ? () => { setView("profile"); setSelectedFile(null); } : undefined,
      });
    }
    if (selectedFile) {
      parts.push({ label: selectedFile.name });
    }
    return parts;
  }, [selectedAgent, selectedFile, view]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== "grid" && (
            <Button variant="ghost" size="icon" onClick={navigateBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm">
                {breadcrumb.map((part, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {part.onClick ? (
                      <button onClick={part.onClick} className="text-muted-foreground hover:text-foreground transition-colors">
                        {part.label}
                      </button>
                    ) : (
                      <span className="font-medium">{part.label}</span>
                    )}
                  </span>
                ))}
              </div>
              {view === "grid" && (
                <p className="text-xs text-muted-foreground">{agents.length} agents in your team</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {view === "grid" && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <AgentGrid
              agents={agents}
              isLoading={isLoading}
              error={error}
              isLoadingProfile={isLoadingProfile}
              onSelectAgent={loadAgentProfile}
              onRetry={loadAgents}
            />
          </motion.div>
        )}

        {view === "profile" && selectedAgent && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <AgentProfile
              agent={selectedAgent}
              groupedFiles={groupedFiles}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSelectFile={(file) => loadFile(selectedAgent.id, file)}
              isLoadingFile={isLoadingFile}
            />
          </motion.div>
        )}

        {view === "file" && selectedFile && selectedAgent && (
          <motion.div
            key="file"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <FileViewer file={selectedFile} agent={selectedAgent} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Agent Grid
// ============================================

function AgentGrid({
  agents,
  isLoading,
  error,
  isLoadingProfile,
  onSelectAgent,
  onRetry,
}: {
  agents: AgentInfo[];
  isLoading: boolean;
  error: string | null;
  isLoadingProfile: boolean;
  onSelectAgent: (agent: AgentInfo) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Bot className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {agents.map((agent) => (
        <motion.div
          key={agent.id}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          <Card
            className="cursor-pointer hover:border-primary/30 transition-all duration-200 group relative overflow-hidden"
            onClick={() => onSelectAgent(agent)}
          >
            {/* Status indicator bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ backgroundColor: agent.status === "active" ? agent.color : "transparent" }}
            />

            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="text-3xl p-2 rounded-xl"
                  style={{ backgroundColor: `${agent.color}15` }}
                >
                  {agent.emoji}
                </div>
                <Badge
                  variant={agent.status === "active" ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    agent.status === "active" && "bg-green-500/10 text-green-600 border-green-500/20"
                  )}
                >
                  {agent.status === "active" ? "● Active" : "○ Idle"}
                </Badge>
              </div>

              <h3 className="font-semibold text-lg mb-0.5">{agent.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{agent.role}</p>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  <span>{agent.sessionCount} sessions</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{agent.fileCount} files</span>
                </div>
              </div>

              {agent.lastActivity && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(agent.lastActivity), { addSuffix: true })}
                </p>
              )}

              {/* Hover arrow */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                {isLoadingProfile ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// Agent Profile
// ============================================

function AgentProfile({
  agent,
  groupedFiles,
  searchQuery,
  onSearchChange,
  onSelectFile,
  isLoadingFile,
}: {
  agent: AgentInfo & { files?: AgentFileInfo[] };
  groupedFiles: Record<string, AgentFileInfo[]>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectFile: (file: AgentFileInfo) => void;
  isLoadingFile: boolean;
}) {
  const totalFiles = agent.files?.length || 0;

  return (
    <div className="space-y-6">
      {/* Agent header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div
              className="text-4xl p-3 rounded-2xl shrink-0"
              style={{ backgroundColor: `${agent.color}15` }}
            >
              {agent.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-semibold">{agent.name}</h2>
                <Badge
                  variant={agent.status === "active" ? "default" : "secondary"}
                  className={cn(
                    "text-xs",
                    agent.status === "active" && "bg-green-500/10 text-green-600 border-green-500/20"
                  )}
                >
                  {agent.status === "active" ? "● Active" : "○ Idle"}
                </Badge>
              </div>
              <p className="text-muted-foreground">{agent.role}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4" />
                  {agent.sessionCount} sessions
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {totalFiles} files
                </span>
                {agent.lastActivity && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Active {formatDistanceToNow(new Date(agent.lastActivity), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* File categories */}
      <div className="space-y-6">
        {Object.entries(groupedFiles).map(([category, files]) => {
          const config = CATEGORY_CONFIG[category] || {
            icon: FileText,
            label: category,
            color: "text-foreground",
          };
          const CategoryIcon = config.icon;

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <CategoryIcon className={cn("h-5 w-5", config.color)} />
                <h3 className="font-semibold">{config.label}</h3>
                <Badge variant="secondary" className="text-xs">{files.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((file) => (
                  <motion.div
                    key={`${file.category}-${file.name}`}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-primary/30 transition-all duration-200 group"
                      onClick={() => onSelectFile(file)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">
                                {file.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {file.name}
                            </p>
                          </div>
                          {file.encrypted && (
                            <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>{format(new Date(file.lastModified), "MMM d, yyyy")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}

        {Object.keys(groupedFiles).length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "No files match your search" : "No files found for this agent"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// File Viewer
// ============================================

function FileViewer({
  file,
  agent,
}: {
  file: { content: string; title: string; category: string; name: string; encrypted: boolean };
  agent: AgentInfo;
}) {
  const config = CATEGORY_CONFIG[file.category] || { icon: FileText, label: file.category, color: "text-foreground" };

  return (
    <div className="space-y-4">
      {/* File header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="text-2xl p-2 rounded-xl shrink-0"
              style={{ backgroundColor: `${agent.color}15` }}
            >
              {agent.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold truncate">{file.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{file.name}</span>
                {file.encrypted && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="h-3 w-3 mr-1" />
                    Encrypted
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File content */}
      <Card>
        <CardContent className="p-6 md:p-8">
          <MarkdownRenderer content={file.content} />
        </CardContent>
      </Card>
    </div>
  );
}
