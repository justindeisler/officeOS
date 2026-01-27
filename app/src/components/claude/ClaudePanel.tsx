import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquarePlus, Loader2 } from "lucide-react";
import { useClaudeStore } from "@/stores/claudeStore";
import { Button } from "@/components/ui/button";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ConversationSelector } from "./ConversationSelector";
import { cn } from "@/lib/utils";

/**
 * Main Claude chat panel component
 * Slides in from the right side of the viewport
 * Includes header, message list, and input
 */
export function ClaudePanel() {
  const {
    isOpen,
    width,
    setWidth,
    closePanel,
    sessionState,
    checkStatus,
    startNewConversation,
    setupEventListeners,
    cliAvailable,
    isAuthenticated,
  } = useClaudeStore();

  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Setup event listeners on mount
  useEffect(() => {
    let unlisteners: (() => void)[] = [];

    setupEventListeners().then((listeners) => {
      unlisteners = listeners;
    });

    // Check CLI status
    checkStatus();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [setupEventListeners, checkStatus]);

  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setWidth]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed right-0 top-0 h-full z-40",
            "bg-background border-l shadow-xl flex flex-col",
            isResizing && "select-none"
          )}
          style={{ width }}
        >
          {/* Resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute left-0 top-0 w-1 h-full cursor-col-resize",
              "hover:bg-primary/20 transition-colors",
              isResizing && "bg-primary/30"
            )}
          />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <ConversationSelector />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={startNewConversation}
                title="New conversation"
              >
                <MessageSquarePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={closePanel}
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status/Error Display */}
          {!cliAvailable && (
            <div className="p-4 bg-destructive/10 border-b">
              <p className="text-sm text-destructive">
                Claude CLI not found. Please install Claude Code CLI.
              </p>
            </div>
          )}

          {cliAvailable && !isAuthenticated && (
            <div className="p-4 bg-yellow-500/10 border-b">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Not authenticated. Run `claude login` in your terminal.
              </p>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-hidden">
            <ChatMessages />
          </div>

          {/* Input area */}
          <div className="border-t p-4">
            {sessionState.status === "starting" ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Starting session...
                </span>
              </div>
            ) : (
              <ChatInput disabled={!cliAvailable} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
