import { useEffect, useState } from 'react';
import { getDashboard, getProjectTasks, createTask, getPendingRequests, ProjectSummary, Task, KanbanData, PendingRequest } from '../api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Calendar, 
  Loader2,
  Inbox,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Column color mapping (top border)
const columnColors = {
  backlog: "border-t-slate-400",
  queue: "border-t-blue-400",
  in_progress: "border-t-amber-400",
  done: "border-t-green-400",
};

// Priority color mapping
const priorityColors = {
  1: "bg-destructive/20 text-destructive",  // High
  2: "bg-warning/20 text-warning",          // Medium
  3: "bg-muted text-muted-foreground",      // Low
};

const priorityLabels = {
  1: "High",
  2: "Medium",
  3: "Low",
};

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return format(new Date(dateStr), "MMM d");
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <div className="group rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
      <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {task.priority && (
          <span className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
            priorityColors[task.priority as keyof typeof priorityColors] || priorityColors[3]
          )}>
            {priorityLabels[task.priority as keyof typeof priorityLabels] || "Low"}
          </span>
        )}
        {task.due_date && (
          <span className={cn(
            "inline-flex items-center gap-1 text-xs",
            isOverdue ? "text-destructive" : "text-muted-foreground"
          )}>
            <Calendar className="h-3 w-3" />
            {formatDate(task.due_date)}
          </span>
        )}
        {task.quick_capture && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Request
          </span>
        )}
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  status: keyof typeof columnColors;
}

function KanbanColumn({ title, tasks, status }: KanbanColumnProps) {
  return (
    <div className={cn(
      "flex flex-col rounded-lg border border-t-4 bg-muted/30",
      columnColors[status]
    )}>
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}

interface ProjectWithTasks extends ProjectSummary {
  kanbanData?: KanbanData;
  tasksLoading?: boolean;
}

export function ClientDashboard() {
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Pending requests state
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingExpanded, setPendingExpanded] = useState(true);

  // Quick capture dialog state
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureDescription, setCaptureDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDashboard();
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      const data = await getPendingRequests();
      setPendingRequests(data.requests);
      // Auto-collapse if more than 3 pending requests
      setPendingExpanded(data.requests.length <= 3);
    } catch (err) {
      console.error('Failed to load pending requests:', err);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await getDashboard();
      const projectsWithTasks: ProjectWithTasks[] = data.projects.map(p => ({
        ...p,
        tasksLoading: true
      }));
      setProjects(projectsWithTasks);
      
      // Set first project as active
      if (data.projects.length > 0) {
        setActiveProjectId(data.projects[0].id);
      }

      // Load tasks for all projects in parallel
      const tasksPromises = data.projects.map(async (project) => {
        try {
          const kanbanData = await getProjectTasks(project.id);
          return { projectId: project.id, kanbanData, error: null };
        } catch (err) {
          return { projectId: project.id, kanbanData: null, error: err };
        }
      });

      const tasksResults = await Promise.all(tasksPromises);
      
      setProjects(prev => prev.map(project => {
        const result = tasksResults.find(r => r.projectId === project.id);
        return {
          ...project,
          kanbanData: result?.kanbanData || undefined,
          tasksLoading: false
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCapture = async () => {
    if (!captureTitle.trim() || !activeProjectId) return;

    try {
      setSubmitting(true);
      await createTask(
        activeProjectId,
        captureTitle.trim(),
        captureDescription.trim() || undefined,
        true, // quick_capture
        captureTitle.trim() // original_capture
      );
      
      toast.success('Request submitted successfully');
      setCaptureOpen(false);
      setCaptureTitle('');
      setCaptureDescription('');
      
      // Reload dashboard and pending requests
      await Promise.all([loadDashboard(), loadPendingRequests()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive font-medium">{error}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tasks</h1>
        </div>
        <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-lg border bg-muted/30">
          <Inbox className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No projects assigned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Tabs (only show if multiple projects) */}
      {projects.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setActiveProjectId(project.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeProjectId === project.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Tasks</h1>
        <Button onClick={() => setCaptureOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <button
            onClick={() => setPendingExpanded(!pendingExpanded)}
            className="flex items-center justify-between w-full p-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <span className="font-medium text-amber-800 dark:text-amber-200">
                Pending Review
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                {pendingRequests.length}
              </span>
            </div>
            {pendingExpanded ? (
              <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            )}
          </button>
          {pendingExpanded && (
            <div className="px-4 pb-4 space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-start gap-3 p-3 rounded-md bg-white dark:bg-card border border-amber-100 dark:border-amber-900/30"
                >
                  <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {request.metadata?.original_title || request.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>
                        Submitted {format(new Date(request.created_at), "MMM d")}
                      </span>
                      <span className="text-amber-600 dark:text-amber-500">
                        • Awaiting review
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kanban Board */}
      {activeProject && (
        activeProject.tasksLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading tasks...</p>
          </div>
        ) : activeProject.kanbanData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KanbanColumn
              title="Backlog"
              tasks={activeProject.kanbanData.kanban.backlog}
              status="backlog"
            />
            <KanbanColumn
              title="Queue"
              tasks={activeProject.kanbanData.kanban.queue || []}
              status="queue"
            />
            <KanbanColumn
              title="In Progress"
              tasks={activeProject.kanbanData.kanban.in_progress}
              status="in_progress"
            />
            <KanbanColumn
              title="Done"
              tasks={activeProject.kanbanData.kanban.done}
              status="done"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-lg border bg-muted/30">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Failed to load tasks</p>
          </div>
        )
      )}

      {/* Quick Capture Dialog */}
      <Dialog open={captureOpen} onOpenChange={setCaptureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit a Request</DialogTitle>
            <DialogDescription>
              Describe what you need and it will be added to the project backlog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                What do you need? <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                placeholder="e.g., Update homepage banner, Fix contact form..."
                value={captureTitle}
                onChange={(e) => setCaptureTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && captureTitle.trim()) {
                    handleSubmitCapture();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Details (optional)
              </label>
              <Textarea
                id="description"
                placeholder="Add any additional context, requirements, or links..."
                value={captureDescription}
                onChange={(e) => setCaptureDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCaptureOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitCapture}
              disabled={!captureTitle.trim() || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Button (mobile) */}
      <button
        onClick={() => setCaptureOpen(true)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
        aria-label="New Request"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
