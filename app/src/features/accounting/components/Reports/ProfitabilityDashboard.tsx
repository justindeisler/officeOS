/**
 * Profitability Dashboard Component
 *
 * Two-tab view showing profitability analysis:
 * - By Client: Revenue per client with bar chart + detailed table
 * - By Category: Expense breakdown with pie chart + table
 *
 * Uses Recharts for visualization (already in project dependencies).
 */

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useProfitability } from '../../hooks/useBWA'
import type { ClientProfitability } from '../../api/bwa-reports'

// ============================================================================
// Types
// ============================================================================

export interface ProfitabilityDashboardProps {
  /** Override the year */
  year?: number
  /** Additional CSS classes */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => 2020 + i)

const PIE_COLORS = [
  'hsl(222.2, 47.4%, 11.2%)', // primary
  'hsl(142, 76%, 36%)', // success
  'hsl(38, 92%, 50%)', // warning
  'hsl(199, 89%, 48%)', // info
  'hsl(0, 84.2%, 60.2%)', // destructive
  'hsl(280, 65%, 60%)', // purple
  'hsl(180, 60%, 45%)', // teal
  'hsl(30, 80%, 55%)', // orange
  'hsl(340, 65%, 50%)', // pink
  'hsl(120, 40%, 50%)', // green
]

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

