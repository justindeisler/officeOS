/**
 * API Usage & Costs Routes
 *
 * Tracks usage and costs across ALL APIs:
 * - Anthropic (Claude via Clawdbot) — tokens (input/output), costs
 * - Groq (Whisper transcription) — API calls, audio seconds, costs
 * - Google APIs (Drive, Sheets, Calendar) — quota usage (free tier)
 * - Future: ElevenLabs TTS, other paid APIs
 *
 * Currently returns mock data. Real data integration will parse:
 * - Clawdbot gateway session logs for Anthropic usage
 * - ~/.config/james/groq-usage.log for Groq usage
 * - Google OAuth/API call logs
 */

import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiProvider {
  id: string;
  name: string;
  category: "ai" | "transcription" | "cloud" | "tts" | "other";
  icon: string; // emoji
  color: string; // chart color key
  pricingModel: string;
  freeTier: boolean;
}

interface DailyUsage {
  date: string;
  apiId: string;
  calls: number;
  units: number; // tokens, seconds, requests depending on API
  unitType: string;
  cost: number;
  inputUnits?: number;
  outputUnits?: number;
}

interface ApiSummary {
  apiId: string;
  name: string;
  category: string;
  calls: number;
  units: number;
  unitType: string;
  cost: number;
  trend: number; // percentage change vs prior period
  avgDailyCost: number;
  inputUnits?: number;
  outputUnits?: number;
}

// ─── Pricing Constants ──────────────────────────────────────────────────────

const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5": { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
  "claude-sonnet-4-5": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-haiku-4-5": { input: 0.80 / 1_000_000, output: 4.0 / 1_000_000 },
};

const GROQ_PRICING = {
  whisper: 0.0001, // per second of audio
};

// Google APIs are free tier
const GOOGLE_QUOTA = {
  drive: { daily: 1_000_000_000, description: "queries/day" },
  sheets: { daily: 300, description: "requests/min" },
  calendar: { daily: 1_000_000, description: "queries/day" },
};

// ─── API Providers ──────────────────────────────────────────────────────────

const API_PROVIDERS: ApiProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    category: "ai",
    icon: "🤖",
    color: "anthropic",
    pricingModel: "Per token (input/output)",
    freeTier: false,
  },
  {
    id: "groq",
    name: "Groq (Whisper STT)",
    category: "transcription",
    icon: "🎙️",
    color: "groq",
    pricingModel: "$0.0001/second of audio",
    freeTier: false,
  },
  {
    id: "google-drive",
    name: "Google Drive",
    category: "cloud",
    icon: "📁",
    color: "google-drive",
    pricingModel: "Free tier",
    freeTier: true,
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    category: "cloud",
    icon: "📊",
    color: "google-sheets",
    pricingModel: "Free tier",
    freeTier: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "cloud",
    icon: "📅",
    color: "google-calendar",
    pricingModel: "Free tier (via iCloud CalDAV)",
    freeTier: true,
  },
];

// ─── Mock Data Generator ────────────────────────────────────────────────────

