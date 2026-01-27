import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { Task, TaskStatus, Area } from "@/types";

class TaskService extends BaseService<Task> {
  constructor() {
    super("tasks");
  }

  async getAll(): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tasks ORDER BY sort_order ASC"
    );
    return rows.map((row) => fromDbFormat<Task>(row));
  }

  async getByStatus(status: TaskStatus): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tasks WHERE status = ? ORDER BY sort_order ASC",
      [status]
    );
    return rows.map((row) => fromDbFormat<Task>(row));
  }

  async getByArea(area: Area): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tasks WHERE area = ? ORDER BY sort_order ASC",
      [area]
    );
    return rows.map((row) => fromDbFormat<Task>(row));
  }

  async getByProject(projectId: string): Promise<Task[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order ASC",
      [projectId]
    );
    return rows.map((row) => fromDbFormat<Task>(row));
  }

  async create(
    item: Omit<Task, "id" | "createdAt" | "updatedAt" | "sortOrder">
  ): Promise<Task> {
    const db = await getDb();
    const id = generateId();
    const now = formatDate(new Date());

    // Get max sort order for this status
    const maxOrderResult = await db.select<{ max_order: number | null }[]>(
      "SELECT MAX(sort_order) as max_order FROM tasks WHERE status = ?",
      [item.status]
    );
    const sortOrder = (maxOrderResult[0]?.max_order ?? -1) + 1;

    const fullItem: Task = {
      ...item,
      id,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };

    const dbItem = toDbFormat(fullItem as unknown as Record<string, unknown>);
    const columns = Object.keys(dbItem);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbItem);

    await db.execute(
      `INSERT INTO tasks (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullItem;
  }

  async moveTask(
    taskId: string,
    newStatus: TaskStatus,
    newIndex: number
  ): Promise<void> {
    const db = await getDb();

    // Get the task
    const task = await this.getById(taskId);
    if (!task) throw new Error("Task not found");

    const now = formatDate(new Date());
    const completedAt = newStatus === "done" ? now : null;

    // Get all tasks in the target status
    const tasksInStatus = await this.getByStatus(newStatus);

    // Remove the current task if it's in the same status
    const otherTasks = tasksInStatus.filter((t) => t.id !== taskId);

    // Insert at new index
    otherTasks.splice(newIndex, 0, { ...task, status: newStatus });

    // Update sort orders
    for (let i = 0; i < otherTasks.length; i++) {
      await db.execute(
        `UPDATE tasks SET sort_order = ?, status = ?, updated_at = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?`,
        [
          i,
          newStatus,
          now,
          otherTasks[i].id === taskId ? completedAt : null,
          otherTasks[i].id,
        ]
      );
    }

    // Update the moved task status and completed_at
    await db.execute(
      `UPDATE tasks SET status = ?, sort_order = ?, updated_at = ?, completed_at = ? WHERE id = ?`,
      [newStatus, newIndex, now, completedAt, taskId]
    );
  }

  async reorderTasks(taskIds: string[], status: TaskStatus): Promise<void> {
    const db = await getDb();
    const now = formatDate(new Date());

    for (let i = 0; i < taskIds.length; i++) {
      await db.execute(
        "UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ? AND status = ?",
        [i, now, taskIds[i], status]
      );
    }
  }
}

export const taskService = new TaskService();
