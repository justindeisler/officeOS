/**
 * Web-based Tag Service using REST API
 */

import { api } from "@/lib/api";
import type { Tag } from "@/types";

/** Map API response (color: string | null) to Tag type (color?: string) */
function toTag(raw: { id: string; name: string; color: string | null }): Tag {
  return { id: raw.id, name: raw.name, color: raw.color ?? undefined };
}

class TagService {
  async getAll(): Promise<Tag[]> {
    const tags = await api.getTags();
    return tags.map(toTag);
  }

  async getById(id: string): Promise<Tag | null> {
    const tags = await api.getTags();
    const found = tags.find((t) => t.id === id);
    return found ? toTag(found) : null;
  }

  async create(item: Omit<Tag, "id">): Promise<Tag> {
    const raw = await api.createTag(item);
    return toTag(raw);
  }

  async update(id: string, updates: Partial<Tag>): Promise<void> {
    await api.updateTag(id, updates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteTag(id);
  }

  async getTaskTags(taskId: string): Promise<Tag[]> {
    const tags = await api.getTaskTags(taskId);
    return tags.map(toTag);
  }

  async addTagToTask(taskId: string, tagId: string): Promise<void> {
    await api.addTagToTask(taskId, tagId);
  }

  async removeTagFromTask(taskId: string, tagId: string): Promise<void> {
    await api.removeTagFromTask(taskId, tagId);
  }

  async syncTaskTags(taskId: string, tagIds: string[]): Promise<Tag[]> {
    const tags = await api.syncTaskTags(taskId, tagIds);
    return tags.map(toTag);
  }

  async getTaskTagsBulk(taskIds: string[]): Promise<Record<string, Tag[]>> {
    const bulk = await api.getTaskTagsBulk(taskIds);
    const result: Record<string, Tag[]> = {};
    for (const [taskId, tags] of Object.entries(bulk)) {
      result[taskId] = tags.map(toTag);
    }
    return result;
  }
}

export const tagService = new TagService();
