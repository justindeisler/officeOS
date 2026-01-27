import { fromDbFormat } from "./base";
import { getDb, generateId } from "@/lib/db";
import type { Tag } from "@/types";

// Tag doesn't extend BaseEntity (no createdAt), so we don't extend BaseService
class TagService {
  async getAll(): Promise<Tag[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tags ORDER BY name"
    );
    return rows.map((row) => fromDbFormat<Tag>(row));
  }

  async getById(id: string): Promise<Tag | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tags WHERE id = ?",
      [id]
    );
    return rows[0] ? fromDbFormat<Tag>(rows[0]) : null;
  }

  async getByName(name: string): Promise<Tag | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM tags WHERE name = ?",
      [name]
    );
    return rows[0] ? fromDbFormat<Tag>(rows[0]) : null;
  }

  async create(item: Omit<Tag, "id">): Promise<Tag> {
    const db = await getDb();
    const id = generateId();

    await db.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)", [
      id,
      item.name,
      item.color || null,
    ]);

    return { id, ...item };
  }

  async getOrCreate(name: string, color?: string): Promise<Tag> {
    const existing = await this.getByName(name);
    if (existing) return existing;

    return this.create({ name, color });
  }

  async update(id: string, updates: Partial<Tag>): Promise<void> {
    const db = await getDb();
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push("name = ?");
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push("color = ?");
      values.push(updates.color);
    }

    if (setClauses.length === 0) return;

    values.push(id);
    await db.execute(
      `UPDATE tags SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    // First remove all task associations
    await db.execute("DELETE FROM task_tags WHERE tag_id = ?", [id]);
    // Then delete the tag
    await db.execute("DELETE FROM tags WHERE id = ?", [id]);
  }

  async getTagsForTask(taskId: string): Promise<Tag[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT t.* FROM tags t
       JOIN task_tags tt ON t.id = tt.tag_id
       WHERE tt.task_id = ?`,
      [taskId]
    );
    return rows.map((row) => fromDbFormat<Tag>(row));
  }

  async addTagToTask(taskId: string, tagId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)",
      [taskId, tagId]
    );
  }

  async removeTagFromTask(taskId: string, tagId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?",
      [taskId, tagId]
    );
  }

  async setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    // Remove all existing tags
    await db.execute("DELETE FROM task_tags WHERE task_id = ?", [taskId]);
    // Add new tags
    for (const tagId of tagIds) {
      await db.execute(
        "INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)",
        [taskId, tagId]
      );
    }
  }
}

export const tagService = new TagService();
