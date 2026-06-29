import { useState } from "react";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";
import type { Command } from "../../commands";
import { openDesktopDevtools, setDeveloperModeEnabled } from "../../lib/developerMode";
import type { SettingsTab } from "./settingsTabs";
import { defaultSettingsPreferences, settingsPreferenceKeys, writeLocalPreference, type SettingsPreferences } from "./preferences";
import { useAppUpdateUi } from "../updates/appUpdateUi";
import { SettingsPersistenceBar } from "./SettingsPersistenceBar";
import { useSettingsPersistence } from "./useSettingsPersistence";
import { useSettingsPreferences } from "./useSettingsPreferences";
import { useWindowMinimumSizePreference } from "./useWindowMinimumSizePreference";
import { useMakerProjectsRootSettings } from "./useMakerProjectsRootSettings";
import { useSettingsDiagnostics } from "./useSettingsDiagnostics";
import { useSettingsScrollSpy } from "./useSettingsScrollSpy";
import { useResetInitialStateAction } from "./useResetInitialStateAction";
import { useDeveloperModeState } from "./useDeveloperModeState";
import { AdvancedDeveloperSettingsSection } from "./sections/AdvancedDeveloperSettingsSection";
import { AppearanceSettingsSection } from "./sections/AppearanceSettingsSection";
import { CanvasAssetsSettingsSection } from "./sections/CanvasAssetsSettingsSection";
import { GeneralSettingsSection } from "./sections/GeneralSettingsSection";
import { GenerationDefaultsSettingsSection } from "./sections/GenerationDefaultsSettingsSection";
import { ProjectWorkspaceSettingsSection } from "./sections/ProjectWorkspaceSettingsSection";
import { RuntimeSettingsSection } from "./sections/RuntimeSettingsSection";
import { ShortcutsSettingsSection } from "./sections/ShortcutsSettingsSection";
import { SoftwareUpdateSettingsSection } from "./sections/SoftwareUpdateSettingsSection";
import { TasksNotificationsSettingsSection } from "./sections/TasksNotificationsSettingsSection";

type Props = {
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  busy: boolean;
  activeTab: SettingsTab;
  sidebarCollapsed: boolean;
  onActiveTabChange: (tab: SettingsTab) => void;
  onExitSettings: () => void;
  onStartRuntime: () => void;
  onStopRuntime: () => void;
  onRefreshTools: () => void;
  onStatusLite: () => void;
  onProjectsRootChanged?: (projects: ProjectSummary[], selectedProjectId?: string) => void;
  onResetInitialState?: () => void;
  onThemePreferenceChange?: (themePreference: SettingsPreferences["themePreference"]) => void;
  commands: Command[];
};

