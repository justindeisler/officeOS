import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Github,
  GitCommit,
  GitPullRequest,
  CircleDot,
  Clock,
  Plus,
  Minus,
  ExternalLink,
  RefreshCw,
  Loader2,
  GitMerge,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api, type GitHubActivityItem, type GitHubActivityStats } from "@/lib/api";

interface GitHubActivityFeedProps {
  projectId: string;
  repoName?: string;
}

function ActivityIcon({ type, merged }: { type: string; merged?: boolean }) {
  switch (type) {
    case "commit":
      return <GitCommit className="h-4 w-4 text-blue-500" />;
    case "pr":
      return merged ? (
        <GitMerge className="h-4 w-4 text-purple-500" />
      ) : (
        <GitPullRequest className="h-4 w-4 text-green-500" />
      );
    case "issue":
      return <CircleDot className="h-4 w-4 text-orange-500" />;
    default:
      return <Github className="h-4 w-4" />;
  }
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ActivityItem({ item }: { item: GitHubActivityItem }) {
  const isMerged = item.type === "pr" && item.merged_at;
  const isClosed = item.closed_at && !isMerged;
  const hasStats = (item.additions || 0) > 0 || (item.deletions || 0) > 0;

  return (
    <div className="flex items-start gap-3 py-3 px-4 hover:bg-muted/50 rounded-lg transition-colors">
      <div className="mt-0.5">
        <ActivityIcon type={item.type} merged={!!isMerged} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">
              {item.type === "commit" && item.sha && (
                <span className="font-mono text-xs text-muted-foreground mr-1.5">
                  {item.sha.substring(0, 7)}
                </span>
              )}
              {item.type !== "commit" && item.number && (
                <span className="text-muted-foreground mr-1">
                  #{item.number}
                </span>
              )}
              {item.title || "No title"}
            </p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{item.author}</span>
              <span>·</span>
              <span title={format(new Date(item.created_at), "PPpp")}>
                {formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                })}
              </span>
              {isMerged && (
                <Badge
                  variant="outline"
                  className="text-purple-500 border-purple-500/20 text-[10px] h-4 px-1"
                >
                  merged
                </Badge>
              )}
              {isClosed && (
                <Badge
                  variant="outline"
                  className="text-red-500 border-red-500/20 text-[10px] h-4 px-1"
                >
                  closed
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasStats && (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-green-500 flex items-center">
                  <Plus className="h-3 w-3" />
                  {item.additions}
                </span>
                <span className="text-red-500 flex items-center">
                  <Minus className="h-3 w-3" />
                  {item.deletions}
                </span>
              </div>
            )}
            {item.estimated_minutes && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatMinutes(item.estimated_minutes)}
              </div>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GitHubActivityFeed({
  projectId,
  repoName,
}: GitHubActivityFeedProps) {
  const [activities, setActivities] = useState<GitHubActivityItem[]>([]);
  const [stats, setStats] = useState<GitHubActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "commit" | "pr" | "issue">("all");

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getGitHubProjectActivity(projectId, filter === "all" ? undefined : filter);
      setActivities(data.activities || []);
      setStats(data.stats || null);
    } catch {
      // Silent fail - project may not have GitHub activity
    } finally {
      setIsLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleSync = async () => {
    if (!repoName) return;
    setIsSyncing(true);
    try {
      const data = await api.syncGitHubRepo(repoName, 30);
      const total =
        data.result.commitsImported +
        data.result.prsImported +
        data.result.issuesImported;
      toast.success(`Imported ${total} items from GitHub`);
      fetchActivity();
    } catch {
      toast.error("Failed to sync GitHub activity");
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't render if no repo linked and no activity
  if (!repoName && activities.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Activity
            {stats && (
              <Badge variant="secondary" className="font-normal">
                {stats.total} total
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {repoName && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sync
              </Button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        {stats && stats.total > 0 && (
          <div className="flex gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <GitCommit className="h-3.5 w-3.5 text-blue-500" />
              {stats.commits} commits
            </span>
            <span className="flex items-center gap-1">
              <GitPullRequest className="h-3.5 w-3.5 text-green-500" />
              {stats.prs} PRs
            </span>
            <span className="flex items-center gap-1">
              <CircleDot className="h-3.5 w-3.5 text-orange-500" />
              {stats.issues} issues
            </span>
            {stats.estimated_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                ~{formatMinutes(stats.estimated_minutes)} estimated
              </span>
            )}
          </div>
        )}

        {/* Filter */}
        {activities.length > 0 && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mt-2">
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7 px-2">All</TabsTrigger>
              <TabsTrigger value="commit" className="text-xs h-7 px-2">
                <GitCommit className="h-3 w-3 mr-1" />
                Commits
              </TabsTrigger>
              <TabsTrigger value="pr" className="text-xs h-7 px-2">
                <GitPullRequest className="h-3 w-3 mr-1" />
                PRs
              </TabsTrigger>
              <TabsTrigger value="issue" className="text-xs h-7 px-2">
                <CircleDot className="h-3 w-3 mr-1" />
                Issues
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Github className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No GitHub activity found.</p>
            {repoName && (
              <p className="text-sm mt-1">
                Click "Sync" to import activity from{" "}
                <span className="font-mono">{repoName}</span>.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y max-h-[500px] overflow-y-auto -mx-4">
            {activities.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
