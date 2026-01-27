import { useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { TrendingUp, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useWeekEntries,
  useWeekTotalMinutes,
  useCategoryBreakdown,
} from "@/stores/timerStore";
import type { TimeCategory } from "@/types";

const categoryColors: Record<TimeCategory, { bg: string; bar: string }> = {
  coding: { bg: "bg-blue-500/10", bar: "bg-blue-500" },
  meetings: { bg: "bg-purple-500/10", bar: "bg-purple-500" },
  admin: { bg: "bg-orange-500/10", bar: "bg-orange-500" },
  planning: { bg: "bg-green-500/10", bar: "bg-green-500" },
  other: { bg: "bg-gray-500/10", bar: "bg-gray-500" },
};

const categoryLabels: Record<TimeCategory, string> = {
  coding: "Coding",
  meetings: "Meetings",
  admin: "Admin",
  planning: "Planning",
  other: "Other",
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

export function WeeklySummary() {
  const weekEntries = useWeekEntries();
  const weekTotal = useWeekTotalMinutes();
  const categoryBreakdown = useCategoryBreakdown(weekEntries);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Calculate daily totals
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

  const maxDailyTotal = Math.max(...dailyTotals.map((d) => d.total), 60); // Min 1 hour scale

  // Category totals sorted by minutes
  const sortedCategories = useMemo(() => {
    return (Object.entries(categoryBreakdown) as [TimeCategory, number][])
      .sort((a, b) => b[1] - a[1])
      .filter(([, minutes]) => minutes > 0);
  }, [categoryBreakdown]);

  const maxCategoryMinutes = Math.max(
    ...sortedCategories.map(([, m]) => m),
    1
  );

  return (
    <div className="space-y-4">
      {/* Week Overview Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              This Week
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold mb-4">
            {formatDuration(weekTotal)}
          </div>

          {/* Daily Bar Chart */}
          <div className="flex items-end gap-2 h-24">
            {dailyTotals.map(({ day, total }) => {
              const height = maxDailyTotal > 0 ? (total / maxDailyTotal) * 100 : 0;
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={day.toISOString()}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div className="w-full h-20 flex items-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        isToday ? "bg-primary" : "bg-muted"
                      }`}
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${format(day, "EEEE")}: ${formatDuration(total)}`}
                    />
                  </div>
                  <span
                    className={`text-xs ${
                      isToday
                        ? "font-semibold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "EEE")}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No time tracked this week yet.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedCategories.map(([category, minutes]) => {
                const percentage = (minutes / maxCategoryMinutes) * 100;

                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {categoryLabels[category]}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDuration(minutes)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${categoryColors[category].bar}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Entries</span>
            </div>
            <div className="text-2xl font-semibold">{weekEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Daily Avg</span>
            </div>
            <div className="text-2xl font-semibold">
              {formatDuration(
                Math.round(weekTotal / (dailyTotals.filter((d) => d.total > 0).length || 1))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
