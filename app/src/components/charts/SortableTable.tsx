import {
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type SortDirection = "asc" | "desc";

// ─── Sort Icon ──────────────────────────────────────────────────────────────

export function SortIcon<F extends string>({
  field,
  activeField,
  direction,
}: {
  field: F;
  activeField: F;
  direction: SortDirection;
}) {
  if (activeField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return direction === "asc" ? (
    <ChevronUp className="h-3 w-3" />
  ) : (
    <ChevronDown className="h-3 w-3" />
  );
}

// ─── Sortable Column Header ─────────────────────────────────────────────────

export function SortableColumnHeader<F extends string>({
  field,
  label,
  activeField,
  direction,
  onToggle,
  align = "left",
  className = "",
}: {
  field: F;
  label: string;
  activeField: F;
  direction: SortDirection;
  onToggle: (field: F) => void;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={`py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
      onClick={() => onToggle(field)}
    >
      <span
        className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}
      >
        {label}
        <SortIcon field={field} activeField={activeField} direction={direction} />
      </span>
    </th>
  );
}

// ─── Expand / Collapse Button ───────────────────────────────────────────────

export function ExpandButton({
  expanded,
  totalCount,
  label = "items",
  onToggle,
}: {
  expanded: boolean;
  totalCount: number;
  label?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
    >
      {expanded ? (
        <>
          Show Less <ChevronUp className="h-4 w-4" />
        </>
      ) : (
        <>
          Show All {totalCount} {label} <ChevronDown className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
