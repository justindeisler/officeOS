import { useState, useEffect, useCallback } from "react";
import {
  Github,
  RefreshCw,
  Link,
  Unlink,
  Check,
  AlertCircle,
  Loader2,
  GitCommit,
  GitPullRequest,
  CircleDot,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { api, type GitHubSyncResult } from "@/lib/api";
import { useProjectStore } from "@/stores/projectStore";

interface GitHubRepo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  updatedAt: string;
}

export function GitHubSection() {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<GitHubSyncResult[] | null>(null);
  const [linkingProject, setLinkingProject] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const { projects } = useProjectStore();

  const fetchRepos = useCallback(async () => {
    setIsLoadingRepos(true);
    try {
      const data = await api.getGitHubRepos();
      setRepos(data.repos || []);
      setAuthenticated(data.authenticated !== false);
    } catch {
      toast.error("Failed to fetch GitHub repos");
      setAuthenticated(false);
    } finally {
      setIsLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncResults(null);
    try {
      const data = await api.syncAllGitHubRepos(7);
      setSyncResults(data.results);
      toast.success(`Synced ${data.totalRepos} repos, imported ${data.totalImported} items`);
    } catch {
      toast.error("Failed to sync GitHub repos");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncRepo = async (repo: string) => {
    setIsSyncing(true);
    try {
      const data = await api.syncGitHubRepo(repo, 30);
      setSyncResults([data.result]);
      const total = data.result.commitsImported + data.result.prsImported + data.result.issuesImported;
      toast.success(`Imported ${total} items from ${repo}`);
    } catch {
      toast.error(`Failed to sync ${repo}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkRepo = async (projectId: string, repo: string) => {
    try {
      await api.linkGitHubRepo(projectId, repo);
      toast.success(`Linked ${repo} to project`);
      setLinkingProject(null);
      setSelectedRepo("");
      // Refresh project store
      useProjectStore.getState().initialize();
    } catch {
      toast.error("Failed to link repo");
    }
  };

  const handleUnlinkRepo = async (projectId: string) => {
    try {
      await api.unlinkGitHubRepo(projectId);
      toast.success("Unlinked GitHub repo from project");
      useProjectStore.getState().initialize();
    } catch {
      toast.error("Failed to unlink repo");
    }
  };

  // Helper to get githubRepo from project (may be camelCase or snake_case)
  const getGithubRepo = (p: typeof projects[0]): string | undefined => {
    const raw = p as unknown as Record<string, unknown>;
    return (raw.githubRepo || raw.github_repo) as string | undefined;
  };

  // Projects with linked repos
  const linkedProjects = projects.filter((p) => getGithubRepo(p));
  const unlinkedProjects = projects.filter((p) => !getGithubRepo(p));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          GitHub Integration
        </CardTitle>
        <CardDescription>
          Connect GitHub repositories to projects for automatic activity tracking.
          Commits, PRs, and issues are imported and time estimates are auto-calculated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {authenticated === null ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : authenticated ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">
                  Connected as <strong>justindeisler</strong>
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  GitHub CLI not authenticated
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRepos}
              disabled={isLoadingRepos}
            >
              {isLoadingRepos ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={handleSyncAll}
              disabled={isSyncing || linkedProjects.length === 0}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Sync All
            </Button>
          </div>
        </div>

        {/* Linked Projects */}
        {linkedProjects.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Linked Repositories</h4>
            <div className="space-y-2">
              {linkedProjects.map((project) => {
                const githubRepo = getGithubRepo(project) || "";
                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Github className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {githubRepo}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSyncRepo(githubRepo)}
                        disabled={isSyncing}
                      >
                        {isSyncing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlinkRepo(project.id)}
                      >
                        <Unlink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Link New Repo to Project */}
        {unlinkedProjects.length > 0 && repos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Link Repository to Project</h4>
            {linkingProject ? (
              <div className="flex items-center gap-2">
                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a repository..." />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.fullName} value={repo.fullName}>
                        {repo.name}
                        {repo.description && (
                          <span className="text-muted-foreground ml-2">
                            — {repo.description.substring(0, 50)}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => handleLinkRepo(linkingProject, selectedRepo)}
                  disabled={!selectedRepo}
                >
                  <Link className="h-4 w-4 mr-1" />
                  Link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLinkingProject(null);
                    setSelectedRepo("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unlinkedProjects.slice(0, 8).map((project) => (
                  <Button
                    key={project.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setLinkingProject(project.id)}
                  >
                    <Link className="h-3 w-3 mr-1" />
                    {project.name}
                  </Button>
                ))}
                {unlinkedProjects.length > 8 && (
                  <span className="text-xs text-muted-foreground self-center">
                    +{unlinkedProjects.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Available Repos */}
        {repos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">
              Available Repositories ({repos.length})
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {repos.map((repo) => (
                <div
                  key={repo.fullName}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{repo.name}</span>
                    {repo.description && (
                      <span className="text-muted-foreground text-xs hidden sm:inline">
                        — {repo.description.substring(0, 40)}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleSyncRepo(repo.fullName)}
                    disabled={isSyncing}
                  >
                    Sync
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sync Results */}
        {syncResults && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Sync Results</h4>
            <div className="space-y-2">
              {syncResults.map((result, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{result.repo}</span>
                    <span className="text-xs text-muted-foreground">
                      {result.duration}ms
                    </span>
                  </div>
                  <div className="flex gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {result.commitsImported} commits
                    </span>
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3" />
                      {result.prsImported} PRs
                    </span>
                    <span className="flex items-center gap-1">
                      <CircleDot className="h-3 w-3" />
                      {result.issuesImported} issues
                    </span>
                  </div>
                  {(result.commitsSkipped + result.prsSkipped + result.issuesSkipped) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Skipped {result.commitsSkipped + result.prsSkipped + result.issuesSkipped} duplicates
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <div className="text-xs text-red-500">
                      {result.errors.length} error(s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {repos.length === 0 && !isLoadingRepos && authenticated && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No repositories found. Make sure you have repos on GitHub.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
