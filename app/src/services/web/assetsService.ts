/**
 * Web-based Assets Service using REST API
 */

import { api } from "@/lib/api";
import type { Asset, DepreciationEntry } from "@/features/accounting/types";

// Re-export as DepreciationScheduleEntry for compatibility
export type DepreciationScheduleEntry = DepreciationEntry;

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
    // Handle Date objects - convert to ISO string date
    if (value instanceof Date) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value.toISOString().split('T')[0];
    } else {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
  }
  return result;
}

/**
 * Sanitize API response to Asset type with proper types
 */
function sanitizeAsset(raw: Record<string, unknown>): Asset {
  const camel = toCamelCase(raw);
  return {
    id: String(camel.id ?? ''),
    name: String(camel.name ?? ''),
    description: camel.description as string | undefined,
    purchaseDate: new Date(camel.purchaseDate as string),
    vendor: camel.vendor as string | undefined,
    purchasePrice: Number(camel.purchasePrice) || 0,
    vatPaid: Number(camel.vatPaid) || 0,
    grossPrice: Number(camel.grossPrice) || 0,
    afaMethod: (camel.afaMethod as Asset['afaMethod']) || 'linear',
    afaYears: Number(camel.afaYears) || 3,
    afaStartDate: new Date(camel.afaStartDate as string),
    afaAnnualAmount: Number(camel.afaAnnualAmount) || 0,
    status: (camel.status as Asset['status']) || 'active',
    disposalDate: camel.disposalDate ? new Date(camel.disposalDate as string) : undefined,
    disposalPrice: camel.disposalPrice != null ? Number(camel.disposalPrice) : undefined,
    disposalReason: camel.disposalReason as string | undefined,
    euerLine: Number(camel.euerLine) || 30,
    euerCategory: String(camel.euerCategory ?? 'AfA'),
    category: (camel.category as Asset['category']) || 'equipment',
    inventoryNumber: camel.inventoryNumber as string | undefined,
    location: camel.location as string | undefined,
    billPath: camel.billPath as string | undefined,
    depreciationSchedule: [],
    createdAt: new Date(camel.createdAt as string),
  };
}

/**
 * Sanitize depreciation entry
 */
function sanitizeDepreciationEntry(raw: Record<string, unknown>): DepreciationEntry {
  const camel = toCamelCase(raw);
  return {
    id: String(camel.id ?? ''),
    assetId: String(camel.assetId ?? ''),
    year: Number(camel.year) || 0,
    months: Number(camel.months) || 12,
    amount: Number(camel.amount) || 0,
    cumulative: Number(camel.cumulative) || 0,
    bookValue: Number(camel.bookValue) || 0,
  };
}

class AssetsService {
  async getAll(filters?: { status?: string; category?: string }): Promise<Asset[]> {
    const assets = await api.getAssets(filters);
    return assets.map(a => sanitizeAsset(a as Record<string, unknown>));
  }

  async getById(id: string): Promise<(Asset & { depreciationSchedule: DepreciationEntry[] }) | null> {
    try {
      const asset = await api.getAssetById(id) as Record<string, unknown>;
      const result = sanitizeAsset(asset);
      
      // Convert depreciation schedule items
      if (asset.depreciation_schedule && Array.isArray(asset.depreciation_schedule)) {
        result.depreciationSchedule = (asset.depreciation_schedule as Record<string, unknown>[]).map(
          entry => sanitizeDepreciationEntry(entry)
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
    return sanitizeAsset(asset as Record<string, unknown>);
  }

  async update(id: string, updates: Partial<Asset>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateAsset(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteAsset(id);
  }

  async getSchedule(id: string): Promise<DepreciationEntry[]> {
    const schedule = await api.getAssetSchedule(id);
    return schedule.map(s => sanitizeDepreciationEntry(s as Record<string, unknown>));
  }

  async depreciate(id: string, year?: number): Promise<{ success: boolean; year: number; depreciationAmount: number; newBookValue: number }> {
    const result = await api.depreciateAsset(id, year) as Record<string, unknown>;
    return {
      success: Boolean(result.success),
      year: Number(result.year) || new Date().getFullYear(),
      depreciationAmount: Number(result.depreciation_amount ?? result.depreciationAmount) || 0,
      newBookValue: Number(result.new_book_value ?? result.newBookValue) || 0,
    };
  }

  async dispose(id: string, data: { disposalDate: Date; disposalPrice: number; disposalReason?: string; status?: 'disposed' | 'sold' }): Promise<Asset & { disposalGainLoss: number; bookValueAtDisposal: number }> {
    const result = await api.disposeAsset(id, {
      disposal_date: data.disposalDate.toISOString().split('T')[0],
      disposal_price: data.disposalPrice,
      disposal_reason: data.disposalReason,
      status: data.status,
    }) as Record<string, unknown>;
    const asset = sanitizeAsset(result);

    // Convert depreciation schedule if present
    if (result.depreciation_schedule && Array.isArray(result.depreciation_schedule)) {
      asset.depreciationSchedule = (result.depreciation_schedule as Record<string, unknown>[]).map(
        entry => sanitizeDepreciationEntry(entry)
      );
    }

    return {
      ...asset,
      disposalGainLoss: Number(result.disposal_gain_loss ?? 0),
      bookValueAtDisposal: Number(result.book_value_at_disposal ?? 0),
    };
  }
}

export const assetsService = new AssetsService();
