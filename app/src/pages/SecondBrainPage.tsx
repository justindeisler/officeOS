import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  Brain,
  BookOpen,
  Lightbulb,
  GitFork,
  FolderKanban,
  Calendar,
  X,
  Microscope,
  ArrowLeft,
  MessageSquare,
  Activity,
  Tag,
  Filter,
  Link2,
  User,
  Bot as BotIcon,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { MarkdownRenderer } from "@/components/shared/MarkdownRenderer";
import type {
  SecondBrainDocument,
  SecondBrainFolder,
  BrainSearchResult,
  BrainActivity,
  ConversationSession,
  ConversationMessage,
} from "@/types";

// Animation easing from design system
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// Folder icons and display names
const FOLDER_CONFIG: Record<string, { icon: React.ElementType; label: string; description: string }> = {
  "": { icon: FileText, label: "Root", description: "Top-level documents" },
  journal: { icon: Calendar, label: "Journal", description: "Daily entries and reflections" },
  concepts: { icon: Lightbulb, label: "Concepts", description: "Deep dives into topics" },
  decisions: { icon: GitFork, label: "Decisions", description: "Important decisions with context" },
  projects: { icon: FolderKanban, label: "Projects", description: "Project documentation" },
  research: { icon: Microscope, label: "Research", description: "Research notes and explorations" },
};

// Custom hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

// ============================================
// Main Page
// ============================================

