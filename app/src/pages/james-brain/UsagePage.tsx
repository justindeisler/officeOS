import { useEffect, useState, useMemo, useRef } from "react";
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
  Cpu,
  Activity,
  Sparkles,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// Design Tokens — Observatory Theme
// ─────────────────────────────────────────────────────────────────────────
// Informed by ui-ux-pro-max skill database:
//   Style:  Financial Dashboard (#020617) + Glassmorphism + Bento Grid
//   Color:  Dark bg with violet accent hierarchy
//   Type:   Rajdhani (headings) + JetBrains Mono (data) + Inter (body)
//   Motion: Count-up counters, hover scale 1.02, glow on active elements
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  accent: {
    violet: { base: "#a78bfa", glow: "rgba(139,92,246,0.15)", muted: "rgba(139,92,246,0.08)" },
    blue:   { base: "#60a5fa", glow: "rgba(96,165,250,0.15)",  muted: "rgba(96,165,250,0.08)" },
    emerald:{ base: "#34d399", glow: "rgba(52,211,153,0.15)",  muted: "rgba(52,211,153,0.08)" },
    amber:  { base: "#fbbf24", glow: "rgba(251,191,36,0.15)",  muted: "rgba(251,191,36,0.08)" },
  },
  text: {
    primary:   "rgba(248,250,252,0.95)",
    secondary: "rgba(148,163,184,0.8)",
    muted:     "rgba(100,116,139,0.6)",
  },
  border:      "rgba(139,92,246,0.1)",
  borderHover: "rgba(139,92,246,0.2)",
  surface:     "rgba(15,18,40,0.55)",
  grid:        "rgba(139,92,246,0.06)",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface UsageData {
  _mock: boolean;
  _note: string;
  overview: {
    total: number; totalInput: number; totalOutput: number;
    today: number; todayInput: number; todayOutput: number;
    week: number; weekInput: number; weekOutput: number;
    month: number; monthInput: number; monthOutput: number;
  };
  byModel: Record<string, { total: number; input: number; output: number }>;
  trend: Array<{
    date: string; inputTokens: number; outputTokens: number;
    tokens: number; model: string;
  }>;
  sessions: Array<{
    id: string; timestamp: string; activity: string; model: string;
    inputTokens: number; outputTokens: number; total: number;
  }>;
}

type SortField = "timestamp" | "model" | "inputTokens" | "outputTokens" | "total";
type SortDirection = "asc" | "desc";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_COLORS: Record<string, string> = {
  "opus-4-5":   "#a78bfa",
  "sonnet-4-5": "#60a5fa",
  "haiku-4-5":  "#34d399",
};

