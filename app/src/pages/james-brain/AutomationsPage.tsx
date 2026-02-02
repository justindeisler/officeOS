import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Zap,
  Clock,
  Calendar,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  schedule: string;
  schedule_human: string | null;
  type: string;
  enabled: number;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  cron: <Clock className="h-4 w-4" />,
  interval: <RefreshCw className="h-4 w-4" />,
  trigger: <Zap className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  cron: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  interval: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  trigger: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAutomations = async () => {
    setIsLoading(true);
    try {
      const data = await api.getJamesAutomations();
      setAutomations(data as Automation[]);
    } catch (error) {
      console.error("Failed to fetch automations:", error);
      toast.error("Failed to load automations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const toggleEnabled = async (id: string, currentEnabled: number) => {
    try {
      await api.updateJamesAutomation(id, { enabled: !currentEnabled });
      toast.success(currentEnabled ? "Automation disabled" : "Automation enabled");
      fetchAutomations();
    } catch (error) {
      toast.error("Failed to update automation");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7" />
            Automations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scheduled jobs and automated tasks that James runs
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAutomations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Automations</p>
                <p className="text-2xl font-bold">{automations.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{enabledCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automations List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduled Jobs</CardTitle>
          <CardDescription>
            These automations run automatically based on their schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No automations configured yet.
            </p>
          ) : (
            <div className="space-y-4">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className={`p-4 rounded-lg border bg-card ${
                    !automation.enabled ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-medium">{automation.name}</span>
                        <Badge variant="outline" className={typeColors[automation.type] || ""}>
                          {typeIcons[automation.type]}
                          <span className="ml-1">{automation.type}</span>
                        </Badge>
                        {automation.enabled ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            <Play className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-500/10 text-gray-700 dark:text-gray-400">
                            <Pause className="h-3 w-3 mr-1" />
                            Paused
                          </Badge>
                        )}
                      </div>
                      
                      {automation.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {automation.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {automation.schedule_human || automation.schedule}
                        </span>
                        {automation.last_run && (
                          <span>
                            Last run: {format(new Date(automation.last_run), "MMM d, HH:mm")}
                          </span>
                        )}
                        {automation.next_run && (
                          <span>
                            Next: {format(new Date(automation.next_run), "MMM d, HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={!!automation.enabled}
                        onCheckedChange={() => toggleEnabled(automation.id, automation.enabled)}
                      />
                    </div>
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
