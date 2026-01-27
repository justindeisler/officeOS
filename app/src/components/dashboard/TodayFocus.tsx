import { useMemo } from "react";
import { Target, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/stores/taskStore";
import type { Task, TaskPriority } from "@/types";

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  1: { label: "High", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  2: { label: "Med", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  3: { label: "Low", color: "bg-green-500/10 text-green-500 border-green-500/20" },
};

function TaskItem({ task, onComplete }: { task: Task; onComplete: () => void }) {
  const isDone = task.status === "done";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isDone ? "bg-muted/50 opacity-60" : "hover:bg-muted/50"
      }`}
    >
      <button
        onClick={onComplete}
        className="mt-0.5 flex-shrink-0"
        disabled={isDone}
      >
        {isDone ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isDone ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={priorityConfig[task.priority].color}>
            {priorityConfig[task.priority].label}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">
            {task.area}
          </span>
        </div>
      </div>
    </div>
  );
}

export function TodayFocus() {
  const { tasks, updateTask } = useTaskStore();

  // Get top 3 in-progress or queue tasks, sorted by priority
  const focusTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === "in_progress" || task.status === "queue")
      .sort((a, b) => {
        // Sort by status first (in_progress first), then by priority
        if (a.status === "in_progress" && b.status !== "in_progress") return -1;
        if (a.status !== "in_progress" && b.status === "in_progress") return 1;
        return a.priority - b.priority;
      })
      .slice(0, 3);
  }, [tasks]);

  const completedToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((task) => {
      if (!task.completedAt) return false;
      const completedDate = new Date(task.completedAt);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === today.getTime();
    }).length;
  }, [tasks]);

  const handleComplete = (task: Task) => {
    if (task.status !== "done") {
      updateTask(task.id, {
        status: "done",
        completedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Today's Focus
          </CardTitle>
          {completedToday > 0 && (
            <Badge variant="secondary" className="text-xs">
              {completedToday} done today
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {focusTasks.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              No tasks in progress or queued.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/tasks">
                Go to Tasks
                <ArrowRight className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </div>
        ) : (
          <>
            {focusTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => handleComplete(task)}
              />
            ))}
            {tasks.filter((t) => t.status === "queue" || t.status === "in_progress").length > 3 && (
              <Button variant="ghost" size="sm" className="w-full mt-2" asChild>
                <a href="/tasks">
                  View all tasks
                  <ArrowRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
