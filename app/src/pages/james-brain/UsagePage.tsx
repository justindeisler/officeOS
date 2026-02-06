import { useEffect, useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart3,
  Zap,
  Calendar,
  CalendarDays,
  CalendarRange,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ChartConfig } from "@/components/ui/chart";
import { api } from "@/lib/api";
import { useSortableTable } from "@/hooks/useSortableTable";
import {
  formatCompactNumber,
  DashboardLoading,
  DashboardError,
  MockDataNotice,
  DashboardHeader,
  OverviewCard,
  StackedAreaTrendChart,
  RadialDistributionChart,
  StackedBarChartCard,
  SortableColumnHeader,
  ExpandButton,
} from "@/components/charts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface UsageData {
  _mock: boolean;
  _note: string;
  overview: {
    total: number;
    totalInput: number;
    totalOutput: number;
    today: number;
    todayInput: number;
    todayOutput: number;
    week: number;
    weekInput: number;
    weekOutput: number;
    month: number;
    monthInput: number;
    monthOutput: number;
  };
  byModel: Record<string, { total: number; input: number; output: number }>;
  trend: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
    model: string;
  }>;
  sessions: Array<{
    id: string;
    timestamp: string;
    activity: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    total: number;
  }>;
}

type SessionSortField = "timestamp" | "model" | "inputTokens" | "outputTokens" | "total";

// ─── Chart Configs ──────────────────────────────────────────────────────────

