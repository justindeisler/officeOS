/**
 * Reports Components
 *
 * German tax report components for freelancer accounting:
 * - USt-Voranmeldung (Quarterly VAT Declaration)
 * - EÜR (Annual Profit Calculation)
 */

// USt-Voranmeldung Components
export { UstVoranmeldungList } from './UstVoranmeldungList'
export type { UstVoranmeldungListProps } from './UstVoranmeldungList'

export { UstVoranmeldungPreview } from './UstVoranmeldungPreview'
export type { UstVoranmeldungPreviewProps } from './UstVoranmeldungPreview'

// EÜR Components
export { EuerReportView } from './EuerReportView'
export type { EuerReportViewProps } from './EuerReportView'

export { EuerExport } from './EuerExport'
export type { EuerExportProps } from './EuerExport'

// Asset Reports
export { Anlageverzeichnis } from './Anlageverzeichnis'
export type { AnlageverzeichnisProps } from './Anlageverzeichnis'

export { AfaSummary } from './AfaSummary'
export type { AfaSummaryProps } from './AfaSummary'

// Enhanced Reporting Components
export { TaxForecast } from './TaxForecast'
export type { TaxForecastProps } from './TaxForecast'

export { ComparisonCard } from './ComparisonCard'
export type { ComparisonCardProps, ComparisonFormat } from './ComparisonCard'

export { YearComparison } from './YearComparison'
export type { YearComparisonProps } from './YearComparison'

// Phase 1: Legal Compliance Components
export { ElsterSubmissionWizard } from './ElsterSubmissionWizard'
export type { ElsterSubmissionWizardProps } from './ElsterSubmissionWizard'

export { ElsterHistoryList } from './ElsterHistoryList'
export type { ElsterHistoryListProps } from './ElsterHistoryList'

export { ZmReportView } from './ZmReportView'
export type { ZmReportViewProps } from './ZmReportView'

// Phase 3: BWA, SuSa & Profitability Reports
export { BWAReport } from './BWAReport'
export type { BWAReportProps } from './BWAReport'

export { SuSaReport } from './SuSaReport'
export type { SuSaReportProps } from './SuSaReport'

export { ProfitabilityDashboard } from './ProfitabilityDashboard'
export type { ProfitabilityDashboardProps } from './ProfitabilityDashboard'
