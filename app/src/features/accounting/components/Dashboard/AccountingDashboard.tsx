/**
 * AccountingDashboard Component
 *
 * Main dashboard view for accounting overview.
 * Shows income, expenses, profit, pending invoices, and VAT summary.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RefreshCw, TrendingUp, TrendingDown, FileText, Receipt, Calculator, Plus, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { useAccountingStats } from '../../hooks/useAccountingStats'
import { useReportData } from '../../hooks/useReportData'
import { IncomeDialog } from '../Income/IncomeDialog'
import { ExpenseDialog } from '../Expenses/ExpenseDialog'
import { AssetDialog } from '../Assets/AssetDialog'
import { PLChart } from '../Charts/PLChart'
import { ProfitTrendChart } from '../Charts/ProfitTrendChart'
import { ExpenseDonut } from '../Charts/ExpenseDonut'
import { TaxForecast } from '../Reports/TaxForecast'
import { YearComparison } from '../Reports/YearComparison'

export interface AccountingDashboardProps {
  /** Callback when navigating to a section */
  onNavigate?: (section: 'invoices' | 'income' | 'expenses') => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Format number as German currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Get quarter label
 */
function getQuarterLabel(quarter: 1 | 2 | 3 | 4): string {
  return `Q${quarter}`
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  testId?: string
  colorClass?: string
  onClick?: () => void
  tabIndex?: number
  ariaLabel?: string
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  testId,
  colorClass,
  onClick,
  tabIndex = 0,
  ariaLabel,
}: StatCardProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-lg border bg-card p-6 shadow-sm',
        colorClass,
        onClick && 'cursor-pointer hover:bg-accent/50 transition-colors'
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={onClick ? tabIndex : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel || title}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  )
}

export function AccountingDashboard({
  onNavigate,
  className,
}: AccountingDashboardProps) {
  const {
    stats,
    isLoading,
    error,
    refresh,
    year,
    quarter,
    setYear,
  } = useAccountingStats()

  // Dialog state for quick actions
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false)
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [assetDialogOpen, setAssetDialogOpen] = useState(false)
  // Reports section state
  const [reportsExpanded, setReportsExpanded] = useState(true)

  // Get report data for charts
  const reportData = useReportData({ year, hasDauerfrist: false })

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={refresh} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Calculate profit styling
  const profitColorClass = stats
    ? stats.profit > 0
      ? 'text-green-600'
      : stats.profit < 0
      ? 'text-red-600'
      : ''
    : ''

  const currentYear = new Date().getFullYear()
  const years = [currentYear - 2, currentYear - 1, currentYear]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-4">
          {/* Period selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="year-select">Period</Label>
            <select
              id="year-select"
              aria-label="Period"
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quarter indicator */}
      <p className="text-sm text-muted-foreground">
        Current Quarter: {getQuarterLabel(quarter)} {year}
      </p>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {/* Total Income */}
        <StatCard
          title="Total Income"
          value={stats ? formatCurrency(stats.totalIncome) : formatCurrency(0)}
          icon={<TrendingUp className="h-6 w-6 text-green-600" />}
          testId="income-card"
          ariaLabel="Total Income"
          onClick={() => onNavigate?.('income')}
          tabIndex={0}
        />

        {/* Total Expenses */}
        <StatCard
          title="Total Expenses"
          value={stats ? formatCurrency(stats.totalExpenses) : formatCurrency(0)}
          icon={<TrendingDown className="h-6 w-6 text-red-600" />}
          testId="expenses-card"
          ariaLabel="Total Expenses"
          onClick={() => onNavigate?.('expenses')}
          tabIndex={0}
        />

        {/* Profit */}
        <div
          data-testid="profit-card"
          className={cn('rounded-lg border bg-card p-6 shadow-sm', profitColorClass)}
          aria-label="Profit"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Profit</p>
              <p className="text-2xl font-bold mt-1">
                {stats ? formatCurrency(stats.profit) : formatCurrency(0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {stats && stats.profit > 0
                  ? 'Net gain'
                  : stats && stats.profit < 0
                  ? 'Net loss'
                  : 'Break even'}
              </p>
            </div>
            <div className="flex items-center justify-center">
              <Calculator className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Pending Invoices */}
        <StatCard
          title="Pending Invoices"
          value={stats ? stats.pendingInvoices.toString() : '0'}
          subtitle={stats ? formatCurrency(stats.pendingAmount) : formatCurrency(0)}
          icon={<FileText className="h-6 w-6 text-orange-600" />}
          testId="pending-card"
          ariaLabel="Pending Invoices"
          onClick={() => onNavigate?.('invoices')}
          tabIndex={0}
        />

        {/* Current Quarter VAT */}
        <StatCard
          title="VAT (USt)"
          value={stats ? formatCurrency(stats.currentQuarterVat) : formatCurrency(0)}
          subtitle={`${getQuarterLabel(quarter)} ${year}`}
          icon={<Receipt className="h-6 w-6 text-blue-600" />}
          testId="vat-card"
          ariaLabel="Current Quarter VAT"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border bg-card p-6 shadow-sm" data-testid="quick-actions">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setIncomeDialogOpen(true)} data-testid="add-income-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Income
          </Button>
          <Button variant="outline" onClick={() => setExpenseDialogOpen(true)} data-testid="add-expense-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
          <Button variant="outline" onClick={() => setAssetDialogOpen(true)} data-testid="add-asset-btn">
            <Plus className="mr-2 h-4 w-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Reports Section */}
      <div className="rounded-lg border bg-card shadow-sm" data-testid="reports-section">
        <button
          className="flex w-full items-center justify-between p-6 text-left"
          onClick={() => setReportsExpanded(!reportsExpanded)}
          aria-expanded={reportsExpanded}
          aria-controls="reports-content"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Reports & Analytics</h2>
          </div>
          {reportsExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {reportsExpanded && (
          <div id="reports-content" className="space-y-6 px-6 pb-6">
            {/* Year-over-Year Comparison */}
            <YearComparison
              comparisons={reportData.yearComparison}
              currentYear={reportData.currentYear}
              previousYear={reportData.previousYear}
            />

            {/* Tax Forecast */}
            {reportData.taxForecast && (
              <TaxForecast forecast={reportData.taxForecast} />
            )}

            {/* Charts Grid */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income vs Expenses Chart */}
              <div className="rounded-lg border bg-background p-4">
                <PLChart
                  data={reportData.plChartData}
                  title="Income vs Expenses"
                  height={280}
                />
              </div>

              {/* Profit Trend Chart */}
              <div className="rounded-lg border bg-background p-4">
                <ProfitTrendChart
                  data={reportData.profitTrendData}
                  title="Profit Trend"
                  height={280}
                />
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="rounded-lg border bg-background p-4">
              <ExpenseDonut
                data={reportData.expenseDonutData}
                title="Expense Breakdown"
                height={300}
                showTotal={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs for quick actions */}
      <IncomeDialog
        open={incomeDialogOpen}
        onOpenChange={setIncomeDialogOpen}
        income={null}
        onClose={() => setIncomeDialogOpen(false)}
      />
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={null}
        onClose={() => setExpenseDialogOpen(false)}
      />
      <AssetDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        asset={null}
        onClose={() => setAssetDialogOpen(false)}
      />
    </div>
  )
}

export default AccountingDashboard
