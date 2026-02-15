import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Clock,
  CheckSquare,
  Receipt,
  FolderKanban,
  Edit2,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjectById, useProjectStore } from "@/stores/projectStore";
import { useClientById } from "@/stores/clientStore";
import { useTaskStore } from "@/stores/taskStore";
import { useTimerStore } from "@/stores/timerStore";
import { useInvoiceStore } from "@/stores/invoiceStore";
import type { Project, ProjectStatus, Area, Task, TimeEntry, Invoice } from "@/types";
import { GitHubActivityFeed } from "@/components/projects/GitHubActivityFeed";

const statusColors: Record<ProjectStatus, string> = {
  pipeline: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<ProjectStatus, string> = {
  pipeline: "Pipeline",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const areaColors: Record<Area, string> = {
  wellfy: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  freelance: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  personal: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Task list item component
function TaskListItem({ task }: { task: Task }) {
  const priorityColors = {
    1: "bg-red-500",
    2: "bg-yellow-500",
    3: "bg-blue-500",
  };

  const statusLabels: Record<string, string> = {
    backlog: "Backlog",
    queue: "Queue",
    in_progress: "In Progress",
    done: "Done",
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
        <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
        <Badge variant="outline" className="text-xs">
          {statusLabels[task.status]}
        </Badge>
      </div>
    </div>
  );
}

// Time entry list item component
function TimeEntryListItem({ entry }: { entry: TimeEntry }) {
  const duration = entry.durationMinutes || 0;

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm">{entry.description || "No description"}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(entry.startTime), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{entry.category}</Badge>
        <span className="text-sm font-medium">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}

// Invoice list item component
function InvoiceListItem({ invoice }: { invoice: Invoice }) {
  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500",
    sent: "bg-blue-500/10 text-blue-500",
    paid: "bg-green-500/10 text-green-500",
    overdue: "bg-red-500/10 text-red-500",
    cancelled: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{invoice.invoiceNumber}</p>
          <p className="text-xs text-muted-foreground">
            Issued {format(new Date(invoice.issueDate), "MMM d, yyyy")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={statusColors[invoice.status]}>
          {invoice.status}
        </Badge>
        <span className="text-sm font-medium">
          {formatCurrency(invoice.totalAmount, invoice.currency)}
        </span>
      </div>
    </div>
  );
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProjectById(id || "");
  const client = useClientById(project?.clientId || "");
  const { tasks } = useTaskStore();
  const { entries } = useTimerStore();
  const { invoices } = useInvoiceStore();

  // Filter related data by projectId
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === id).sort((a, b) => a.sortOrder - b.sortOrder),
    [tasks, id]
  );

  const projectTimeEntries = useMemo(
    () =>
      entries
        .filter((e) => e.projectId === id)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [entries, id]
  );

  const projectInvoices = useMemo(
    () =>
      invoices
        .filter((inv) => inv.projectId === id)
        .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices, id]
  );

  // Calculate summary stats
  const totalTimeMinutes = useMemo(
    () => projectTimeEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0),
    [projectTimeEntries]
  );

  const completedTasks = useMemo(
    () => projectTasks.filter((t) => t.status === "done").length,
    [projectTasks]
  );

  const totalInvoiced = useMemo(
    () => projectInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    [projectInvoices]
  );

  const paidAmount = useMemo(
    () =>
      projectInvoices
        .filter((inv) => inv.status === "paid")
        .reduce((sum, inv) => sum + inv.totalAmount, 0),
    [projectInvoices]
  );

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <FolderKanban className="h-12 w-12 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Project not found</h2>
        <p className="text-muted-foreground">
          The project you're looking for doesn't exist or has been deleted.
        </p>
        <Button onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    );
  }

  // Extract github_repo from the raw project object (snake_case from API)
  const githubRepo = ((project as unknown as Record<string, unknown>).githubRepo ||
    (project as unknown as Record<string, unknown>).github_repo) as string | undefined;

  return (
    <div className="space-y-6">
      {/* Back button and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/projects")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>

      {/* Project Header */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {client && (
              <p className="text-muted-foreground mt-1">
                <Link
                  to="/clients"
                  className="hover:underline"
                >
                  {client.name}
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusColors[project.status]}>
              {statusLabels[project.status]}
            </Badge>
            <Badge variant="outline" className={areaColors[project.area]}>
              {project.area}
            </Badge>
            {githubRepo ? (
              <a
                href={`https://github.com/${githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Badge variant="outline" className="gap-1 hover:bg-muted">
                  <Github className="h-3 w-3" />
                  {githubRepo.split("/").pop()}
                </Badge>
              </a>
            ) : null}
          </div>
        </div>

        {project.description && (
          <p className="text-muted-foreground">{project.description}</p>
        )}

        {/* Project Meta Info */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {project.budgetAmount && (
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Budget: {formatCurrency(project.budgetAmount, project.budgetCurrency)}
            </div>
          )}
          {project.startDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Started: {format(new Date(project.startDate), "MMM d, yyyy")}
            </div>
          )}
          {project.targetEndDate && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Due: {format(new Date(project.targetEndDate), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTasks}/{projectTasks.length}
            </div>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Time Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(totalTimeMinutes)}</div>
            <p className="text-xs text-muted-foreground">
              {projectTimeEntries.length} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Invoiced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalInvoiced, project.budgetCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {projectInvoices.length} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(paidAmount, project.budgetCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalInvoiced > 0
                ? `${Math.round((paidAmount / totalInvoiced) * 100)}%`
                : "0%"}{" "}
              of invoiced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks ({projectTasks.length})
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2">
            <Clock className="h-4 w-4" />
            Time ({projectTimeEntries.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            Invoices ({projectInvoices.length})
          </TabsTrigger>
          {githubRepo ? (
            <TabsTrigger value="github" className="gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {projectTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No tasks linked to this project yet.</p>
                  <p className="text-sm">Create tasks and assign them to this project.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {projectTasks.map((task) => (
                    <TaskListItem key={task.id} task={task} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Entries Tab */}
        <TabsContent value="time">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {projectTimeEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No time tracked for this project yet.</p>
                  <p className="text-sm">Start a timer and link it to this project.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {projectTimeEntries.map((entry) => (
                    <TimeEntryListItem key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {projectInvoices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No invoices linked to this project yet.</p>
                  <p className="text-sm">Create invoices and assign them to this project.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {projectInvoices.map((invoice) => (
                    <InvoiceListItem key={invoice.id} invoice={invoice} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GitHub Activity Tab */}
        {githubRepo ? (
          <TabsContent value="github">
            <GitHubActivityFeed
              projectId={project.id}
              repoName={githubRepo}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
