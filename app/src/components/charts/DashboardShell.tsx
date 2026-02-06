import { ReactNode } from "react";
import { Info } from "lucide-react";

// ─── Loading Spinner ────────────────────────────────────────────────────────

export function DashboardLoading() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// ─── Error / Empty State ────────────────────────────────────────────────────

export function DashboardError({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center space-y-2">
        <p className="text-destructive text-lg">⚠️</p>
        <p className="text-sm text-muted-foreground">{message || "No data available"}</p>
      </div>
    </div>
  );
}

// ─── Mock Data Notice ───────────────────────────────────────────────────────

export function MockDataNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
      <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {children}
      </p>
    </div>
  );
}

// ─── Page Header ────────────────────────────────────────────────────────────

export function DashboardHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Icon className="h-7 w-7" />
          {title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── Empty Chart Placeholder ────────────────────────────────────────────────

export function EmptyChart({ height = "h-[200px] sm:h-[300px]" }: { height?: string }) {
  return (
    <div className={`flex items-center justify-center ${height}`}>
      <p className="text-muted-foreground text-sm">No data for this period</p>
    </div>
  );
}
