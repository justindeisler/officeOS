/**
 * DatevExportDialog Component
 *
 * Main dialog for DATEV export functionality.
 * Includes settings panel, preview, and export actions.
 */

import { type FC, useState, useCallback, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useDatevExport } from '../../hooks/useDatevExport'

// Lazy-loaded Tauri modules to avoid blocking React mount
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
import { DatevSettings } from './DatevSettings'
import type { DatevExportPreview, DatevExportResult } from '../../types/datev'
import type { Income, Expense } from '../../types'
import { generateDatevCsv } from '../../utils/datev-csv'
import { generateDatevXml, generateDatevXmlContent } from '../../utils/datev-xml'
import { encodeToLatin1 } from '../../utils/datev-csv'
import { generateDatevFilename } from '../../utils/datev-csv'

// ============================================================================
// TYPES
// ============================================================================

export interface DatevExportDialogProps {
  /** Whether the dialog is open */
  open: boolean

  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void

  /** Income data to export */
  incomes: Array<{
    id: string
    date: Date
    description: string
    grossAmount: number
    vatRate: 0 | 7 | 19
    vatAmount: number
    euerCategory: string
    invoiceId?: string
  }>

  /** Expense data to export */
  expenses: Array<{
    id: string
    date: Date
    vendor: string
    description: string
    grossAmount: number
    vatRate: 0 | 7 | 19
    vatAmount: number
    euerCategory: string
    receiptPath?: string
  }>

  /** Custom class name */
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DatevExportDialog: FC<DatevExportDialogProps> = ({
  open,
  onOpenChange,
  incomes,
  expenses,
  className = '',
}) => {
  const exportState = useDatevExport()
  const { exportOptions, isValid } = exportState

  const [isExporting, setIsExporting] = useState(false)
  const [preview, setPreview] = useState<DatevExportPreview | null>(null)
  const [result, setResult] = useState<DatevExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Calculate preview when options change
  useEffect(() => {
    if (!open) return

    // Filter data by date range
    const filteredIncomes = incomes.filter((inc) => {
      const date = inc.date
      return date >= exportOptions.startDate && date <= exportOptions.endDate
    })

    const filteredExpenses = expenses.filter((exp) => {
      const date = exp.date
      return date >= exportOptions.startDate && date <= exportOptions.endDate
    })

    const incomeCount = exportOptions.includeIncome ? filteredIncomes.length : 0
    const expenseCount = exportOptions.includeExpenses ? filteredExpenses.length : 0
    const totalIncome = filteredIncomes.reduce((sum, inc) => sum + inc.grossAmount, 0)
    const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.grossAmount, 0)

    setPreview({
      incomeCount,
      expenseCount,
      depreciationCount: 0,
      totalCount: incomeCount + expenseCount,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      startDate: exportOptions.startDate,
      endDate: exportOptions.endDate,
    })
  }, [open, incomes, expenses, exportOptions])

  // Handle export
  const handleExport = useCallback(async () => {
    if (!isValid) return

    setIsExporting(true)
    setError(null)

    try {
      const { save, writeFile } = await getTauriModules()
      // Cast to full types — props use a subset of Income/Expense fields
      const incomeData = incomes as unknown as Income[]
      const expenseData = expenses as unknown as Expense[]

      let exportResult: DatevExportResult
      let content: string
      let mimeType: string
      let encoding: 'utf-8' | 'iso-8859-1'

      if (exportOptions.format === 'csv') {
        exportResult = generateDatevCsv(incomeData, expenseData, exportOptions)
        // Generate CSV content
        const { generateCsvContent } = await import('../../utils/datev-csv')
        content = generateCsvContent(exportResult.records)
        mimeType = 'text/csv'
        encoding = 'iso-8859-1'
      } else {
        exportResult = generateDatevXml(incomeData, expenseData, exportOptions)
        content = generateDatevXmlContent(exportResult, exportOptions)
        mimeType = 'application/xml'
        encoding = 'utf-8'
      }

      if (exportResult.errors.length > 0) {
        throw new Error(exportResult.errors.join('\n'))
      }

      // Generate filename and open Tauri save dialog
      const filename = generateDatevFilename(exportOptions, exportOptions.format)

      const filePath = await save({
        defaultPath: filename,
        filters: [
          {
            name: exportOptions.format === 'csv' ? 'CSV Files' : 'XML Files',
            extensions: [exportOptions.format],
          },
        ],
      })

      if (!filePath) {
        // User cancelled the dialog
        return
      }

      // Write file using Tauri API
      let bytes: Uint8Array
      if (encoding === 'iso-8859-1') {
        bytes = encodeToLatin1(content)
      } else {
        bytes = new TextEncoder().encode(content)
      }

      await writeFile(filePath, bytes)
      setResult(exportResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }, [isValid, incomes, expenses, exportOptions])

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE').format(date)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fadeIn" />
        <Dialog.Content
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto focus:outline-none data-[state=open]:animate-contentShow ${className}`}
          aria-describedby="datev-export-description"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              DATEV Export
            </Dialog.Title>
            <Dialog.Description
              id="datev-export-description"
              className="text-sm text-gray-500 mt-1"
            >
              Exportieren Sie Ihre Buchhaltungsdaten im DATEV-Format für Ihren
              Steuerberater.
            </Dialog.Description>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Settings */}
            <DatevSettings exportState={exportState} disabled={isExporting} />

            {/* Preview */}
            {preview && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-gray-700">
                  Vorschau
                </h3>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Zeitraum:</span>
                    <p className="font-medium">
                      {formatDate(preview.startDate)} -{' '}
                      {formatDate(preview.endDate)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Datensätze:</span>
                    <p className="font-medium">{preview.totalCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm pt-2 border-t">
                  <div>
                    <span className="text-gray-500">Einnahmen</span>
                    <p className="font-medium text-green-600">
                      {preview.incomeCount} ({formatCurrency(preview.totalIncome)})
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Ausgaben</span>
                    <p className="font-medium text-red-600">
                      {preview.expenseCount} ({formatCurrency(preview.totalExpenses)})
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Ergebnis</span>
                    <p
                      className={`font-medium ${
                        preview.totalIncome - preview.totalExpenses >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(preview.totalIncome - preview.totalExpenses)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {result && !error && (
              <div
                className="p-3 bg-green-50 border border-green-200 rounded-md"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm text-green-800">
                  Export erfolgreich! {result.recordCount} Datensätze wurden
                  exportiert.
                </p>
                {result.warnings.length > 0 && (
                  <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div
                className="p-3 bg-red-50 border border-red-200 rounded-md"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isExporting}
              >
                Abbrechen
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleExport}
              disabled={!isValid || isExporting || preview?.totalCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-busy={isExporting}
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Exportiere...
                </span>
              ) : (
                'Exportieren'
              )}
            </button>
          </div>

          {/* Close Button */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute top-4 right-4 p-1 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Schließen"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default DatevExportDialog
