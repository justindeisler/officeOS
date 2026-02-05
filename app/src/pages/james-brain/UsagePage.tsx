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
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarRadiusAxis,
  AreaChart,
  Area,
} from "recharts";
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { api } from "@/lib/api";

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

type SortField = "timestamp" | "model" | "inputTokens" | "outputTokens" | "total";
type SortDirection = "asc" | "desc";

// ─── Chart Configs ──────────────────────────────────────────────────────────

const modelChartConfig = {
  "opus-4-5": {
    label: "Opus 4.5",
    color: "hsl(var(--chart-1))",
  },
  "sonnet-4-5": {
    label: "Sonnet 4.5",
    color: "hsl(var(--chart-2))",
  },
  "haiku-4-5": {
    label: "Haiku 4.5",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const inputOutputChartConfig = {
  input: {
    label: "Input Tokens",
    color: "hsl(var(--chart-2))",
  },
  output: {
    label: "Output Tokens",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const barChartConfig = {
  input: {
    label: "Input",
    color: "hsl(var(--chart-2))",
  },
  output: {
    label: "Output",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

const pieChartConfig = {
  tokens: {
    label: "Tokens",
  },
  "opus-4-5": {
    label: "Opus 4.5",
    color: "hsl(var(--chart-1))",
  },
  "sonnet-4-5": {
    label: "Sonnet 4.5",
    color: "hsl(var(--chart-2))",
  },
  "haiku-4-5": {
    label: "Haiku 4.5",
    color: "hsl(var(--chart-3))",
  },
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Overview Card ──────────────────────────────────────────────────────────

function OverviewCard({
  title,
  icon: Icon,
  total,
  input,
  output,
  accent,
}: {
  title: string;
  icon: typeof Zap;
  total: number;
  input: number;
  output: number;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{formatTokens(total)}</p>
            <div className="flex items-center gap-3 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowUpRight className="h-3 w-3 text-chart-2" />
                {formatTokens(input)} in
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowDownRight className="h-3 w-3 text-chart-3" />
                {formatTokens(output)} out
              </span>
            </div>
          </div>
          <div className={`rounded-xl p-2.5 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("day");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tableExpanded, setTableExpanded] = useState(false);

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

  // Prepare trend chart data (aggregate across models per date)
  const trendChartData = useMemo(() => {
    if (!data) return [];

    if (modelFilter !== "all") {
      return data.trend.map((entry) => ({
        date:
          groupBy === "day"
            ? format(new Date(entry.date), "MMM d")
            : groupBy === "week"
              ? `W${format(new Date(entry.date), "w")}`
              : format(new Date(entry.date), "MMM yyyy"),
        input: entry.inputTokens,
        output: entry.outputTokens,
      }));
    }

    const dateMap = new Map<string, Record<string, number>>();
    for (const entry of data.trend) {
      const dateLabel =
        groupBy === "day"
          ? format(new Date(entry.date), "MMM d")
          : groupBy === "week"
            ? `W${format(new Date(entry.date), "w")}`
            : format(new Date(entry.date), "MMM yyyy");
      if (!dateMap.has(dateLabel)) {
        dateMap.set(dateLabel, {});
      }
      const existing = dateMap.get(dateLabel)!;
      existing[entry.model] = (existing[entry.model] || 0) + entry.tokens;
    }

    return Array.from(dateMap.entries()).map(([date, models]) => ({
      date,
      ...models,
    }));
  }, [data, groupBy, modelFilter]);

  // Prepare radial chart data (percentage-based for concentric rings)
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
      .sort((a, b) => b.value - a.value); // Largest ring on outside
  }, [data]);

  // Prepare bar chart data for input/output by model
  const modelBarData = useMemo(() => {
    if (!data) return [];

    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      input: stats.input,
      output: stats.output,
    }));
  }, [data]);

  // Sort sessions
  const sortedSessions = useMemo(() => {
    if (!data) return [];

    return [...data.sessions].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "timestamp":
          return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        case "model":
          return dir * a.model.localeCompare(b.model);
        case "inputTokens":
          return dir * (a.inputTokens - b.inputTokens);
        case "outputTokens":
          return dir * (a.outputTokens - b.outputTokens);
        case "total":
          return dir * (a.total - b.total);
        default:
          return 0;
      }
    });
  }, [data, sortField, sortDirection]);

  const displayedSessions = tableExpanded ? sortedSessions : sortedSessions.slice(0, 10);

  // Toggle sort
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-2">
          <p className="text-destructive text-lg">⚠️</p>
          <p className="text-sm text-muted-foreground">{error || "No data available"}</p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Token Usage
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track AI token consumption across models
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Mock Data Notice */}
      {data._mock && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <span className="font-medium">Sample data.</span> Real token tracking will be
            integrated when Clawdbot gateway exposes per-session usage metrics.
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          title="All Time"
          icon={TrendingUp}
          total={data.overview.total}
          input={data.overview.totalInput}
          output={data.overview.totalOutput}
          accent="bg-chart-1/10 text-chart-1"
        />
        <OverviewCard
          title="This Month"
          icon={CalendarRange}
          total={data.overview.month}
          input={data.overview.monthInput}
          output={data.overview.monthOutput}
          accent="bg-chart-2/10 text-chart-2"
        />
        <OverviewCard
          title="This Week"
          icon={CalendarDays}
          total={data.overview.week}
          input={data.overview.weekInput}
          output={data.overview.weekOutput}
          accent="bg-chart-3/10 text-chart-3"
        />
        <OverviewCard
          title="Today"
          icon={Calendar}
          total={data.overview.today}
          input={data.overview.todayInput}
          output={data.overview.todayOutput}
          accent="bg-chart-4/10 text-chart-4"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* ── Area Chart: Usage Trend ────────────────────────────────────── */}
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
                <TabsTrigger value="day" className="text-xs px-2.5 h-6">
                  Daily
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 h-6">
                  Weekly
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 h-6">
                  Monthly
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {trendChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] sm:h-[300px]">
                <p className="text-muted-foreground text-sm">No data for this period</p>
              </div>
            ) : modelFilter !== "all" ? (
              <ChartContainer config={inputOutputChartConfig} className="h-[200px] sm:h-[300px] w-full">
                <AreaChart
                  data={trendChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillInput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-input)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-input)" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="fillOutput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-output)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--color-output)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => formatTokens(v)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">
                              {inputOutputChartConfig[name as keyof typeof inputOutputChartConfig]
                                ?.label || name}
                              :
                            </span>{" "}
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {(value as number).toLocaleString()}
                            </span>
                          </>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="input"
                    stroke="var(--color-input)"
                    fill="url(#fillInput)"
                    strokeWidth={2}
                    stackId="a"
                  />
                  <Area
                    type="monotone"
                    dataKey="output"
                    stroke="var(--color-output)"
                    fill="url(#fillOutput)"
                    strokeWidth={2}
                    stackId="a"
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <ChartContainer config={modelChartConfig} className="h-[200px] sm:h-[300px] w-full">
                <AreaChart
                  data={trendChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    {Object.keys(modelChartConfig).map((model) => (
                      <linearGradient
                        key={model}
                        id={`fill-${model}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={`var(--color-${model})`}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={`var(--color-${model})`}
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => formatTokens(v)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">
                              {modelChartConfig[name as keyof typeof modelChartConfig]?.label ||
                                name}
                              :
                            </span>{" "}
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {(value as number).toLocaleString()}
                            </span>
                          </>
                        )}
                      />
                    }
                  />
                  {Object.keys(modelChartConfig).map((model) => (
                    <Area
                      key={model}
                      type="monotone"
                      dataKey={model}
                      stroke={`var(--color-${model})`}
                      fill={`url(#fill-${model})`}
                      strokeWidth={2}
                      stackId="1"
                    />
                  ))}
                  <ChartLegend content={<ChartLegendContent />} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* ── Radial Chart: Model Distribution ────────────────────────────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              By Model
            </CardTitle>
            <CardDescription>Token distribution across models</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            <ChartContainer
              config={pieChartConfig}
              className="mx-auto aspect-square max-h-[180px] sm:max-h-[220px]"
            >
              <RadialBarChart
                data={radialChartData}
                innerRadius={30}
                outerRadius={110}
                startAngle={180}
                endAngle={0}
              >
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                </PolarRadiusAxis>
                <RadialBar
                  dataKey="value"
                  background
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ChartContainer>

            {/* Legend with details */}
            <div className="space-y-3 px-2 pb-4">
              {Object.entries(data.byModel).map(([model, stats]) => {
                const totalAll = Object.values(data.byModel).reduce(
                  (s, m) => s + m.total,
                  0
                );
                const pct = totalAll > 0 ? ((stats.total / totalAll) * 100).toFixed(1) : "0";
                return (
                  <div key={model} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-[2px] flex-shrink-0"
                      style={{ backgroundColor: MODEL_CHART_COLORS[model] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {MODEL_LABELS[model]}
                        </span>
                        <span className="text-sm text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatTokens(stats.input)} in</span>
                        <span>·</span>
                        <span>{formatTokens(stats.output)} out</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bar Chart: Input vs Output by Model ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Input vs Output by Model
          </CardTitle>
          <CardDescription>
            Compare input and output token usage across each model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={barChartConfig} className="h-[200px] sm:h-[250px] w-full">
            <BarChart
              data={modelBarData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => formatTokens(v)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) => (
                      <>
                        <span className="text-muted-foreground">
                          {barChartConfig[name as keyof typeof barChartConfig]?.label || name}:
                        </span>{" "}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {(value as number).toLocaleString()}
                        </span>
                      </>
                    )}
                  />
                }
              />
              <Bar
                dataKey="input"
                fill="var(--color-input)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="output"
                fill="var(--color-output)"
                radius={[4, 4, 0, 0]}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── Sessions Table ──────────────────────────────────────────────────── */}
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
                  <th
                    className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("timestamp")}
                  >
                    <span className="flex items-center gap-1">
                      Date <SortIcon field="timestamp" />
                    </span>
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Activity
                  </th>
                  <th
                    className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("model")}
                  >
                    <span className="flex items-center gap-1">
                      Model <SortIcon field="model" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                    onClick={() => toggleSort("inputTokens")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Input <SortIcon field="inputTokens" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                    onClick={() => toggleSort("outputTokens")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Output <SortIcon field="outputTokens" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("total")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Total <SortIcon field="total" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedSessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
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
                      {formatTokens(session.inputTokens)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                      {formatTokens(session.outputTokens)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-medium">
                      {formatTokens(session.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show more/less */}
          {sortedSessions.length > 10 && (
            <button
              onClick={() => setTableExpanded(!tableExpanded)}
              className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              {tableExpanded ? (
                <>
                  Show Less <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show All {sortedSessions.length} Sessions{" "}
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
