import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  Globe,
  Coins,
  CheckCircle2,
  XCircle,
  Activity,
  Cpu,
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
  LineChart,
  Line,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";

// ═══════════════════════════════════════════════════════════════════════════
// Design Tokens
// ═══════════════════════════════════════════════════════════════════════════

const THEME = {
  // Core palette — deep space with electric accents
  colors: {
    surface: {
      base: "rgba(10, 12, 28, 0.6)",
      elevated: "rgba(16, 20, 45, 0.7)",
      overlay: "rgba(20, 24, 55, 0.5)",
    },
    accent: {
      violet: { base: "#8b5cf6", glow: "rgba(139, 92, 246, 0.15)", muted: "rgba(139, 92, 246, 0.08)" },
      blue: { base: "#60a5fa", glow: "rgba(96, 165, 250, 0.15)", muted: "rgba(96, 165, 250, 0.08)" },
      emerald: { base: "#34d399", glow: "rgba(52, 211, 153, 0.15)", muted: "rgba(52, 211, 153, 0.08)" },
      amber: { base: "#fbbf24", glow: "rgba(251, 191, 36, 0.15)", muted: "rgba(251, 191, 36, 0.08)" },
      rose: { base: "#fb7185", glow: "rgba(251, 113, 133, 0.15)", muted: "rgba(251, 113, 133, 0.08)" },
      cyan: { base: "#22d3ee", glow: "rgba(34, 211, 238, 0.15)", muted: "rgba(34, 211, 238, 0.08)" },
    },
    border: "rgba(139, 92, 246, 0.12)",
    borderHover: "rgba(139, 92, 246, 0.25)",
    text: {
      primary: "rgba(248, 250, 252, 0.95)",
      secondary: "rgba(148, 163, 184, 0.8)",
      muted: "rgba(100, 116, 139, 0.6)",
    },
  },
  // Glassmorphism presets
  glass: {
    card: "backdrop-blur-xl bg-[rgba(15,18,40,0.55)] border border-[rgba(139,92,246,0.1)] shadow-[0_0_30px_rgba(139,92,246,0.04),inset_0_1px_0_rgba(255,255,255,0.03)]",
    cardHover: "hover:border-[rgba(139,92,246,0.2)] hover:shadow-[0_0_40px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]",
    pill: "backdrop-blur-md bg-[rgba(20,24,55,0.6)] border border-[rgba(139,92,246,0.08)]",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface TokenData {
  _mock: boolean;
  overview: {
    total: number; totalInput: number; totalOutput: number;
    today: number; todayInput: number; todayOutput: number;
    week: number; weekInput: number; weekOutput: number;
    month: number; monthInput: number; monthOutput: number;
  };
  byModel: Record<string, { total: number; input: number; output: number }>;
  trend: Array<{ date: string; inputTokens: number; outputTokens: number; tokens: number; model: string }>;
  sessions: Array<{ id: string; timestamp: string; activity: string; model: string; inputTokens: number; outputTokens: number; total: number }>;
}

interface ApiData {
  overview: {
    totalCalls: number; totalCost: number;
    monthCalls: number; monthCost: number;
    weekCalls: number; weekCost: number;
    todayCalls: number; todayCost: number;
  };
  byService: Record<string, { totalCalls: number; totalCost: number; totalUsage: number; usageUnit: string; successRate: number }>;
  trend: Array<{ date: string; service: string; calls: number; cost: number; usage: number }>;
  costTrend: Array<{ date: string; cost: number; calls: number }>;
  recentCalls: Array<{
    id: string; service: string; operation: string; timestamp: string;
    cost: number; usage: number; usageUnit: string; success: boolean;
    source: string; metadata: Record<string, unknown> | null;
  }>;
}

type SortField = "timestamp" | "model" | "inputTokens" | "outputTokens" | "total";
type SortDirection = "asc" | "desc";
type ApiSortField = "timestamp" | "service" | "operation" | "cost" | "usage";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_COLORS: Record<string, string> = {
  "opus-4-5": "#a78bfa",
  "sonnet-4-5": "#60a5fa",
  "haiku-4-5": "#34d399",
};
const MODEL_LABELS: Record<string, string> = {
  "opus-4-5":   "Opus 4.5",
  "sonnet-4-5": "Sonnet 4.5",
  "haiku-4-5":  "Haiku 4.5",
};

const SERVICE_COLORS: Record<string, string> = {
  "groq": "#f97316",
  "brave-search": "#fb7185",
  "google-drive": "#34d399",
  "google-sheets": "#2dd4bf",
  "edge-tts": "#818cf8",
  "gmail": "#fbbf24",
  "icloud-calendar": "#f472b6",
};
const SERVICE_LABELS: Record<string, string> = {
  "groq": "Groq",
  "brave-search": "Brave Search",
  "google-drive": "Google Drive",
  "google-sheets": "Google Sheets",
  "edge-tts": "Edge TTS",
  "gmail": "Gmail",
  "icloud-calendar": "iCloud Calendar",
};
const SERVICE_ICONS: Record<string, string> = {
  "groq": "🎙️",
  "brave-search": "🔍",
  "google-drive": "📁",
  "google-sheets": "📊",
  "edge-tts": "🔊",
  "gmail": "✉️",
  "icloud-calendar": "📅",
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function formatTokensFull(n: number): string { return n.toLocaleString(); }
function formatEur(n: number): string {
  return `€${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`;
}
function formatUsage(n: number, unit: string): string {
  if (unit === "seconds") {
    if (n >= 3600) return `${(n / 3600).toFixed(1)}h`;
    if (n >= 60) return `${(n / 60).toFixed(1)}m`;
    return `${Math.round(n)}s`;
  }
  if (unit === "characters") return formatTokens(n);
  return n.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════════════════
// Animation Presets
// ═══════════════════════════════════════════════════════════════════════════

const stagger = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, delayChildren: 0.1 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  },
};

const cardHover = {
  rest: { scale: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
  hover: { scale: 1.01, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
};

// ═══════════════════════════════════════════════════════════════════════════
// Animated Counter Hook
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
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (target - start) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// Glass Card Component
// ═══════════════════════════════════════════════════════════════════════════

function GlassCard({
  children,
  className = "",
  glowColor,
  animate = true,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  animate?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  const Wrapper = animate ? motion.div : "div";
  const animateProps = animate
    ? { variants: stagger.item, initial: "hidden", whileInView: "show", viewport: { once: true } }
    : {};

  return (
    <Wrapper
      className={`
        relative rounded-2xl overflow-hidden
        backdrop-blur-xl bg-[rgba(15,18,40,0.55)]
        border border-[rgba(139,92,246,0.1)]
        shadow-[0_0_30px_rgba(139,92,246,0.04),inset_0_1px_0_rgba(255,255,255,0.03)]
        transition-all duration-300 ease-out
        hover:border-[rgba(139,92,246,0.2)]
        hover:shadow-[0_0_40px_rgba(139,92,246,0.08),inset_0_1px_0_rgba(255,255,255,0.05)]
        ${className}
      `}
      {...animateProps}
      {...props}
    >
      {glowColor && (
        <div
          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: glowColor }}
        />
      )}
      {children}
    </Wrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared Tooltip Components (themed)
// ═══════════════════════════════════════════════════════════════════════════

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(10,12,28,0.95)] backdrop-blur-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <p className="font-medium text-sm mb-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.primary }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm flex items-center gap-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          <span style={{ color: THEME.colors.text.secondary }}>{entry.name}:</span>
          <span className="font-mono font-medium" style={{ color: THEME.colors.text.primary }}>{formatTokensFull(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CostTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(10,12,28,0.95)] backdrop-blur-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <p className="font-medium text-sm mb-2" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.primary }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm flex items-center gap-2.5 py-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color, boxShadow: `0 0 6px ${entry.color}` }} />
          <span style={{ color: THEME.colors.text.secondary }}>{entry.name}:</span>
          <span className="font-mono font-medium" style={{ color: THEME.colors.text.primary }}>
            {entry.dataKey === "cost" ? formatEur(entry.value) : entry.value}
          </span>
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
    <div className="rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(10,12,28,0.95)] backdrop-blur-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <p className="font-medium text-sm mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.primary }}>{d.name}</p>
      <p className="text-sm font-mono" style={{ color: THEME.colors.text.secondary }}>
        {formatTokensFull(d.value)} tokens ({d.percentage.toFixed(1)}%)
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Metric Card (Hero-style with animated counter)
// ═══════════════════════════════════════════════════════════════════════════

