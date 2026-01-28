import { useState, useEffect } from "react";
import { Play, Pause, Square, Clock, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useTimerStore,
  useActiveEntry,
  useTodayTotalMinutes,
} from "@/stores/timerStore";
import { useProjectStore, useActiveProjects } from "@/stores/projectStore";
import type { TimeCategory } from "@/types";

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

const categoryColors: Record<TimeCategory, string> = {
  coding: "bg-blue-500",
  meetings: "bg-purple-500",
  admin: "bg-orange-500",
  planning: "bg-green-500",
  other: "bg-gray-500",
};

const categoryLabels: Record<TimeCategory, string> = {
  coding: "Coding",
  meetings: "Meetings",
  admin: "Admin",
  planning: "Planning",
  other: "Other",
};

export function Timer() {
  const { startTimer, stopTimer, pauseTimer, resumeTimer } = useTimerStore();
  const activeEntry = useActiveEntry();
  const todayTotal = useTodayTotalMinutes();
  const { initialize: initializeProjects } = useProjectStore();
  const activeProjects = useActiveProjects();

  const [category, setCategory] = useState<TimeCategory>("coding");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Initialize projects store
  useEffect(() => {
    initializeProjects();
  }, [initializeProjects]);

  // Get project name for display
  const activeProject = activeEntry?.projectId 
    ? activeProjects.find(p => p.id === activeEntry.projectId)
    : null;

  const isRunning = activeEntry?.isRunning ?? false;
  const isPaused = activeEntry && !activeEntry.isRunning;

  // Update elapsed time every second when timer is running
  useEffect(() => {
    if (!activeEntry) {
      setElapsedSeconds(0);
      return;
    }

    const calculateElapsed = () => {
      const baseMinutes = activeEntry.durationMinutes || 0;
      if (activeEntry.isRunning) {
        const startTime = new Date(activeEntry.startTime);
        const now = new Date();
        const runningSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        return baseMinutes * 60 + runningSeconds;
      }
      return baseMinutes * 60;
    };

    setElapsedSeconds(calculateElapsed());

    if (activeEntry.isRunning) {
      const interval = setInterval(() => {
        setElapsedSeconds(calculateElapsed());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeEntry]);

  const handleStart = () => {
    startTimer({
      category,
      description: description.trim() || undefined,
      projectId: projectId || undefined,
    });
  };

  const handleStop = () => {
    stopTimer();
    setDescription("");
    setProjectId(undefined);
  };

  const handlePause = () => {
    pauseTimer();
  };

  const handleResume = () => {
    resumeTimer();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timer
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Today: {formatMinutes(todayTotal)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timer Display */}
        <div className="text-center">
          <div className="text-5xl font-mono font-semibold tracking-tight">
            {formatTime(elapsedSeconds)}
          </div>
          {activeEntry && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${categoryColors[activeEntry.category]} ${isRunning ? "animate-pulse" : ""}`}
                />
                <span className="text-sm text-muted-foreground">
                  {categoryLabels[activeEntry.category]}
                  {activeEntry.description && ` • ${activeEntry.description}`}
                </span>
              </div>
              {activeProject && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FolderKanban className="h-3 w-3" />
                  <span>{activeProject.name}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls when not tracking */}
        {!activeEntry && (
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TimeCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coding">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Coding
                    </div>
                  </SelectItem>
                  <SelectItem value="meetings">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Meetings
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="planning">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Planning
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                      Other
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are you working on?"
              />
            </div>

            {/* Project Selector */}
            {activeProjects.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="project">Project (optional)</Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(v) => setProjectId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FolderKanban className="h-4 w-4" />
                        No project
                      </div>
                    </SelectItem>
                    {activeProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <FolderKanban className="h-4 w-4 text-primary" />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          {!activeEntry && (
            <Button onClick={handleStart} className="flex-1 gap-2">
              <Play className="h-4 w-4" />
              Start Timer
            </Button>
          )}

          {isRunning && (
            <>
              <Button
                variant="outline"
                onClick={handlePause}
                className="flex-1 gap-2"
              >
                <Pause className="h-4 w-4" />
                Pause
              </Button>
              <Button
                variant="destructive"
                onClick={handleStop}
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}

          {isPaused && (
            <>
              <Button onClick={handleResume} className="flex-1 gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
              <Button
                variant="destructive"
                onClick={handleStop}
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