function generateMockApiUsage(startDate: string, endDate: string) {
  const start = new Date(startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const end = new Date(endDate || new Date().toISOString().slice(0, 10));
  const now = new Date();

  // Daily usage entries
  const dailyUsage: DailyUsage[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dayMultiplier = isWeekend ? 0.3 : 1.0;
    const variance = 0.5 + Math.random() * 1.0;

    // Anthropic Claude usage (the big one)
    const anthropicSessions = Math.floor((8 + Math.random() * 15) * dayMultiplier * variance);
    const anthropicInputTokens = Math.floor(anthropicSessions * 6500 * variance);
    const anthropicOutputTokens = Math.floor(anthropicSessions * 9500 * variance);
    // Weighted cost: ~70% Sonnet, ~15% Opus, ~15% Haiku
    const opusCost = anthropicInputTokens * 0.15 * ANTHROPIC_PRICING["claude-opus-4-5"].input +
      anthropicOutputTokens * 0.15 * ANTHROPIC_PRICING["claude-opus-4-5"].output;
    const sonnetCost = anthropicInputTokens * 0.70 * ANTHROPIC_PRICING["claude-sonnet-4-5"].input +
      anthropicOutputTokens * 0.70 * ANTHROPIC_PRICING["claude-sonnet-4-5"].output;
    const haikuCost = anthropicInputTokens * 0.15 * ANTHROPIC_PRICING["claude-haiku-4-5"].input +
      anthropicOutputTokens * 0.15 * ANTHROPIC_PRICING["claude-haiku-4-5"].output;
    const anthropicTotalCost = opusCost + sonnetCost + haikuCost;

    dailyUsage.push({
      date: dateStr,
      apiId: "anthropic",
      calls: anthropicSessions,
      units: anthropicInputTokens + anthropicOutputTokens,
      unitType: "tokens",
      cost: Math.round(anthropicTotalCost * 10000) / 10000,
      inputUnits: anthropicInputTokens,
      outputUnits: anthropicOutputTokens,
    });

    // Groq Whisper usage (voice messages transcription)
    const groqCalls = Math.floor((2 + Math.random() * 6) * dayMultiplier);
    const groqSeconds = groqCalls * (15 + Math.floor(Math.random() * 45)); // 15-60 seconds per call
    const groqCost = groqSeconds * GROQ_PRICING.whisper;

    dailyUsage.push({
      date: dateStr,
      apiId: "groq",
      calls: groqCalls,
      units: groqSeconds,
      unitType: "seconds",
      cost: Math.round(groqCost * 10000) / 10000,
    });

    // Google Drive API calls
    const driveCalls = Math.floor((5 + Math.random() * 15) * dayMultiplier);
    dailyUsage.push({
      date: dateStr,
      apiId: "google-drive",
      calls: driveCalls,
      units: driveCalls,
      unitType: "requests",
      cost: 0, // Free tier
    });

    // Google Sheets API calls
    const sheetsCalls = Math.floor((3 + Math.random() * 10) * dayMultiplier);
    dailyUsage.push({
      date: dateStr,
      apiId: "google-sheets",
      calls: sheetsCalls,
      units: sheetsCalls,
      unitType: "requests",
      cost: 0, // Free tier
    });

    // Google Calendar (via iCloud CalDAV, so very few actual Google calls)
    const calCalls = Math.floor((1 + Math.random() * 4) * dayMultiplier);
    dailyUsage.push({
      date: dateStr,
      apiId: "google-calendar",
      calls: calCalls,
      units: calCalls,
      unitType: "requests",
      cost: 0, // Free tier
    });

    current.setDate(current.getDate() + 1);
  }

  // Calculate summaries per API
  const todayStr = now.toISOString().slice(0, 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const priorMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const priorMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const apiSummaries: ApiSummary[] = API_PROVIDERS.map((provider) => {
    const allEntries = dailyUsage.filter((u) => u.apiId === provider.id);
    const monthEntries = allEntries.filter((u) => u.date >= monthStart);
    const priorMonthEntries = allEntries.filter(
      (u) => u.date >= priorMonthStart && u.date <= priorMonthEnd
    );

    const totalCalls = monthEntries.reduce((s, e) => s + e.calls, 0);
    const totalUnits = monthEntries.reduce((s, e) => s + e.units, 0);
    const totalCost = monthEntries.reduce((s, e) => s + e.cost, 0);
    const priorCost = priorMonthEntries.reduce((s, e) => s + e.cost, 0);
    const totalInputUnits = monthEntries.reduce((s, e) => s + (e.inputUnits || 0), 0);
    const totalOutputUnits = monthEntries.reduce((s, e) => s + (e.outputUnits || 0), 0);
    const daysInMonth = monthEntries.length || 1;
    const trend = priorCost > 0 ? ((totalCost - priorCost) / priorCost) * 100 : 0;

    return {
      apiId: provider.id,
      name: provider.name,
      category: provider.category,
      calls: totalCalls,
      units: totalUnits,
      unitType: allEntries[0]?.unitType || "units",
      cost: Math.round(totalCost * 100) / 100,
      trend: Math.round(trend * 10) / 10,
      avgDailyCost: Math.round((totalCost / daysInMonth) * 100) / 100,
      inputUnits: totalInputUnits || undefined,
      outputUnits: totalOutputUnits || undefined,
    };
  });

  // Cost trend data for stacked area chart (daily costs by API)
  const costTrend: Array<{
    date: string;
    anthropic: number;
    groq: number;
    "google-drive": number;
    "google-sheets": number;
    "google-calendar": number;
    total: number;
  }> = [];

  const dates = [...new Set(dailyUsage.map((u) => u.date))].sort();
  for (const date of dates) {
    const dayEntries = dailyUsage.filter((u) => u.date === date);
    const entry: Record<string, number> = { total: 0 };
    for (const provider of API_PROVIDERS) {
      const providerEntry = dayEntries.find((e) => e.apiId === provider.id);
      entry[provider.id] = providerEntry ? Math.round(providerEntry.cost * 10000) / 10000 : 0;
      entry.total += entry[provider.id];
    }
    entry.total = Math.round(entry.total * 10000) / 10000;
    costTrend.push({ date, ...entry } as any);
  }

  // Overview totals
  const monthCost = apiSummaries.reduce((s, a) => s + a.cost, 0);
  const monthCalls = apiSummaries.reduce((s, a) => s + a.calls, 0);
  const todayEntries = dailyUsage.filter((u) => u.date === todayStr);
  const todayCost = todayEntries.reduce((s, e) => s + e.cost, 0);
  const todayCalls = todayEntries.reduce((s, e) => s + e.calls, 0);

  // Top API by cost
  const topApi = apiSummaries.reduce((max, a) => (a.cost > max.cost ? a : max), apiSummaries[0]);

  // Projected monthly cost (based on avg daily * 30)
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - new Date(monthStart).getTime()) / 86400000) + 1
  );
  const projectedMonthlyCost = Math.round((monthCost / daysElapsed) * 30 * 100) / 100;

  return {
    _mock: true,
    _note:
      "Mock data. Real integration will parse Clawdbot gateway logs, Groq usage log, and Google API metrics.",
    overview: {
      monthCost: Math.round(monthCost * 100) / 100,
      monthCalls,
      todayCost: Math.round(todayCost * 100) / 100,
      todayCalls,
      projectedMonthlyCost,
      topApiId: topApi.apiId,
      topApiName: topApi.name,
      topApiCost: topApi.cost,
    },
    providers: API_PROVIDERS,
    summaries: apiSummaries,
    costTrend,
    dailyUsage,
    pricing: {
      anthropic: ANTHROPIC_PRICING,
      groq: GROQ_PRICING,
      googleQuota: GOOGLE_QUOTA,
    },
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/james/api-usage
 *
 * Query params:
 *   startDate - ISO date string (default: 30 days ago)
 *   endDate   - ISO date string (default: today)
 */
router.get("/api-usage", asyncHandler(async (req, res) => {
  const {
    startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    endDate = new Date().toISOString().slice(0, 10),
  } = req.query as {
    startDate?: string;
    endDate?: string;
  };

  const data = generateMockApiUsage(startDate, endDate);
  res.json(data);
}));

export default router;
