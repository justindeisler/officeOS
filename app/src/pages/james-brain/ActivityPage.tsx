import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Sparkles,
  FileText,
  Bot,
  Lightbulb,
  RefreshCw,
  Filter,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface JamesAction {
  id: string;
  action_type: string;
  description: string;
  project_id: string | null;
  task_id: string | null;
  suggestion_id: string | null;
  prd_id: string | null;
  metadata: string | null;
  created_at: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  analysis: <Sparkles className="h-4 w-4" />,
  suggestion: <Lightbulb className="h-4 w-4" />,
  prd_created: <FileText className="h-4 w-4" />,
  task_created: <Bot className="h-4 w-4" />,
  implementation: <Bot className="h-4 w-4" />,
  decision: <Activity className="h-4 w-4" />,
  automation: <Bot className="h-4 w-4" />,
};

const actionTypeColors: Record<string, string> = {
  analysis: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
  suggestion: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200",
  prd_created: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200",
  task_created: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200",
  implementation: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200",
  decision: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200",
  automation: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200",
};

const actionTypeLabels: Record<string, string> = {
  analysis: "Analysis",
  suggestion: "Suggestion",
  prd_created: "PRD Created",
  task_created: "Task Created",
  implementation: "Implementation",
  decision: "Decision",
  automation: "Automation",
};

export function ActivityPage() {
  const [actions, setActions] = useState<JamesAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<JamesAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [limit, setLimit] = useState(50);

  const fetchActions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getJamesActions({ limit: limit });
      setActions(data as JamesAction[]);
    } catch (error) {
      console.error("Failed to fetch actions:", error);
      toast.error("Failed to load activity");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, [limit]);

  useEffect(() => {
    if (typeFilter === "all") {
      setFilteredActions(actions);
    } else {
      setFilteredActions(actions.filter((a) => a.action_type === typeFilter));
    }
  }, [actions, typeFilter]);

  // Group actions by date
  const groupedActions = filteredActions.reduce((groups, action) => {
    const date = format(new Date(action.created_at), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(action);
    return groups;
  }, {} as Record<string, JamesAction[]>);

  const sortedDates = Object.keys(groupedActions).sort((a, b) => b.localeCompare(a));

  // Get unique action types for filter
  const actionTypes = [...new Set(actions.map((a) => a.action_type))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7" />
            Activity Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Audit trail of James's actions and decisions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchActions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {actionTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {actionTypeLabels[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">Last 25</SelectItem>
                <SelectItem value="50">Last 50</SelectItem>
                <SelectItem value="100">Last 100</SelectItem>
                <SelectItem value="200">Last 200</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      {sortedDates.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity recorded yet.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <Card key={date}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                  <Badge variant="secondary" className="ml-auto">
                    {groupedActions[date].length} action{groupedActions[date].length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
                  
                  <div className="space-y-4">
                    {groupedActions[date].map((action, index) => (
                      <div key={action.id} className="relative flex gap-4">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background">
                          {actionTypeIcons[action.action_type] || <Bot className="h-4 w-4" />}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 pb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={actionTypeColors[action.action_type] || ""}
                            >
                              {actionTypeLabels[action.action_type] || action.action_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(action.created_at), "HH:mm")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({formatDistanceToNow(new Date(action.created_at), { addSuffix: true })})
                            </span>
                          </div>
                          <p className="mt-1 text-sm">{action.description}</p>
                          
                          {/* Metadata and links */}
                          {(action.project_id || action.task_id || action.suggestion_id || action.prd_id) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {action.project_id && (
                                <span className="bg-muted px-2 py-0.5 rounded">
                                  Project: {action.project_id.slice(0, 8)}...
                                </span>
                              )}
                              {action.task_id && (
                                <span className="bg-muted px-2 py-0.5 rounded">
                                  Task: {action.task_id.slice(0, 8)}...
                                </span>
                              )}
                              {action.suggestion_id && (
                                <span className="bg-muted px-2 py-0.5 rounded">
                                  Suggestion: {action.suggestion_id.slice(0, 8)}...
                                </span>
                              )}
                              {action.prd_id && (
                                <span className="bg-muted px-2 py-0.5 rounded">
                                  PRD: {action.prd_id.slice(0, 8)}...
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Parsed metadata */}
                          {action.metadata && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                View metadata
                              </summary>
                              <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                                {JSON.stringify(JSON.parse(action.metadata), null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load more hint */}
      {filteredActions.length >= limit && (
        <div className="text-center">
          <Button variant="outline" onClick={() => setLimit(limit + 50)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
