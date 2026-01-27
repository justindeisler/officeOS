import { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  format,
} from "date-fns";
import { Clock, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useTodayTotalMinutes,
  useWeekTotalMinutes,
  useWeekEntries,
} from "@/stores/timerStore";

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function TimeTrackedWidget() {
  const todayTotal = useTodayTotalMinutes();
  const weekTotal = useWeekTotalMinutes();
  const weekEntries = useWeekEntries();

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calculate daily totals for the mini chart
  const dailyTotals = useMemo(() => {
    return daysOfWeek.map((day) => {
      const dayEntries = weekEntries.filter((entry) =>
        isSameDay(new Date(entry.startTime), day)
      );
      const total = dayEntries.reduce(
        (sum, entry) => sum + (entry.durationMinutes || 0),
        0
      );
      return { day, total };
    });
  }, [weekEntries, daysOfWeek]);

  const maxDailyTotal = Math.max(...dailyTotals.map((d) => d.total), 60);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Tracked
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Today's time */}
        <div className="mb-4">
          <div className="text-3xl font-semibold">{formatDuration(todayTotal)}</div>
          <p className="text-sm text-muted-foreground">Today</p>
        </div>

        {/* Week summary */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">This week:</span>
          <span className="font-medium">{formatDuration(weekTotal)}</span>
        </div>

        {/* Mini week chart */}
        <div className="flex items-end gap-1 h-12 mb-4">
          {dailyTotals.map(({ day, total }) => {
            const height = maxDailyTotal > 0 ? (total / maxDailyTotal) * 100 : 0;
            const isToday = isSameDay(day, today);

            return (
              <div
                key={day.toISOString()}
                className="flex-1 flex flex-col items-center gap-0.5"
              >
                <div className="w-full h-8 flex items-end">
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday ? "bg-primary" : "bg-muted"
                    }`}
                    style={{ height: `${Math.max(height, 8)}%` }}
                    title={`${format(day, "EEEE")}: ${formatDuration(total)}`}
                  />
                </div>
                <span
                  className={`text-[10px] ${
                    isToday ? "font-semibold text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "EEEEE")}
                </span>
              </div>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" className="w-full" asChild>
          <a href="/time">
            View details
            <ArrowRight className="h-4 w-4 ml-1" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