export function SecondBrainPage() {
  const [folders, setFolders] = useState<SecondBrainFolder[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SecondBrainDocument | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [universalResults, setUniversalResults] = useState<BrainSearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["journal", "concepts", "decisions", "projects", "research"]));
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("documents");

  // Activity state
  const [activities, setActivities] = useState<BrainActivity[]>([]);
  const [activityDays, setActivityDays] = useState(7);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Conversations state
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [conversationAgents, setConversationAgents] = useState<string[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<{ messages: ConversationMessage[]; agent: string; id: string } | null>(null);
  const [isLoadingConvos, setIsLoadingConvos] = useState(false);
  const [convoFilter, setConvoFilter] = useState<string>("");
  const [convoError, setConvoError] = useState<string | null>(null);

  // Rate limit protection: track last fetch time and prevent retry storms
  const convoFetchRef = useRef<{ lastFetch: number; inFlight: boolean; rateLimitedUntil: number }>({
    lastFetch: 0,
    inFlight: false,
    rateLimitedUntil: 0,
  });

  // Type filter for documents
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Mobile view state
  const [mobileView, setMobileView] = useState<'list' | 'document'>('list');
  const isMobile = useIsMobile();

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Universal search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setUniversalResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const sourceFilter = activeTab === "documents" ? "documents" : activeTab === "conversations" ? "conversation" : undefined;
        const result = await api.searchBrain(searchQuery, sourceFilter);
        setUniversalResults(result.results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Load activity when tab switches
  useEffect(() => {
    if (activeTab === "activity") {
      loadActivity();
    } else if (activeTab === "conversations") {
      loadConversations();
    }
  }, [activeTab]); // Note: activityDays handled separately to avoid scroll reset

  // Reload activity when days filter changes (separate to preserve scroll position)
  const prevActivityDaysRef = useRef(activityDays);
  useEffect(() => {
    if (prevActivityDaysRef.current !== activityDays) {
      prevActivityDaysRef.current = activityDays;
      if (activeTab === "activity") {
        loadActivity();
      }
    }
  }, [activityDays, activeTab]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getSecondBrainDocuments();
      setFolders(result.folders);

      if (!isMobile) {
        const firstDoc = result.folders.flatMap(f => f.documents)[0];
        if (firstDoc) {
          await loadDocument(firstDoc, false);
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents. Make sure the API server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDocument = async (doc: SecondBrainDocument, switchToDocView = true) => {
    try {
      setIsLoadingDoc(true);
      const result = await api.getSecondBrainDocument(doc.path);
      setSelectedDoc({ ...doc, content: result.content });
      setDocContent(result.content);
      setSelectedConvo(null);

      if (switchToDocView && isMobile) {
        setMobileView('document');
      }
    } catch (err) {
      console.error("Failed to load document:", err);
      setDocContent("# Error\n\nFailed to load document content.");
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const loadActivity = async () => {
    try {
      setIsLoadingActivity(true);
      const result = await api.getBrainActivity(activityDays);
      setActivities(result.activities);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const loadConversations = useCallback(async (force = false) => {
    const ref = convoFetchRef.current;
    const now = Date.now();

    // Prevent concurrent fetches
    if (ref.inFlight) return;

    // Respect rate limit backoff
    if (!force && now < ref.rateLimitedUntil) {
      console.log(`[SecondBrain] Rate limited, retry after ${Math.ceil((ref.rateLimitedUntil - now) / 1000)}s`);
      return;
    }

    // Debounce: don't fetch more than once per 2 seconds
    if (!force && now - ref.lastFetch < 2000) return;

    try {
      ref.inFlight = true;
      ref.lastFetch = now;
      setIsLoadingConvos(true);
      setConvoError(null);
      const result = await api.getConversations({ agent: convoFilter || undefined, limit: 50 });
      setConversations(result.sessions);
      setConversationAgents(result.agents);
    } catch (err: unknown) {
      console.error("Failed to load conversations:", err);
      // Handle 429 rate limit — back off and don't retry
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429) {
        ref.rateLimitedUntil = Date.now() + 30000; // Back off 30 seconds
        setConvoError("Too many requests. Will retry automatically in 30 seconds.");
        // Auto-retry after backoff
        setTimeout(() => {
          if (convoFetchRef.current.rateLimitedUntil <= Date.now()) {
            loadConversations(true);
          }
        }, 31000);
      } else {
        setConvoError("Failed to load conversations. Click retry to try again.");
      }
    } finally {
      ref.inFlight = false;
      setIsLoadingConvos(false);
    }
  }, [convoFilter]);

  const loadConversationTranscript = async (session: ConversationSession) => {
    try {
      setIsLoadingDoc(true);
      const result = await api.getConversationTranscript(session.agent, session.id);
      setSelectedConvo({
        messages: result.messages,
        agent: session.agent,
        id: session.id,
      });
      setSelectedDoc(null);
      setDocContent("");

      if (isMobile) {
        setMobileView('document');
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleBackToList = () => {
    setMobileView('list');
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setUniversalResults(null);
  };

  // Filter folders by type
  const displayedFolders = useMemo(() => {
    let foldersToShow = folders;

    if (typeFilter !== "all") {
      foldersToShow = folders.filter(f => f.name === typeFilter);
    }

    if (universalResults && activeTab === "documents") {
      const grouped: Record<string, SecondBrainDocument[]> = {};
      for (const r of universalResults) {
        if (r.type !== "document") continue;
        const folder = r.source === "root" ? "" : r.source;
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push({
          path: r.path,
          name: r.path.split("/").pop() || r.path,
          title: r.title,
          folder,
          lastModified: r.lastModified,
        });
      }
      return Object.entries(grouped).map(([name, documents]) => ({ name, documents }));
    }

    return foldersToShow;
  }, [folders, universalResults, typeFilter, activeTab]);

  const totalDocs = folders.reduce((sum, f) => sum + f.documents.length, 0);

  // Mobile slide animation
  const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  // Content panel - shared between desktop and mobile
  const ContentPanel = ({ isMobileView = false }: { isMobileView?: boolean }) => {
    if (selectedConvo) {
      return <ConversationViewer conversation={selectedConvo} isMobile={isMobileView} />;
    }
    return (
      <DocumentViewer
        selectedDoc={selectedDoc}
        docContent={docContent}
        isLoadingDoc={isLoadingDoc}
        isMobile={isMobileView}
      />
    );
  };

  // Sidebar content shared between desktop/mobile
  const SidebarContent = () => (
    <>
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search everything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-9 pr-9", isMobile ? "h-10 bg-muted/50" : "h-9 bg-background")}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {universalResults && (
          <p className="text-xs text-muted-foreground mt-2">
            {universalResults.length} result{universalResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b-0 h-auto p-0 bg-transparent">
            <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Docs
            </TabsTrigger>
            <TabsTrigger value="conversations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2.5">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2.5">
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Activity
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === "documents" && (
          <>
            {/* Type filter chips */}
            <div className="flex flex-wrap gap-1.5 px-1 py-2">
              {["all", "journal", "concepts", "decisions", "projects", "research"].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border transition-colors",
                    typeFilter === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-border text-muted-foreground"
                  )}
                >
                  {type === "all" ? "All" : FOLDER_CONFIG[type]?.label || type}
                </button>
              ))}
            </div>

            {/* Universal search results */}
            {universalResults && searchQuery && (
              <div className="space-y-1 mb-3">
                {universalResults.filter(r => r.type !== "document").map((result, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (result.type === "conversation") {
                        const parts = result.path.split("/");
                        if (parts.length >= 3) {
                          loadConversationTranscript({
                            id: parts[2],
                            agent: parts[1],
                            timestamp: result.lastModified,
                            messageCount: 0,
                            size: 0,
                            isLong: false,
                          });
                        }
                      }
                    }}
                    className="w-full flex items-start gap-2 px-3 py-2.5 rounded-md text-left hover:bg-accent transition-colors"
                  >
                    <div className={cn(
                      "mt-0.5 shrink-0 p-1 rounded",
                      result.type === "agent-memory" ? "bg-purple-500/10" : "bg-blue-500/10"
                    )}>
                      {result.type === "agent-memory" ? (
                        <Brain className="h-3.5 w-3.5 text-purple-500" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium truncate block">{result.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <DocumentList
              isLoading={isLoading}
              error={error}
              displayedFolders={displayedFolders}
              expandedFolders={expandedFolders}
              selectedDoc={selectedDoc}
              searchQuery={searchQuery}
              onToggleFolder={toggleFolder}
              onSelectDoc={loadDocument}
              onRetry={loadDocuments}
            />
          </>
        )}

        {activeTab === "conversations" && (
          <ConversationList
            conversations={conversations}
            agents={conversationAgents}
            selectedConvo={selectedConvo}
            filter={convoFilter}
            onFilterChange={(f) => { setConvoFilter(f); }}
            onSelect={loadConversationTranscript}
            isLoading={isLoadingConvos}
            onRefresh={loadConversations}
            error={convoError}
          />
        )}

        {activeTab === "activity" && (
          <ActivityTimeline
            activities={activities}
            days={activityDays}
            onDaysChange={setActivityDays}
            isLoading={isLoadingActivity}
          />
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6 md:-m-8 overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden md:flex md:flex-col h-full">
        {/* Desktop Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Second Brain</h1>
              <p className="text-xs text-muted-foreground">
                {totalDocs} document{totalDocs !== 1 ? "s" : ""} • Search across everything
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Content - Split Panel */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - Left Panel */}
          <div className="w-80 flex flex-col bg-muted/30 border-r">
            <SidebarContent />
          </div>

          {/* Document Viewer - Right Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <ContentPanel />
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden flex-col h-full">
        <AnimatePresence mode="wait" custom={mobileView === 'document' ? 1 : -1}>
          {mobileView === 'list' ? (
            <motion.div
              key="list"
              custom={-1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col h-full"
            >
              {/* Mobile List Header */}
              <div className="flex items-center gap-3 px-4 py-4 border-b bg-background/95 backdrop-blur">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold tracking-tight">Second Brain</h1>
                  <p className="text-xs text-muted-foreground">{totalDocs} documents</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-muted/20">
                <SidebarContent />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="document"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex flex-col h-full bg-background"
            >
              {/* Mobile Document Header with Back Button */}
              <div className="flex items-center gap-2 px-2 py-3 border-b bg-background/95 backdrop-blur">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToList}
                  className="shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base font-semibold tracking-tight truncate">
                    {selectedConvo ? `${selectedConvo.agent} session` : selectedDoc?.title || "Document"}
                  </h1>
                  {selectedDoc?.folder && (
                    <Badge variant="outline" className="text-xs capitalize mt-0.5">
                      {selectedDoc.folder}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mobile Document Content */}
              <div className="flex-1 overflow-y-auto">
                <ContentPanel isMobileView />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// Document List (existing, improved)
// ============================================

function DocumentList({
  isLoading,
  error,
  displayedFolders,
  expandedFolders,
  selectedDoc,
  searchQuery,
  onToggleFolder,
  onSelectDoc,
  onRetry,
}: {
  isLoading: boolean;
  error: string | null;
  displayedFolders: SecondBrainFolder[];
  expandedFolders: Set<string>;
  selectedDoc: SecondBrainDocument | null;
  searchQuery: string;
  onToggleFolder: (name: string) => void;
  onSelectDoc: (doc: SecondBrainDocument) => void;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-3 min-h-[44px]" onClick={onRetry}>Retry</Button>
      </div>
    );
  }

  if (displayedFolders.length === 0 || displayedFolders.every(f => f.documents.length === 0)) {
    return (
      <div className="p-4 text-center">
        <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          {searchQuery ? "No documents match your search" : "No documents yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {displayedFolders.map((folder) => {
        if (folder.documents.length === 0) return null;

        const config = FOLDER_CONFIG[folder.name] || { icon: FileText, label: folder.name || "Documents", description: "" };
        const FolderIcon = config.icon;
        const isExpanded = expandedFolders.has(folder.name);

        return (
          <Collapsible key={folder.name} open={isExpanded} onOpenChange={() => onToggleFolder(folder.name)}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{config.label}</span>
                <Badge variant="secondary" className="text-xs font-normal">{folder.documents.length}</Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                className="ml-6 mt-1 space-y-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {folder.documents.map((doc) => (
                  <DocumentItem
                    key={doc.path}
                    doc={doc}
                    isSelected={selectedDoc?.path === doc.path}
                    onClick={() => onSelectDoc(doc)}
                  />
                ))}
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

// ============================================
// Document Viewer (enhanced with MarkdownRenderer)
// ============================================

function DocumentViewer({
  selectedDoc,
  docContent,
  isLoadingDoc,
  isMobile = false,
}: {
  selectedDoc: SecondBrainDocument | null;
  docContent: string;
  isLoadingDoc: boolean;
  isMobile?: boolean;
}) {
  if (!selectedDoc) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Select a document to view</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Choose from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Document Header - Desktop only */}
      {!isMobile && (
        <div className="px-8 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight truncate">{selectedDoc.title}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {selectedDoc.folder && (
                  <Badge variant="outline" className="capitalize">{selectedDoc.folder}</Badge>
                )}
                <span>Updated {formatDistanceToNow(new Date(selectedDoc.lastModified), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Content */}
      <div className={cn("flex-1 overflow-y-auto", isMobile && "pb-safe")}>
        {isLoadingDoc ? (
          <div className={cn("space-y-4", isMobile ? "p-4" : "p-8")}>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-32 w-full mt-6" />
          </div>
        ) : (
          <div className={cn(isMobile ? "p-4" : "p-8")}>
            <MarkdownRenderer
              content={docContent}
              enableWikiLinks
              onWikiLink={(target) => {
                console.log("Wiki link clicked:", target);
                // Could navigate to another document
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ============================================
// Conversation List
// ============================================

function ConversationList({
  conversations,
  agents,
  selectedConvo,
  filter,
  onFilterChange,
  onSelect,
  isLoading,
  onRefresh,
  error,
}: {
  conversations: ConversationSession[];
  agents: string[];
  selectedConvo: { agent: string; id: string } | null;
  filter: string;
  onFilterChange: (f: string) => void;
  onSelect: (session: ConversationSession) => void;
  isLoading: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  // When filter changes, trigger a refresh via the parent's loadConversations
  // (which has built-in rate limiting / debounce protection).
  const prevFilter = useRef(filter);
  useEffect(() => {
    if (prevFilter.current !== filter) {
      prevFilter.current = filter;
      onRefresh();
    }
  }, [filter, onRefresh]);

  // Only show skeleton on initial load (no data yet), not on reload
  const showSkeleton = isLoading && conversations.length === 0 && !error;

  return (
    <div className="space-y-2">
      {/* Agent filter chips */}
      <div className="flex flex-wrap gap-1.5 px-1 py-2">
        <button
          onClick={() => onFilterChange("")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            !filter
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent border-border text-muted-foreground"
          )}
        >
          All
        </button>
        {agents.map(agent => (
          <button
            key={agent}
            onClick={() => onFilterChange(agent)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              filter === agent
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-border text-muted-foreground"
            )}
          >
            {agent}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 text-xs"
            onClick={() => onRefresh()}
            disabled={isLoading}
          >
            {isLoading ? "Retrying…" : "Retry now"}
          </Button>
        </div>
      )}

      {showSkeleton ? (
        <div className="space-y-2 p-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : conversations.length === 0 && !error ? (
        <div className="p-4 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No conversations found</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {isLoading && conversations.length > 0 && (
            <p className="text-xs text-muted-foreground px-3 py-1">Updating…</p>
          )}
          {conversations.map((session) => (
            <motion.button
              key={`${session.agent}-${session.id}`}
              onClick={() => onSelect(session)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors min-h-[44px]",
                selectedConvo?.id === session.id && selectedConvo?.agent === session.agent
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-accent"
              )}
              whileTap={{ scale: 0.98 }}
            >
              <div className="p-1.5 rounded-md bg-blue-500/10 shrink-0">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{session.agent}</span>
                  {session.isLong && <Badge variant="secondary" className="text-[10px] px-1.5">Long</Badge>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{session.messageCount} messages</span>
                  <span>•</span>
                  <span>{format(new Date(session.timestamp), "MMM d, HH:mm")}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Conversation Viewer
// ============================================

function ConversationViewer({
  conversation,
  isMobile = false,
}: {
  conversation: { messages: ConversationMessage[]; agent: string; id: string };
  isMobile?: boolean;
}) {
  return (
    <>
      {!isMobile && (
        <div className="px-8 py-4 border-b">
          <h2 className="text-xl font-semibold tracking-tight">
            {conversation.agent} session
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {conversation.messages.length} messages
          </p>
        </div>
      )}

      <div className={cn("flex-1 overflow-y-auto", isMobile ? "p-4" : "p-6")}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {conversation.messages.map((msg, i) => (
            <div
              key={msg.id || i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role !== "user" && (
                <div className="shrink-0 p-1.5 rounded-full bg-primary/10 h-8 w-8 flex items-center justify-center">
                  <BotIcon className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <MarkdownRenderer content={msg.text || ""} className="text-sm" />
                )}
                {msg.timestamp && (
                  <p className={cn(
                    "text-[10px] mt-1",
                    msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                  )}>
                    {format(new Date(msg.timestamp), "HH:mm")}
                  </p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 p-1.5 rounded-full bg-blue-500/10 h-8 w-8 flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-500" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================
// Activity Timeline
// ============================================

function ActivityTimeline({
  activities,
  days,
  onDaysChange,
  isLoading,
}: {
  activities: BrainActivity[];
  days: number;
  onDaysChange: (d: number) => void;
  isLoading: boolean;
}) {
  // Only show skeleton on initial load (no data yet). During reloads, keep existing
  // data visible to preserve scroll position.
  const showSkeleton = isLoading && activities.length === 0;

  return (
    <div className="space-y-2">
      {/* Days filter */}
      <div className="flex gap-1.5 px-1 py-2 sticky top-0 bg-inherit z-10">
        {[7, 14, 30].map(d => (
          <button
            key={d}
            onClick={() => onDaysChange(d)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              days === d
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-border text-muted-foreground"
            )}
          >
            {d}d
          </button>
        ))}
        {isLoading && activities.length > 0 && (
          <span className="text-xs text-muted-foreground self-center ml-auto">Updating…</span>
        )}
      </div>

      {showSkeleton ? (
        <div className="space-y-2 p-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="p-4 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {activities.map((activity, i) => {
            const icon = activity.type === "document" ? FileText
              : activity.type === "conversation" ? MessageSquare
              : Brain;
            const iconColor = activity.type === "document" ? "text-emerald-500"
              : activity.type === "conversation" ? "text-blue-500"
              : "text-purple-500";
            const bgColor = activity.type === "document" ? "bg-emerald-500/10"
              : activity.type === "conversation" ? "bg-blue-500/10"
              : "bg-purple-500/10";
            const Icon = icon;

            return (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-accent transition-colors"
              >
                <div className={cn("shrink-0 p-1.5 rounded-md mt-0.5", bgColor)}>
                  <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.action}</Badge>
                    <span>{formatDistanceToNow(new Date(activity.lastModified), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Document Item
// ============================================

function DocumentItem({
  doc,
  isSelected,
  onClick,
}: {
  doc: SecondBrainDocument;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "flex flex-col w-full px-3 py-2.5 min-h-[44px] rounded-md text-left transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-accent active:bg-accent/80"
      )}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
    >
      <span className="text-sm font-medium truncate">{doc.title}</span>
      <span className="text-xs text-muted-foreground mt-0.5">
        {format(new Date(doc.lastModified), "MMM d, yyyy")}
      </span>
    </motion.button>
  );
}
