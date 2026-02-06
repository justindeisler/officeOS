import {
  AreaChart,
  Area,
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
import { EmptyChart } from "./DashboardShell";

interface StackedAreaChartProps {
  data: Record<string, unknown>[];
  config: ChartConfig;
  /** Keys from `config` to render as stacked areas */
  dataKeys: string[];
  /** Prefix for gradient ids (must be unique per chart instance) */
  gradientPrefix?: string;
  /** Formatter for Y-axis tick labels */
  yTickFormatter?: (value: number) => string;
  /** Formatter for tooltip values. Receives (value, name). */
  tooltipFormatter?: (value: number, name: string) => React.ReactNode;
  /** Chart height class */
  height?: string;
  /** Stack id – areas with the same stackId are stacked together */
  stackId?: string;
}

/**
 * A reusable stacked area chart with gradient fills.
 * Used by both the Token Usage trend and the API Cost trend charts.
 */
export function StackedAreaTrendChart({
  data,
  config,
  dataKeys,
  gradientPrefix = "fill",
  yTickFormatter,
  tooltipFormatter,
  height = "h-[200px] sm:h-[300px]",
  stackId = "1",
}: StackedAreaChartProps) {
  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  return (
    <ChartContainer config={config} className={`${height} w-full`}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {dataKeys.map((key) => (
            <linearGradient
              key={key}
              id={`${gradientPrefix}-${key}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.4} />
              <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
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
                formatter={(value, name) => tooltipFormatter(value as number, name as string)}
              />
            ) : (
              <ChartTooltipContent indicator="dot" />
            )
          }
        />
        {dataKeys.map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={`var(--color-${key})`}
            fill={`url(#${gradientPrefix}-${key})`}
            strokeWidth={2}
            stackId={stackId}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
