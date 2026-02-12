import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import type { SecondBrainDocument, SecondBrainFolder } from "@/types";

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

export function SecondBrainPage() {
  const [folders, setFolders] = useState<SecondBrainFolder[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<SecondBrainDocument | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SecondBrainDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["journal", "concepts", "decisions", "projects", "research"]));
  const [error, setError] = useState<string | null>(null);
  
  // Mobile view state: 'list' or 'document'
  const [mobileView, setMobileView] = useState<'list' | 'document'>('list');
  const isMobile = useIsMobile();

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await api.searchSecondBrain(searchQuery);
        setSearchResults(result.results);
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getSecondBrainDocuments();
      setFolders(result.folders);

      // Auto-select first document only on desktop
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
      
      // On mobile, switch to document view
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

  const handleBackToList = () => {
    setMobileView('list');
  };

  const toggleFolder = (folderName: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // Get documents to display (search results or folders)
  const displayedFolders = useMemo(() => {
    if (searchResults) {
      // Group search results by folder
      const grouped: Record<string, SecondBrainDocument[]> = {};
      for (const doc of searchResults) {
        const folder = doc.folder || "";
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(doc);
      }
      return Object.entries(grouped).map(([name, documents]) => ({
        name,
        documents,
      }));
    }
    return folders;
  }, [folders, searchResults]);

  // Total document count
  const totalDocs = folders.reduce((sum, f) => sum + f.documents.length, 0);

  // Animation variants for mobile transitions
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
    }),
  };

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
              <h1 className="text-xl font-semibold tracking-tight">James's Brain</h1>
              <p className="text-xs text-muted-foreground">
                {totalDocs} document{totalDocs !== 1 ? "s" : ""} in your knowledge base
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Content - Split Panel */}
        <div className="flex flex-1 min-h-0">
          {/* Document List - Left Panel */}
          <div className="w-80 flex flex-col bg-muted/30 border-r">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-9 bg-background"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 min-h-[32px] min-w-[32px]"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {searchResults && (
                <p className="text-xs text-muted-foreground mt-2">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                </p>
              )}
            </div>

            {/* Document Tree */}
            <div className="flex-1 overflow-y-auto p-2">
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
            </div>
          </div>

          {/* Document Viewer - Right Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <DocumentViewer
              selectedDoc={selectedDoc}
              docContent={docContent}
              isLoadingDoc={isLoadingDoc}
            />
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
                  <h1 className="text-lg font-semibold tracking-tight">James's Brain</h1>
                  <p className="text-xs text-muted-foreground">
                    {totalDocs} document{totalDocs !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Mobile Search */}
              <div className="p-3 border-b bg-background">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9 h-10 bg-muted/50"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 min-h-[44px] min-w-[44px]"
                      onClick={clearSearch}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {searchResults && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                  </p>
                )}
              </div>

              {/* Mobile Document List */}
              <div className="flex-1 overflow-y-auto p-2 bg-muted/20">
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
                    {selectedDoc?.title || "Document"}
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
                <DocumentViewer
                  selectedDoc={selectedDoc}
                  docContent={docContent}
                  isLoadingDoc={isLoadingDoc}
                  isMobile
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Document list component
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
        <Button variant="outline" size="sm" className="mt-3 min-h-[44px]" onClick={onRetry}>
          Retry
        </Button>
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

        const config = FOLDER_CONFIG[folder.name] || {
          icon: FileText,
          label: folder.name || "Documents",
          description: "",
        };
        const FolderIcon = config.icon;
        const isExpanded = expandedFolders.has(folder.name);

        return (
          <Collapsible
            key={folder.name}
            open={isExpanded}
            onOpenChange={() => onToggleFolder(folder.name)}
          >
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left truncate">{config.label}</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {folder.documents.length}
                </Badge>
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

// Document viewer component
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
          <h3 className="text-lg font-medium text-muted-foreground">
            Select a document to view
          </h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Choose from the list on the left
          </p>
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
              <h2 className="text-2xl font-semibold tracking-tight truncate">
                {selectedDoc.title}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {selectedDoc.folder && (
                  <Badge variant="outline" className="capitalize">
                    {selectedDoc.folder}
                  </Badge>
                )}
                <span>
                  Updated {formatDistanceToNow(new Date(selectedDoc.lastModified), { addSuffix: true })}
                </span>
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
          <article className={cn(
            "prose prose-neutral dark:prose-invert max-w-none",
            isMobile ? "p-4" : "p-8"
          )}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold tracking-tight mt-8 mb-4 first:mt-0 pb-2 border-b">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-semibold tracking-tight mt-8 mb-3 pb-1 border-b border-border/50">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold tracking-tight mt-6 mb-2">
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="text-lg font-semibold mt-4 mb-2">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="leading-7 [&:not(:first-child)]:mt-4">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="my-4 ml-6 list-disc [&>li]:mt-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-4 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-7">{children}</li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="mt-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
                    {children}
                  </blockquote>
                ),
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;

                  if (isInline) {
                    return (
                      <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm" {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="mt-4 mb-4 overflow-x-auto rounded-lg bg-muted/50 border p-4 font-mono text-sm">
                    {children}
                  </pre>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-8 border-border" />,
                table: ({ children }) => (
                  <div className="my-6 w-full overflow-auto">
                    <table className="w-full border-collapse border border-border">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted/50 px-4 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-4 py-2">{children}</td>
                ),
                img: ({ src, alt }) => (
                  <img
                    src={src}
                    alt={alt || ""}
                    className="rounded-lg border my-4 max-w-full"
                  />
                ),
              }}
            >
              {docContent}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </>
  );
}

// Document list item component
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
