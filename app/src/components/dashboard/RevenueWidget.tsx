import { DollarSign, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInvoiceStore, useInvoiceStats } from "@/stores/invoiceStore";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  isWithinInterval,
  parseISO,
} from "date-fns";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function RevenueWidget() {
  const { invoices } = useInvoiceStore();
  const stats = useInvoiceStats();

  // Calculate MTD revenue (paid invoices this month)
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const mtdRevenue = invoices
    .filter((inv) => {
      if (inv.status !== "paid" || !inv.paidDate) return false;
      const paidDate = parseISO(inv.paidDate);
      return isWithinInterval(paidDate, {
        start: thisMonthStart,
        end: thisMonthEnd,
      });
    })
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const lastMonthRevenue = invoices
    .filter((inv) => {
      if (inv.status !== "paid" || !inv.paidDate) return false;
      const paidDate = parseISO(inv.paidDate);
      return isWithinInterval(paidDate, {
        start: lastMonthStart,
        end: lastMonthEnd,
      });
    })
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const hasData = invoices.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Revenue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="text-3xl font-semibold">{formatCurrency(mtdRevenue)}</div>
          <p className="text-sm text-muted-foreground">This month</p>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last month</span>
            <span className="font-medium">{formatCurrency(lastMonthRevenue)}</span>
          </div>
          {stats.pendingRevenue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Pending invoices</span>
              <span className="font-medium text-yellow-500">
                {formatCurrency(stats.pendingRevenue)}
              </span>
            </div>
          )}
          {stats.overdue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Overdue</span>
              <span className="font-medium text-destructive">
                {stats.overdue} invoice{stats.overdue > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {!hasData && (
          <p className="text-sm text-muted-foreground text-center py-2 mb-2">
            No revenue data yet. Add invoices to track earnings.
          </p>
        )}

        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link to="/invoices">
            View invoices
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
