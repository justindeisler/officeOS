import { isWebBuild } from "@/api";
import { useSettings } from "@/hooks/useSettings";
import {
  ProfileSection,
  BusinessProfileSection,
  AppearanceSection,
  WorkspaceSection,
  DefaultsSection,
  BackupSection,
  DatabaseManagementSection,
  AboutSection,
} from "@/components/settings";

export function SettingsPage() {
  const settings = useSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <ProfileSection
        nameInput={settings.nameInput}
        setNameInput={settings.setNameInput}
        onSave={settings.handleSaveUserName}
      />

      <BusinessProfileSection
        profileForm={settings.profileForm}
        isSavingProfile={settings.isSavingProfile}
        onUpdateField={settings.updateProfileField}
        onIbanChange={settings.handleIbanChange}
        formatIban={settings.formatIban}
        onSave={settings.handleSaveBusinessProfile}
      />

      <AppearanceSection
        theme={settings.theme}
        onSetTheme={settings.setTheme}
      />

      <WorkspaceSection
        pathInput={settings.pathInput}
        setPathInput={settings.setPathInput}
        workspacePath={settings.workspacePath}
        onSave={settings.handleSaveWorkspacePath}
      />

      <DefaultsSection
        defaultArea={settings.defaultArea}
        defaultCurrency={settings.defaultCurrency}
        onSetDefaultArea={settings.setDefaultArea}
        onSetDefaultCurrency={settings.setDefaultCurrency}
      />

      {isWebBuild() && (
        <BackupSection
          backupStatus={settings.backupStatus}
          isBackingUp={settings.isBackingUp}
          isDownloadingBackup={settings.isDownloadingBackup}
          isExportingJson={settings.isExportingJson}
          onTriggerBackup={settings.handleTriggerBackup}
          onDownloadBackup={settings.handleDownloadBackup}
          onExportJson={settings.handleExportJson}
        />
      )}

      <DatabaseManagementSection
        dataStats={settings.dataStats}
        totalRecords={settings.totalRecords}
        isExporting={settings.isExporting}
        isImporting={settings.isImporting}
        onExport={settings.handleExportData}
        onImport={settings.handleImportData}
        onClearAll={settings.handleClearAllData}
      />

      <AboutSection />
    </div>
  );
}
