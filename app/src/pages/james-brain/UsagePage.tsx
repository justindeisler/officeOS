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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// ─── Constants ──────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "opus-4-5": "#8b5cf6",    // violet
  "sonnet-4-5": "#3b82f6",  // blue
  "haiku-4-5": "#10b981",   // emerald
};

const MODEL_LABELS: Record<string, string> = {
  "opus-4-5": "Opus 4.5",
  "sonnet-4-5": "Sonnet 4.5",
  "haiku-4-5": "Haiku 4.5",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTokensFull(n: number): string {
  return n.toLocaleString();
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
      <p className="font-medium text-sm mb-2 text-foreground">{label}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-sm flex items-center gap-2"
        >
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{formatTokensFull(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; percentage: number; fill: string } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-lg">
      <p className="font-medium text-sm mb-1 text-foreground">{data.name}</p>
      <p className="text-sm text-muted-foreground">
        {formatTokensFull(data.value)} tokens ({data.percentage.toFixed(1)}%)
      </p>
    </div>
  );
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
                <ArrowUpRight className="h-3 w-3 text-blue-500" />
                {formatTokens(input)} in
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ArrowDownRight className="h-3 w-3 text-emerald-500" />
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
      // Single model - show input vs output
      return data.trend.map((entry) => ({
        date: groupBy === "day" ? format(new Date(entry.date), "MMM d") : 
              groupBy === "week" ? `W${format(new Date(entry.date), "w")}` :
              format(new Date(entry.date), "MMM yyyy"),
        input: entry.inputTokens,
        output: entry.outputTokens,
      }));
    }

    // All models - aggregate by date, show per-model
    const dateMap = new Map<string, Record<string, number>>();
    for (const entry of data.trend) {
      const dateLabel = groupBy === "day" ? format(new Date(entry.date), "MMM d") :
                        groupBy === "week" ? `W${format(new Date(entry.date), "w")}` :
                        format(new Date(entry.date), "MMM yyyy");
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

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    if (!data) return [];

    const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      value: stats.total,
      percentage: totalAll > 0 ? (stats.total / totalAll) * 100 : 0,
      fill: MODEL_COLORS[model] || "#94a3b8",
    }));
  }, [data]);

  // Prepare bar chart data for input/output by model
  const modelBarData = useMemo(() => {
    if (!data) return [];

    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      input: stats.input,
      output: stats.output,
      fill: MODEL_COLORS[model] || "#94a3b8",
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
            <span className="font-medium">Sample data.</span> Real token tracking will be integrated when Clawdbot gateway exposes per-session usage metrics.
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
          accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        />
        <OverviewCard
          title="This Month"
          icon={CalendarRange}
          total={data.overview.month}
          input={data.overview.monthInput}
          output={data.overview.monthOutput}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <OverviewCard
          title="This Week"
          icon={CalendarDays}
          total={data.overview.week}
          input={data.overview.weekInput}
          output={data.overview.weekOutput}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <OverviewCard
          title="Today"
          icon={Calendar}
          total={data.overview.today}
          input={data.overview.todayInput}
          output={data.overview.todayOutput}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Trend
            </CardTitle>
            <Tabs value={groupBy} onValueChange={setGroupBy}>
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs px-2.5 h-6">Daily</TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 h-6">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 h-6">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {trendChartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-muted-foreground text-sm">No data for this period</p>
              </div>
            ) : modelFilter !== "all" ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatTokens(v)}
                    className="text-muted-foreground"
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="input"
                    name="Input Tokens"
                    stroke="#3b82f6"
                    fill="url(#inputGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="output"
                    name="Output Tokens"
                    stroke="#10b981"
                    fill="url(#outputGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    {Object.entries(MODEL_COLORS).map(([model, color]) => (
                      <linearGradient key={model} id={`grad-${model}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => formatTokens(v)}
                    className="text-muted-foreground"
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: "10px" }}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                  {Object.entries(MODEL_COLORS).map(([model, color]) => (
                    <Area
                      key={model}
                      type="monotone"
                      dataKey={model}
                      name={MODEL_LABELS[model]}
                      stroke={color}
                      fill={`url(#grad-${model})`}
                      strokeWidth={2}
                      stackId="1"
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Model Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              By Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center total */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-lg font-bold">{formatTokens(data.overview.total)}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </div>
            </div>

            {/* Legend with details */}
            <div className="space-y-3 mt-2">
              {Object.entries(data.byModel).map(([model, stats]) => {
                const totalAll = Object.values(data.byModel).reduce(
                  (s, m) => s + m.total,
                  0
                );
                const pct = totalAll > 0 ? ((stats.total / totalAll) * 100).toFixed(1) : "0";
                return (
                  <div key={model} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: MODEL_COLORS[model] }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {MODEL_LABELS[model]}
                        </span>
                        <span className="text-sm text-muted-foreground">{pct}%</span>
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

      {/* Input vs Output by Model */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Input vs Output by Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={modelBarData}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatTokens(v)}
                className="text-muted-foreground"
              />
              <RechartsTooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
              <Bar dataKey="input" name="Input Tokens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="output" name="Output Tokens" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
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
                          borderColor: MODEL_COLORS[session.model] + "40",
                          color: MODEL_COLORS[session.model],
                          backgroundColor: MODEL_COLORS[session.model] + "10",
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
                  Show All {sortedSessions.length} Sessions <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
