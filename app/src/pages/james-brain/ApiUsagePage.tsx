import { useEffect, useState, useMemo, useCallback } from "react";
import { format, subDays } from "date-fns";
import {
  DollarSign,
  Activity,
  TrendingUp,
  TrendingDown,
  Crown,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Download,
  Zap,
  BarChart3,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarRadiusAxis,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface ApiProvider {
  id: string;
  name: string;
  category: string;
  icon: string;
  color: string;
  pricingModel: string;
  freeTier: boolean;
}

interface ApiSummary {
  apiId: string;
  name: string;
  category: string;
  calls: number;
  units: number;
  unitType: string;
  cost: number;
  trend: number;
  avgDailyCost: number;
  inputUnits?: number;
  outputUnits?: number;
}

interface CostTrendEntry {
  date: string;
  anthropic: number;
  groq: number;
  "google-drive": number;
  "google-sheets": number;
  "google-calendar": number;
  total: number;
}

interface ApiUsageData {
  _mock: boolean;
  _note: string;
  overview: {
    monthCost: number;
    monthCalls: number;
    todayCost: number;
    todayCalls: number;
    projectedMonthlyCost: number;
    topApiId: string;
    topApiName: string;
    topApiCost: number;
  };
  providers: ApiProvider[];
  summaries: ApiSummary[];
  costTrend: CostTrendEntry[];
  dailyUsage: Array<{
    date: string;
    apiId: string;
    calls: number;
    units: number;
    unitType: string;
    cost: number;
    inputUnits?: number;
    outputUnits?: number;
  }>;
  pricing: {
    anthropic: Record<string, { input: number; output: number }>;
    groq: { whisper: number };
    googleQuota: Record<string, { daily: number; description: string }>;
  };
}

type SortField = "name" | "calls" | "units" | "cost" | "trend";
type SortDirection = "asc" | "desc";
type TimeRange = "7d" | "14d" | "30d" | "90d";

// ─── Chart Configs ──────────────────────────────────────────────────────────

const costTrendChartConfig = {
  anthropic: {
    label: "Anthropic",
    color: "hsl(var(--chart-1))",
  },
  groq: {
    label: "Groq",
    color: "hsl(var(--chart-2))",
  },
  "google-drive": {
    label: "Google Drive",
    color: "hsl(var(--chart-3))",
  },
  "google-sheets": {
    label: "Google Sheets",
    color: "hsl(var(--chart-4))",
  },
  "google-calendar": {
    label: "Google Calendar",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const breakdownChartConfig = {
  cost: {
    label: "Cost",
  },
  anthropic: {
    label: "Anthropic",
    color: "hsl(var(--chart-1))",
  },
  groq: {
    label: "Groq",
    color: "hsl(var(--chart-2))",
  },
  "google-drive": {
    label: "Google Drive",
    color: "hsl(var(--chart-3))",
  },
  "google-sheets": {
    label: "Google Sheets",
    color: "hsl(var(--chart-4))",
  },
  "google-calendar": {
    label: "Google Calendar",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

const callsBarConfig = {
  anthropic: {
    label: "Anthropic",
    color: "hsl(var(--chart-1))",
  },
  groq: {
    label: "Groq",
    color: "hsl(var(--chart-2))",
  },
  "google-drive": {
    label: "Google Drive",
    color: "hsl(var(--chart-3))",
  },
  "google-sheets": {
    label: "Google Sheets",
    color: "hsl(var(--chart-4))",
  },
  "google-calendar": {
    label: "Google Calendar",
    color: "hsl(var(--chart-5))",
  },
} satisfies ChartConfig;

// ─── Constants ──────────────────────────────────────────────────────────────

const API_COLORS: Record<string, string> = {
  anthropic: "hsl(var(--chart-1))",
  groq: "hsl(var(--chart-2))",
  "google-drive": "hsl(var(--chart-3))",
  "google-sheets": "hsl(var(--chart-4))",
  "google-calendar": "hsl(var(--chart-5))",
};

const API_ICONS: Record<string, string> = {
  anthropic: "🤖",
  groq: "🎙️",
  "google-drive": "📁",
  "google-sheets": "📊",
  "google-calendar": "📅",
};

const CATEGORY_BADGES: Record<string, string> = {
  ai: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  transcription: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  cloud: "bg-green-500/10 text-green-700 dark:text-green-400",
  tts: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  other: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCost(n: number): string {
  if (n === 0) return "Free";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatUnits(n: number, unitType: string): string {
  if (unitType === "tokens") {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  }
  if (unitType === "seconds") {
    if (n >= 3600) return `${(n / 3600).toFixed(1)}h`;
    if (n >= 60) return `${(n / 60).toFixed(1)}m`;
    return `${n}s`;
  }
  return n.toLocaleString();
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Overview Card ──────────────────────────────────────────────────────────

function OverviewCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof DollarSign;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground pt-0.5">{subtitle}</p>
            )}
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

export function ApiUsagePage() {
  const [data, setData] = useState<ApiUsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("cost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tableExpanded, setTableExpanded] = useState(false);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const days = parseInt(timeRange);
        const startDate = subDays(new Date(), days).toISOString().slice(0, 10);
        const endDate = new Date().toISOString().slice(0, 10);
        const result = await api.getApiUsage({ startDate, endDate });
        setData(result);
      } catch (err) {
        console.error("Failed to fetch API usage data:", err);
        setError("Failed to load API usage data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  // Prepare cost trend chart data
  const trendChartData = useMemo(() => {
    if (!data) return [];
    return data.costTrend.map((entry) => ({
      date: format(new Date(entry.date), "MMM d"),
      anthropic: entry.anthropic,
      groq: entry.groq,
      "google-drive": entry["google-drive"],
      "google-sheets": entry["google-sheets"],
      "google-calendar": entry["google-calendar"],
      total: entry.total,
    }));
  }, [data]);

  // Radial chart data for cost breakdown
  const radialChartData = useMemo(() => {
    if (!data) return [];
    const totalCost = data.summaries.reduce((s, a) => s + a.cost, 0);
    return data.summaries
      .filter((s) => s.cost > 0) // Only paid APIs
      .map((summary) => ({
        apiId: summary.apiId,
        name: summary.name,
        cost: summary.cost,
        value: totalCost > 0 ? Math.round((summary.cost / totalCost) * 100) : 0,
        fill: API_COLORS[summary.apiId] || "hsl(var(--chart-4))",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // Bar chart data for API calls
  const callsBarData = useMemo(() => {
    if (!data) return [];
    // Group last 7 days into a bar chart
    const last7Days = data.costTrend.slice(-7);
    return last7Days.map((entry) => {
      // Get calls per API for this date
      const dayUsage = data.dailyUsage.filter((u) => u.date === entry.date);
      const result: Record<string, number | string> = {
        date: format(new Date(entry.date), "MMM d"),
      };
      for (const provider of data.providers) {
        const providerUsage = dayUsage.find((u) => u.apiId === provider.id);
        result[provider.id] = providerUsage?.calls || 0;
      }
      return result;
    });
  }, [data]);

  // Filter and sort summaries
  const filteredSummaries = useMemo(() => {
    if (!data) return [];
    let summaries = [...data.summaries];

    if (categoryFilter !== "all") {
      summaries = summaries.filter((s) => s.category === categoryFilter);
    }

    summaries.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "calls":
          return dir * (a.calls - b.calls);
        case "units":
          return dir * (a.units - b.units);
        case "cost":
          return dir * (a.cost - b.cost);
        case "trend":
          return dir * (a.trend - b.trend);
        default:
          return 0;
      }
    });

    return summaries;
  }, [data, categoryFilter, sortField, sortDirection]);

  const displayedSummaries = tableExpanded ? filteredSummaries : filteredSummaries.slice(0, 10);

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

  // Export to CSV
  const exportCsv = useCallback(() => {
    if (!data) return;

    const headers = ["API", "Category", "Calls", "Units", "Unit Type", "Cost ($)", "Trend (%)", "Avg Daily Cost ($)"];
    const rows = data.summaries.map((s) => [
      s.name,
      s.category,
      s.calls,
      s.units,
      s.unitType,
      s.cost.toFixed(4),
      s.trend.toFixed(1),
      s.avgDailyCost.toFixed(4),
    ]);

    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data]);

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
            <DollarSign className="h-7 w-7" />
            API Usage & Costs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track usage and costs across all integrated APIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Mock Data Notice */}
      {data._mock && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <span className="font-medium">Sample data.</span> Real cost tracking will be
            integrated via Clawdbot gateway logs, Groq usage logs, and Google API metrics.
          </p>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          title="Cost This Month"
          value={formatCost(data.overview.monthCost)}
          subtitle={`Projected: ${formatCost(data.overview.projectedMonthlyCost)}/mo`}
          icon={DollarSign}
          accent="bg-chart-1/10 text-chart-1"
        />
        <OverviewCard
          title="API Calls This Month"
          value={formatNumber(data.overview.monthCalls)}
          subtitle={`${formatNumber(data.overview.todayCalls)} today`}
          icon={Activity}
          accent="bg-chart-2/10 text-chart-2"
        />
        <OverviewCard
          title="Top API by Cost"
          value={`${API_ICONS[data.overview.topApiId] || "📦"} ${data.overview.topApiName.split(" ")[0]}`}
          subtitle={formatCost(data.overview.topApiCost)}
          icon={Crown}
          accent="bg-chart-3/10 text-chart-3"
        />
        <OverviewCard
          title="Today's Cost"
          value={formatCost(data.overview.todayCost)}
          subtitle={`${data.overview.todayCalls} calls`}
          icon={Zap}
          accent="bg-chart-4/10 text-chart-4"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* ── Stacked Area Chart: Cost Trend ────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cost Trend
            </CardTitle>
            <CardDescription>
              Daily costs stacked by API provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] sm:h-[300px]">
                <p className="text-muted-foreground text-sm">No data for this period</p>
              </div>
            ) : (
              <ChartContainer config={costTrendChartConfig} className="h-[200px] sm:h-[300px] w-full">
                <AreaChart
                  data={trendChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    {Object.keys(costTrendChartConfig).map((apiId) => (
                      <linearGradient
                        key={apiId}
                        id={`fill-cost-${apiId}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={`var(--color-${apiId})`}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={`var(--color-${apiId})`}
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
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        formatter={(value, name) => (
                          <>
                            <span className="text-muted-foreground">
                              {costTrendChartConfig[name as keyof typeof costTrendChartConfig]?.label || name}:
                            </span>{" "}
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              ${(value as number).toFixed(4)}
                            </span>
                          </>
                        )}
                      />
                    }
                  />
                  {Object.keys(costTrendChartConfig).map((apiId) => (
                    <Area
                      key={apiId}
                      type="monotone"
                      dataKey={apiId}
                      stroke={`var(--color-${apiId})`}
                      fill={`url(#fill-cost-${apiId})`}
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

        {/* ── Radial Chart: Cost Breakdown ────────────────────────────── */}
        <Card className="flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Breakdown
            </CardTitle>
            <CardDescription>
              Monthly cost distribution (paid APIs only)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {radialChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[180px]">
                <p className="text-muted-foreground text-sm">No paid API costs</p>
              </div>
            ) : (
              <ChartContainer
                config={breakdownChartConfig}
                className="mx-auto aspect-square max-h-[180px] sm:max-h-[220px]"
              >
                <RadialBarChart
                  data={radialChartData}
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

            {/* Legend with details */}
            <div className="space-y-3 px-2 pb-4">
              {data.summaries
                .filter((s) => s.cost > 0)
                .sort((a, b) => b.cost - a.cost)
                .map((summary) => {
                  const totalCost = data.summaries.reduce((s, a) => s + a.cost, 0);
                  const pct = totalCost > 0 ? ((summary.cost / totalCost) * 100).toFixed(1) : "0";
                  return (
                    <div key={summary.apiId} className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-[2px] flex-shrink-0"
                        style={{ backgroundColor: API_COLORS[summary.apiId] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {API_ICONS[summary.apiId]} {summary.name.split("(")[0].trim()}
                          </span>
                          <span className="text-sm text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatCost(summary.cost)}</span>
                          <span>·</span>
                          <span>{formatNumber(summary.calls)} calls</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {/* Free tier APIs */}
              {data.summaries.filter((s) => s.cost === 0).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Free Tier APIs</p>
                  {data.summaries
                    .filter((s) => s.cost === 0)
                    .map((summary) => (
                      <div key={summary.apiId} className="flex items-center gap-3 py-1">
                        <span
                          className="w-3 h-3 rounded-[2px] flex-shrink-0"
                          style={{ backgroundColor: API_COLORS[summary.apiId] }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs">
                              {API_ICONS[summary.apiId]} {summary.name.split("(")[0].trim()}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/5 text-green-600 dark:text-green-400 border-green-500/20">
                              Free
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bar Chart: API Calls (Last 7 Days) ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            API Calls (Last 7 Days)
          </CardTitle>
          <CardDescription>
            Daily API call count by provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={callsBarConfig} className="h-[200px] sm:h-[250px] w-full">
            <BarChart
              data={callsBarData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
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
                tickFormatter={(v) => formatNumber(v)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) => (
                      <>
                        <span className="text-muted-foreground">
                          {callsBarConfig[name as keyof typeof callsBarConfig]?.label || name}:
                        </span>{" "}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {(value as number).toLocaleString()} calls
                        </span>
                      </>
                    )}
                  />
                }
              />
              {data.providers.map((provider) => (
                <Bar
                  key={provider.id}
                  dataKey={provider.id}
                  fill={`var(--color-${provider.id})`}
                  radius={[2, 2, 0, 0]}
                  stackId="calls"
                />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── API Breakdown Table ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 pb-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              API Breakdown
            </CardTitle>
            <CardDescription className="mt-1">
              Detailed usage and cost per API this month
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All APIs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All APIs</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="transcription">Transcription</SelectItem>
                <SelectItem value="cloud">Cloud</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filteredSummaries.length} APIs
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th
                    className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("name")}
                  >
                    <span className="flex items-center gap-1">
                      API <SortIcon field="name" />
                    </span>
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">
                    Category
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("calls")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Calls <SortIcon field="calls" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden md:table-cell"
                    onClick={() => toggleSort("units")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Usage <SortIcon field="units" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort("cost")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Cost <SortIcon field="cost" />
                    </span>
                  </th>
                  <th
                    className="text-right py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors hidden lg:table-cell"
                    onClick={() => toggleSort("trend")}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Trend <SortIcon field="trend" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedSummaries.map((summary) => (
                  <tr
                    key={summary.apiId}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{API_ICONS[summary.apiId]}</span>
                        <div>
                          <span className="font-medium text-sm block">{summary.name}</span>
                          {summary.inputUnits !== undefined && summary.outputUnits !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              {formatUnits(summary.inputUnits, summary.unitType)} in ·{" "}
                              {formatUnits(summary.outputUnits, summary.unitType)} out
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-xs ${CATEGORY_BADGES[summary.category] || ""}`}
                      >
                        {summary.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums">
                      {formatNumber(summary.calls)}
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                      {formatUnits(summary.units, summary.unitType)}
                      <span className="text-xs ml-1">{summary.unitType}</span>
                    </td>
                    <td className="py-3 px-2 text-right tabular-nums font-medium">
                      {summary.cost > 0 ? (
                        formatCost(summary.cost)
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/5 text-green-600 dark:text-green-400 border-green-500/20">
                          Free
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right hidden lg:table-cell">
                      {summary.cost > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            summary.trend > 0
                              ? "text-red-600 dark:text-red-400"
                              : summary.trend < 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {summary.trend > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : summary.trend < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          {summary.trend > 0 ? "+" : ""}
                          {summary.trend.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Show more/less */}
          {filteredSummaries.length > 10 && (
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
                  Show All {filteredSummaries.length} APIs <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Pricing Reference ──────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            Pricing Reference
          </CardTitle>
          <CardDescription>
            Current pricing for tracked APIs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Anthropic Pricing */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <span className="font-medium text-sm">Anthropic (Claude)</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {Object.entries(data.pricing.anthropic).map(([model, prices]) => (
                  <div key={model} className="flex justify-between">
                    <span>{model.replace("claude-", "").replace("-", " ")}</span>
                    <span className="tabular-nums">
                      ${(prices.input * 1_000_000).toFixed(2)}/{(prices.output * 1_000_000).toFixed(2)} /MTok
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Groq Pricing */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎙️</span>
                <span className="font-medium text-sm">Groq (Whisper STT)</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Whisper Large v3</span>
                  <span className="tabular-nums">${data.pricing.groq.whisper}/second</span>
                </div>
              </div>
            </div>

            {/* Google Quotas */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">☁️</span>
                <span className="font-medium text-sm">Google APIs</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {Object.entries(data.pricing.googleQuota).map(([api, quota]) => (
                  <div key={api} className="flex justify-between">
                    <span className="capitalize">{api}</span>
                    <span className="tabular-nums">
                      {formatNumber(quota.daily)}/day
                    </span>
                  </div>
                ))}
                <div className="pt-1 text-green-600 dark:text-green-400 font-medium">
                  ✓ Free tier — no costs
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