function MetricCard({ title, icon: Icon, value, formatted, subLeft, subRight, accentColor, delay = 0 }: {
  title: string;
  icon: typeof Zap;
  value: number;
  formatted: string;
  subLeft?: { label: string; value: string; icon?: typeof ArrowUpRight };
  subRight?: { label: string; value: string; icon?: typeof ArrowDownRight };
  accentColor: { base: string; glow: string; muted: string };
  delay?: number;
}) {
  const animatedValue = useAnimatedCounter(value);

  return (
    <motion.div
      variants={stagger.item}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      whileHover="hover"
    >
      <motion.div variants={cardHover}>
        <GlassCard className="p-5 group" glowColor={accentColor.glow} animate={false}>
          <div className="flex items-start justify-between mb-3">
            <div
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]"
              style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.secondary }}
            >
              {title}
            </div>
            <div
              className="rounded-xl p-2 transition-all duration-300"
              style={{ background: accentColor.muted }}
            >
              <Icon className="h-4 w-4" style={{ color: accentColor.base }} />
            </div>
          </div>

          <div
            className="text-3xl font-bold tracking-tight mb-1 font-mono tabular-nums"
            style={{ color: THEME.colors.text.primary }}
          >
            {formatted.includes("€")
              ? formatted
              : formatTokens(animatedValue)}
          </div>

          {(subLeft || subRight) && (
            <div className="flex items-center gap-3 mt-2">
              {subLeft && (
                <span className="flex items-center gap-1 text-xs" style={{ color: THEME.colors.text.muted }}>
                  {subLeft.icon && <subLeft.icon className="h-3 w-3" style={{ color: THEME.colors.accent.blue.base }} />}
                  <span className="font-mono">{subLeft.value}</span>
                  <span>{subLeft.label}</span>
                </span>
              )}
              {subRight && (
                <span className="flex items-center gap-1 text-xs" style={{ color: THEME.colors.text.muted }}>
                  {subRight.icon && <subRight.icon className="h-3 w-3" style={{ color: THEME.colors.accent.emerald.base }} />}
                  <span className="font-mono">{subRight.value}</span>
                  <span>{subRight.label}</span>
                </span>
              )}
            </div>
          )}

          {/* Subtle accent bar at bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] opacity-30 group-hover:opacity-60 transition-opacity duration-500"
            style={{ background: `linear-gradient(90deg, transparent, ${accentColor.base}, transparent)` }}
          />
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sort helpers
// ═══════════════════════════════════════════════════════════════════════════

function SortIcon({ field, currentField, direction }: { field: string; currentField: string; direction: SortDirection }) {
  if (currentField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ title, icon: Icon, rightContent }: {
  title: string;
  icon: typeof TrendingUp;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-1">
      <h3
        className="text-lg font-bold tracking-wide flex items-center gap-2.5"
        style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.primary }}
      >
        <Icon className="h-5 w-5" style={{ color: THEME.colors.accent.violet.base }} />
        {title}
      </h3>
      {rightContent}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styled Tab Trigger for chart grouping
// ═══════════════════════════════════════════════════════════════════════════

function GroupByTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl p-1" style={{ background: "rgba(139, 92, 246, 0.06)", border: "1px solid rgba(139, 92, 246, 0.08)" }}>
      {["day", "week", "month"].map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`
            px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 uppercase tracking-wider
            ${value === v
              ? "bg-[rgba(139,92,246,0.15)] text-[rgba(167,139,250,1)] shadow-[0_0_10px_rgba(139,92,246,0.1)]"
              : "text-[rgba(148,163,184,0.5)] hover:text-[rgba(148,163,184,0.8)]"
            }
          `}
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {v === "day" ? "Daily" : v === "week" ? "Weekly" : "Monthly"}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Chart Axis Styles
// ═══════════════════════════════════════════════════════════════════════════

const axisStyle = {
  tick: { fontSize: 11, fill: "rgba(148,163,184,0.5)", fontFamily: "'JetBrains Mono', monospace" },
  axisLine: { stroke: "rgba(139,92,246,0.08)" },
  tickLine: { stroke: "rgba(139,92,246,0.06)" },
};
const gridStyle = { stroke: "rgba(139,92,246,0.06)", strokeDasharray: "4 8" };

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN USAGE SECTION
// ═══════════════════════════════════════════════════════════════════════════

function TokenUsageSection({ data, groupBy, setGroupBy, modelFilter, setModelFilter }: {
  data: TokenData;
  groupBy: string;
  setGroupBy: (v: string) => void;
  modelFilter: string;
  setModelFilter: (v: string) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [expanded, setExpanded] = useState(false);

  const trendChartData = useMemo(() => {
    if (modelFilter !== "all") {
      return data.trend.map(e => ({
        date: groupBy === "day" ? format(new Date(e.date), "MMM d") :
              groupBy === "week" ? `W${format(new Date(e.date), "w")}` :
              format(new Date(e.date), "MMM yyyy"),
        input: e.inputTokens,
        output: e.outputTokens,
      }));
    }
    const dateMap = new Map<string, Record<string, number>>();
    for (const e of data.trend) {
      const label = groupBy === "day" ? format(new Date(e.date), "MMM d") :
                    groupBy === "week" ? `W${format(new Date(e.date), "w")}` :
                    format(new Date(e.date), "MMM yyyy");
      if (!dateMap.has(label)) dateMap.set(label, {});
      const m = dateMap.get(label)!;
      m[e.model] = (m[e.model] || 0) + e.tokens;
    }
    return Array.from(dateMap.entries()).map(([date, models]) => ({ date, ...models }));
  }, [data, groupBy, modelFilter]);

  const pieData = useMemo(() => {
    const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
    return Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      value: stats.total,
      percentage: totalAll > 0 ? (stats.total / totalAll) * 100 : 0,
      fill: MODEL_COLORS[model] || "#94a3b8",
    }));
  }, [data]);

  const modelBarData = useMemo(() =>
    Object.entries(data.byModel).map(([model, stats]) => ({
      name: MODEL_LABELS[model] || model,
      input: stats.input,
      output: stats.output,
      color: MODEL_COLORS[model] || "#94a3b8",
    })), [data]);

  const sorted = useMemo(() => {
    return [...data.sessions].sort((a, b) => {
      const d = sortDir === "asc" ? 1 : -1;
      if (sortField === "timestamp") return d * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (sortField === "model") return d * a.model.localeCompare(b.model);
      return d * ((a as Record<string, number>)[sortField] - (b as Record<string, number>)[sortField]);
    });
  }, [data, sortField, sortDir]);

  const displayed = expanded ? sorted : sorted.slice(0, 10);
  function toggle(f: SortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  }

  return (
    <motion.div
      className="space-y-6"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* Filters row */}
      <motion.div variants={stagger.item} className="flex flex-wrap items-center gap-3">
        <Select value={modelFilter} onValueChange={setModelFilter}>
          <SelectTrigger
            className="w-[160px] h-9 text-xs rounded-xl border-[rgba(139,92,246,0.12)] bg-[rgba(15,18,40,0.5)] hover:border-[rgba(139,92,246,0.25)] transition-colors"
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" style={{ color: THEME.colors.accent.violet.base }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-[rgba(139,92,246,0.12)] bg-[rgba(10,12,28,0.98)] backdrop-blur-xl">
            <SelectItem value="all">All Models</SelectItem>
            <SelectItem value="opus-4-5">Opus 4.5</SelectItem>
            <SelectItem value="sonnet-4-5">Sonnet 4.5</SelectItem>
            <SelectItem value="haiku-4-5">Haiku 4.5</SelectItem>
          </SelectContent>
        </Select>
        {data._mock && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: THEME.colors.accent.amber.base }}>
            <Info className="h-3.5 w-3.5" />
            <span style={{ fontFamily: "'Rajdhani', sans-serif" }}>Sample data — awaiting Clawdbot integration</span>
          </div>
        )}
      </motion.div>

      {/* Overview Cards */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="All Time" icon={TrendingUp} value={data.overview.total} formatted={formatTokens(data.overview.total)}
          subLeft={{ label: "in", value: formatTokens(data.overview.totalInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.totalOutput), icon: ArrowDownRight }}
          accentColor={THEME.colors.accent.violet} />
        <MetricCard title="This Month" icon={CalendarRange} value={data.overview.month} formatted={formatTokens(data.overview.month)}
          subLeft={{ label: "in", value: formatTokens(data.overview.monthInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.monthOutput), icon: ArrowDownRight }}
          accentColor={THEME.colors.accent.blue} delay={0.05} />
        <MetricCard title="This Week" icon={CalendarDays} value={data.overview.week} formatted={formatTokens(data.overview.week)}
          subLeft={{ label: "in", value: formatTokens(data.overview.weekInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.weekOutput), icon: ArrowDownRight }}
          accentColor={THEME.colors.accent.emerald} delay={0.1} />
        <MetricCard title="Today" icon={Calendar} value={data.overview.today} formatted={formatTokens(data.overview.today)}
          subLeft={{ label: "in", value: formatTokens(data.overview.todayInput), icon: ArrowUpRight }}
          subRight={{ label: "out", value: formatTokens(data.overview.todayOutput), icon: ArrowDownRight }}
          accentColor={THEME.colors.accent.amber} delay={0.15} />
      </motion.div>

      {/* Charts — Bento Grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Trend — spans 2 cols */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="Token Trend" icon={TrendingUp} />
            <GroupByTabs value={groupBy} onChange={setGroupBy} />
          </div>
          {trendChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm" style={{ color: THEME.colors.text.muted }}>No data</p>
            </div>
          ) : modelFilter !== "all" ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="usage-inG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="usage-outG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={v => formatTokens(v)} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={v => <span className="text-xs" style={{ color: THEME.colors.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
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
                      <stop offset="0%" stopColor={c} stopOpacity={0.3}/>
                      <stop offset="100%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={v => formatTokens(v)} />
                <RechartsTooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={v => <span className="text-xs" style={{ color: THEME.colors.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
                />
                {Object.entries(MODEL_COLORS).map(([m, c]) => (
                  <Area key={m} type="monotone" dataKey={m} name={MODEL_LABELS[m]} stroke={c} fill={`url(#usage-g-${m})`} strokeWidth={2.5} stackId="1" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#0a0c1c" }} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* Model Donut */}
        <GlassCard className="p-6">
          <SectionHeader title="By Model" icon={Cpu} />
          <div className="relative mt-3">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <defs>
                  {pieData.map((entry) => (
                    <filter key={`glow-${entry.name}`} id={`pie-glow-${entry.name.replace(/\s/g, "")}`}>
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feFlood floodColor={entry.fill} floodOpacity="0.3" result="color" />
                      <feComposite in="color" in2="blur" operator="in" result="shadow" />
                      <feMerge>
                        <feMergeNode in="shadow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  ))}
                </defs>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {pieData.map((e, i) => (
                    <Cell key={i} fill={e.fill} style={{ filter: `drop-shadow(0 0 6px ${e.fill}40)` }} />
                  ))}
                </Pie>
                <RechartsTooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: THEME.colors.text.primary }}>
                  {formatTokens(data.overview.total)}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: THEME.colors.text.muted, fontFamily: "'Rajdhani', sans-serif" }}>
                  Total
                </p>
              </div>
            </div>
          </div>

          {/* Model breakdown list */}
          <div className="space-y-3 mt-4">
            {Object.entries(data.byModel).map(([model, stats]) => {
              const totalAll = Object.values(data.byModel).reduce((s, m) => s + m.total, 0);
              const pct = totalAll > 0 ? ((stats.total / totalAll) * 100) : 0;
              const color = MODEL_COLORS[model] || "#94a3b8";
              return (
                <div key={model} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
                      <span className="text-sm font-semibold" style={{ color: THEME.colors.text.primary, fontFamily: "'Rajdhani', sans-serif" }}>
                        {MODEL_LABELS[model]}
                      </span>
                    </div>
                    <span className="text-sm font-mono tabular-nums" style={{ color: THEME.colors.text.secondary }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.06)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      style={{ background: `linear-gradient(90deg, ${color}, ${color}90)`, boxShadow: `0 0 8px ${color}30` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs font-mono" style={{ color: THEME.colors.text.muted }}>
                    <span>{formatTokens(stats.input)} in</span>
                    <span style={{ color: "rgba(139,92,246,0.2)" }}>·</span>
                    <span>{formatTokens(stats.output)} out</span>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* I/O Bar Chart */}
      <GlassCard className="p-6">
        <SectionHeader title="Input vs Output by Model" icon={BarChart3} />
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={modelBarData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="usage-barIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5}/>
                </linearGradient>
                <linearGradient id="usage-barOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.5}/>
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="name" {...axisStyle} />
              <YAxis {...axisStyle} tickFormatter={v => formatTokens(v)} />
              <RechartsTooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "12px" }}
                formatter={v => <span className="text-xs" style={{ color: THEME.colors.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
              />
              <Bar dataKey="input" name="Input Tokens" fill="url(#usage-barIn)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="output" name="Output Tokens" fill="url(#usage-barOut)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Sessions Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Recent Sessions" icon={Activity} />
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-lg"
            style={{
              background: THEME.colors.accent.violet.muted,
              color: THEME.colors.accent.violet.base,
              border: `1px solid ${THEME.colors.accent.violet.base}20`,
            }}
          >
            {data.sessions.length} sessions
          </span>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid rgba(139,92,246,0.1)` }}>
                {[
                  { key: "timestamp" as SortField, label: "Date", align: "left", hide: "" },
                  { key: "timestamp" as SortField, label: "Activity", align: "left", hide: "hidden sm:table-cell", sortable: false },
                  { key: "model" as SortField, label: "Model", align: "left", hide: "" },
                  { key: "inputTokens" as SortField, label: "In", align: "right", hide: "hidden md:table-cell" },
                  { key: "outputTokens" as SortField, label: "Out", align: "right", hide: "hidden md:table-cell" },
                  { key: "total" as SortField, label: "Total", align: "right", hide: "" },
                ].map((col, i) => (
                  <th
                    key={i}
                    className={`${col.align === "right" ? "text-right" : "text-left"} py-3 px-2 cursor-pointer transition-colors ${col.hide}`}
                    style={{
                      fontFamily: "'Rajdhani', sans-serif",
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: THEME.colors.text.muted,
                    }}
                    onClick={() => col.sortable !== false && toggle(col.key)}
                  >
                    <span className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : ""}`}>
                      {col.label}
                      {col.sortable !== false && <SortIcon field={col.key} currentField={sortField} direction={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((s, i) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="group transition-colors duration-200"
                  style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs" style={{ color: THEME.colors.text.muted }}>
                    {format(new Date(s.timestamp), "MMM d, HH:mm")}
                  </td>
                  <td className="py-2.5 px-2 hidden sm:table-cell">
                    <span className="truncate block max-w-[300px] text-xs" style={{ color: THEME.colors.text.secondary }}>{s.activity}</span>
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        backgroundColor: (MODEL_COLORS[s.model] || "#94a3b8") + "12",
                        color: MODEL_COLORS[s.model] || "#94a3b8",
                        border: `1px solid ${MODEL_COLORS[s.model] || "#94a3b8"}20`,
                      }}
                    >
                      {MODEL_LABELS[s.model]}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell" style={{ color: THEME.colors.text.muted }}>
                    {formatTokens(s.inputTokens)}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell" style={{ color: THEME.colors.text.muted }}>
                    {formatTokens(s.outputTokens)}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium" style={{ color: THEME.colors.text.primary }}>
                    {formatTokens(s.total)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-200 flex items-center justify-center gap-1.5 rounded-xl"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              color: THEME.colors.accent.violet.base,
              background: THEME.colors.accent.violet.muted,
              border: `1px solid ${THEME.colors.accent.violet.base}15`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = THEME.colors.accent.violet.glow; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = THEME.colors.accent.violet.muted; }}
          >
            {expanded ? <>Show Less <ChevronUp className="h-3.5 w-3.5" /></> : <>Show All {sorted.length} Sessions <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
      </GlassCard>
    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// EXTERNAL API SECTION
// ═══════════════════════════════════════════════════════════════════════════

function ExternalApiSection({ data, groupBy, setGroupBy, serviceFilter, setServiceFilter }: {
  data: ApiData;
  groupBy: string;
  setGroupBy: (v: string) => void;
  serviceFilter: string;
  setServiceFilter: (v: string) => void;
}) {
  const [sortField, setSortField] = useState<ApiSortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [expanded, setExpanded] = useState(false);

  const costChartData = useMemo(() =>
    (data.costTrend || []).map(e => ({
      date: groupBy === "day" ? format(new Date(e.date), "MMM d") :
            groupBy === "week" ? `W${format(new Date(e.date), "w")}` :
            format(new Date(e.date), "MMM yyyy"),
      cost: e.cost,
      calls: e.calls,
    })), [data, groupBy]);

  const servicePieData = useMemo(() => {
    const total = Object.values(data.byService).reduce((s, v) => s + v.totalCalls, 0);
    return Object.entries(data.byService).map(([svc, stats]) => ({
      name: SERVICE_LABELS[svc] || svc,
      value: stats.totalCalls,
      percentage: total > 0 ? (stats.totalCalls / total) * 100 : 0,
      fill: SERVICE_COLORS[svc] || "#94a3b8",
    }));
  }, [data]);

  const callsTrendData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const e of data.trend) {
      const label = groupBy === "day" ? format(new Date(e.date), "MMM d") :
                    groupBy === "week" ? `W${format(new Date(e.date), "w")}` :
                    format(new Date(e.date), "MMM yyyy");
      if (!dateMap.has(label)) dateMap.set(label, {});
      const m = dateMap.get(label)!;
      m[e.service] = (m[e.service] || 0) + e.calls;
    }
    return Array.from(dateMap.entries()).map(([date, svcs]) => ({ date, ...svcs }));
  }, [data, groupBy]);

  const sorted = useMemo(() => {
    return [...data.recentCalls].sort((a, b) => {
      const d = sortDir === "asc" ? 1 : -1;
      if (sortField === "timestamp") return d * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (sortField === "service") return d * a.service.localeCompare(b.service);
      if (sortField === "operation") return d * (a.operation || "").localeCompare(b.operation || "");
      if (sortField === "cost") return d * (a.cost - b.cost);
      if (sortField === "usage") return d * ((a.usage || 0) - (b.usage || 0));
      return 0;
    });
  }, [data, sortField, sortDir]);

  const displayed = expanded ? sorted : sorted.slice(0, 10);
  function toggle(f: ApiSortField) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("desc"); }
  }

  const services = Object.keys(data.byService);

  return (
    <motion.div
      className="space-y-6"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* Filters */}
      <motion.div variants={stagger.item} className="flex flex-wrap items-center gap-3">
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger
            className="w-[180px] h-9 text-xs rounded-xl border-[rgba(139,92,246,0.12)] bg-[rgba(15,18,40,0.5)] hover:border-[rgba(139,92,246,0.25)] transition-colors"
            style={{ fontFamily: "'Rajdhani', sans-serif" }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" style={{ color: THEME.colors.accent.violet.base }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-[rgba(139,92,246,0.12)] bg-[rgba(10,12,28,0.98)] backdrop-blur-xl">
            <SelectItem value="all">All Services</SelectItem>
            {services.map(s => (
              <SelectItem key={s} value={s}>
                {SERVICE_ICONS[s] || "🔌"} {SERVICE_LABELS[s] || s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Overview Cards */}
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard title="All Time" icon={Globe} value={data.overview.totalCost * 100} formatted={formatEur(data.overview.totalCost)}
          subLeft={{ label: "calls", value: data.overview.totalCalls.toLocaleString() }}
          accentColor={THEME.colors.accent.violet} />
        <MetricCard title="This Month" icon={CalendarRange} value={data.overview.monthCost * 100} formatted={formatEur(data.overview.monthCost)}
          subLeft={{ label: "calls", value: data.overview.monthCalls.toLocaleString() }}
          accentColor={THEME.colors.accent.blue} />
        <MetricCard title="This Week" icon={CalendarDays} value={data.overview.weekCost * 100} formatted={formatEur(data.overview.weekCost)}
          subLeft={{ label: "calls", value: data.overview.weekCalls.toLocaleString() }}
          accentColor={THEME.colors.accent.emerald} />
        <MetricCard title="Today" icon={Calendar} value={data.overview.todayCost * 100} formatted={formatEur(data.overview.todayCost)}
          subLeft={{ label: "calls", value: data.overview.todayCalls.toLocaleString() }}
          accentColor={THEME.colors.accent.amber} />
      </motion.div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Cost Trend */}
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="Cost Trend" icon={Coins} />
            <GroupByTabs value={groupBy} onChange={setGroupBy} />
          </div>
          {costChartData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm" style={{ color: THEME.colors.text.muted }}>No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={costChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="api-costG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="date" {...axisStyle} />
                <YAxis {...axisStyle} tickFormatter={v => `€${v.toFixed(2)}`} />
                <YAxis yAxisId="right" orientation="right" {...axisStyle} />
                <RechartsTooltip content={<CostTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: "12px" }}
                  formatter={v => <span className="text-xs" style={{ color: THEME.colors.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
                />
                <Area type="monotone" dataKey="cost" name="Cost (€)" stroke="#f97316" fill="url(#api-costG)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#0a0c1c" }} />
                <Line type="monotone" dataKey="calls" name="Calls" stroke="#818cf8" strokeWidth={1.5} dot={false} yAxisId="right" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* Service Breakdown */}
        <GlassCard className="p-6">
          <SectionHeader title="By Service" icon={Globe} />
          <div className="relative mt-3">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={servicePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {servicePieData.map((e, i) => (
                    <Cell key={i} fill={e.fill} style={{ filter: `drop-shadow(0 0 6px ${e.fill}40)` }} />
                  ))}
                </Pie>
                <RechartsTooltip content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(10,12,28,0.95)] backdrop-blur-xl p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                      <p className="font-medium text-sm mb-1" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.primary }}>{d.name}</p>
                      <p className="text-sm font-mono" style={{ color: THEME.colors.text.secondary }}>{d.value} calls ({d.percentage.toFixed(1)}%)</p>
                    </div>
                  );
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums" style={{ color: THEME.colors.text.primary }}>{data.overview.totalCalls}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: THEME.colors.text.muted, fontFamily: "'Rajdhani', sans-serif" }}>Total Calls</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            {Object.entries(data.byService).map(([svc, stats]) => {
              const color = SERVICE_COLORS[svc] || "#94a3b8";
              const totalCalls = Object.values(data.byService).reduce((s, v) => s + v.totalCalls, 0);
              const pct = totalCalls > 0 ? (stats.totalCalls / totalCalls) * 100 : 0;
              return (
                <div key={svc} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
                      <span className="text-sm font-semibold" style={{ color: THEME.colors.text.primary, fontFamily: "'Rajdhani', sans-serif" }}>
                        {SERVICE_ICONS[svc]} {SERVICE_LABELS[svc] || svc}
                      </span>
                    </div>
                    <span className="text-xs font-mono" style={{ color: THEME.colors.text.secondary }}>
                      {stats.totalCost > 0 ? formatEur(stats.totalCost) : "Free"}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(139,92,246,0.06)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                      style={{ background: `linear-gradient(90deg, ${color}, ${color}90)`, boxShadow: `0 0 8px ${color}30` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono" style={{ color: THEME.colors.text.muted }}>
                    <span>{stats.totalCalls} calls</span>
                    <span style={{ color: "rgba(139,92,246,0.2)" }}>·</span>
                    <span>{formatUsage(stats.totalUsage, stats.usageUnit)} {stats.usageUnit}</span>
                    {stats.successRate < 100 && <>
                      <span style={{ color: "rgba(139,92,246,0.2)" }}>·</span>
                      <span style={{ color: THEME.colors.accent.amber.base }}>{stats.successRate}% ok</span>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Calls by Service Trend */}
      <GlassCard className="p-6">
        <SectionHeader title="API Calls by Service" icon={BarChart3} />
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={callsTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(SERVICE_COLORS).map(([s, c]) => (
                  <linearGradient key={s} id={`api-sg-${s}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.25}/>
                    <stop offset="100%" stopColor={c} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="date" {...axisStyle} />
              <YAxis {...axisStyle} />
              <RechartsTooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "12px" }}
                formatter={v => <span className="text-xs" style={{ color: THEME.colors.text.secondary, fontFamily: "'Rajdhani', sans-serif" }}>{v}</span>}
              />
              {services.map(s => (
                <Area key={s} type="monotone" dataKey={s} name={SERVICE_LABELS[s] || s} stroke={SERVICE_COLORS[s] || "#94a3b8"} fill={`url(#api-sg-${s})`} strokeWidth={2} stackId="1" dot={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Recent API Calls Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Recent API Calls" icon={Globe} />
          <span
            className="text-xs font-mono px-2.5 py-1 rounded-lg"
            style={{
              background: THEME.colors.accent.violet.muted,
              color: THEME.colors.accent.violet.base,
              border: `1px solid ${THEME.colors.accent.violet.base}20`,
            }}
          >
            {data.recentCalls.length} calls
          </span>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(139,92,246,0.1)" }}>
                <th className="text-left py-3 px-2 cursor-pointer" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }} onClick={() => toggle("timestamp")}>
                  <span className="flex items-center gap-1">Date <SortIcon field="timestamp" currentField={sortField} direction={sortDir} /></span>
                </th>
                <th className="text-left py-3 px-2 cursor-pointer" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }} onClick={() => toggle("service")}>
                  <span className="flex items-center gap-1">Service <SortIcon field="service" currentField={sortField} direction={sortDir} /></span>
                </th>
                <th className="text-left py-3 px-2 hidden sm:table-cell cursor-pointer" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }} onClick={() => toggle("operation")}>
                  <span className="flex items-center gap-1">Operation <SortIcon field="operation" currentField={sortField} direction={sortDir} /></span>
                </th>
                <th className="text-right py-3 px-2 hidden md:table-cell cursor-pointer" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }} onClick={() => toggle("usage")}>
                  <span className="flex items-center gap-1 justify-end">Usage <SortIcon field="usage" currentField={sortField} direction={sortDir} /></span>
                </th>
                <th className="text-right py-3 px-2 cursor-pointer" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }} onClick={() => toggle("cost")}>
                  <span className="flex items-center gap-1 justify-end">Cost <SortIcon field="cost" currentField={sortField} direction={sortDir} /></span>
                </th>
                <th className="text-center py-3 px-2 hidden md:table-cell" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: THEME.colors.text.muted }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="transition-colors duration-200"
                  style={{ borderBottom: "1px solid rgba(139,92,246,0.05)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,92,246,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs" style={{ color: THEME.colors.text.muted }}>
                    {format(new Date(c.timestamp), "MMM d, HH:mm")}
                  </td>
                  <td className="py-2.5 px-2">
                    <span
                      className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        backgroundColor: (SERVICE_COLORS[c.service] || "#94a3b8") + "12",
                        color: SERVICE_COLORS[c.service] || "#94a3b8",
                        border: `1px solid ${SERVICE_COLORS[c.service] || "#94a3b8"}20`,
                      }}
                    >
                      {SERVICE_ICONS[c.service] || "🔌"} {SERVICE_LABELS[c.service] || c.service}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 hidden sm:table-cell text-xs font-mono" style={{ color: THEME.colors.text.secondary }}>{c.operation || "—"}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell" style={{ color: THEME.colors.text.muted }}>
                    {c.usage != null ? `${formatUsage(c.usage, c.usageUnit)} ${c.usageUnit}` : "—"}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium" style={{ color: THEME.colors.text.primary }}>
                    {c.cost > 0 ? formatEur(c.cost) : <span style={{ color: THEME.colors.text.muted }}>Free</span>}
                  </td>
                  <td className="py-2.5 px-2 text-center hidden md:table-cell">
                    {c.success
                      ? <CheckCircle2 className="h-4 w-4 inline" style={{ color: THEME.colors.accent.emerald.base, filter: `drop-shadow(0 0 4px ${THEME.colors.accent.emerald.base}40)` }} />
                      : <XCircle className="h-4 w-4 inline" style={{ color: THEME.colors.accent.rose.base, filter: `drop-shadow(0 0 4px ${THEME.colors.accent.rose.base}40)` }} />
                    }
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-200 flex items-center justify-center gap-1.5 rounded-xl"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              color: THEME.colors.accent.violet.base,
              background: THEME.colors.accent.violet.muted,
              border: `1px solid ${THEME.colors.accent.violet.base}15`,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = THEME.colors.accent.violet.glow; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = THEME.colors.accent.violet.muted; }}
          >
            {expanded ? <>Show Less <ChevronUp className="h-3.5 w-3.5" /></> : <>Show All {sorted.length} Calls <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
      </GlassCard>
    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function UsagePage() {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [apiData, setApiData] = useState<ApiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("tokens");

  const [groupBy, setGroupBy] = useState("day");
  const [modelFilter, setModelFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const startDate = subDays(new Date(), 30).toISOString().slice(0, 10);
        const endDate = new Date().toISOString().slice(0, 10);
        const result = await api.getUsageDashboard({
          startDate,
          endDate,
          groupBy,
          model: modelFilter === "all" ? undefined : modelFilter,
          service: serviceFilter === "all" ? undefined : serviceFilter,
        });
        setTokenData(result.tokens);
        setApiData(result.apis);
      } catch (err) {
        console.error("Failed to fetch usage data:", err);
        setError("Failed to load usage data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [groupBy, modelFilter, serviceFilter]);

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16 min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div
              className="h-10 w-10 rounded-full border-2 animate-spin mx-auto"
              style={{
                borderColor: "rgba(139,92,246,0.15)",
                borderTopColor: THEME.colors.accent.violet.base,
              }}
            />
            <div
              className="absolute inset-0 h-10 w-10 rounded-full animate-ping opacity-20 mx-auto"
              style={{ background: THEME.colors.accent.violet.glow }}
            />
          </div>
          <p className="text-xs uppercase tracking-[0.2em]" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.muted }}>
            Loading usage data...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error || !tokenData || !apiData) {
    return (
      <div className="flex items-center justify-center p-16 min-h-[60vh]">
        <GlassCard className="p-8 text-center max-w-sm" animate={false}>
          <div className="text-3xl mb-3">⚠️</div>
          <p className="text-sm" style={{ color: THEME.colors.text.secondary }}>{error || "No data available"}</p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8 usage-dashboard">
      {/* ─── Page Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        {/* Ambient glow behind header */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full blur-[100px] opacity-[0.07] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${THEME.colors.accent.violet.base}, ${THEME.colors.accent.blue.base}, transparent)` }}
        />

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="p-2.5 rounded-xl"
              style={{
                background: `linear-gradient(135deg, ${THEME.colors.accent.violet.muted}, ${THEME.colors.accent.blue.muted})`,
                border: `1px solid ${THEME.colors.accent.violet.base}15`,
              }}
            >
              <Sparkles className="h-6 w-6" style={{ color: THEME.colors.accent.violet.base }} />
            </div>
            <div>
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  background: `linear-gradient(135deg, ${THEME.colors.text.primary}, ${THEME.colors.accent.violet.base})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Usage Dashboard
              </h1>
              <p className="text-sm mt-0.5" style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.muted, letterSpacing: "0.05em" }}>
                Track AI token consumption and external API costs
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Summary Strip ─── */}
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="grid gap-3 grid-cols-2 lg:grid-cols-4"
      >
        {[
          { label: "Tokens (Month)", value: formatTokens(tokenData.overview.month), color: THEME.colors.accent.violet },
          { label: "API Cost (Month)", value: formatEur(apiData.overview.monthCost), color: THEME.colors.accent.amber },
          { label: "API Calls (Month)", value: apiData.overview.monthCalls.toLocaleString(), color: THEME.colors.accent.blue },
          { label: "Services Active", value: Object.keys(apiData.byService).length.toString(), color: THEME.colors.accent.emerald },
        ].map((item, i) => (
          <motion.div key={i} variants={stagger.item}>
            <div
              className="relative rounded-xl px-5 py-4 overflow-hidden transition-all duration-300 hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, rgba(15,18,40,0.6), rgba(15,18,40,0.4))`,
                border: `1px solid ${item.color.base}15`,
                backdropFilter: "blur(20px)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${item.color.base}30`;
                e.currentTarget.style.boxShadow = `0 0 30px ${item.color.base}10`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${item.color.base}15`;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Left accent bar */}
              <div
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{ background: item.color.base, opacity: 0.6 }}
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                style={{ fontFamily: "'Rajdhani', sans-serif", color: THEME.colors.text.muted }}>
                {item.label}
              </p>
              <p className="text-xl font-bold font-mono tabular-nums" style={{ color: THEME.colors.text.primary }}>
                {item.value}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ─── Tab Navigation ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="inline-flex gap-1 rounded-xl p-1"
          style={{
            background: "rgba(15,18,40,0.5)",
            border: "1px solid rgba(139,92,246,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          {[
            { key: "tokens", label: "Clawdbot Tokens", icon: Zap },
            { key: "apis", label: "External APIs", icon: Globe },
          ].map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300
                ${activeTab === key
                  ? "shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                  : "hover:bg-[rgba(139,92,246,0.04)]"
                }
              `}
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                letterSpacing: "0.05em",
                background: activeTab === key ? "rgba(139,92,246,0.12)" : "transparent",
                color: activeTab === key ? THEME.colors.accent.violet.base : THEME.colors.text.muted,
                border: activeTab === key ? `1px solid rgba(139,92,246,0.15)` : "1px solid transparent",
              }}
            >
              <TabIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ─── Section Content ─── */}
      <AnimatePresence mode="wait">
        {activeTab === "tokens" ? (
          <motion.div
            key="tokens"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <TokenUsageSection
              data={tokenData}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              modelFilter={modelFilter}
              setModelFilter={setModelFilter}
            />
          </motion.div>
        ) : (
          <motion.div
            key="apis"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <ExternalApiSection
              data={apiData}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              serviceFilter={serviceFilter}
              setServiceFilter={setServiceFilter}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
