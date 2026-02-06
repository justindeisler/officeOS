// ─── Shared chart/dashboard formatting utilities ────────────────────────────

/**
 * Format large numbers with K/M suffixes.
 * Works for tokens, API calls, or any numeric count.
 */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * Format a dollar cost value.
 */
export function formatCost(n: number): string {
  if (n === 0) return "Free";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Format units with a type-specific display (tokens, seconds, generic).
 */
export function formatUnits(n: number, unitType: string): string {
  if (unitType === "tokens") {
    return formatCompactNumber(n);
  }
  if (unitType === "seconds") {
    if (n >= 3600) return `${(n / 3600).toFixed(1)}h`;
    if (n >= 60) return `${(n / 60).toFixed(1)}m`;
    return `${n}s`;
  }
  return n.toLocaleString();
}
