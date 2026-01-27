/**
 * DATEV Export API
 *
 * Provides functions for exporting accounting data to DATEV formats.
 * Integrates with Tauri file dialogs for cross-platform file saving.
 *
 * NOTE: Tauri imports are dynamic to avoid blocking React mount.
 */

// Lazy-loaded Tauri modules
let tauriDialog: typeof import('@tauri-apps/plugin-dialog') | null = null;
let tauriFs: typeof import('@tauri-apps/plugin-fs') | null = null;

async function getTauriModules() {
  if (!tauriDialog || !tauriFs) {
    const [dialog, fs] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);
    tauriDialog = dialog;
    tauriFs = fs;
  }
  return {
    save: tauriDialog.save,
    writeFile: tauriFs.writeFile,
  };
}

import type { DatevExportOptions, DatevExportPreview, DatevExportResult } from '../types/datev'
import type { Expense } from '../types'
import { getAllIncome, getIncomeByDateRange } from './income'
import { getAllExpenses } from './expenses'
import {
  generateDatevCsv,
  generateDatevCsvBlob,
  generateDatevFilename,
  generateCsvContent,
  encodeToLatin1,
} from '../utils/datev-csv'

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate a preview of what will be exported
 */
export async function getDatevExportPreview(
  options: DatevExportOptions
): Promise<DatevExportPreview> {
  // Get filtered data
  const incomes = await getIncomeByDateRange(options.startDate, options.endDate)
  const expenses = await getExpensesByDateRange(options.startDate, options.endDate)

  // Calculate totals
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.grossAmount, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.grossAmount, 0)

  // Count records based on options
  const incomeCount = options.includeIncome !== false ? incomes.length : 0
  const expenseCount = options.includeExpenses !== false ? expenses.length : 0
  const depreciationCount = 0 // TODO: Add depreciation support

  return {
    incomeCount,
    expenseCount,
    depreciationCount,
    totalCount: incomeCount + expenseCount + depreciationCount,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    startDate: options.startDate,
    endDate: options.endDate,
  }
}

/**
 * Generate DATEV export result without saving
 */
export async function generateDatevExport(
  options: DatevExportOptions
): Promise<DatevExportResult> {
  // Get data from database
  const incomes = await getIncomeByDateRange(options.startDate, options.endDate)
  const expenses = await getExpensesByDateRange(options.startDate, options.endDate)

  // Generate export result
  return generateDatevCsv(incomes, expenses, options)
}

/**
 * Export DATEV data to a file (with file dialog)
 *
 * Opens a save dialog and writes the export to the selected location.
 * Returns the path where the file was saved, or null if cancelled.
 */
export async function exportDatevToFile(
  options: DatevExportOptions
): Promise<string | null> {
  const { save, writeFile } = await getTauriModules()

  // Generate the export
  const result = await generateDatevExport(options)

  if (result.errors.length > 0) {
    throw new Error(`Export validation failed: ${result.errors.join(', ')}`)
  }

  // Generate filename
  const defaultFilename = generateDatevFilename(options, options.format)

  // Open save dialog
  const filePath = await save({
    defaultPath: defaultFilename,
    filters: [
      {
        name: options.format === 'csv' ? 'CSV Files' : 'XML Files',
        extensions: [options.format],
      },
    ],
  })

  if (!filePath) {
    return null // User cancelled
  }

  // Generate content and save
  if (options.format === 'csv') {
    const csvContent = generateCsvContent(result.records)
    const bytes = encodeToLatin1(csvContent)
    await writeFile(filePath, bytes)
  } else {
    // XML format - to be implemented in Phase 3
    throw new Error('XML export not yet implemented')
  }

  return filePath
}

/**
 * Export DATEV data as a downloadable blob (for web/preview)
 */
export async function exportDatevAsBlob(
  options: DatevExportOptions
): Promise<{ blob: Blob; filename: string; result: DatevExportResult }> {
  const result = await generateDatevExport(options)
  const blob = generateDatevCsvBlob(result)
  const filename = generateDatevFilename(options, options.format)

  return { blob, filename, result }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get expense records by date range
 * (Wrapper to handle case when function doesn't exist yet)
 */
async function getExpensesByDateRange(
  startDate: Date,
  endDate: Date
): Promise<Expense[]> {
  try {
    // Try to use the date range function if it exists
    const { getExpensesByDateRange: getExpensesByRange } = await import('./expenses')
    return getExpensesByRange(startDate, endDate)
  } catch {
    // Fall back to getting all and filtering
    const allExpenses = await getAllExpenses()
    return allExpenses.filter((exp) => {
      const date = exp.date
      return date >= startDate && date <= endDate
    })
  }
}

/**
 * Validate export options before processing
 */
export function validateExportOptions(options: DatevExportOptions): string[] {
  const errors: string[] = []

  if (!options.startDate) {
    errors.push('Start date is required')
  }

  if (!options.endDate) {
    errors.push('End date is required')
  }

  if (options.startDate && options.endDate && options.startDate > options.endDate) {
    errors.push('Start date must be before or equal to end date')
  }

  if (!['SKR03', 'SKR04'].includes(options.chartOfAccounts)) {
    errors.push('Chart of accounts must be SKR03 or SKR04')
  }

  if (!['csv', 'xml'].includes(options.format)) {
    errors.push('Format must be csv or xml')
  }

  return errors
}

/**
 * Get available years for export (based on existing data)
 */
export async function getAvailableExportYears(): Promise<number[]> {
  const incomes = await getAllIncome()
  const expenses = await getAllExpenses()

  const years = new Set<number>()

  incomes.forEach((inc) => {
    years.add(inc.date.getFullYear())
  })

  expenses.forEach((exp) => {
    years.add(exp.date.getFullYear())
  })

  return Array.from(years).sort((a, b) => b - a) // Descending order
}

/**
 * Get export statistics for a period
 */
export async function getExportStatistics(
  options: DatevExportOptions
): Promise<{
  totalTransactions: number
  totalIncome: number
  totalExpenses: number
  netResult: number
  vatCollected: number
  vatPaid: number
}> {
  const incomes = await getIncomeByDateRange(options.startDate, options.endDate)
  const expenses = await getExpensesByDateRange(options.startDate, options.endDate)

  const totalIncome = incomes.reduce((sum, inc) => sum + inc.grossAmount, 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.grossAmount, 0)
  const vatCollected = incomes.reduce((sum, inc) => sum + inc.vatAmount, 0)
  const vatPaid = expenses.reduce((sum, exp) => sum + exp.vatAmount, 0)

  return {
    totalTransactions: incomes.length + expenses.length,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netResult: Math.round((totalIncome - totalExpenses) * 100) / 100,
    vatCollected: Math.round(vatCollected * 100) / 100,
    vatPaid: Math.round(vatPaid * 100) / 100,
  }
}
