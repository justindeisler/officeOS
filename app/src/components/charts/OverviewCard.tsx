import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * A stat card used in dashboard overview rows.
 * Flexible: pass `children` for custom body content, or use the simple value/subtitle API.
 */
export function OverviewCard({
  title,
  icon: Icon,
  accent,
  value,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  value?: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {value !== undefined && (
              <p className="text-2xl font-bold tracking-tight">{value}</p>
            )}
            {subtitle && (
              <div className="pt-0.5 text-xs text-muted-foreground">{subtitle}</div>
            )}
            {children}
          </div>
          <div className={`rounded-xl p-2.5 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
