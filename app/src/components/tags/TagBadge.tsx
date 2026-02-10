/**
 * TagBadge – compact colored badge for displaying a tag.
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types";

interface TagBadgeProps {
  tag: Tag;
  /** Show a remove button */
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Generate a legible foreground color for a given background hex.
 * Returns black or white depending on contrast.
 */
function contrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

export function TagBadge({ tag, onRemove, className, size = "sm" }: TagBadgeProps) {
  const bg = tag.color || "#6b7280"; // fallback grey
  const fg = contrastColor(bg);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-[10px] leading-tight" : "px-2 py-0.5 text-xs",
        className,
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full hover:opacity-80 focus:outline-none"
          style={{ color: fg }}
        >
          <X className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}