export function SettingsView({
  project,
  runtime,
  tools,
  busy,
  activeTab,
  sidebarCollapsed,
  onActiveTabChange,
  onExitSettings,
  onStartRuntime,
  onStopRuntime,
  onRefreshTools,
  onStatusLite,
  onProjectsRootChanged,
  onResetInitialState,
  onThemePreferenceChange,
  commands,
}: Props) {
  const [prefs, setPref] = useSettingsPreferences();
  void tools;
  void sidebarCollapsed;
  void onExitSettings;
  void onStatusLite;
  const developerMode = useDeveloperModeState();
  const [developerOptionsUnlocked, setDeveloperOptionsUnlocked] = useState(false);
  const updateState = useAppUpdateUi(developerMode);
  const settingsPersistence = useSettingsPersistence();
  const scrollContainerRef = useSettingsScrollSpy({ activeTab, onActiveTabChange });
  const {
    windowMinimumDraft,
    setWindowMinimumDraft,
    applyWindowMinimumSizePreset,
    commitWindowMinimumSize,
  } = useWindowMinimumSizePreference({ prefs, setPref });
  const {
    makerRootSettings,
    makerRootDraft,
    makerRootNotice,
    setMakerRootDraft,
    saveMakerRoot,
  } = useMakerProjectsRootSettings({ onProjectsRootChanged });
  const {
    diagnosticExportState,
    developerLogCount,
    clearLogs,
    exportLogs,
    checkDesktopResources,
  } = useSettingsDiagnostics({ projectId: project?.id, logRetention: prefs.logRetention });
  const {
    resetInitialStateText,
    resetInitialStateNotice,
    setResetInitialStateText,
    resetInitialState,
  } = useResetInitialStateAction({ onResetInitialState });

  const handleSaveSettingsNow = async () => {
    try {
      await settingsPersistence.saveNow();
    } catch (error) {
      settingsPersistence.setState({
        status: "failed",
        message: "已临时应用，配置服务未连接：" + (error instanceof Error ? error.message : String(error)),
      });
    }
  };

  const handleResetSettingsDefaults = async () => {
    const confirmed = window.confirm("确定要把已接入的设置项恢复为默认值吗？");
    if (!confirmed) return;

    settingsPersistence.setState({ status: "saving-local", message: "正在写入本地配置..." });
    for (const key of Object.keys(defaultSettingsPreferences) as Array<keyof SettingsPreferences>) {
      writeLocalPreference(settingsPreferenceKeys[key], defaultSettingsPreferences[key]);
    }
    try {
      await settingsPersistence.saveNow();
    } catch (error) {
      settingsPersistence.setState({
        status: "failed",
        message: "已恢复前端默认值，配置服务未连接：" + (error instanceof Error ? error.message : String(error)),
      });
    }
  };


  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-transparent">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <SettingsPersistenceBar
            state={settingsPersistence.state}
            label={settingsPersistence.label}
            onResetDefaults={() => void handleResetSettingsDefaults()}
            onSaveNow={() => void handleSaveSettingsNow()}
          />
          <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-12 pb-32 scrollbar-thin flex flex-col gap-12 max-w-4xl mx-auto w-full pt-12">
            <GeneralSettingsSection
              prefs={prefs}
              setPref={setPref}
              windowMinimumDraft={windowMinimumDraft}
              setWindowMinimumDraft={setWindowMinimumDraft}
              applyWindowMinimumSizePreset={applyWindowMinimumSizePreset}
              commitWindowMinimumSize={commitWindowMinimumSize}
            />
            <ProjectWorkspaceSettingsSection
              makerRootSettings={makerRootSettings}
              makerRootDraft={makerRootDraft}
              makerRootNotice={makerRootNotice}
              setMakerRootDraft={setMakerRootDraft}
              onSaveMakerRoot={() => void saveMakerRoot()}
            />
            <AppearanceSettingsSection
              prefs={prefs}
              setPref={setPref}
              onThemePreferenceChange={onThemePreferenceChange}
            />
            <GenerationDefaultsSettingsSection prefs={prefs} setPref={setPref} />
            <CanvasAssetsSettingsSection prefs={prefs} setPref={setPref} />
            <TasksNotificationsSettingsSection prefs={prefs} setPref={setPref} />
            <RuntimeSettingsSection
              prefs={prefs}
              setPref={setPref}
              runtime={runtime}
              busy={busy}
              onStartRuntime={onStartRuntime}
              onStopRuntime={onStopRuntime}
              onRefreshTools={onRefreshTools}
              onDeveloperUnlock={() => setDeveloperOptionsUnlocked(true)}
            />
            <SoftwareUpdateSettingsSection updateState={updateState} />
            <ShortcutsSettingsSection commands={commands} />
            <AdvancedDeveloperSettingsSection
              prefs={prefs}
              setPref={setPref}
              developerOptionsUnlocked={developerOptionsUnlocked}
              developerMode={developerMode}
              developerLogCount={developerLogCount}
              diagnosticExportState={diagnosticExportState}
              resetInitialStateText={resetInitialStateText}
              resetInitialStateNotice={resetInitialStateNotice}
              setResetInitialStateText={setResetInitialStateText}
              setDeveloperModeEnabled={setDeveloperModeEnabled}
              onCheckDesktopResources={() => void checkDesktopResources()}
              onExportLogs={() => void exportLogs()}
              onClearLogs={() => void clearLogs()}
              onOpenDesktopDevtools={() => void openDesktopDevtools()}
              onResetInitialState={() => void resetInitialState()}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
