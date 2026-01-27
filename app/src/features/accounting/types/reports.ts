/**
 * Report & Analytics Types for Enhanced Reporting Feature
 *
 * Types for:
 * - Monthly/Quarterly aggregations
 * - Category breakdowns
 * - Tax forecasting (Zahllast projection)
 * - Year-over-Year comparisons
 */

// ============================================================================
// MONTHLY AGGREGATION
// ============================================================================

/** Monthly aggregated financial data */
export interface MonthlyAggregate {
  year: number;
  month: number; // 1-12
  income: number;
  expenses: number;
  profit: number;
  vatCollected: number; // Umsatzsteuer collected
  vatPaid: number; // Vorsteuer paid
  transactionCount: number;
}

/** Quarterly aggregated financial data */
export interface QuarterlyAggregate {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  income: number;
  expenses: number;
  profit: number;
  vatCollected: number;
  vatPaid: number;
  netVat: number; // Zahllast (vatCollected - vatPaid)
  transactionCount: number;
}

// ============================================================================
// CATEGORY AGGREGATION
// ============================================================================

/** Expense breakdown by category */
export interface CategoryAggregate {
  category: string; // EÜR category key
  label: string; // Human-readable label
  amount: number; // Total amount
  percentage: number; // Percentage of total expenses
  transactionCount: number;
  averageTransaction: number;
}

/** Top vendor by spend */
export interface VendorAggregate {
  vendor: string;
  amount: number;
  transactionCount: number;
  percentage: number;
}

/** Monthly category breakdown for trend charts */
export interface MonthlyCategoryData {
  year: number;
  month: number;
  categories: Record<string, number>; // category -> amount
}

// ============================================================================
// TAX FORECAST
// ============================================================================

/** Confidence level for tax projections */
export type ForecastConfidence = 'low' | 'medium' | 'high';

/** Tax forecast for upcoming quarter */
export interface TaxForecast {
  period: string; // "2024-Q2"
  year: number;
  quarter: 1 | 2 | 3 | 4;
  projectedIncome: number;
  projectedExpenses: number;
  projectedUmsatzsteuer: number; // Output VAT
  projectedVorsteuer: number; // Input VAT
  estimatedZahllast: number; // Net VAT payment
  confidence: ForecastConfidence;
  dueDate: Date;
  hasDauerfrist: boolean; // Extended deadline
  dataPointsUsed: number; // Number of months used for projection
  projectionRange: {
    // Confidence interval
    low: number;
    high: number;
  };
}

/** Historical forecast accuracy */
export interface ForecastAccuracy {
  period: string;
  forecasted: number;
  actual: number;
  difference: number;
  percentageError: number;
}

// ============================================================================
// YEAR-OVER-YEAR COMPARISON
// ============================================================================

/** Trend direction indicator */
export type TrendDirection = 'up' | 'down' | 'neutral';

/** Single metric comparison between years */
export interface YearComparison {
  metric: string;
  label: string;
  currentYear: number;
  previousYear: number;
  change: number; // Absolute change
  changePercent: number; // Percentage change
  trend: TrendDirection;
  format: 'currency' | 'percent' | 'number';
}

/** Full year-over-year comparison report */
export interface YoYReport {
  currentYear: number;
  previousYear: number;
  comparisons: YearComparison[];
  monthlyComparison: MonthlyYoYData[];
}

/** Monthly data for YoY trend charts */
export interface MonthlyYoYData {
  month: number;
  currentYearIncome: number;
  previousYearIncome: number;
  currentYearExpenses: number;
  previousYearExpenses: number;
  currentYearProfit: number;
  previousYearProfit: number;
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

/** Data point for P&L bar chart */
export interface PLChartDataPoint {
  month: string; // "Jan", "Feb", etc.
  monthIndex: number; // 1-12
  income: number;
  expenses: number;
  profit: number;
}

/** Data point for profit trend line chart */
export interface ProfitTrendDataPoint {
  month: string;
  monthIndex: number;
  profit: number;
  cumulativeProfit: number;
}

/** Data point for expense donut chart */
export interface ExpenseDonutDataPoint {
  name: string; // Category label
  value: number; // Amount
  percentage: number;
  color: string; // Chart color
}

/** Data point for category trend stacked area chart */
export interface CategoryTrendDataPoint {
  month: string;
  monthIndex: number;
  [category: string]: number | string; // Dynamic category keys
}

// ============================================================================
// REPORT CONFIGURATION
// ============================================================================

/** Time period for reports */
export type ReportPeriod = 'month' | 'quarter' | 'year' | 'custom';

/** Report configuration options */
export interface ReportConfig {
  period: ReportPeriod;
  year: number;
  month?: number; // For monthly reports
  quarter?: 1 | 2 | 3 | 4; // For quarterly reports
  dateRange?: {
    // For custom range
    from: Date;
    to: Date;
  };
  includeVat: boolean;
  compareWithPreviousPeriod: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** German month names for charts */
export const GERMAN_MONTHS = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
] as const;

/** English month names for charts (fallback) */
export const ENGLISH_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Chart color palette matching design system */
export const CHART_COLORS = {
  income: 'hsl(142, 76%, 36%)', // --success (green)
  expenses: 'hsl(0, 84.2%, 60.2%)', // --destructive (red)
  profit: 'hsl(199, 89%, 48%)', // --info (blue)
  neutral: 'hsl(215.4, 16.3%, 46.9%)', // --muted-foreground
  vatCollected: 'hsl(38, 92%, 50%)', // --warning (amber)
  vatPaid: 'hsl(222.2, 47.4%, 11.2%)', // --primary (dark blue)
  categories: [
    'hsl(222.2, 47.4%, 11.2%)', // primary
    'hsl(142, 76%, 36%)', // success
    'hsl(38, 92%, 50%)', // warning
    'hsl(199, 89%, 48%)', // info
    'hsl(0, 84.2%, 60.2%)', // destructive
    'hsl(280, 65%, 60%)', // purple
    'hsl(180, 60%, 45%)', // teal
    'hsl(30, 80%, 55%)', // orange
  ],
} as const;
