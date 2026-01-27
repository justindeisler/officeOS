import { useMemo } from "react";
import { format, isToday, isYesterday, startOfDay } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TimeEntryCard } from "./TimeEntryCard";
import { useTimerStore } from "@/stores/timerStore";
import type { TimeEntry } from "@/types";

interface DayGroup {
  date: Date;
  dateLabel: string;
  entries: TimeEntry[];
  totalMinutes: number;
}

function formatTotalTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d");
}

export function DailyTimeline() {
  const { entries } = useTimerStore();

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, DayGroup>();

    // Sort entries by start time descending
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    sortedEntries.forEach((entry) => {
      const date = startOfDay(new Date(entry.startTime));
      const key = date.toISOString();

      if (!groups.has(key)) {
        groups.set(key, {
          date,
          dateLabel: getDateLabel(date),
          entries: [],
          totalMinutes: 0,
        });
      }

      const group = groups.get(key)!;
      group.entries.push(entry);
      group.totalMinutes += entry.durationMinutes || 0;
    });

    return Array.from(groups.values());
  }, [entries]);

  if (groupedByDay.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No time entries yet</h3>
          <p className="text-sm text-muted-foreground">
            Start the timer or add a manual entry to begin tracking your time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByDay.map((group) => (
        <div key={group.date.toISOString()} className="space-y-3">
          {/* Day Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">{group.dateLabel}</h3>
              <span className="text-sm text-muted-foreground">
                {format(group.date, "MMM d, yyyy")}
              </span>
            </div>
            <div className="text-sm font-medium">
              {formatTotalTime(group.totalMinutes)}
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-2 pl-6 border-l-2 border-muted">
            {group.entries.map((entry) => (
              <TimeEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
