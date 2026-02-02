import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  Bot,
  Sparkles,
  Lightbulb,
  ListTodo,
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface JamesAction {
  id: string;
  action_type: string;
  description: string;
  created_at: string;
}

interface Suggestion {
  id: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
}

interface JamesTask {
  id: string;
  title: string;
  status: string;
  priority: number;
  created_at: string;
}

interface TaskStats {
  total: number;
  backlog: number;
  queue: number;
  in_progress: number;
  done: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  approved: "bg-green-500/10 text-green-700 dark:text-green-400",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  implemented: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  backlog: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  queue: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

export function OverviewPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tasks, setTasks] = useState<JamesTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [recentActions, setRecentActions] = useState<JamesAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suggestionsData, tasksData, statsData, actionsData] = await Promise.all([
          api.getSuggestions({ status: "pending", limit: 5 }),
          api.getJamesTasks({ limit: 10 }),
          api.getJamesTasksStats(),
          api.getJamesActions({ limit: 5 }),
        ]);

        setSuggestions(suggestionsData as Suggestion[]);
        setTasks(tasksData as JamesTask[]);
        setTaskStats(statsData);
        setRecentActions(actionsData as JamesAction[]);
      } catch (error) {
        console.error("Failed to fetch James Brain data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const queuedTasks = tasks.filter((t) => t.status === "queue");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Bot className="h-7 w-7" />
          James Brain
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of James's activities, suggestions, and tasks
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Suggestions</p>
                <p className="text-2xl font-bold">{pendingSuggestions.length}</p>
              </div>
              <Lightbulb className="h-8 w-8 text-yellow-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{taskStats?.in_progress || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Queued</p>
                <p className="text-2xl font-bold">{taskStats?.queue || 0}</p>
              </div>
              <ListTodo className="h-8 w-8 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{taskStats?.done || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Suggestions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Pending Suggestions
            </CardTitle>
            <Link to="/james-brain/suggestions">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingSuggestions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No pending suggestions.</p>
            ) : (
              <div className="space-y-3">
                {pendingSuggestions.slice(0, 5).map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(suggestion.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColors[suggestion.status]}>
                      {suggestion.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Active Tasks
            </CardTitle>
            <Link to="/james-brain/tasks">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {inProgressTasks.length === 0 && queuedTasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active tasks.</p>
            ) : (
              <div className="space-y-3">
                {[...inProgressTasks, ...queuedTasks].slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Priority: {task.priority}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <Link to="/james-brain/activity">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentActions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {recentActions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{action.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(action.created_at), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