const MODEL_LABELS: Record<string, string> = {
  "opus-4-5":   "Opus 4.5",
  "sonnet-4-5": "Sonnet 4.5",
  "haiku-4-5":  "Haiku 4.5",
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTokensFull(n: number): string {
  return n.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
// Animation Presets
// ═══════════════════════════════════════════════════════════════════════════

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ═══════════════════════════════════════════════════════════════════════════
// Animated Counter Hook (Financial Dashboard pattern: number count-up)
// ═══════════════════════════════════════════════════════════════════════════

function useAnimatedCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    if (start === target) { setValue(target); return; }
    const startTime = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// Glass Card (Glassmorphism pattern: backdrop-blur + translucent overlay)
// ═══════════════════════════════════════════════════════════════════════════

function GlassCard({ children, className = "", glowColor }: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <motion.div
      variants={staggerItem}
      className={`
        relative rounded-2xl overflow-hidden
        backdrop-blur-xl border transition-all duration-300 ease-out
        hover:shadow-[0_0_40px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]
        ${className}
      `}
      style={{
        background: T.surface,
        borderColor: T.border,
        boxShadow: "0 0 30px rgba(139,92,246,0.04), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {glowColor && (
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: glowColor }}
        />
      )}
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Chart Tooltips (themed to match Observatory)
// ═══════════════════════════════════════════════════════════════════════════

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "rgba(10,12,28,0.95)",
        border: `1px solid ${T.border}`,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <p className="font-medium text-sm mb-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.primary }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm flex items-center gap-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          <span style={{ color: T.text.secondary }}>{entry.name}:</span>
          <span className="font-mono font-medium" style={{ color: T.text.primary }}>{formatTokensFull(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; percentage: number; fill: string } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl p-3.5"
      style={{
        background: "rgba(10,12,28,0.95)",
        border: `1px solid ${T.border}`,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <p className="font-medium text-sm mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.primary }}>{d.name}</p>
      <p className="text-sm font-mono" style={{ color: T.text.secondary }}>
        {formatTokensFull(d.value)} tokens ({d.percentage.toFixed(1)}%)
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Metric Card (Bento Grid pattern: varied card sizes, hover scale 1.02)
// ═══════════════════════════════════════════════════════════════════════════

function MetricCard({ title, icon: Icon, value, subLeft, subRight, accentColor }: {
  title: string;
  icon: typeof Zap;
  value: number;
  subLeft?: { label: string; value: string; icon?: typeof ArrowUpRight };
  subRight?: { label: string; value: string; icon?: typeof ArrowDownRight };
  accentColor: { base: string; glow: string; muted: string };
}) {
  const animatedValue = useAnimatedCounter(value);

  return (
    <motion.div variants={staggerItem}>
      <GlassCard className="p-5 group" glowColor={accentColor.glow}>
        <div className="flex items-start justify-between mb-3">
          <div
            className="text-xs font-semibold uppercase tracking-[0.15em]"
            style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.secondary }}
          >
            {title}
          </div>
          <div className="rounded-xl p-2 transition-all duration-300" style={{ background: accentColor.muted }}>
            <Icon className="h-4 w-4" style={{ color: accentColor.base }} />
          </div>
        </div>
        <div className="text-3xl font-bold tracking-tight mb-1 font-mono tabular-nums" style={{ color: T.text.primary }}>
          {formatTokens(animatedValue)}
        </div>
        {(subLeft || subRight) && (
          <div className="flex items-center gap-3 mt-2">
            {subLeft && (
              <span className="flex items-center gap-1 text-xs" style={{ color: T.text.muted }}>
                {subLeft.icon && <subLeft.icon className="h-3 w-3" style={{ color: T.accent.blue.base }} />}
                <span className="font-mono">{subLeft.value}</span>
                <span>{subLeft.label}</span>
              </span>
            )}
            {subRight && (
              <span className="flex items-center gap-1 text-xs" style={{ color: T.text.muted }}>
                {subRight.icon && <subRight.icon className="h-3 w-3" style={{ color: T.accent.emerald.base }} />}
                <span className="font-mono">{subRight.value}</span>
                <span>{subRight.label}</span>
              </span>
            )}
          </div>
        )}
        {/* Bottom accent line — glow on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-30 group-hover:opacity-60 transition-opacity duration-500"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor.base}, transparent)` }}
        />
      </GlassCard>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ title, icon: Icon }: { title: string; icon: typeof TrendingUp }) {
  return (
    <h3
      className="text-lg font-bold tracking-wide flex items-center gap-2.5"
      style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.primary }}
    >
      <Icon className="h-5 w-5" style={{ color: T.accent.violet.base }} />
      {title}
    </h3>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GroupBy Tabs (custom styled, not shadcn)
// ═══════════════════════════════════════════════════════════════════════════

function GroupByTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl p-1" style={{ background: T.accent.violet.muted, border: `1px solid rgba(139,92,246,0.08)` }}>
      {(["day", "week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 uppercase tracking-wider ${
            value === v
              ? "text-[rgba(167,139,250,1)] shadow-[0_0_10px_rgba(139,92,246,0.1)]"
              : "text-[rgba(148,163,184,0.5)] hover:text-[rgba(148,163,184,0.8)]"
          }`}
          style={{
            fontFamily: "'Rajdhani', sans-serif",
            background: value === v ? "rgba(139,92,246,0.15)" : "transparent",
          }}
        >
          {v === "day" ? "Daily" : v === "week" ? "Weekly" : "Monthly"}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Chart Axis Styles (minimal grid — Data-Dense Dashboard pattern)
// ═══════════════════════════════════════════════════════════════════════════

const axisStyle = {
  tick: { fontSize: 11, fill: "rgba(148,163,184,0.5)", fontFamily: "'JetBrains Mono', monospace" },
  axisLine: { stroke: T.grid },
  tickLine: { stroke: T.grid },
};
const gridStyle = { stroke: T.grid, strokeDasharray: "4 8" };

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState("day");
  const [modelFilter, setModelFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [tableExpanded, setTableExpanded] = useState(false);

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

  // ─── Derived Data ───────────────────────────────────────────────────────

  const trendChartData = useMemo(() => {
    if (!data) return [];
    if (modelFilter !== "all") {
      return data.trend.map((entry) => ({
        date: groupBy === "day" ? format(new Date(entry.date), "MMM d") :
              groupBy === "week" ? `W${format(new Date(entry.date), "w")}` :
              format(new Date(entry.date), "MMM yyyy"),
        input: entry.inputTokens,
        output: entry.outputTokens,
      }));
    }
    const dateMap = new Map<string, Record<string, number>>();
    for (const entry of data.trend) {
      const dateLabel = groupBy === "day" ? format(new Date(entry.date), "MMM d") :
                        groupBy === "week" ? `W${format(new Date(entry.date), "w")}` :
                        format(new Date(entry.date), "MMM yyyy");
      if (!dateMap.has(dateLabel)) dateMap.set(dateLabel, {});
      const existing = dateMap.get(dateLabel)!;
      existing[entry.model] = (existing[entry.model] || 0) + entry.tokens;
    }
    return Array.from(dateMap.entries()).map(([date, models]) => ({ date, ...models }));
  }, [data, groupBy, modelFilter]);

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

  const modelBarData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      input: stats.input,
      output: stats.output,
    }));
  }, [data]);

  const sortedSessions = useMemo(() => {
    if (!data) return [];
    return [...data.sessions].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "timestamp": return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        case "model": return dir * a.model.localeCompare(b.model);
        case "inputTokens": return dir * (a.inputTokens - b.inputTokens);
        case "outputTokens": return dir * (a.outputTokens - b.outputTokens);
        case "total": return dir * (a.total - b.total);
        default: return 0;
      }
    });
  }, [data, sortField, sortDirection]);

  const displayedSessions = tableExpanded ? sortedSessions : sortedSessions.slice(0, 10);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDirection("desc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div
              className="h-10 w-10 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(139,92,246,0.15)", borderTopColor: T.accent.violet.base }}
            />
            <div
              className="absolute inset-0 h-10 w-10 rounded-full animate-ping opacity-20"
              style={{ background: T.accent.violet.glow }}
            />
          </div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.muted }}>
            Loading usage data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center p-16 min-h-[60vh]">
        <div
          className="rounded-2xl p-8 text-center max-w-sm backdrop-blur-xl"
          style={{ background: T.surface, border: `1px solid ${T.border}` }}
        >
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm" style={{ color: T.text.secondary }}>{error || "No data available"}</p>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-8 usage-dashboard">
      {/* ─── Page Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        {/* Ambient glow behind header (OLED Dark Mode pattern) */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full blur-[100px] opacity-[0.07] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${T.accent.violet.base}, ${T.accent.blue.base}, transparent)` }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${T.accent.violet.muted}, ${T.accent.blue.muted})`,
              border: "1px solid rgba(139,92,246,0.15)",
            }}
          >
            <Sparkles className="h-6 w-6" style={{ color: T.accent.violet.base }} />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                background: `linear-gradient(135deg, ${T.text.primary}, ${T.accent.violet.base})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Token Usage
            </h1>
            <p className="text-sm mt-0.5" style={{ fontFamily: "'Rajdhani', sans-serif", color: T.text.muted, letterSpacing: "0.05em" }}>
              Track AI token consumption across models
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Filter Bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center gap-3"
      >
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger
            className="w-[160px] h-9 text-xs rounded-xl transition-colors"
            style={{ fontFamily: "'Rajdhani', sans-serif", borderColor: T.border, background: T.surface }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" style={{ color: T.accent.violet.base }} />
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent
            className="rounded-xl"
            style={{ borderColor: T.border, background: "rgba(10,12,28,0.98)", backdropFilter: "blur(20px)" }}
          >
            <SelectItem value="all">All Models</SelectItem>
            <SelectItem value="opus-4-5">Opus 4.5</SelectItem>
            <SelectItem value="sonnet-4-5">Sonnet 4.5</SelectItem>
            <SelectItem value="haiku-4-5">Haiku 4.5</SelectItem>
          </SelectContent>
        </Select>
        {data._mock && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: T.accent.amber.base }}>
            <Info className="h-3.5 w-3.5" />
            <span style={{ fontFamily: "'Rajdhani', sans-serif" }}>Sample data — awaiting Clawdbot integration</span>
          </div>
        )}
      </motion.div>

      {/* ─── Overview Cards (Bento Grid pattern: 4-column) ─── */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="All Time" icon={TrendingUp} value={data.overview.total}
          subLeft={{ label: "in", value: formatTokens(data.overview.totalInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.totalOutput), icon: ArrowDownRight }}
          accentColor={T.accent.violet}
        />
        <MetricCard
          title="This Month" icon={CalendarRange} value={data.overview.month}
          subLeft={{ label: "in", value: formatTokens(data.overview.monthInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.monthOutput), icon: ArrowDownRight }}
          accentColor={T.accent.blue}
        />
        <MetricCard
          title="This Week" icon={CalendarDays} value={data.overview.week}
          subLeft={{ label: "in", value: formatTokens(data.overview.weekInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.weekOutput), icon: ArrowDownRight }}
          accentColor={T.accent.emerald}
        />
        <MetricCard
          title="Today" icon={Calendar} value={data.overview.today}
          subLeft={{ label: "in", value: formatTokens(data.overview.todayInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.todayOutput), icon: ArrowDownRight }}
          accentColor={T.accent.amber}
        />
      </motion.div>

      {/* ─── Charts: Bento Grid (2:1 ratio) ─── */}
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-3">
        {/* Trend Chart — spans 2 columns */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="Token Trend" icon={TrendingUp} />
            <GroupByTabs value={groupBy} onChange={setGroupBy} />
          </div>
          {trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm" style={{ color: T.text.muted }}>No data for this period</p>
            </div>
          ) : modelFilter !== "all" ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="usage-inG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="usage-outG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => formatTokens(v)} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={(v) => <span className="text-xs" style={{ color: T.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
                />
                <Area type="monotone" dataKey="input" name="Input" stroke="#60a5fa" fill="url(#usage-inG)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#0a0c1c" }} />
                <Area type="monotone" dataKey="output" name="Output" stroke="#34d399" fill="url(#usage-outG)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#0a0c1c" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {Object.entries(MODEL_COLORS).map(([m, c]) => (
                    <linearGradient key={m} id={`usage-g-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => formatTokens(v)} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={(v) => <span className="text-xs" style={{ color: T.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
                />
                {Object.entries(MODEL_COLORS).map(([m, c]) => (
                  <Area key={m} type="monotone" dataKey={m} name={MODEL_LABELS[m]} stroke={c} fill={`url(#usage-g-${m})`} strokeWidth={2.5} stackId="1" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#0a0c1c" }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* Model Donut — 1 column */}
        <GlassCard className="p-6">
          <SectionHeader title="By Model" icon={Cpu} />
          <div className="relative mt-3">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {pieChartData.map((e, i) => (
                    <Cell key={i} fill={e.fill} style={{ filter: `drop-shadow(0 0 6px ${e.fill}40)` }} />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: T.text.primary }}>
                  {formatTokens(data.overview.total)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: T.text.muted, fontFamily: "'Rajdhani', sans-serif" }}>
                  Total
                </p>
              </div>
            </div>
          </div>

          {/* Model breakdown with animated progress bars */}
          <div className="space-y-3 mt-4">
            {Object.entries(data.byModel).map(([model, stats]) => {
              const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
              const pct = totalAll > 0 ? (stats.total / totalAll) * 100 : 0;
              const color = MODEL_COLORS[model] || "#94a3b8";
              return (
                <div key={model}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
                      <span className="text-sm font-semibold" style={{ color: T.text.primary, fontFamily: "'Rajdhani', sans-serif" }}>
                        {MODEL_LABELS[model]}
                      </span>
                    </div>
                    <span className="text-sm font-mono tabular-nums" style={{ color: T.text.secondary }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: T.grid }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      style={{ background: `linear-gradient(90deg, ${color}, ${color}90)`, boxShadow: `0 0 8px ${color}30` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs font-mono" style={{ color: T.text.muted }}>
                    <span>{formatTokens(stats.input)} in</span>
                    <span style={{ color: T.grid }}>·</span>
                    <span>{formatTokens(stats.output)} out</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* ─── Input vs Output Bar Chart ─── */}
      <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <GlassCard className="p-6">
          <SectionHeader title="Input vs Output by Model" icon={BarChart3} />
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={modelBarData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="usage-barIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
                  </linearGradient>
                  <linearGradient id="usage-barOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="name" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={(v) => formatTokens(v)} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={(v) => <span className="text-xs" style={{ color: T.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
                />
                <Bar dataKey="input" name="Input Tokens" fill="url(#usage-barIn)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="output" name="Output Tokens" fill="url(#usage-barOut)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </motion.div>

      {/* ─── Sessions Table ─── */}
      <motion.div variants={staggerContainer} initial="hidden" whileInView="show" viewport={{ once: true }}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Recent Sessions" icon={Activity} />
            <span
              className="text-xs font-mono px-2.5 py-1 rounded-lg"
              style={{
                background: T.accent.violet.muted,
                color: T.accent.violet.base,
                border: "1px solid rgba(167,139,250,0.2)",
              }}
            >
              {data.sessions.length} sessions
            </span>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {([
                    { field: "timestamp" as SortField, label: "Date", align: "left", hide: "", sortable: true },
                    { field: "timestamp" as SortField, label: "Activity", align: "left", hide: "hidden sm:table-cell", sortable: false },
                    { field: "model" as SortField, label: "Model", align: "left", hide: "", sortable: true },
                    { field: "inputTokens" as SortField, label: "In", align: "right", hide: "hidden md:table-cell", sortable: true },
                    { field: "outputTokens" as SortField, label: "Out", align: "right", hide: "hidden md:table-cell", sortable: true },
                    { field: "total" as SortField, label: "Total", align: "right", hide: "", sortable: true },
                  ]).map((col, i) => (
                    <th
                      key={i}
                      className={`${col.align === "right" ? "text-right" : "text-left"} py-3 px-2 ${col.sortable ? "cursor-pointer" : ""} ${col.hide}`}
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: T.text.muted,
                      }}
                      onClick={() => col.sortable && toggleSort(col.field)}
                    >
                      <span className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                        {col.label}
                        {col.sortable && <SortIcon field={col.field} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {displayedSessions.map((session, i) => (
                    <motion.tr
                      key={session.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="transition-colors duration-200"
                      style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs" style={{ color: T.text.muted }}>
                        {format(new Date(session.timestamp), "MMM d, HH:mm")}
                      </td>
                      <td className="py-2.5 px-2 hidden sm:table-cell">
                        <span className="truncate block max-w-[300px] text-xs" style={{ color: T.text.secondary }}>{session.activity}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{
                            fontFamily: "'Rajdhani', sans-serif",
                            backgroundColor: (MODEL_COLORS[session.model] || "#94a3b8") + "12",
                            color: MODEL_COLORS[session.model] || "#94a3b8",
                            border: `1px solid ${MODEL_COLORS[session.model] || "#94a3b8"}20`,
                          }}
                        >
                          {MODEL_LABELS[session.model] || session.model}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell" style={{ color: T.text.muted }}>
                        {formatTokens(session.inputTokens)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell" style={{ color: T.text.muted }}>
                        {formatTokens(session.outputTokens)}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium" style={{ color: T.text.primary }}>
                        {formatTokens(session.total)}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedSessions.length > 10 && (
            <button
              onClick={() => setTableExpanded(!tableExpanded)}
              className="w-full mt-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-200 flex items-center justify-center gap-1.5 rounded-xl"
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                color: T.accent.violet.base,
                background: T.accent.violet.muted,
                border: "1px solid rgba(167,139,250,0.15)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.accent.violet.glow; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.accent.violet.muted; }}
            >
              {tableExpanded ? (
                <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>Show All {sortedSessions.length} Sessions <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>
          )}
        </GlassCard>
      </motion.div>
    </div>
  );
}
