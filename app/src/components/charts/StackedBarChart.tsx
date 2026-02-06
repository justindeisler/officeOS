import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface StackedBarChartCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  config: ChartConfig;
  data: Record<string, unknown>[];
  /** Bar data keys from the config */
  dataKeys: string[];
  /** Formatter for Y-axis tick labels */
  yTickFormatter?: (value: number) => string;
  /** Formatter for tooltip values */
  tooltipFormatter?: (value: number, name: string) => React.ReactNode;
  /** Height class */
  height?: string;
  /** Whether bars are stacked (use common stackId) or side-by-side */
  stacked?: boolean;
  /** Top radius for bars */
  barRadius?: [number, number, number, number];
}

/**
 * A bar chart inside a card.
 * Used by "Input vs Output by Model" (token) and "API Calls" (api) sections.
 */
export function StackedBarChartCard({
  icon: Icon,
  title,
  description,
  config,
  data,
  dataKeys,
  yTickFormatter,
  tooltipFormatter,
  height = "h-[200px] sm:h-[250px]",
  stacked = false,
  barRadius = [4, 4, 0, 0],
}: StackedBarChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className={`${height} w-full`}>
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey={data.length > 0 && "name" in data[0] ? "name" : "date"} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={yTickFormatter}
            />
            <ChartTooltip
              cursor={false}
              content={
                tooltipFormatter ? (
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) =>
                      tooltipFormatter(value as number, name as string)
                    }
                  />
                ) : (
                  <ChartTooltipContent indicator="dot" />
                )
              }
            />
            {dataKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`var(--color-${key})`}
                radius={barRadius}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
