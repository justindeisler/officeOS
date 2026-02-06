import { useState, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import { useTaskStore, useFilteredTasks } from "@/stores/taskStore";
import { useConfettiStore } from "@/stores/confettiStore";
import { taskService } from "@/services";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Task, TaskStatus, SubtaskCounts } from "@/types";

const columns: { id: TaskStatus; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "queue", title: "Queue" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export function KanbanBoard() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | null>(null);

  // Track original status for confetti trigger
  const originalStatusRef = useRef<TaskStatus | null>(null);

  // Subtask counts for all tasks
  const [subtaskCounts, setSubtaskCounts] = useState<Record<string, SubtaskCounts>>({});

  const { moveTaskLocal, persistColumnOrder } = useTaskStore();
  const filteredTasks = useFilteredTasks();
  const triggerConfetti = useConfettiStore((state) => state.trigger);

  // Capture pre-drag task state for rollback on API failure
  const preDragTasksRef = useRef<Task[]>([]);

  // Fetch subtask counts for all visible tasks
  useEffect(() => {
    const taskIds = filteredTasks.map((t) => t.id);
    if (taskIds.length === 0) return;

    const fetchCounts = async () => {
      try {
        const counts = await api.getSubtaskCounts(taskIds);
        setSubtaskCounts(counts);
      } catch (err) {
        console.error("Failed to fetch subtask counts:", err);
      }
    };

    fetchCounts();
  }, [filteredTasks.map((t) => t.id).join(",")]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      backlog: [],
      queue: [],
      in_progress: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });

    // Sort by sortOrder within each column
    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => a.sortOrder - b.sortOrder);
    });

    return grouped;
  }, [filteredTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = filteredTasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
      // Capture original status for confetti check on drop
      originalStatusRef.current = task.status;
      // Capture pre-drag state for API rollback
      preDragTasksRef.current = useTaskStore.getState().tasks;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find if we're over a column or a task
    const activeTask = filteredTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Check if overId is a column
    const isOverColumn = columns.some((col) => col.id === overId);

    if (isOverColumn) {
      // Dropping directly on a column (empty space)
      const newStatus = overId as TaskStatus;
      if (activeTask.status !== newStatus) {
        const columnTasks = tasksByStatus[newStatus];
        moveTaskLocal(activeId, newStatus, columnTasks.length);
      }
    } else {
      // Dropping on another task
      const overTask = filteredTasks.find((t) => t.id === overId);
      if (overTask && activeTask.status !== overTask.status) {
        const columnTasks = tasksByStatus[overTask.status];
        const overIndex = columnTasks.findIndex((t) => t.id === overId);
        moveTaskLocal(activeId, overTask.status, overIndex);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const originalStatus = originalStatusRef.current;
    const activeId = active.id as string;
    const preDragTasks = preDragTasksRef.current;

    // Reset drag state
    setActiveTask(null);
    originalStatusRef.current = null;
    preDragTasksRef.current = [];

    // Check for confetti BEFORE any early returns
    // Get fresh state from store (handleDragOver already moved the task)
    const freshTasks = useTaskStore.getState().tasks;
    const currentTask = freshTasks.find((t) => t.id === activeId);

    if (currentTask?.status === "done" && originalStatus !== "done") {
      triggerConfetti();
    }

    // Handle same-column reordering
    if (over) {
      const overId = over.id as string;
      if (activeId !== overId) {
        const overTask = freshTasks.find((t) => t.id === overId);
        if (overTask && currentTask && currentTask.status === overTask.status) {
          const columnTasks = freshTasks
            .filter((t) => t.status === currentTask.status)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const activeIndex = columnTasks.findIndex((t) => t.id === activeId);
          const overIndex = columnTasks.findIndex((t) => t.id === overId);

          if (activeIndex !== overIndex) {
            moveTaskLocal(activeId, currentTask.status, overIndex);
          }
        }
      }
    }

    // Persist the final state to the API
    if (currentTask) {
      persistColumnOrder(activeId, currentTask.status, preDragTasks);

      // If the task moved to a different column, also persist the source column order
      if (originalStatus && originalStatus !== currentTask.status) {
        const sourceColumnTasks = useTaskStore.getState()
          .tasks.filter((t) => t.status === originalStatus)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const sourceTaskIds = sourceColumnTasks.map((t) => t.id);
        if (sourceTaskIds.length > 0) {
          taskService.reorderTasks(sourceTaskIds, originalStatus).catch((err) => {
            console.error("Failed to persist source column order:", err);
          });
        }
      }
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    setNewTaskStatus(status);
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setNewTaskStatus(null);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
    setNewTaskStatus(null);
  };

  const handleAssignToJames = async (task: Task) => {
    try {
      // Update task to assign to James
      const { updateTask } = useTaskStore.getState();
      updateTask(task.id, { assignee: "james" });
      
      // Trigger James to start working on it
      await api.triggerJames();
      
      toast.success(`Assigned "${task.title}" to James`, {
        description: "James will start working on it shortly",
      });
    } catch (error) {
      console.error("Failed to assign to James:", error);
      toast.error("Failed to assign task to James");
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <div key={column.id} className="w-full">
              <KanbanColumn
                id={column.id}
                title={column.title}
                tasks={tasksByStatus[column.id]}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onAssignToJames={handleAssignToJames}
                subtaskCounts={subtaskCounts}
              />
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard 
              task={activeTask} 
              onEdit={() => {}} 
              isDragging 
              subtaskCounts={subtaskCounts[activeTask.id]}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultStatus={newTaskStatus}
        onClose={handleCloseDialog}
      />
    </>
  );
}
