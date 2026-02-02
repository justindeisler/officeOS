import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Bot, Sparkles, FileText, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

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

interface Suggestion {
  id: string;
  project_name: string | null;
  type: string;
  title: string;
  description: string | null;
  priority: number;
  status: string;
  created_at: string;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  analysis: <Sparkles className="h-4 w-4" />,
  suggestion: <Lightbulb className="h-4 w-4" />,
  prd_created: <FileText className="h-4 w-4" />,
  task_created: <Bot className="h-4 w-4" />,
  implementation: <Bot className="h-4 w-4" />,
};

const actionTypeColors: Record<string, string> = {
  analysis: "bg-blue-500/10 text-blue-700",
  suggestion: "bg-yellow-500/10 text-yellow-700",
  prd_created: "bg-purple-500/10 text-purple-700",
  task_created: "bg-green-500/10 text-green-700",
  implementation: "bg-emerald-500/10 text-emerald-700",
};

const suggestionStatusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700",
  approved: "bg-green-500/10 text-green-700",
  rejected: "bg-red-500/10 text-red-700",
  implemented: "bg-purple-500/10 text-purple-700",
};

export function JamesBrainPage() {
  const [actions, setActions] = useState<JamesAction[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [actionsData, suggestionsData] = await Promise.all([
          api.getJamesActions({ limit: 50 }),
          api.getSuggestions({ limit: 20 }),
        ]);

        setActions(actionsData as JamesAction[]);
        setSuggestions(suggestionsData as Suggestion[]);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Bot className="h-7 w-7" />
          James Brain
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Audit trail of James's actions, suggestions, and decisions
        </p>
      </div>

      {/* Suggestions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No suggestions yet.</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{suggestion.title}</span>
                      <Badge variant="outline" className={suggestionStatusColors[suggestion.status] || ""}>
                        {suggestion.status}
                      </Badge>
                    </div>
                    {suggestion.project_name && (
                      <p className="text-xs text-muted-foreground">{suggestion.project_name}</p>
                    )}
                    {suggestion.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {suggestion.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {format(new Date(suggestion.created_at), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Actions Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No actions logged yet.</p>
          ) : (
            <div className="space-y-2">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <div className="mt-0.5">
                    {actionTypeIcons[action.action_type] || <Bot className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={actionTypeColors[action.action_type] || ""}
                      >
                        {action.action_type.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(action.created_at), "MMM d, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{action.description}</p>
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
