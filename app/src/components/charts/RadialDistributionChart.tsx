import { ReactNode } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarRadiusAxis,
} from "recharts";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface RadialDistributionChartProps {
  config: ChartConfig;
  data: Array<{
    value: number;
    fill: string;
    [key: string]: unknown;
  }>;
  icon: React.ElementType;
  title: string;
  description: string;
  /** Rendered below the radial chart (legend, details, etc.) */
  legend: ReactNode;
  /** Shown when data is empty */
  emptyMessage?: string;
}

/**
 * A radial bar distribution chart in a card layout.
 * Used by both "By Model" (token usage) and "Cost Breakdown" (API usage) sections.
 */
export function RadialDistributionChart({
  config,
  data,
  icon: Icon,
  title,
  description,
  legend,
  emptyMessage = "No data",
}: RadialDistributionChartProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[180px]">
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <ChartContainer
            config={config}
            className="mx-auto aspect-square max-h-[180px] sm:max-h-[220px]"
          >
            <RadialBarChart
              data={data}
              innerRadius={30}
              outerRadius={110}
              startAngle={180}
              endAngle={0}
            >
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
              <RadialBar dataKey="value" background cornerRadius={10} />
            </RadialBarChart>
          </ChartContainer>
        )}
        {legend}
      </CardContent>
    </Card>
  );
}
