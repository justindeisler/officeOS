/**
 * DatevSettings Component
 *
 * Configuration panel for DATEV export options.
 * Includes period selection, chart of accounts, format, and metadata inputs.
 */

import { type FC } from 'react'
import type { UseDatevExportReturn } from '../../hooks/useDatevExport'
import {
  useAvailableYears,
  useMonthOptions,
  useQuarterOptions,
  usePeriodTypeOptions,
} from '../../hooks/useDatevExport'

// ============================================================================
// TYPES
// ============================================================================

export interface DatevSettingsProps {
  /** Export hook return value */
  exportState: UseDatevExportReturn

  /** Whether the form is disabled (e.g., during export) */
  disabled?: boolean

  /** Custom class name */
  className?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export const DatevSettings: FC<DatevSettingsProps> = ({
  exportState,
  disabled = false,
  className = '',
}) => {
  const {
    state,
    setPeriodType,
    setYear,
    setQuarter,
    setMonth,
    setCustomDateRange,
    setChartOfAccounts,
    setFormat,
    setConsultantNumber,
    setClientNumber,
    toggleIncludeIncome,
    toggleIncludeExpenses,
    toggleIncludeDepreciation,
    validationErrors,
  } = exportState

  const years = useAvailableYears()
  const months = useMonthOptions()
  const quarters = useQuarterOptions()
  const periodTypes = usePeriodTypeOptions()

  return (
    <div
      className={`space-y-6 ${className}`}
      role="form"
      aria-label="DATEV Export Einstellungen"
    >
      {/* Period Selection */}
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="text-sm font-medium text-gray-700">
          Zeitraum
        </legend>

        <div className="grid grid-cols-2 gap-4">
          {/* Period Type */}
          <div>
            <label
              htmlFor="periodType"
              className="block text-sm text-gray-600 mb-1"
            >
              Zeitraumtyp
            </label>
            <select
              id="periodType"
              value={state.periodType}
              onChange={(e) =>
                setPeriodType(e.target.value as typeof state.periodType)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              aria-describedby="periodType-description"
            >
              {periodTypes.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label
              htmlFor="year"
              className="block text-sm text-gray-600 mb-1"
            >
              Jahr
            </label>
            <select
              id="year"
              value={state.year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quarter Selection (shown for quarterly period) */}
        {state.periodType === 'quarter' && (
          <div>
            <label
              htmlFor="quarter"
              className="block text-sm text-gray-600 mb-1"
            >
              Quartal
            </label>
            <select
              id="quarter"
              value={state.quarter}
              onChange={(e) =>
                setQuarter(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {quarters.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Month Selection (shown for monthly period) */}
        {state.periodType === 'month' && (
          <div>
            <label
              htmlFor="month"
              className="block text-sm text-gray-600 mb-1"
            >
              Monat
            </label>
            <select
              id="month"
              value={state.month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              {months.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Custom Date Range (shown for custom period) */}
        {state.periodType === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm text-gray-600 mb-1"
              >
                Von
              </label>
              <input
                type="date"
                id="startDate"
                value={
                  state.customStartDate
                    ? state.customStartDate.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setCustomDateRange(
                    e.target.value ? new Date(e.target.value) : null,
                    state.customEndDate
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm text-gray-600 mb-1"
              >
                Bis
              </label>
              <input
                type="date"
                id="endDate"
                value={
                  state.customEndDate
                    ? state.customEndDate.toISOString().split('T')[0]
                    : ''
                }
                onChange={(e) =>
                  setCustomDateRange(
                    state.customStartDate,
                    e.target.value ? new Date(e.target.value) : null
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </fieldset>

      {/* Chart of Accounts & Format */}
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="text-sm font-medium text-gray-700">
          Format
        </legend>

        <div className="grid grid-cols-2 gap-4">
          {/* Chart of Accounts */}
          <div>
            <label
              htmlFor="chartOfAccounts"
              className="block text-sm text-gray-600 mb-1"
            >
              Kontenrahmen
            </label>
            <select
              id="chartOfAccounts"
              value={state.chartOfAccounts}
              onChange={(e) =>
                setChartOfAccounts(e.target.value as 'SKR03' | 'SKR04')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="SKR03">SKR03 (Standard)</option>
              <option value="SKR04">SKR04</option>
            </select>
          </div>

          {/* Export Format */}
          <div>
            <label
              htmlFor="format"
              className="block text-sm text-gray-600 mb-1"
            >
              Exportformat
            </label>
            <select
              id="format"
              value={state.format}
              onChange={(e) =>
                setFormat(e.target.value as 'csv' | 'xml')
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="csv">CSV (Buchungsstapel)</option>
              <option value="xml">XML (LedgerImport)</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* DATEV Metadata */}
      <fieldset className="space-y-4" disabled={disabled}>
        <legend className="text-sm font-medium text-gray-700">
          DATEV Metadaten (optional)
        </legend>

        <div className="grid grid-cols-2 gap-4">
          {/* Consultant Number */}
          <div>
            <label
              htmlFor="consultantNumber"
              className="block text-sm text-gray-600 mb-1"
            >
              Beraternummer
            </label>
            <input
              type="text"
              id="consultantNumber"
              value={state.consultantNumber}
              onChange={(e) => setConsultantNumber(e.target.value)}
              placeholder="z.B. 12345"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Client Number */}
          <div>
            <label
              htmlFor="clientNumber"
              className="block text-sm text-gray-600 mb-1"
            >
              Mandantennummer
            </label>
            <input
              type="text"
              id="clientNumber"
              value={state.clientNumber}
              onChange={(e) => setClientNumber(e.target.value)}
              placeholder="z.B. 99999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Transaction Types */}
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-sm font-medium text-gray-700">
          Zu exportieren
        </legend>

        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={state.includeIncome}
              onChange={toggleIncludeIncome}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Einnahmen
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={state.includeExpenses}
              onChange={toggleIncludeExpenses}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Ausgaben
            </span>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={state.includeDepreciation}
              onChange={toggleIncludeDepreciation}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Abschreibungen (AfA)
            </span>
          </label>
        </div>
      </fieldset>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-md"
          role="alert"
          aria-live="polite"
        >
          <h4 className="text-sm font-medium text-red-800">
            Bitte korrigieren Sie folgende Fehler:
          </h4>
          <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default DatevSettings
