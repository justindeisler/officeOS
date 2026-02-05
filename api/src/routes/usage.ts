/**
 * Token Usage API Routes
 *
 * Provides AI token usage data for the cost tracking dashboard.
 * Currently returns mock data as Clawdbot doesn't yet expose
 * per-session token metrics. When real tracking is available,
 * this endpoint will query the actual usage store.
 *
 * DATA REQUIREMENTS (for future real integration):
 * - Per-session token counts (input + output)
 * - Model used per session (opus-4-5, sonnet-4-5, haiku-4-5)
 * - Timestamp per session
 * - Activity description per session
 * - Source: Clawdbot gateway logs or Anthropic usage API
 */

import { Router } from "express";

const router = Router();

// ─── Mock Data Generator ────────────────────────────────────────────────────

function generateMockData(startDate: string, endDate: string, groupBy: string, modelFilter?: string) {
  const start = new Date(startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const end = new Date(endDate || new Date().toISOString().slice(0, 10));

  const models = ["opus-4-5", "sonnet-4-5", "haiku-4-5"];
  const activeModels = modelFilter ? [modelFilter] : models;

  // Token rate per model (output tokens are typically fewer)
  const modelRates: Record<string, { inputBase: number; outputBase: number }> = {
    "opus-4-5": { inputBase: 8000, outputBase: 12000 },
    "sonnet-4-5": { inputBase: 6000, outputBase: 9000 },
    "haiku-4-5": { inputBase: 3000, outputBase: 4000 },
  };

  // Model usage distribution weights
  const modelWeights: Record<string, number> = {
    "opus-4-5": 0.15,
    "sonnet-4-5": 0.70,
    "haiku-4-5": 0.15,
  };

  const activities = [
    "Implemented expense toggle feature",
    "Fixed mobile comments display",
    "Created PR for dashboard update",
    "Reviewed and merged code changes",
    "Generated project suggestions",
    "Email inbox processing",
    "Calendar event management",
    "Second brain journal entry",
    "Task prioritization analysis",
    "Codebase architecture review",
    "Bug investigation and fix",
    "Documentation update",
    "API endpoint development",
    "UI component refactoring",
    "Database migration planning",
    "Heartbeat system check",
    "Memory consolidation",
    "Git branch management",
    "Test suite execution",
    "Deployment and monitoring",
  ];

  // Generate daily trend data
  const trend: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    tokens: number;
    model: string;
  }> = [];

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getDay();
    // Weekdays are busier
    const dayMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.4 : 1.0;
    // Add some variance
    const variance = 0.5 + Math.random() * 1.0;

    for (const model of activeModels) {
      const rate = modelRates[model];
      const weight = modelWeights[model];
      const sessionsToday = Math.floor((3 + Math.random() * 8) * dayMultiplier * weight);

      const inputTokens = Math.floor(rate.inputBase * sessionsToday * variance);
      const outputTokens = Math.floor(rate.outputBase * sessionsToday * variance);

      trend.push({
        date: dateStr,
        inputTokens,
        outputTokens,
        tokens: inputTokens + outputTokens,
        model,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  // Aggregate by groupBy
  let aggregatedTrend = trend;
  if (groupBy === "week") {
    const weekMap = new Map<string, typeof trend[0]>();
    for (const entry of trend) {
      const d = new Date(entry.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
      const key = `${weekStart.toISOString().slice(0, 10)}|${entry.model}`;
      if (weekMap.has(key)) {
        const existing = weekMap.get(key)!;
        existing.inputTokens += entry.inputTokens;
        existing.outputTokens += entry.outputTokens;
        existing.tokens += entry.tokens;
      } else {
        weekMap.set(key, { ...entry, date: weekStart.toISOString().slice(0, 10) });
      }
    }
    aggregatedTrend = Array.from(weekMap.values());
  } else if (groupBy === "month") {
    const monthMap = new Map<string, typeof trend[0]>();
    for (const entry of trend) {
      const key = `${entry.date.slice(0, 7)}-01|${entry.model}`;
      if (monthMap.has(key)) {
        const existing = monthMap.get(key)!;
        existing.inputTokens += entry.inputTokens;
        existing.outputTokens += entry.outputTokens;
        existing.tokens += entry.tokens;
      } else {
        monthMap.set(key, { ...entry, date: `${entry.date.slice(0, 7)}-01` });
      }
    }
    aggregatedTrend = Array.from(monthMap.values());
  }

  // Calculate overview
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);

  const todayTokens = trend.filter((t) => t.date === todayStr).reduce((s, t) => s + t.tokens, 0);
  const weekTokens = trend.filter((t) => t.date >= weekAgo).reduce((s, t) => s + t.tokens, 0);
  const monthTokens = trend.filter((t) => t.date >= monthAgo).reduce((s, t) => s + t.tokens, 0);
  const totalTokens = trend.reduce((s, t) => s + t.tokens, 0);

  const todayInput = trend.filter((t) => t.date === todayStr).reduce((s, t) => s + t.inputTokens, 0);
  const todayOutput = trend.filter((t) => t.date === todayStr).reduce((s, t) => s + t.outputTokens, 0);
  const weekInput = trend.filter((t) => t.date >= weekAgo).reduce((s, t) => s + t.inputTokens, 0);
  const weekOutput = trend.filter((t) => t.date >= weekAgo).reduce((s, t) => s + t.outputTokens, 0);
  const monthInput = trend.filter((t) => t.date >= monthAgo).reduce((s, t) => s + t.inputTokens, 0);
  const monthOutput = trend.filter((t) => t.date >= monthAgo).reduce((s, t) => s + t.outputTokens, 0);
  const totalInput = trend.reduce((s, t) => s + t.inputTokens, 0);
  const totalOutput = trend.reduce((s, t) => s + t.outputTokens, 0);

  // By model breakdown
  const byModel: Record<string, { total: number; input: number; output: number }> = {};
  for (const model of models) {
    const modelEntries = trend.filter((t) => t.model === model);
    byModel[model] = {
      total: modelEntries.reduce((s, t) => s + t.tokens, 0),
      input: modelEntries.reduce((s, t) => s + t.inputTokens, 0),
      output: modelEntries.reduce((s, t) => s + t.outputTokens, 0),
    };
  }

  // Generate mock sessions
  const sessions: Array<{
    id: string;
    timestamp: string;
    activity: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    total: number;
  }> = [];

  // Generate ~50 recent sessions
  for (let i = 0; i < 50; i++) {
    const hoursAgo = Math.floor(Math.random() * 72);
    const timestamp = new Date(now.getTime() - hoursAgo * 3600000);
    const model = models[Math.floor(Math.random() * 100) < 15 ? 0 : Math.floor(Math.random() * 100) < 85 ? 1 : 2];
    const rate = modelRates[model];
    const inputTokens = Math.floor(rate.inputBase * (0.3 + Math.random() * 1.5));
    const outputTokens = Math.floor(rate.outputBase * (0.3 + Math.random() * 1.5));

    sessions.push({
      id: crypto.randomUUID(),
      timestamp: timestamp.toISOString(),
      activity: activities[Math.floor(Math.random() * activities.length)],
      model,
      inputTokens,
      outputTokens,
      total: inputTokens + outputTokens,
    });
  }

  // Sort sessions by timestamp (newest first)
  sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter sessions by model if needed
  const filteredSessions = modelFilter
    ? sessions.filter((s) => s.model === modelFilter)
    : sessions;

  return {
    _mock: true,
    _note: "This is mock data. Real token tracking requires Clawdbot gateway integration or Anthropic usage API access.",
    overview: {
      total: totalTokens,
      totalInput: totalInput,
      totalOutput: totalOutput,
      today: todayTokens,
      todayInput,
      todayOutput,
      week: weekTokens,
      weekInput,
      weekOutput,
      month: monthTokens,
      monthInput,
      monthOutput,
    },
    byModel,
    trend: aggregatedTrend.sort((a, b) => a.date.localeCompare(b.date)),
    sessions: filteredSessions,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/james/usage
 *
 * Query params:
 *   startDate - ISO date string (default: 30 days ago)
 *   endDate   - ISO date string (default: today)
 *   model     - Filter by model (opus-4-5, sonnet-4-5, haiku-4-5)
 *   groupBy   - Aggregation period: day (default), week, month
 */
router.get("/usage", (req, res) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      endDate = new Date().toISOString().slice(0, 10),
      model,
      groupBy = "day",
    } = req.query as {
      startDate?: string;
      endDate?: string;
      model?: string;
      groupBy?: string;
    };

    const data = generateMockData(startDate, endDate, groupBy, model);
    res.json(data);
  } catch (error) {
    console.error("[Usage] Error generating usage data:", error);
    res.status(500).json({ error: "Failed to generate usage data" });
  }
});

export default router;
