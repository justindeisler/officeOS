import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/stores/claudeStore";
import { cn } from "@/lib/utils";
import { Bot, User, Info, Loader2, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

interface MessageBubbleProps {
  message: Message;
}

/**
 * Individual message bubble component
 * Renders different styles based on message role
 * Supports markdown rendering for assistant messages
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser && "bg-primary text-primary-foreground",
          isAssistant && "bg-[#D97757] text-white",
          isSystem && "bg-muted text-muted-foreground"
        )}
      >
        {isUser && <User className="w-4 h-4" />}
        {isAssistant && <Bot className="w-4 h-4" />}
        {isSystem && <Info className="w-4 h-4" />}
      </div>

      {/* Message content */}
      <div className={cn("flex-1 max-w-[85%]", isUser && "flex justify-end")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2",
            isUser && "bg-primary text-primary-foreground",
            isAssistant && "bg-muted",
            isSystem && "bg-muted/50 text-muted-foreground text-sm italic"
          )}
        >
          {/* Message text with streaming indicator */}
          {message.content ? (
            isAssistant ? (
              <MarkdownContent content={message.content} />
            ) : (
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            )
          ) : (
            message.isStreaming && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </span>
            )
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>

        {/* Timestamp */}
        <div
          className={cn(
            "text-xs text-muted-foreground mt-1",
            isUser && "text-right"
          )}
        >
          {formatTime(message.timestamp)}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Markdown content renderer with custom components
 */
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            const codeContent = String(children).replace(/\n$/, "");

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match?.[1]} code={codeContent} />
            );
          },
          pre({ children }) {
            // Let CodeBlock handle the pre styling
            return <>{children}</>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D97757] hover:underline"
              >
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="min-w-full text-sm border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border px-3 py-1.5 bg-muted text-left font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border px-3 py-1.5">{children}</td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Code block with copy button
 */
function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative group my-2">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      {language && (
        <div className="absolute left-3 top-2 text-xs text-muted-foreground font-mono">
          {language}
        </div>
      )}
      <pre className="bg-[#1a1a1a] rounded-lg p-4 pt-8 overflow-x-auto">
        <code className="text-sm font-mono text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
