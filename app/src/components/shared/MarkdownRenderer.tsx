/**
 * Enhanced Markdown Renderer
 * - Syntax highlighting for code blocks
 * - Proper table rendering
 * - Wiki-style [[links]]
 * - Emoji support
 * - Consistent styling
 */

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { Copy, Check, Link2, ExternalLink } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Callback when a wiki-style [[link]] is clicked */
  onWikiLink?: (linkTarget: string) => void;
  /** Enable wiki-style [[links]] parsing */
  enableWikiLinks?: boolean;
  /** Highlight search terms */
  highlightTerms?: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border/50 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// Process wiki-style links: [[link target]] or [[link target|display text]]
function processWikiLinks(
  content: string,
  onWikiLink?: (target: string) => void
): string {
  if (!onWikiLink) return content;

  // Replace [[link]] and [[link|text]] with markdown links
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target, display) => {
      const displayText = display || target;
      return `[📎 ${displayText}](wiki:${encodeURIComponent(target.trim())})`;
    }
  );
}

export function MarkdownRenderer({
  content,
  className,
  onWikiLink,
  enableWikiLinks = false,
  highlightTerms = [],
}: MarkdownRendererProps) {
  const processedContent = useMemo(() => {
    if (enableWikiLinks) {
      return processWikiLinks(content, onWikiLink);
    }
    return content;
  }, [content, enableWikiLinks, onWikiLink]);

  return (
    <article
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none",
        // Better prose defaults
        "prose-headings:tracking-tight",
        "prose-p:leading-7",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground",
        "prose-strong:font-semibold",
        "prose-code:before:content-[''] prose-code:after:content-['']",
        className
      )}
    >
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
            <h4 className="text-lg font-semibold mt-4 mb-2">{children}</h4>
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
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <div className="relative group not-prose">
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: "1rem 0",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                  <CopyButton text={codeString} />
                  <span className="absolute top-2 left-3 text-xs text-muted-foreground/60 font-mono">
                    {match[1]}
                  </span>
                </div>
              );
            }

            return (
              <code
                className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ href, children }) => {
            // Handle wiki links
            if (href?.startsWith("wiki:")) {
              const target = decodeURIComponent(href.replace("wiki:", ""));
              return (
                <button
                  onClick={() => onWikiLink?.(target)}
                  className="inline-flex items-center gap-1 text-primary hover:underline cursor-pointer"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {children}
                </button>
              );
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
              >
                {children}
                <ExternalLink className="h-3 w-3" />
              </a>
            );
          },
          hr: () => <hr className="my-8 border-border" />,
          table: ({ children }) => (
            <div className="my-6 w-full overflow-auto rounded-lg border">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-border px-4 py-2.5 text-left font-semibold text-sm">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/50 px-4 py-2 text-sm">
              {children}
            </td>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt || ""}
              className="rounded-lg border my-4 max-w-full"
            />
          ),
          // Render checkboxes in task lists
          input: ({ type, checked, ...props }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 h-4 w-4 rounded border-border accent-primary"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </article>
  );
}
