import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useClaudeStore, useClaudeIsStreaming } from "@/stores/claudeStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  disabled?: boolean;
}

/**
 * Chat input component with auto-resize textarea
 * Supports keyboard shortcuts and /commands
 */
export function ChatInput({ disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, stopSession } = useClaudeStore();
  const isStreaming = useClaudeIsStreaming();

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    if (!input.trim() || disabled || isStreaming) return;

    const message = input.trim();
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    await sendMessage(message);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    stopSession();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Claude CLI not available"
              : "Ask Claude to help with your tasks..."
          }
          disabled={disabled || isStreaming}
          className={cn(
            "min-h-[44px] max-h-[200px] resize-none",
            "focus-visible:ring-[#D97757]"
          )}
          rows={1}
        />

        {isStreaming ? (
          <Button
            onClick={handleStop}
            variant="destructive"
            size="icon"
            className="flex-shrink-0 h-11 w-11"
            title="Stop generation"
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            size="icon"
            className={cn(
              "flex-shrink-0 h-11 w-11",
              "bg-[#D97757] hover:bg-[#C56A4C]"
            )}
            title="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="text-xs text-muted-foreground text-center">
        Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd>{" "}
        to send, <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Shift+Enter</kbd>{" "}
        for new line
      </div>
    </div>
  );
}
