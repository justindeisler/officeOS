import { useMemo } from "react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { CalendarClock, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTaskStore } from "@/stores/taskStore";
import type { Task } from "@/types";

function getDeadlineLabel(dueDate: Date): { label: string; urgent: boolean } {
  if (isToday(dueDate)) {
    return { label: "Today", urgent: true };
  }
  if (isTomorrow(dueDate)) {
    return { label: "Tomorrow", urgent: true };
  }
  const daysUntil = differenceInDays(dueDate, new Date());
  if (daysUntil < 0) {
    return { label: `${Math.abs(daysUntil)}d overdue`, urgent: true };
  }
  if (daysUntil <= 7) {
    return { label: `${daysUntil}d`, urgent: daysUntil <= 3 };
  }
  return { label: format(dueDate, "MMM d"), urgent: false };
}

function DeadlineItem({ task }: { task: Task }) {
  const dueDate = new Date(task.dueDate!);
  const { label, urgent } = getDeadlineLabel(dueDate);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{task.area}</p>
      </div>
      <Badge
        variant={urgent ? "destructive" : "outline"}
        className={urgent ? "" : ""}
      >
        {urgent && <AlertCircle className="h-3 w-3 mr-1" />}
        {label}
      </Badge>
    </div>
  );
}

export function UpcomingDeadlines() {
  const { tasks } = useTaskStore();

  // Get tasks with due dates in the next 7 days, sorted by date
  const upcomingTasks = useMemo(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    return tasks
      .filter((task) => {
        if (!task.dueDate || task.status === "done") return false;
        const dueDate = new Date(task.dueDate);
        return dueDate <= nextWeek;
      })
      .sort((a, b) => {
        const dateA = new Date(a.dueDate!);
        const dateB = new Date(b.dueDate!);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 5);
  }, [tasks]);

  const overdueCount = useMemo(() => {
    const now = new Date();
    return tasks.filter((task) => {
      if (!task.dueDate || task.status === "done") return false;
      return new Date(task.dueDate) < now;
    }).length;
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Upcoming Deadlines
          </CardTitle>
          {overdueCount > 0 && (
            <Badge variant="destructive">{overdueCount} overdue</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcomingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No upcoming deadlines in the next 7 days.
          </p>
        ) : (
          <>
            {upcomingTasks.map((task) => (
              <DeadlineItem key={task.id} task={task} />
            ))}
            <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
              <a href="/tasks">
                View all tasks
                <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
