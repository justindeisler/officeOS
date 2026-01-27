import { useEffect, useRef } from "react";
import { useClaudeMessages } from "@/stores/claudeStore";
import { MessageBubble } from "./MessageBubble";

/**
 * Chat message list with auto-scroll to bottom
 */
export function ChatMessages() {
  const messages = useClaudeMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <h3 className="text-lg font-medium mb-2">Claude Assistant</h3>
          <p className="text-sm text-muted-foreground">
            Ask me to help with your tasks, projects, or time tracking. I can
            create, update, and query your data.
          </p>
          <div className="mt-4 space-y-2 text-xs text-muted-foreground text-left">
            <p>Try asking:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>"Create a task for reviewing Q4 financials"</li>
              <li>"Show me all overdue tasks"</li>
              <li>"Start a timer for deep work"</li>
              <li>"List my active projects"</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={scrollRef} />
    </div>
  );
}
