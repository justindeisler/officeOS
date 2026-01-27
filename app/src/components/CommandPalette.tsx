import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Briefcase,
  Users,
  FileText,
  Inbox,
  Settings,
  Plus,
  Timer,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";
import { useClientStore } from "@/stores/clientStore";
import { useTimerStore } from "@/stores/timerStore";

interface CommandPaletteProps {
  onNewTask?: () => void;
  onNewProject?: () => void;
  onNewClient?: () => void;
  onNewCapture?: () => void;
}

export function CommandPalette({
  onNewTask,
  onNewProject,
  onNewClient,
  onNewCapture,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { tasks } = useTaskStore();
  const { projects } = useProjectStore();
  const { clients } = useClientStore();
  const { entries, startTimer, stopTimer } = useTimerStore();

  // Check if timer is running
  const isTimerRunning = entries.some((e) => e.isRunning);

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Get recent/active items
  const recentTasks = tasks
    .filter((t) => t.status === "in_progress" || t.status === "queue")
    .slice(0, 5);

  const activeProjects = projects
    .filter((p) => p.status === "active")
    .slice(0, 5);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          {onNewTask && (
            <CommandItem onSelect={() => runCommand(onNewTask)}>
              <Plus className="mr-2 h-4 w-4" />
              New Task
              <span className="ml-auto text-xs text-muted-foreground">⌘N</span>
            </CommandItem>
          )}
          {onNewCapture && (
            <CommandItem onSelect={() => runCommand(onNewCapture)}>
              <Inbox className="mr-2 h-4 w-4" />
              Quick Capture
              <span className="ml-auto text-xs text-muted-foreground">⌘⇧Space</span>
            </CommandItem>
          )}
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                isTimerRunning
                  ? stopTimer()
                  : startTimer({ category: "coding" })
              )
            }
          >
            <Timer className="mr-2 h-4 w-4" />
            {isTimerRunning ? "Stop Timer" : "Start Timer"}
          </CommandItem>
          {onNewProject && (
            <CommandItem onSelect={() => runCommand(onNewProject)}>
              <Briefcase className="mr-2 h-4 w-4" />
              New Project
            </CommandItem>
          )}
          {onNewClient && (
            <CommandItem onSelect={() => runCommand(onNewClient)}>
              <Users className="mr-2 h-4 w-4" />
              New Client
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
            <span className="ml-auto text-xs text-muted-foreground">⌘1</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/tasks"))}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Tasks
            <span className="ml-auto text-xs text-muted-foreground">⌘2</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/time"))}>
            <Clock className="mr-2 h-4 w-4" />
            Time Tracking
            <span className="ml-auto text-xs text-muted-foreground">⌘3</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/projects"))}>
            <Briefcase className="mr-2 h-4 w-4" />
            Projects
            <span className="ml-auto text-xs text-muted-foreground">⌘4</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/clients"))}>
            <Users className="mr-2 h-4 w-4" />
            Clients
            <span className="ml-auto text-xs text-muted-foreground">⌘5</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/invoices"))}>
            <FileText className="mr-2 h-4 w-4" />
            Invoices
            <span className="ml-auto text-xs text-muted-foreground">⌘6</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/inbox"))}>
            <Inbox className="mr-2 h-4 w-4" />
            Inbox
            <span className="ml-auto text-xs text-muted-foreground">⌘7</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
            <span className="ml-auto text-xs text-muted-foreground">⌘,</span>
          </CommandItem>
        </CommandGroup>

        {/* Recent Tasks */}
        {recentTasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Active Tasks">
              {recentTasks.map((task) => (
                <CommandItem
                  key={task.id}
                  onSelect={() => runCommand(() => navigate("/tasks"))}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  {task.title}
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {task.status.replace("_", " ")}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Active Projects */}
        {activeProjects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Active Projects">
              {activeProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => runCommand(() => navigate("/projects"))}
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  {project.name}
                  {project.clientId && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {clients.find((c) => c.id === project.clientId)?.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
