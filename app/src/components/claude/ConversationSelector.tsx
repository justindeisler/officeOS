import { useEffect } from "react";
import { useClaudeStore } from "@/stores/claudeStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";

/**
 * Dropdown selector for conversation history
 * Allows resuming previous Claude sessions
 */
export function ConversationSelector() {
  const {
    conversations,
    currentConversationId,
    loadConversations,
    selectConversation,
  } = useClaudeStore();

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const truncateText = (text: string | null, maxLength: number) => {
    if (!text) return "New conversation";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  return (
    <Select
      value={currentConversationId || "new"}
      onValueChange={(value) => {
        if (value !== "new") {
          selectConversation(value);
        }
      }}
    >
      <SelectTrigger className="w-[220px] h-9">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="New conversation" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new">
          <span className="text-muted-foreground">New conversation</span>
        </SelectItem>

        {conversations.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1">
              Recent conversations
            </div>
            {conversations.map((conv) => (
              <SelectItem key={conv.id} value={conv.id}>
                <div className="flex flex-col">
                  <span className="text-sm">
                    {truncateText(conv.title || conv.preview, 25)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(conv.updated_at)} · {conv.message_count} messages
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
