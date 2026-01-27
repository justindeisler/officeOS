import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { Project, Area, ProjectStatus } from "@/types";

class ProjectService extends BaseService<Project> {
  constructor() {
    super("projects");
  }

  // Override create to handle updatedAt field
  async create(
    item: Omit<Project, "id" | "createdAt" | "updatedAt">
  ): Promise<Project> {
    const db = await getDb();
    const id = generateId();
    const now = formatDate(new Date());

    const fullItem: Project = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const dbItem = toDbFormat(fullItem as unknown as Record<string, unknown>);
    const columns = Object.keys(dbItem);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbItem);

    await db.execute(
      `INSERT INTO projects (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullItem;
  }

  async getByArea(area: Area): Promise<Project[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM projects WHERE area = ? ORDER BY created_at DESC",
      [area]
    );
    return rows.map((row) => fromDbFormat<Project>(row));
  }

  async getByStatus(status: ProjectStatus): Promise<Project[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM projects WHERE status = ? ORDER BY created_at DESC",
      [status]
    );
    return rows.map((row) => fromDbFormat<Project>(row));
  }

  async getByClient(clientId: string): Promise<Project[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC",
      [clientId]
    );
    return rows.map((row) => fromDbFormat<Project>(row));
  }

  async getActive(): Promise<Project[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM projects WHERE status = 'active' ORDER BY created_at DESC"
    );
    return rows.map((row) => fromDbFormat<Project>(row));
  }
}

export const projectService = new ProjectService();
