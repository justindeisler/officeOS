/**
 * Web-based Assets Service using REST API
 */

import { api } from "@/lib/api";
import type { Asset, DepreciationScheduleEntry } from "@/types";

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

class AssetsService {
  async getAll(filters?: { status?: string; category?: string }): Promise<Asset[]> {
    const assets = await api.getAssets(filters);
    return assets.map(a => toCamelCase(a as Record<string, unknown>) as unknown as Asset);
  }

  async getById(id: string): Promise<(Asset & { depreciationSchedule: DepreciationScheduleEntry[] }) | null> {
    try {
      const asset = await api.getAssetById(id) as Record<string, unknown>;
      const result = toCamelCase(asset) as unknown as Asset & { depreciationSchedule: DepreciationScheduleEntry[] };
      
      // Convert depreciation schedule items
      if (asset.depreciation_schedule && Array.isArray(asset.depreciation_schedule)) {
        result.depreciationSchedule = (asset.depreciation_schedule as Record<string, unknown>[]).map(
          entry => toCamelCase(entry) as unknown as DepreciationScheduleEntry
        );
      }
      
      return result;
    } catch {
      return null;
    }
  }

  async create(item: Omit<Asset, "id" | "createdAt" | "currentValue" | "status">): Promise<Asset> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const asset = await api.createAsset(snakeItem);
    return toCamelCase(asset as Record<string, unknown>) as unknown as Asset;
  }

  async update(id: string, updates: Partial<Asset>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateAsset(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteAsset(id);
  }

  async getSchedule(id: string): Promise<DepreciationScheduleEntry[]> {
    const schedule = await api.getAssetSchedule(id);
    return schedule.map(s => toCamelCase(s as Record<string, unknown>) as unknown as DepreciationScheduleEntry);
  }

  async depreciate(id: string, year?: number): Promise<{ success: boolean; year: number; depreciationAmount: number; newBookValue: number }> {
    const result = await api.depreciateAsset(id, year) as Record<string, unknown>;
    return toCamelCase(result) as unknown as { success: boolean; year: number; depreciationAmount: number; newBookValue: number };
  }
}

export const assetsService = new AssetsService();
