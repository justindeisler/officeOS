/**
 * Web-based Capture Service using REST API
 */

import { api } from "@/lib/api";
import type { Capture, ProcessingStatus } from "@/types";

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

class CaptureService {
  async getAll(): Promise<Capture[]> {
    const captures = await api.getCaptures();
    return captures.map(c => toCamelCase(c as Record<string, unknown>) as unknown as Capture);
  }

  async getById(id: string): Promise<Capture | null> {
    const captures = await this.getAll();
    return captures.find(c => c.id === id) || null;
  }

  async getUnprocessed(): Promise<Capture[]> {
    const captures = await api.getCaptures({ processed: false });
    return captures.map(c => toCamelCase(c as Record<string, unknown>) as unknown as Capture);
  }

  async create(item: Omit<Capture, "id" | "createdAt" | "processed" | "processedTo">): Promise<Capture> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const capture = await api.createCapture(snakeItem);
    return toCamelCase(capture as Record<string, unknown>) as unknown as Capture;
  }

  async markProcessed(id: string, processedTo?: string): Promise<void> {
    await api.processCapture(id, processedTo);
  }

  async processWithJames(id: string): Promise<{ status: string; message: string; captureId: string }> {
    return api.processWithJames(id);
  }

  async getProcessingStatus(id: string): Promise<{
    captureId: string;
    processingStatus: ProcessingStatus;
    processedBy?: string;
    artifactType?: string;
    artifactId?: string;
    processed: boolean;
  }> {
    const result = await api.getProcessingStatus(id);
    return {
      ...result,
      processingStatus: result.processingStatus as ProcessingStatus,
    };
  }

  async delete(id: string): Promise<void> {
    await api.deleteCapture(id);
  }

  async update(_id: string, _updates: Partial<Capture>): Promise<void> {
    // This is called by the store but we don't need it for web
    // Updates are handled through specific methods like markProcessed
  }
}

export const captureService = new CaptureService();