const modelChartConfig = {
  "opus-4-5": { label: "Opus 4.5", color: "hsl(var(--chart-1))" },
  "sonnet-4-5": { label: "Sonnet 4.5", color: "hsl(var(--chart-2))" },
  "haiku-4-5": { label: "Haiku 4.5", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const inputOutputChartConfig = {
  input: { label: "Input Tokens", color: "hsl(var(--chart-2))" },
  output: { label: "Output Tokens", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const barChartConfig = {
  input: { label: "Input", color: "hsl(var(--chart-2))" },
  output: { label: "Output", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

const pieChartConfig = {
  tokens: { label: "Tokens" },
  "opus-4-5": { label: "Opus 4.5", color: "hsl(var(--chart-1))" },
  "sonnet-4-5": { label: "Sonnet 4.5", color: "hsl(var(--chart-2))" },
  "haiku-4-5": { label: "Haiku 4.5", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  "opus-4-5": "Opus 4.5",
  "sonnet-4-5": "Sonnet 4.5",
  "haiku-4-5": "Haiku 4.5",
};

const MODEL_CHART_COLORS: Record<string, string> = {
  "opus-4-5": "hsl(var(--chart-1))",
  "sonnet-4-5": "hsl(var(--chart-2))",
  "haiku-4-5": "hsl(var(--chart-3))",
};

// ─── Session Sort Comparators ───────────────────────────────────────────────

const sessionComparators: Record<
  SessionSortField,
  (a: UsageData["sessions"][number], b: UsageData["sessions"][number]) => number
> = {
  timestamp: (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  model: (a, b) => a.model.localeCompare(b.model),
  inputTokens: (a, b) => a.inputTokens - b.inputTokens,
  outputTokens: (a, b) => a.outputTokens - b.outputTokens,
  total: (a, b) => a.total - b.total,
};

// ─── Tooltip Formatters ─────────────────────────────────────────────────────

function tokenTooltipFormatter(config: ChartConfig) {
  return (value: number, name: string) => (
    <>
      <span className="text-muted-foreground">
        {config[name as keyof typeof config]?.label || name}:
      </span>{" "}
      <span className="font-mono font-medium tabular-nums text-foreground">
        {value.toLocaleString()}
      </span>
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("day");
  const [modelFilter, setModelFilter] = useState("all");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const startDate = subDays(new Date(), 30).toISOString().slice(0, 10);
        const endDate = new Date().toISOString().slice(0, 10);
        const result = await api.getTokenUsage({
          startDate,
          endDate,
          groupBy,
          model: modelFilter === "all" ? undefined : modelFilter,
        });
        setData(result);
      } catch (err) {
        console.error("Failed to fetch usage data:", err);
        setError("Failed to load usage data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [groupBy, modelFilter]);

  // Sortable sessions table
  const {
    sortField,
    sortDirection,
    toggleSort,
    displayed: displayedSessions,
    expanded: tableExpanded,
    setExpanded: setTableExpanded,
    canExpand,
    totalCount: sessionCount,
  } = useSortableTable<UsageData["sessions"][number], SessionSortField>({
    data: data?.sessions ?? [],
    defaultField: "timestamp",
    comparators: sessionComparators,
  });

  // Prepare trend chart data
  const trendChartData = useMemo(() => {
    if (!data) return [];

    const formatDate = (date: string) =>
      groupBy === "day"
        ? format(new Date(date), "MMM d")
        : groupBy === "week"
          ? `W${format(new Date(date), "w")}`
          : format(new Date(date), "MMM yyyy");

    if (modelFilter !== "all") {
      return data.trend.map((entry) => ({
        date: formatDate(entry.date),
        input: entry.inputTokens,
        output: entry.outputTokens,
      }));
    }

    const dateMap = new Map<string, Record<string, number>>();
    for (const entry of data.trend) {
      const dateLabel = formatDate(entry.date);
      if (!dateMap.has(dateLabel)) dateMap.set(dateLabel, {});
      const existing = dateMap.get(dateLabel)!;
      existing[entry.model] = (existing[entry.model] || 0) + entry.tokens;
    }

    return Array.from(dateMap.entries()).map(([date, models]) => ({ date, ...models }));
  }, [data, groupBy, modelFilter]);

  // Radial chart data
  const radialChartData = useMemo(() => {
    if (!data) return [];
    const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
    return Object.entries(data.byModel)
      .map(([model, stats]) => ({
        model,
        name: MODEL_LABELS[model] || model,
        tokens: stats.total,
        value: totalAll > 0 ? Math.round((stats.total / totalAll) * 100) : 0,
        fill: MODEL_CHART_COLORS[model] || "hsl(var(--chart-4))",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // Bar chart data
  const modelBarData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      input: stats.input,
      output: stats.output,
    }));
  }, [data]);

  // ─── Loading / Error ────────────────────────────────────────────────────

  if (isLoading) return <DashboardLoading />;
  if (error || !data) return <DashboardError message={error ?? undefined} />;

  // ─── Render ─────────────────────────────────────────────────────────────

  const trendConfig = modelFilter !== "all" ? inputOutputChartConfig : modelChartConfig;
  const trendKeys = Object.keys(trendConfig);

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={BarChart3}
        title="Token Usage"
        description="Track AI token consumption across models"
        actions={
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-[140px]">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              <SelectItem value="opus-4-5">Opus 4.5</SelectItem>
              <SelectItem value="sonnet-4-5">Sonnet 4.5</SelectItem>
              <SelectItem value="haiku-4-5">Haiku 4.5</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* Mock Data Notice */}
      {data._mock && (
        <MockDataNotice>
          <span className="font-medium">Sample data.</span> Real token tracking will be
          integrated when Clawdbot gateway exposes per-session usage metrics.
        </MockDataNotice>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {([
          { title: "All Time", icon: TrendingUp, key: "total" as const, accent: "bg-chart-1/10 text-chart-1" },
          { title: "This Month", icon: CalendarRange, key: "month" as const, accent: "bg-chart-2/10 text-chart-2" },
          { title: "This Week", icon: CalendarDays, key: "week" as const, accent: "bg-chart-3/10 text-chart-3" },
          { title: "Today", icon: Calendar, key: "today" as const, accent: "bg-chart-4/10 text-chart-4" },
        ] as const).map(({ title, icon, key, accent }) => {
          const total = key === "total" ? data.overview.total : data.overview[key];
          const input = data.overview[key === "total" ? "totalInput" : `${key}Input` as keyof typeof data.overview] as number;
          const output = data.overview[key === "total" ? "totalOutput" : `${key}Output` as keyof typeof data.overview] as number;
          return (
            <OverviewCard key={key} title={title} icon={icon} accent={accent} value={formatCompactNumber(total)}>
              <div className="flex items-center gap-3 pt-1">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-chart-2" />
                  {formatCompactNumber(input)} in
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowDownRight className="h-3 w-3 text-chart-3" />
                  {formatCompactNumber(output)} out
                </span>
              </div>
            </OverviewCard>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Area Chart: Usage Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Trend
              </CardTitle>
              <CardDescription className="mt-1">
                {modelFilter !== "all"
                  ? `${MODEL_LABELS[modelFilter]} — input vs output tokens`
                  : "Token usage stacked by model"}
              </CardDescription>
            </div>
            <Tabs value={groupBy} onValueChange={setGroupBy}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-2.5 h-6">Daily</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 h-6">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 h-6">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <StackedAreaTrendChart
              data={trendChartData}
              config={trendConfig}
              dataKeys={trendKeys}
              gradientPrefix={modelFilter !== "all" ? "fill" : "fill"}
              yTickFormatter={(v) => formatCompactNumber(v)}
              tooltipFormatter={tokenTooltipFormatter(trendConfig)}
            />
          </CardContent>
        </Card>

        {/* Radial Chart: Model Distribution */}
        <RadialDistributionChart
          config={pieChartConfig}
          data={radialChartData}
          icon={Zap}
          title="By Model"
          description="Token distribution across models"
          legend={
            <div className="space-y-3 px-2 pb-4">
              {Object.entries(data.byModel).map(([model, stats]) => {
                const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
                const pct = totalAll > 0 ? ((stats.total / totalAll) * 100).toFixed(1) : "0";
                return (
                  <div key={model} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-[2px] flex-shrink-0"
                      style={{ backgroundColor: MODEL_CHART_COLORS[model] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{MODEL_LABELS[model]}</span>
                        <span className="text-sm text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatCompactNumber(stats.input)} in</span>
                        <span>·</span>
                        <span>{formatCompactNumber(stats.output)} out</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        />
      </div>

      {/* Bar Chart: Input vs Output by Model */}
      <StackedBarChartCard
        icon={BarChart3}
        title="Input vs Output by Model"
        description="Compare input and output token usage across each model"
        config={barChartConfig}
        data={modelBarData}
        dataKeys={["input", "output"]}
        yTickFormatter={(v) => formatCompactNumber(v)}
        tooltipFormatter={tokenTooltipFormatter(barChartConfig)}
      />

      {/* Sessions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
            <CardDescription className="mt-1">
              Detailed breakdown of individual sessions
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {data.sessions.length} sessions
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <SortableColumnHeader field="timestamp" label="Date" activeField={sortField} direction={sortDirection} onToggle={toggleSort} />
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Activity</th>
                  <SortableColumnHeader field="model" label="Model" activeField={sortField} direction={sortDirection} onToggle={toggleSort} />
                  <SortableColumnHeader field="inputTokens" label="Input" activeField={sortField} direction={sortDirection} onToggle={toggleSort} align="right" className="hidden md:table-cell" />
                  <SortableColumnHeader field="outputTokens" label="Output" activeField={sortField} direction={sortDirection} onToggle={toggleSort} align="right" className="hidden md:table-cell" />
                  <SortableColumnHeader field="total" label="Total" activeField={sortField} direction={sortDirection} onToggle={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {displayedSessions.map((session) => (
                  <tr key={session.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-2 whitespace-nowrap text-muted-foreground">
                      {format(new Date(session.timestamp), "MMM d, HH:mm")}
                    </td>
                    <td className="py-2.5 px-2 hidden sm:table-cell">
                      <span className="truncate block max-w-[300px]">{session.activity}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <Badge
                        variant="outline"
                        className="text-xs font-normal"
                        style={{
                          borderColor: MODEL_CHART_COLORS[session.model]
                            ? `color-mix(in srgb, ${MODEL_CHART_COLORS[session.model]} 40%, transparent)`
                            : undefined,
                          color: MODEL_CHART_COLORS[session.model],
                          backgroundColor: MODEL_CHART_COLORS[session.model]
                            ? `color-mix(in srgb, ${MODEL_CHART_COLORS[session.model]} 10%, transparent)`
                            : undefined,
                        }}
                      >
                        {MODEL_LABELS[session.model] || session.model}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                      {formatCompactNumber(session.inputTokens)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                      {formatCompactNumber(session.outputTokens)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-medium">
                      {formatCompactNumber(session.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canExpand && (
            <ExpandButton
              expanded={tableExpanded}
              totalCount={sessionCount}
              label="Sessions"
              onToggle={() => setTableExpanded(!tableExpanded)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