/**
 * Custom tooltip for charts
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <p key={idx} style={{ color: entry.color }} className="text-sm">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// ============================================================================
// By Client Tab
// ============================================================================

function ClientTab({ year }: { year: number }) {
  const { clientData, isLoading, error } = useProfitability({
    year,
    type: 'client',
  })

  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Laden...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
        Fehler: {error}
      </div>
    )
  }

  if (!clientData || clientData.clients.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Keine Kundendaten verfügbar
      </div>
    )
  }

  const clients = [...clientData.clients].sort((a, b) => b.income - a.income)
  const top10 = clients.slice(0, 10)

  // Chart data: top 10 clients
  const chartData = top10.map((c) => ({
    name: c.client_name.length > 15 ? c.client_name.slice(0, 15) + '…' : c.client_name,
    fullName: c.client_name,
    Umsatz: c.income,
    Kosten: c.expenses,
    Gewinn: c.profit,
  }))

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Top 10 Kunden nach Umsatz
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat('de-DE', {
                    notation: 'compact',
                    compactDisplay: 'short',
                  }).format(v)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Umsatz" fill="hsl(142, 76%, 36%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Kosten" fill="hsl(0, 84.2%, 60.2%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Gewinn" fill="hsl(199, 89%, 48%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Client Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[30px]">#</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead className="text-right">Umsatz</TableHead>
              <TableHead className="text-right">Kosten</TableHead>
              <TableHead className="text-right">Gewinn</TableHead>
              <TableHead className="text-right">Marge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client, idx) => (
              <TableRow
                key={client.client_id}
                className={cn(
                  'hover:bg-muted/20 transition-colors',
                  idx < 10 && 'bg-primary/5',
                  idx % 2 === 1 && 'bg-muted/10'
                )}
              >
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="font-medium">
                  {client.client_name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(client.income)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(client.expenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums font-medium',
                    client.profit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {formatCurrency(client.profit)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    client.profit_margin_percent >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  )}
                >
                  {formatPercent(client.profit_margin_percent)}
                </TableCell>
              </TableRow>
            ))}

            {/* Unassigned row */}
            {clientData.unassigned.income > 0 && (
              <TableRow className="bg-muted/20 italic">
                <TableCell className="font-mono text-sm text-muted-foreground">
                  –
                </TableCell>
                <TableCell className="text-muted-foreground">
                  Nicht zugeordnet
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(clientData.unassigned.income)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(clientData.unassigned.expenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(clientData.unassigned.profit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">–</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// By Category Tab
// ============================================================================

function CategoryTab({ year }: { year: number }) {
  const { categoryData, isLoading, error } = useProfitability({
    year,
    type: 'category',
  })

  if (isLoading) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Laden...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive p-8 text-center text-destructive">
        Fehler: {error}
      </div>
    )
  }

  if (!categoryData) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Keine Kategoriedaten verfügbar
      </div>
    )
  }

  const expenseTotal = categoryData.expense_categories.reduce(
    (sum, c) => sum + c.total,
    0
  )

  // Pie chart data
  const pieData = categoryData.expense_categories.map((c, idx) => ({
    name: c.category_name,
    value: c.total,
    percentage: expenseTotal > 0 ? (c.total / expenseTotal) * 100 : 0,
    fill: PIE_COLORS[idx % PIE_COLORS.length],
  }))

  const incomeTotal = categoryData.income_categories.reduce(
    (sum, c) => sum + c.total,
    0
  )

  return (
    <div className="space-y-6">
      {/* Pie Chart */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">
          Kostenverteilung nach Kategorie
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({
                  cx,
                  cy,
                  midAngle,
                  innerRadius,
                  outerRadius,
                  percentage,
                  name,
                }: {
                  cx: number
                  cy: number
                  midAngle: number
                  innerRadius: number
                  outerRadius: number
                  percentage: number
                  name: string
                }) => {
                  if (percentage < 5) return null
                  const RADIAN = Math.PI / 180
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                  const x = cx + radius * Math.cos(-midAngle * RADIAN)
                  const y = cy + radius * Math.sin(-midAngle * RADIAN)
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="white"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={600}
                    >
                      {percentage.toFixed(0)}%
                    </text>
                  )
                }}
                outerRadius={120}
                dataKey="value"
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend
                formatter={(value: string) =>
                  value.length > 25 ? value.slice(0, 25) + '…' : value
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Income Categories */}
      {categoryData.income_categories.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <div className="p-3 bg-green-50 dark:bg-green-950/20 border-b">
            <h3 className="font-semibold text-green-800 dark:text-green-300">
              Einnahmen nach Kategorie
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategorie</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
                <TableHead className="text-right">% des Gesamten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryData.income_categories.map((cat, idx) => (
                <TableRow
                  key={cat.category}
                  className={cn(idx % 2 === 1 && 'bg-muted/10')}
                >
                  <TableCell className="font-medium capitalize">
                    {cat.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(cat.total)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {incomeTotal > 0
                      ? formatPercent((cat.total / incomeTotal) * 100)
                      : '–'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/20">
                <TableCell>Gesamt</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(incomeTotal)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  100,0 %
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Expense Categories */}
      <div className="rounded-lg border overflow-x-auto">
        <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b">
          <h3 className="font-semibold text-red-800 dark:text-red-300">
            Ausgaben nach Kategorie
          </h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead className="text-right">% des Gesamten</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoryData.expense_categories.map((cat, idx) => (
              <TableRow
                key={cat.category}
                className={cn(idx % 2 === 1 && 'bg-muted/10')}
              >
                <TableCell className="font-medium">
                  {cat.category_name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(cat.total)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {expenseTotal > 0
                    ? formatPercent((cat.total / expenseTotal) * 100)
                    : '–'}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold bg-muted/20">
              <TableCell>Gesamt</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(expenseTotal)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                100,0 %
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ProfitabilityDashboard({
  year: initialYear,
  className,
}: ProfitabilityDashboardProps) {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(initialYear ?? currentYear)

  const handlePrint = () => window.print()

  return (
    <div className={cn('space-y-6 print:space-y-2', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h2 className="text-xl font-semibold">Rentabilität {selectedYear}</h2>
        <div className="flex items-center gap-2">
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Drucken
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block print:text-center print:mb-4">
        <h1 className="text-lg font-bold">Rentabilitätsanalyse {selectedYear}</h1>
      </div>

      {/* Tabs: By Client | By Category */}
      <Tabs defaultValue="client" className="w-full">
        <TabsList className="print:hidden">
          <TabsTrigger value="client">Nach Kunde</TabsTrigger>
          <TabsTrigger value="category">Nach Kategorie</TabsTrigger>
        </TabsList>

        <TabsContent value="client" className="mt-4">
          <ClientTab year={selectedYear} />
        </TabsContent>

        <TabsContent value="category" className="mt-4">
          <CategoryTab year={selectedYear} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProfitabilityDashboard
