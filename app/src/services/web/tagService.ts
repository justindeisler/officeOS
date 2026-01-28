/**
 * Web-based Tag Service stub
 * TODO: Implement tag API endpoints
 */

import type { Tag } from "@/types";

class TagService {
  async getAll(): Promise<Tag[]> {
    console.warn("Tag service not yet implemented for web");
    return [];
  }

  async getById(_id: string): Promise<Tag | null> {
    return null;
  }

  async create(_item: Omit<Tag, "id">): Promise<Tag> {
    throw new Error("Tag creation not yet implemented for web");
  }

  async update(_id: string, _updates: Partial<Tag>): Promise<void> {
    throw new Error("Tag update not yet implemented for web");
  }

  async delete(_id: string): Promise<void> {
    throw new Error("Tag deletion not yet implemented for web");
  }

  async getTaskTags(_taskId: string): Promise<Tag[]> {
    return [];
  }

  async addTagToTask(_taskId: string, _tagId: string): Promise<void> {
    console.warn("Task tagging not yet implemented for web");
  }

  async removeTagFromTask(_taskId: string, _tagId: string): Promise<void> {
    console.warn("Task tag removal not yet implemented for web");
  }
}

export const tagService = new TagService();
