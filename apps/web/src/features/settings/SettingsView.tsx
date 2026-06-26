import { useEffect, useState } from "react";
import {
  Bug,
  Copy,
  Cpu,
  Download,
  FileJson,
  RefreshCw,
  ServerCog,
  Settings,
  Square,
  Trash2,
  Play,
  Palette,
  Bell,
  Box,
  Grid3X3,
  Images,
  Workflow,
  Info,
  PanelLeft
} from "lucide-react";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";
import {
  clearFrontendDiagnostics,
  listFrontendDiagnostics,
  type FrontendDiagnosticEntry,
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/SelectField";
import { Switch } from "../../components/ui/Switch";
import {
  clearDeveloperLogEntries,
  formatDeveloperLogsForDisplay,
  getDeveloperLogEntries,
  isDeveloperModeEnabled,
  openDesktopDevtools,
  setDeveloperModeEnabled,
  subscribeDeveloperLogs,
  subscribeDeveloperMode,
} from "../../lib/developerMode";
import { copyText } from "../../lib/clipboard";
import type { SettingsTab } from "./settingsTabs";
import { cn } from "../../lib/utils";
import React from "react";
import {
  defaultSettingsPreferences,
  defaultWorkspaceLabels,
  SETTINGS_PREFERENCES_CHANGED_EVENT,
  readLocalPreference,
  settingsPreferenceKeys,
  type AssetDropPreference,
  type AssetReferencePreference,
  type AutoRuntimePreference,
  type CanvasAutoSavePreference,
  type CanvasGridPreference,
  type CanvasLeavePreference,
  type CanvasMiniMapPreference,
  type CanvasSidebarPreference,
  type CodeEditorFontSizePreference,
  type CodeEditorLineNumbersPreference,
  type CodeEditorPalettePreference,
  type CodeEditorThemePreference,
  type CodeEditorWrapPreference,
  type ConfirmationPreference,
  type DefaultWorkspace,
  type DensityPreference,
  type ImageDefaultMode,
  type ImageDefaultModel,
  type ImageDefaultResolution,
  type ImageThinkingLevel,
  type LogRetentionPreference,
  type Model3DDefaultMode,
  type Model3DSubjectType,
  type Model3DTextureQuality,
  type MusicDefaultModel,
  type MusicVocalGender,
  type PanelPreference,
  type StartupPreference,
  type TaskCompletionRefreshPreference,
  type TaskPanelPreference,
  type ThemePreference,
  type VideoDefaultMode,
  type VideoDefaultModel,
  type VideoDefaultResolution,
  writeLocalPreference,
} from "./preferences";

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
}: Props) {
  const [themePreference, setThemePreference] = useLocalPreference<ThemePreference>(settingsPreferenceKeys.themePreference, defaultSettingsPreferences.themePreference);
  const [startupPreference, setStartupPreference] = useLocalPreference<StartupPreference>(settingsPreferenceKeys.startupPreference, defaultSettingsPreferences.startupPreference);
  const [defaultWorkspace, setDefaultWorkspace] = useLocalPreference<DefaultWorkspace>(settingsPreferenceKeys.defaultWorkspace, defaultSettingsPreferences.defaultWorkspace);
  const [density, setDensity] = useLocalPreference<DensityPreference>(settingsPreferenceKeys.density, defaultSettingsPreferences.density);
  const [sidebarPreference, setSidebarPreference] = useLocalPreference<PanelPreference>(settingsPreferenceKeys.sidebarPreference, defaultSettingsPreferences.sidebarPreference);
  const [inspectorPreference, setInspectorPreference] = useLocalPreference<PanelPreference>(settingsPreferenceKeys.inspectorPreference, defaultSettingsPreferences.inspectorPreference);
  const [confirmationPreference, setConfirmationPreference] = useLocalPreference<ConfirmationPreference>(settingsPreferenceKeys.confirmationPreference, defaultSettingsPreferences.confirmationPreference);
  const [autoRuntime, setAutoRuntime] = useLocalPreference<AutoRuntimePreference>(settingsPreferenceKeys.autoRuntime, defaultSettingsPreferences.autoRuntime);
  const [logRetention, setLogRetention] = useLocalPreference<LogRetentionPreference>(settingsPreferenceKeys.logRetention, defaultSettingsPreferences.logRetention);
  const [failureNotifications, setFailureNotifications] = useLocalPreference(settingsPreferenceKeys.failureNotifications, defaultSettingsPreferences.failureNotifications);
  const [autoOpenErrors, setAutoOpenErrors] = useLocalPreference(settingsPreferenceKeys.autoOpenErrors, defaultSettingsPreferences.autoOpenErrors);
  const [openHiddenLegacyWorkspaces, setOpenHiddenLegacyWorkspaces] = useLocalPreference(settingsPreferenceKeys.openHiddenLegacyWorkspaces, defaultSettingsPreferences.openHiddenLegacyWorkspaces);
  const [canvasGrid, setCanvasGrid] = useLocalPreference<CanvasGridPreference>(settingsPreferenceKeys.canvasGrid, defaultSettingsPreferences.canvasGrid);
  const [canvasMiniMap, setCanvasMiniMap] = useLocalPreference<CanvasMiniMapPreference>(settingsPreferenceKeys.canvasMiniMap, defaultSettingsPreferences.canvasMiniMap);
  const [canvasAutoSave, setCanvasAutoSave] = useLocalPreference<CanvasAutoSavePreference>(settingsPreferenceKeys.canvasAutoSave, defaultSettingsPreferences.canvasAutoSave);
  const [canvasSidebarBehavior, setCanvasSidebarBehavior] = useLocalPreference<CanvasSidebarPreference>(settingsPreferenceKeys.canvasSidebarBehavior, defaultSettingsPreferences.canvasSidebarBehavior);
  const [canvasLeaveBehavior, setCanvasLeaveBehavior] = useLocalPreference<CanvasLeavePreference>(settingsPreferenceKeys.canvasLeaveBehavior, defaultSettingsPreferences.canvasLeaveBehavior);
  const [codeEditorTheme, setCodeEditorTheme] = useLocalPreference<CodeEditorThemePreference>(settingsPreferenceKeys.codeEditorTheme, defaultSettingsPreferences.codeEditorTheme);
  const [codeEditorPalette, setCodeEditorPalette] = useLocalPreference<CodeEditorPalettePreference>(settingsPreferenceKeys.codeEditorPalette, defaultSettingsPreferences.codeEditorPalette);
  const [codeEditorFontSize, setCodeEditorFontSize] = useLocalPreference<CodeEditorFontSizePreference>(settingsPreferenceKeys.codeEditorFontSize, defaultSettingsPreferences.codeEditorFontSize);
  const [codeEditorWrap, setCodeEditorWrap] = useLocalPreference<CodeEditorWrapPreference>(settingsPreferenceKeys.codeEditorWrap, defaultSettingsPreferences.codeEditorWrap);
  const [codeEditorLineNumbers, setCodeEditorLineNumbers] = useLocalPreference<CodeEditorLineNumbersPreference>(settingsPreferenceKeys.codeEditorLineNumbers, defaultSettingsPreferences.codeEditorLineNumbers);
  const [assetDropBehavior, setAssetDropBehavior] = useLocalPreference<AssetDropPreference>(settingsPreferenceKeys.assetDropBehavior, defaultSettingsPreferences.assetDropBehavior);
  const [assetReferenceCheck, setAssetReferenceCheck] = useLocalPreference<AssetReferencePreference>(settingsPreferenceKeys.assetReferenceCheck, defaultSettingsPreferences.assetReferenceCheck);
  const [taskDefaultPanel, setTaskDefaultPanel] = useLocalPreference<TaskPanelPreference>(settingsPreferenceKeys.taskDefaultPanel, defaultSettingsPreferences.taskDefaultPanel);
  const [taskCompletionRefresh, setTaskCompletionRefresh] = useLocalPreference<TaskCompletionRefreshPreference>(settingsPreferenceKeys.taskCompletionRefresh, defaultSettingsPreferences.taskCompletionRefresh);
  const [imageDefaultMode, setImageDefaultMode] = useLocalPreference<ImageDefaultMode>(settingsPreferenceKeys.imageDefaultMode, defaultSettingsPreferences.imageDefaultMode);
  const [imageTargetSize, setImageTargetSize] = useLocalPreference(settingsPreferenceKeys.imageTargetSize, defaultSettingsPreferences.imageTargetSize);
  const [imageAspectRatio, setImageAspectRatio] = useLocalPreference(settingsPreferenceKeys.imageAspectRatio, defaultSettingsPreferences.imageAspectRatio);
  const [imageModel, setImageModel] = useLocalPreference<ImageDefaultModel>(settingsPreferenceKeys.imageModel, defaultSettingsPreferences.imageModel);
  const [imageResolution, setImageResolution] = useLocalPreference<ImageDefaultResolution>(settingsPreferenceKeys.imageResolution, defaultSettingsPreferences.imageResolution);
  const [imageThinkingLevel, setImageThinkingLevel] = useLocalPreference<ImageThinkingLevel>(settingsPreferenceKeys.imageThinkingLevel, defaultSettingsPreferences.imageThinkingLevel);
  const [videoDefaultMode, setVideoDefaultMode] = useLocalPreference<VideoDefaultMode>(settingsPreferenceKeys.videoDefaultMode, defaultSettingsPreferences.videoDefaultMode);
  const [videoRatio, setVideoRatio] = useLocalPreference(settingsPreferenceKeys.videoRatio, defaultSettingsPreferences.videoRatio);
  const [videoDuration, setVideoDuration] = useLocalPreference(settingsPreferenceKeys.videoDuration, defaultSettingsPreferences.videoDuration);
  const [videoResolution, setVideoResolution] = useLocalPreference<VideoDefaultResolution>(settingsPreferenceKeys.videoResolution, defaultSettingsPreferences.videoResolution);
  const [videoModel, setVideoModel] = useLocalPreference<VideoDefaultModel>(settingsPreferenceKeys.videoModel, defaultSettingsPreferences.videoModel);
  const [videoGenerateAudio, setVideoGenerateAudio] = useLocalPreference(settingsPreferenceKeys.videoGenerateAudio, defaultSettingsPreferences.videoGenerateAudio);
  const [videoReturnLastFrame, setVideoReturnLastFrame] = useLocalPreference(settingsPreferenceKeys.videoReturnLastFrame, defaultSettingsPreferences.videoReturnLastFrame);
  const [videoEnableWebSearch, setVideoEnableWebSearch] = useLocalPreference(settingsPreferenceKeys.videoEnableWebSearch, defaultSettingsPreferences.videoEnableWebSearch);
  const [musicModel, setMusicModel] = useLocalPreference<MusicDefaultModel>(settingsPreferenceKeys.musicModel, defaultSettingsPreferences.musicModel);
  const [musicInstrumental, setMusicInstrumental] = useLocalPreference(settingsPreferenceKeys.musicInstrumental, defaultSettingsPreferences.musicInstrumental);
  const [musicVocalGender, setMusicVocalGender] = useLocalPreference<MusicVocalGender>(settingsPreferenceKeys.musicVocalGender, defaultSettingsPreferences.musicVocalGender);
  const [model3dDefaultMode, setModel3dDefaultMode] = useLocalPreference<Model3DDefaultMode>(settingsPreferenceKeys.model3dDefaultMode, defaultSettingsPreferences.model3dDefaultMode);
  const [model3dSubjectType, setModel3dSubjectType] = useLocalPreference<Model3DSubjectType>(settingsPreferenceKeys.model3dSubjectType, defaultSettingsPreferences.model3dSubjectType);
  const [model3dRig, setModel3dRig] = useLocalPreference(settingsPreferenceKeys.model3dRig, defaultSettingsPreferences.model3dRig);
  const [model3dFaceLimit, setModel3dFaceLimit] = useLocalPreference(settingsPreferenceKeys.model3dFaceLimit, defaultSettingsPreferences.model3dFaceLimit);
  const [model3dTextureQuality, setModel3dTextureQuality] = useLocalPreference<Model3DTextureQuality>(settingsPreferenceKeys.model3dTextureQuality, defaultSettingsPreferences.model3dTextureQuality);
  const [model3dTransparent, setModel3dTransparent] = useLocalPreference(settingsPreferenceKeys.model3dTransparent, defaultSettingsPreferences.model3dTransparent);

  const [developerMode, setDeveloperMode] = useState(isDeveloperModeEnabled());
  const [developerLogVersion, setDeveloperLogVersion] = useState(0);

  const [serverLogEntries, setServerLogEntries] = useState<
    FrontendDiagnosticEntry[]
  >([]);
  const developerLogs = formatDeveloperLogsForDisplay();
  const serverLogs = formatDiagnosticEntries(serverLogEntries);
  const visibleLogs = serverLogs || developerLogs;
  const developerLogCount = Math.max(
    getDeveloperLogEntries().length,
    serverLogEntries.length,
  );
  const runtimeActionLabel = runtime?.status === "ready" ? "重启 Runtime" : "启动 Runtime";
  const [workMode, setWorkMode] = useState<"creator" | "technical">("creator");
  const [personalityTone, setPersonalityTone] = useState("balanced");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryFromTools, setMemoryFromTools] = useState(false);
  const [browserEnabled, setBrowserEnabled] = useState(true);
  const [browserApproval, setBrowserApproval] = useState("ask-first");
  const [captureScreenshots, setCaptureScreenshots] = useState("include");
  const [terminalApproval, setTerminalApproval] = useState("confirm-dangerous");
  const [outsideSandboxApproval, setOutsideSandboxApproval] = useState("confirm");
  const [mcpToolApproval, setMcpToolApproval] = useState("project-only");

  void project;
  void tools;
  void sidebarCollapsed;
  void onActiveTabChange;
  void onExitSettings;

  useEffect(() => {
    const unsubscribeMode = subscribeDeveloperMode(setDeveloperMode);
    const unsubscribeLogs = subscribeDeveloperLogs(() =>
      setDeveloperLogVersion((version) => version + 1),
    );
    return () => {
      unsubscribeMode();
      unsubscribeLogs();
    };
  }, []);

  const refreshServerLogs = async () => {
    try {
      const response = await listFrontendDiagnostics();
      setServerLogEntries(response.entries);
    } catch {
      setServerLogEntries([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const refreshLogs = async () => {
      try {
        const response = await listFrontendDiagnostics();
        if (cancelled) return;
        setServerLogEntries(response.entries);
      } catch {
        if (!cancelled) setServerLogEntries([]);
      }
    };
    void refreshLogs();
    const timer = window.setInterval(refreshLogs, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleClearLogs = async () => {
    const retention = logRetention === "manual" ? "all" : logRetention;
    clearDeveloperLogEntries();
    setServerLogEntries([]);
    await clearFrontendDiagnostics(retention).catch(() => undefined);
    await refreshServerLogs();
  };

  const handleExportLogs = () => {
    const exportPayload = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        project: project
          ? {
              id: project.id,
              name: project.name,
              rootPath: project.rootPath,
              makerProjectId: project.makerProjectId,
            }
          : undefined,
        runtime,
        logText: visibleLogs,
      },
      null,
      2,
    );
    const blob = new Blob([exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `taptap-settings-diagnostics-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  void developerLogVersion;

  useEffect(() => {
    const el = document.getElementById(`settings-${activeTab}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeTab]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-6 bg-surface-app">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto pr-8 pb-32 scrollbar-thin flex flex-col gap-12 max-w-4xl mx-auto w-full pt-4">

            <div id="settings-general" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Settings className="h-4 w-4" />} title="通用">
                <SegmentedSetting
                  label="启动后打开"
                  description="控制桌面工作台启动后先进入哪里。"
                  value={startupPreference}
                  options={[
                    { label: "上次项目", value: "last-project" },
                    { label: "首页", value: "home" },
                    { label: "首页选择", value: "home-picker" },
                  ]}
                  onChange={(value) => setStartupPreference(value as StartupPreference)}
                />
                <SegmentedSetting
                  label="默认工作区"
                  description="选择打开项目后默认进入的模块。"
                  value={defaultWorkspace}
                  options={Object.entries(defaultWorkspaceLabels).map(([value, label]) => ({ value, label }))}
                  onChange={(value) => setDefaultWorkspace(value as DefaultWorkspace)}
                />
                <SegmentedSetting
                  label="危险操作确认"
                  description="控制删除本地文件、重启 Runtime 等危险操作的确认强度。"
                  value={confirmationPreference}
                  options={[
                    { label: "标准", value: "standard" },
                    { label: "严格", value: "strict" },
                  ]}
                  onChange={(value) => setConfirmationPreference(value as ConfirmationPreference)}
                />
                <SegmentedSetting
                  label="默认任务面板"
                  description="点击普通任务时，右侧 Inspector 默认切到哪个页签。失败任务仍优先打开错误。"
                  value={taskDefaultPanel}
                  options={[
                    { label: "状态", value: "status" },
                    { label: "日志", value: "logs" },
                    { label: "错误", value: "errors" },
                  ]}
                  onChange={(value) => setTaskDefaultPanel(value as TaskPanelPreference)}
                />
                <SwitchSetting label="失败时打开错误面板" description="有新失败任务时自动展开 Inspector 并切到错误页。" checked={autoOpenErrors} onChange={setAutoOpenErrors} />
              </SettingsPanel>
            </div>

            <div id="settings-appearance" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Palette className="h-4 w-4" />} title="外观">
                <ThemeSelectorPreview value={themePreference} onChange={setThemePreference} />
                <SegmentedSetting
                  label="UI 密度"
                  description="调整全局界面字号和整体信息密度。"
                  value={density}
                  options={[
                    { label: "舒适", value: "comfortable" },
                    { label: "标准", value: "standard" },
                    { label: "紧凑", value: "compact" },
                  ]}
                  onChange={(value) => setDensity(value as DensityPreference)}
                />
                <SegmentedSetting
                  label="左侧栏"
                  description="控制进入工作台时左侧主导航的默认展开状态。"
                  value={sidebarPreference}
                  options={[
                    { label: "记住", value: "remember" },
                    { label: "展开", value: "expanded" },
                    { label: "收起", value: "collapsed" },
                  ]}
                  onChange={(value) => setSidebarPreference(value as PanelPreference)}
                />
                <SegmentedSetting
                  label="Inspector"
                  description="控制右侧状态、工具、日志和错误面板的默认展开状态。"
                  value={inspectorPreference}
                  options={[
                    { label: "记住", value: "remember" },
                    { label: "展开", value: "expanded" },
                    { label: "收起", value: "collapsed" },
                  ]}
                  onChange={(value) => setInspectorPreference(value as PanelPreference)}
                />
              </SettingsPanel>
            </div>

            <div id="settings-personalization" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Settings className="h-4 w-4" />} title="工作模式">
                <ModeCardGrid
                  value={workMode}
                  options={[
                    {
                      value: "creator",
                      title: "适用于日常创作",
                      description: "少一些技术细节，优先展示项目、素材、画布和任务结果。",
                      icon: <Images className="h-5 w-5" />,
                    },
                    {
                      value: "technical",
                      title: "适用于调试开发",
                      description: "显示更多 runtime、payload、schema、日志和诊断入口。",
                      icon: <FileJson className="h-5 w-5" />,
                    },
                  ]}
                  onChange={(value) => setWorkMode(value as "creator" | "technical")}
                />
                <PreferenceNote text="雏形：这个区域只做 UI 信息架构，后续再决定哪些模块随工作模式隐藏或展开。" />
              </SettingsPanel>
              <SettingsPanel icon={<Bug className="h-4 w-4" />} title="回答与记忆">
                <SegmentedSetting
                  label="默认语气"
                  description="控制内置助手说明、错误解释和操作建议的表达风格。"
                  value={personalityTone}
                  options={[
                    { label: "直接", value: "direct" },
                    { label: "平衡", value: "balanced" },
                    { label: "详细", value: "detailed" },
                  ]}
                  onChange={setPersonalityTone}
                />
                <LargeTextSetting
                  label="项目协作指令"
                  description="给本机协作助手的长期说明，会作为后续任务的上下文雏形。"
                  defaultValue={"回答问题时避免过分夸赞。优先读取真实源码、schema、日志和配置。不要猜字段、路径、JSON 结构或工具参数。"}
                  actionLabel="保存"
                />
                <SwitchSetting
                  label="启用项目记忆"
                  description="允许工作台保留项目内的偏好、常用入口和协作说明。"
                  checked={memoryEnabled}
                  onChange={setMemoryEnabled}
                />
                <SwitchSetting
                  label="跳过工具辅助对话"
                  description="避免从网页搜索或 MCP 工具调用的临时对话中生成长期记忆。"
                  checked={memoryFromTools}
                  onChange={setMemoryFromTools}
                />
                <ActionRow
                  label="重置项目记忆"
                  description="删除当前项目下保存的协作偏好和长期说明。"
                  actionLabel="重置"
                  danger
                />
              </SettingsPanel>
            </div>

            <div id="settings-shortcuts" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Grid3X3 className="h-4 w-4" />} title="键盘快捷键">
                <SearchSetting label="搜索快捷键" placeholder="搜索命令、画布、任务、资产..." />
                <ShortcutTable
                  rows={[
                    { command: "打开设置", description: "进入当前设置中心", shortcut: "Ctrl + ," },
                    { command: "切换主题", description: "在浅色和深色主题之间切换", shortcut: "Ctrl + Shift + T" },
                    { command: "刷新当前数据", description: "刷新项目、任务、资产或 runtime 状态", shortcut: "Ctrl + R" },
                    { command: "切换左侧栏", description: "展开或收起全局侧栏", shortcut: "Ctrl + B" },
                    { command: "切换 Inspector", description: "展开或收起右侧状态栏", shortcut: "Ctrl + Shift + I" },
                    { command: "打开视频工作室", description: "进入视频工作室和多模态画布", shortcut: "Ctrl + Alt + V" },
                    { command: "扫描资产", description: "刷新当前项目资产索引", shortcut: "Ctrl + Alt + A" },
                    { command: "启动 Runtime", description: "启动当前项目 MCP Runtime", shortcut: "Ctrl + Alt + R" },
                    { command: "复制诊断摘要", description: "复制当前项目、工具、任务和 runtime 摘要", shortcut: "未指定" },
                  ]}
                />
                <PreferenceNote text="雏形：快捷键列表先做完整 GUI，后续再接命令注册表、冲突检测和自定义录入。" />
              </SettingsPanel>
            </div>

            <div id="settings-browser" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="内置浏览器">
                <FeatureHero
                  icon={<ServerCog className="h-8 w-8" />}
                  title="浏览器"
                  description="管理内置浏览器、网页预览、截图和网页权限。这里先放 GUI 雏形，不启用真实浏览器自动化。"
                  enabled={browserEnabled}
                  onToggle={setBrowserEnabled}
                />
              </SettingsPanel>
              <SettingsPanel icon={<Settings className="h-4 w-4" />} title="常规">
                <SegmentedSetting
                  label="本地 URL 打开位置"
                  description="本地开发站点或预览地址默认在哪里打开。"
                  value="workbench"
                  options={[
                    { label: "工作台", value: "workbench" },
                    { label: "系统浏览器", value: "system" },
                    { label: "每次询问", value: "ask" },
                  ]}
                  onChange={() => undefined}
                />
                <SegmentedSetting
                  label="浏览数据"
                  description="清理应用内浏览器中的历史记录、网站数据、缓存和下载记录。"
                  value="all"
                  options={[
                    { label: "清除所有", value: "all" },
                    { label: "清除缓存", value: "cache" },
                    { label: "保留登录", value: "keep-auth" },
                  ]}
                  onChange={() => undefined}
                />
                <SegmentedSetting
                  label="批注截图"
                  description="截图可帮助理解网页状态，但会增加诊断包体积。"
                  value={captureScreenshots}
                  options={[
                    { label: "始终包含", value: "include" },
                    { label: "失败时包含", value: "on-error" },
                    { label: "不包含", value: "off" },
                  ]}
                  onChange={setCaptureScreenshots}
                />
              </SettingsPanel>
              <SettingsPanel icon={<ShieldPreviewIcon />} title="权限">
                <ActionRow label="网站设置" description="管理摄像头、麦克风、剪贴板和下载权限。" actionLabel="管理" />
                <SegmentedSetting
                  label="打开网站审批"
                  description="选择打开外部网站前是否先请求确认。"
                  value={browserApproval}
                  options={[
                    { label: "始终询问", value: "ask-first" },
                    { label: "本地允许", value: "allow-local" },
                    { label: "始终允许", value: "allow" },
                  ]}
                  onChange={setBrowserApproval}
                />
              </SettingsPanel>
            </div>

            <div id="settings-permissions" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="权限概览">
                <PermissionMatrix
                  rows={[
                    { label: "默认工作区文件", description: "读取和编辑当前项目目录内文件", enabled: true },
                    { label: "自动审核", description: "访问项目外文件前进行额外确认", enabled: true },
                    { label: "完整访问权限", description: "允许编辑任意本地路径和运行联网命令", enabled: false },
                  ]}
                />
              </SettingsPanel>
              <SettingsPanel icon={<FileJson className="h-4 w-4" />} title="沙盒与工具">
                <SegmentedSetting
                  label="终端命令"
                  description="配置工作台内允许执行的终端命令范围。"
                  value={terminalApproval}
                  options={[
                    { label: "危险操作确认", value: "confirm-dangerous" },
                    { label: "每次确认", value: "always" },
                    { label: "不允许", value: "blocked" },
                  ]}
                  onChange={setTerminalApproval}
                />
                <SegmentedSetting
                  label="沙盒外命令"
                  description="配置当前项目范围外的命令审批策略。"
                  value={outsideSandboxApproval}
                  options={[
                    { label: "确认", value: "confirm" },
                    { label: "始终阻止", value: "blocked" },
                    { label: "允许", value: "allow" },
                  ]}
                  onChange={setOutsideSandboxApproval}
                />
                <SegmentedSetting
                  label="MCP Tools"
                  description="配置外部工具调用的显示和审批方式。"
                  value={mcpToolApproval}
                  options={[
                    { label: "项目内工具", value: "project-only" },
                    { label: "每次确认", value: "confirm" },
                    { label: "开发者模式", value: "developer" },
                  ]}
                  onChange={setMcpToolApproval}
                />
              </SettingsPanel>
              <SettingsPanel icon={<Bug className="h-4 w-4" />} title="自定义预算">
                <BudgetPreview
                  rows={[
                    { label: "项目规则", value: 42, color: "#5aa7ff" },
                    { label: "技能说明", value: 18, color: "#86d67d" },
                    { label: "MCP Schema", value: 24, color: "#d8a657" },
                  ]}
                />
                <ActionRow label="Skills" description="查看和管理本地技能说明、触发规则和说明长度。" actionLabel="打开" />
                <ActionRow label="MCP Tools" description="查看当前项目暴露的工具和 schema 预算占用。" actionLabel="打开" />
              </SettingsPanel>
            </div>

            <div id="settings-project" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="项目偏好">
                <ModeCardGrid
                  value={defaultWorkspace}
                  options={Object.entries(defaultWorkspaceLabels).map(([value, label]) => ({
                    value,
                    title: label,
                    description: value === "assets" ? "打开项目后优先进入资产管理。" : "打开项目后优先进入对应工作室。",
                    icon: value === "assets" ? <Images className="h-5 w-5" /> : <Box className="h-5 w-5" />,
                  }))}
                  onChange={(value) => setDefaultWorkspace(value as DefaultWorkspace)}
                />
                <SegmentedSetting
                  label="启动后打开"
                  description="控制桌面工作台启动后先进入哪里。"
                  value={startupPreference}
                  options={[
                    { label: "上次项目", value: "last-project" },
                    { label: "首页", value: "home" },
                    { label: "首页选择", value: "home-picker" },
                  ]}
                  onChange={(value) => setStartupPreference(value as StartupPreference)}
                />
                <SegmentedSetting
                  label="危险操作确认"
                  description="控制移除记录、删除本地项目文件夹和批量清理时的确认强度。"
                  value={confirmationPreference}
                  options={[
                    { label: "标准", value: "standard" },
                    { label: "严格", value: "strict" },
                  ]}
                  onChange={(value) => setConfirmationPreference(value as ConfirmationPreference)}
                />
              </SettingsPanel>
              <SettingsPanel icon={<Workflow className="h-4 w-4" />} title="项目管理默认动作">
                <ActionRow label="打开项目文件夹" description="从项目列表或命令面板进入系统文件管理器。" actionLabel="配置" />
                <ActionRow label="移除项目记录" description="仅从工作台列表移除，不删除本地目录。" actionLabel="配置" />
                <ActionRow label="删除本地项目文件夹" description="破坏性动作，始终保留二次确认；严格模式要求输入完整路径。" actionLabel="配置" danger />
                <PreferenceNote text="项目状态、健康检查、路径、project_id 和 runtime 详情放在首页或右侧 Inspector，不在设置页重复展示。" />
              </SettingsPanel>
            </div>

            <div id="settings-workspaces" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Images className="h-4 w-4" />} title="图像工作室默认值">
                <SegmentedSetting label="模式" description="新建图像任务时默认选中的工作模式。" value={imageDefaultMode} options={[{ label: "单图", value: "generate" }, { label: "批量", value: "batch" }, { label: "编辑", value: "edit" }]} onChange={(value) => setImageDefaultMode(value as ImageDefaultMode)} />
                <SegmentedSetting label="模型" description="新建图像任务时默认使用的图像生成模型。" value={imageModel} options={[{ label: "自动", value: "auto" }, { label: "Nano Banana", value: "nanobanana" }, { label: "GPT Image", value: "gpt" }]} onChange={(value) => setImageModel(value as ImageDefaultModel)} />
                <SegmentedSetting label="目标尺寸" description="图像生成结果的默认像素尺寸。" value={imageTargetSize} options={[{ label: "512", value: "512x512" }, { label: "1024", value: "1024x1024" }, { label: "1536", value: "1536x1536" }, { label: "16:9", value: "1920x1080" }, { label: "9:16", value: "1080x1920" }]} onChange={setImageTargetSize} />
                <SegmentedSetting label="长宽比" description="新图默认画面比例，会影响构图方向。" value={imageAspectRatio} options={[{ label: "1:1", value: "1:1" }, { label: "16:9", value: "16:9" }, { label: "9:16", value: "9:16" }, { label: "4:3", value: "4:3" }, { label: "3:4", value: "3:4" }]} onChange={setImageAspectRatio} />
                <SegmentedSetting label="输出分辨率" description="控制图像生成的清晰度档位，越高通常越慢、消耗越高。" value={imageResolution} options={[{ label: "0.5K", value: "0.5K" }, { label: "1K", value: "1K" }, { label: "2K", value: "2K" }, { label: "4K", value: "4K" }]} onChange={(value) => setImageResolution(value as ImageDefaultResolution)} />
                <SegmentedSetting label="思考层级" description="控制图像模型在生成前的推理强度。" value={imageThinkingLevel} options={[{ label: "minimal", value: "minimal" }, { label: "high", value: "high" }]} onChange={(value) => setImageThinkingLevel(value as ImageThinkingLevel)} />
              </SettingsPanel>
              <SettingsPanel icon={<Box className="h-4 w-4" />} title="视频工作室默认值">
                <SegmentedSetting label="模式" description="新建视频任务时默认使用的生成方式。" value={videoDefaultMode} options={[{ label: "文本", value: "text_to_video" }, { label: "首帧", value: "first_frame" }, { label: "首尾帧", value: "first_last_frame" }]} onChange={(value) => setVideoDefaultMode(value as VideoDefaultMode)} />
                <SegmentedSetting label="画幅" description="新视频默认画面比例。" value={videoRatio} options={[{ label: "16:9", value: "16:9" }, { label: "9:16", value: "9:16" }, { label: "1:1", value: "1:1" }, { label: "4:3", value: "4:3" }, { label: "3:4", value: "3:4" }, { label: "21:9", value: "21:9" }]} onChange={setVideoRatio} />
                <SegmentedSetting label="时长" description="新视频默认生成时长。" value={videoDuration} options={[{ label: "4 秒", value: "4" }, { label: "5 秒", value: "5" }, { label: "10 秒", value: "10" }, { label: "15 秒", value: "15" }, { label: "自动", value: "-1" }]} onChange={setVideoDuration} />
                <SegmentedSetting label="分辨率" description="新视频默认输出清晰度。" value={videoResolution} options={[{ label: "720p", value: "720p" }, { label: "480p", value: "480p" }]} onChange={(value) => setVideoResolution(value as VideoDefaultResolution)} />
                <SegmentedSetting label="模型" description="新视频默认使用标准模式还是更快的模式。" value={videoModel} options={[{ label: "标准", value: "default" }, { label: "极速", value: "fast" }]} onChange={(value) => setVideoModel(value as VideoDefaultModel)} />
                <SwitchSetting label="生成音频" description="视频生成时默认请求同步生成音频。" checked={videoGenerateAudio} onChange={setVideoGenerateAudio} />
                <SwitchSetting label="返回尾帧" description="生成完成后保留 last frame，方便继续接下一段视频。" checked={videoReturnLastFrame} onChange={setVideoReturnLastFrame} />
                <SwitchSetting label="启用 Web Search" description="允许视频任务使用联网检索增强提示词或参考信息。" checked={videoEnableWebSearch} onChange={setVideoEnableWebSearch} />
              </SettingsPanel>
              <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="音频工作室默认值">
                <SegmentedSetting label="模型" description="新建音乐任务时默认使用的音乐模型版本。" value={musicModel} options={[{ label: "V4_5", value: "V4_5" }, { label: "V5", value: "V5" }, { label: "V4_5 PLUS", value: "V4_5PLUS" }, { label: "V4", value: "V4" }, { label: "V3_5", value: "V3_5" }]} onChange={(value) => setMusicModel(value as MusicDefaultModel)} />
                <SwitchSetting label="纯音乐" description="开启后默认不生成人声，只生成伴奏或背景音乐。" checked={musicInstrumental} onChange={setMusicInstrumental} />
                <SegmentedSetting label="默认人声" description="没有开启纯音乐时，默认使用的人声方向。" value={musicVocalGender} options={[{ label: "女声", value: "f" }, { label: "男声", value: "m" }]} onChange={(value) => setMusicVocalGender(value as MusicVocalGender)} />
              </SettingsPanel>
              <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="3D 工作室默认值">
                <SegmentedSetting label="模式" description="新建 3D 任务时默认使用的输入方式。" value={model3dDefaultMode} options={[{ label: "文本", value: "text_to_model" }, { label: "单图", value: "image_to_model" }, { label: "多视图", value: "multiview_to_model" }]} onChange={(value) => setModel3dDefaultMode(value as Model3DDefaultMode)} />
                <SegmentedSetting label="模型类型" description="告诉 3D 生成链路目标物体大概属于哪类。" value={model3dSubjectType} options={[{ label: "双足", value: "biped" }, { label: "四足", value: "quadruped" }, { label: "场景", value: "scenery" }, { label: "其他", value: "other" }]} onChange={(value) => setModel3dSubjectType(value as Model3DSubjectType)} />
                <SegmentedSetting label="面数上限" description="控制生成模型的默认多边形规模。" value={model3dFaceLimit} options={[{ label: "5k", value: "5000" }, { label: "12k", value: "12000" }, { label: "20k", value: "20000" }]} onChange={setModel3dFaceLimit} />
                <SegmentedSetting label="贴图质量" description="控制 3D 模型默认贴图细节。" value={model3dTextureQuality} options={[{ label: "标准", value: "standard" }, { label: "细节", value: "detailed" }]} onChange={(value) => setModel3dTextureQuality(value as Model3DTextureQuality)} />
                <SwitchSetting label="绑定骨骼" description="双足模型默认请求绑定骨骼，方便后续动画或角色使用。" checked={model3dRig} onChange={setModel3dRig} />
                <SwitchSetting label="透明背景" description="生成参考图或预览图时默认使用透明背景。" checked={model3dTransparent} onChange={setModel3dTransparent} />
              </SettingsPanel>
            </div>

            <div id="settings-canvas" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<PanelLeft className="h-4 w-4" />} title="进入与退出">
                <SegmentedSetting label="进入多模态画布" description="控制从视频工作室进入聚焦画布时，左右面板怎么处理。" value={canvasSidebarBehavior} options={[{ label: "保持", value: "keep" }, { label: "折叠左栏", value: "collapse-left" }, { label: "折叠左右栏", value: "collapse-both" }]} onChange={(value) => setCanvasSidebarBehavior(value as CanvasSidebarPreference)} />
                <SegmentedSetting label="离开画布" description="控制退出画布后是否恢复进入前的面板状态。" value={canvasLeaveBehavior} options={[{ label: "保持当前", value: "keep" }, { label: "恢复进入前", value: "restore" }]} onChange={(value) => setCanvasLeaveBehavior(value as CanvasLeavePreference)} />
                <SwitchSetting label="生成失败打开错误面板" description="画布运行失败时自动展开右侧 Inspector 并切到错误页。" checked={autoOpenErrors} onChange={setAutoOpenErrors} />
              </SettingsPanel>
              <SettingsPanel icon={<Workflow className="h-4 w-4" />} title="视频画布">
                <SegmentedSetting label="网格" description="控制画布背景网格的默认显示状态。" value={canvasGrid} options={[{ label: "显示", value: "visible" }, { label: "隐藏", value: "hidden" }]} onChange={(value) => setCanvasGrid(value as CanvasGridPreference)} />
                <SegmentedSetting label="小地图" description="控制画布右下角小地图的默认状态。" value={canvasMiniMap} options={[{ label: "显示", value: "visible" }, { label: "隐藏", value: "hidden" }]} onChange={(value) => setCanvasMiniMap(value as CanvasMiniMapPreference)} />
                <SegmentedSetting label="自动保存" description="控制视频画布节点和连线是否自动保存。" value={canvasAutoSave} options={[{ label: "开启", value: "on" }, { label: "关闭", value: "off" }]} onChange={(value) => setCanvasAutoSave(value as CanvasAutoSavePreference)} />
                <PreferenceNote text="旧全能画布、旧 Workflow 和 Runs 是历史入口，当前按项目文档保持隐藏；这里不提供普通用户开关。" />
              </SettingsPanel>
              <SettingsPanel icon={<FileJson className="h-4 w-4" />} title="代码面板">
                <SegmentedSetting label="主题" description="控制 Payload JSON、Raw Result、日志等代码块的明暗样式。" value={codeEditorTheme} options={[{ label: "跟随应用", value: "app" }, { label: "深色", value: "dark" }, { label: "浅色", value: "light" }, { label: "高对比", value: "high-contrast" }, { label: "自定义", value: "custom" }]} onChange={(value) => setCodeEditorTheme(value as CodeEditorThemePreference)} />
                <SegmentedSetting label="颜色预设" description="控制代码高亮的配色风格。" value={codeEditorPalette} options={[{ label: "VS Dark", value: "vscode-dark" }, { label: "GitHub", value: "github-light" }, { label: "Monokai", value: "monokai" }, { label: "自定义", value: "custom" }]} onChange={(value) => setCodeEditorPalette(value as CodeEditorPalettePreference)} />
                <SegmentedSetting label="字号" description="控制代码面板字体大小。" value={codeEditorFontSize} options={[{ label: "小", value: "small" }, { label: "标准", value: "standard" }, { label: "大", value: "large" }]} onChange={(value) => setCodeEditorFontSize(value as CodeEditorFontSizePreference)} />
                <SegmentedSetting label="长行" description="控制超长 JSON 或日志行如何显示。" value={codeEditorWrap} options={[{ label: "自动换行", value: "wrap" }, { label: "横向滚动", value: "scroll" }]} onChange={(value) => setCodeEditorWrap(value as CodeEditorWrapPreference)} />
                <SegmentedSetting label="行号" description="控制代码面板左侧是否显示行号。" value={codeEditorLineNumbers} options={[{ label: "显示", value: "show" }, { label: "隐藏", value: "hide" }]} onChange={(value) => setCodeEditorLineNumbers(value as CodeEditorLineNumbersPreference)} />
              </SettingsPanel>
            </div>

            <div id="settings-assets" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Images className="h-4 w-4" />} title="资产">
                <SegmentedSetting label="拖入资产" description="控制把文件拖进资产区域时默认怎么处理。" value={assetDropBehavior} options={[{ label: "直接导入", value: "copy" }, { label: "每次询问", value: "ask" }]} onChange={(value) => setAssetDropBehavior(value as AssetDropPreference)} />
                <SegmentedSetting label="引用检查" description="控制移动或删除资产前是否默认检查画布、任务或资源引用。" value={assetReferenceCheck} options={[{ label: "删除/移动前扫描", value: "scan" }, { label: "手动扫描", value: "skip" }]} onChange={(value) => setAssetReferenceCheck(value as AssetReferencePreference)} />
                <SegmentedSetting label="危险操作确认" description="控制删除资产和本地文件夹时的确认强度。" value={confirmationPreference} options={[{ label: "标准", value: "standard" }, { label: "严格", value: "strict" }]} onChange={(value) => setConfirmationPreference(value as ConfirmationPreference)} />
                <SwitchSetting label="生成完成刷新资产" description="图像、音频、视频任务成功后自动刷新资产列表和资产树。" checked={taskCompletionRefresh === "on"} onChange={(checked) => setTaskCompletionRefresh(checked ? "on" : "off")} />
              </SettingsPanel>
            </div>

            <div id="settings-tasks" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Grid3X3 className="h-4 w-4" />} title="任务">
                <SegmentedSetting label="默认任务面板" description="点击任务时右侧 Inspector 默认打开哪个页签。" value={taskDefaultPanel} options={[{ label: "状态", value: "status" }, { label: "日志", value: "logs" }, { label: "错误", value: "errors" }]} onChange={(value) => setTaskDefaultPanel(value as TaskPanelPreference)} />
                <SegmentedSetting label="生成完成刷新资产" description="控制生成类任务成功后是否自动刷新资产列表。" value={taskCompletionRefresh} options={[{ label: "开启", value: "on" }, { label: "关闭", value: "off" }]} onChange={(value) => setTaskCompletionRefresh(value as TaskCompletionRefreshPreference)} />
                <SwitchSetting label="失败任务通知" description="控制失败任务是否触发工作台内通知和错误联动。" checked={failureNotifications} onChange={setFailureNotifications} />
                <SwitchSetting label="失败时打开错误面板" description="出现新失败任务时自动展开右侧错误页。" checked={autoOpenErrors} onChange={setAutoOpenErrors} />
              </SettingsPanel>
            </div>

            <div id="settings-runtime" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="MCP Runtime 偏好">
                <ModeCardGrid
                  value={autoRuntime}
                  options={[
                    {
                      value: "manual",
                      title: "手动启动",
                      description: "进入项目后不自动拉起 runtime，需要时再手动启动。",
                      icon: <Square className="h-5 w-5" />,
                    },
                    {
                      value: "selected-project",
                      title: "选中项目时启动",
                      description: "切换到项目后自动准备 MCP Runtime 和工具列表。",
                      icon: <Play className="h-5 w-5" />,
                    },
                  ]}
                  onChange={(value) => setAutoRuntime(value as AutoRuntimePreference)}
                />
                <SegmentedSetting
                  label="MCP Tools 审批"
                  description="配置外部工具调用的显示和审批方式。"
                  value={mcpToolApproval}
                  options={[
                    { label: "项目内工具", value: "project-only" },
                    { label: "每次确认", value: "confirm" },
                    { label: "开发者模式", value: "developer" },
                  ]}
                  onChange={setMcpToolApproval}
                />
                <PreferenceNote text="Runtime 状态、PID、cwd、tools/list 更新时间和错误详情放在右侧 Inspector；设置页只保留默认行为和审批策略。" />
              </SettingsPanel>
              <SettingsPanel icon={<RefreshCw className="h-4 w-4" />} title="Runtime 动作入口">
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={onStartRuntime}>
                    <Play className="h-3.5 w-3.5" />
                    {runtimeActionLabel}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy || runtime?.status === "idle"} onClick={onStopRuntime}>
                    <Square className="h-3.5 w-3.5" />
                    停止 Runtime
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onRefreshTools}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    刷新 tools/list
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onStatusLite}>
                    <Cpu className="h-3.5 w-3.5" />
                    打开状态检查
                  </Button>
                </div>
              </SettingsPanel>
            </div>

            <div id="settings-logs" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Bell className="h-4 w-4" />} title="日志与通知">
                <SegmentedSetting
                  label="日志保留"
                  description="控制清理诊断日志时使用的保留策略。"
                  value={logRetention}
                  options={[
                    { label: "14 天", value: "14d" },
                    { label: "30 天", value: "30d" },
                    { label: "100 MB", value: "100mb" },
                    { label: "手动", value: "manual" },
                  ]}
                  onChange={(value) => setLogRetention(value as LogRetentionPreference)}
                />
                <SwitchSetting label="失败任务通知" description="控制失败任务是否触发工作台内通知和错误联动。" checked={failureNotifications} onChange={setFailureNotifications} />
                <SwitchSetting label="失败时打开错误面板" description="出现新失败任务时自动展开右侧错误页。" checked={autoOpenErrors} onChange={setAutoOpenErrors} />
              </SettingsPanel>
              <SettingsPanel icon={<Bug className="h-4 w-4" />} title="诊断包管理">
                <ActionRow label="导出诊断包" description="导出用于排查问题的前端日志、当前偏好和基础上下文。" actionLabel="导出" />
                <div className="grid gap-2 p-3 sm:grid-cols-3">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleExportLogs}>
                    <Download className="h-3.5 w-3.5" />
                    导出
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(visibleLogs || "空日志")}>
                    <Copy className="h-3.5 w-3.5" />
                    复制日志
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 hover:bg-red-500/10 hover:text-red-500" onClick={() => void handleClearLogs()}>
                    <Trash2 className="h-3.5 w-3.5" />
                    按策略清理 ({developerLogCount})
                  </Button>
                </div>
                <PreferenceNote text="实时日志、错误堆栈、runtime 状态和 tools/list 概览放在右侧 Inspector，不在设置页作为看板展示。" />
              </SettingsPanel>
            </div>

            <div id="settings-developer" className="scroll-mt-6 flex flex-col gap-10">
              <SettingsPanel icon={<Bug className="h-4 w-4" />} title="开发者选项">
                <SwitchSetting
                  label="开发者模式"
                  description="开启后将记录所有调试日志，可在诊断信息中查看。"
                  checked={developerMode}
                  onChange={(val) => {
                    setDeveloperModeEnabled(val);
                  }}
                />
                <SwitchSetting
                  label="历史工作区调试"
                  description="仅用于开发排查旧 Workflow、Runs 或旧全能画布数据，不会把这些入口恢复到普通导航。"
                  checked={openHiddenLegacyWorkspaces}
                  onChange={setOpenHiddenLegacyWorkspaces}
                />
                <div className="px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      void openDesktopDevtools();
                    }}
                  >
                    <Bug className="h-3.5 w-3.5" />
                    打开 Chromium Devtools
                  </Button>
                </div>
              </SettingsPanel>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <div className="text-text-muted">{icon}</div>
        <h3 className="m-0 text-sm font-semibold text-text">{title}</h3>
      </div>
      <div className="flex flex-col rounded-xl border border-border-soft bg-surface-panel overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}

function SettingContainer({ label, description, children, note }: { label: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; note?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between p-4 border-b border-border-soft last:border-b-0", note ? "bg-surface-muted/20" : "hover:bg-surface-muted/30 transition-colors")}>
      <div className="flex flex-col pr-8">
        <span className="text-[13px] font-medium text-text">{label}</span>
        {description && <span className="mt-1.5 text-xs text-text-muted leading-relaxed">{description}</span>}
      </div>
      {children && <div className="shrink-0 flex items-center justify-end">{children}</div>}
    </div>
  );
}

function PreferenceNote({ text }: { text: string }) {
  return (
    <SettingContainer
      note
      label={
        <div className="flex items-start gap-2 text-text-muted">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="font-normal">{text}</span>
        </div>
      }
    />
  );
}

function SwitchSetting({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingContainer label={label} description={description}>
      <Switch checked={checked} onChange={onChange} />
    </SettingContainer>
  );
}

function ModeCardGrid({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; title: string; description: string; icon: React.ReactNode }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 border-b border-border-soft p-4 md:grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-h-[92px] items-center gap-4 rounded-lg border px-4 text-left transition",
              active
                ? "border-brand bg-brand/10 text-text shadow-sm"
                : "border-border-soft bg-surface-muted/20 text-text hover:bg-surface-muted/40",
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border-soft bg-surface-panel text-text-subtle">
              {option.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-text">{option.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-text-muted">{option.description}</span>
            </span>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                active ? "border-brand bg-brand" : "border-border bg-surface-panel",
              )}
            >
              {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LargeTextSetting({
  label,
  description,
  defaultValue,
  actionLabel,
}: {
  label: string;
  description: string;
  defaultValue: string;
  actionLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="border-b border-border-soft p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h4 className="m-0 text-[13px] font-semibold text-text">{label}</h4>
          <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline">
          {actionLabel}
        </Button>
      </div>
      <textarea
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        className="min-h-[180px] w-full resize-y rounded-lg border border-border bg-surface-muted px-3 py-3 text-sm leading-relaxed text-text outline-none focus:border-brand"
      />
    </div>
  );
}

function SearchSetting({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="border-b border-border-soft p-4">
      <label className="mb-2 block text-[13px] font-semibold text-text">{label}</label>
      <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-muted px-3 text-text-muted">
        <SearchIcon />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
          placeholder={placeholder}
        />
        <span className="rounded-control border border-border-soft px-1.5 py-0.5 text-[10px]">⌘</span>
      </div>
    </div>
  );
}

function ShortcutTable({
  rows,
}: {
  rows: Array<{ command: string; description: string; shortcut: string }>;
}) {
  return (
    <div className="overflow-hidden">
      <div className="grid grid-cols-[1fr_220px_40px] border-b border-border-soft bg-surface-muted/30 px-4 py-3 text-xs font-semibold text-text-muted">
        <span>命令</span>
        <span>按键绑定</span>
        <span />
      </div>
      {rows.map((row) => (
        <div key={`${row.command}-${row.shortcut}`} className="grid grid-cols-[1fr_220px_40px] items-center border-b border-border-soft px-4 py-3 last:border-b-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{row.command}</div>
            <div className="mt-1 text-xs text-text-muted">{row.description}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {row.shortcut === "未指定" ? (
              <span className="text-xs text-text-muted">未指定</span>
            ) : (
              row.shortcut.split("+").map((key) => (
                <span key={`${row.command}-${key}`} className="rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-text-subtle">
                  {key.trim()}
                </span>
              ))
            )}
          </div>
          <button type="button" className="flex h-8 w-8 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function FeatureHero({
  icon,
  title,
  description,
  enabled,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface-muted text-text">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="m-0 text-[15px] font-semibold text-text">{title}</h4>
        <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
      <Switch checked={enabled} onChange={onToggle} />
    </div>
  );
}

function ActionRow({
  label,
  description,
  actionLabel,
  danger,
}: {
  label: string;
  description: string;
  actionLabel: string;
  danger?: boolean;
}) {
  return (
    <SettingContainer label={label} description={description}>
      <Button type="button" size="sm" variant="outline" className={danger ? "text-red-500 hover:bg-red-500/10" : undefined}>
        {actionLabel}
      </Button>
    </SettingContainer>
  );
}

function PermissionMatrix({
  rows,
}: {
  rows: Array<{ label: string; description: string; enabled: boolean }>;
}) {
  return (
    <div className="divide-y divide-border-soft">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-sm font-semibold text-text">{row.label}</div>
            <div className="mt-1 text-xs leading-relaxed text-text-muted">{row.description}</div>
          </div>
          <Switch checked={row.enabled} onChange={() => undefined} />
        </div>
      ))}
    </div>
  );
}

function BudgetPreview({
  rows,
}: {
  rows: Array<{ label: string; value: number; color: string }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="border-b border-border-soft p-4">
      <p className="m-0 text-sm leading-relaxed text-text-muted">
        下方用于展示规则、技能和 MCP Schema 在上下文预算里的占用雏形。
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-surface-muted">
        {rows.map((row) => (
          <div key={row.label} style={{ width: `${row.value}%`, backgroundColor: row.color }} />
        ))}
      </div>
      <div className="mt-3 grid gap-2 text-xs text-text-muted md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
            <span>{row.label}</span>
            <span className="text-text-subtle">{row.value}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-text-muted">剩余预算约 {Math.max(0, 100 - total)}%</div>
    </div>
  );
}

function ShieldPreviewIcon() {
  return <ServerCog className="h-4 w-4" />;
}

function SearchIcon() {
  return <span className="h-3 w-3 rounded-full border border-current after:ml-2 after:mt-2 after:block after:h-1.5 after:w-px after:rotate-[-45deg] after:bg-current" />;
}

function SegmentedSetting<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}) {
  const id = React.useId();
  return (
    <SettingContainer label={label} description={description}>
      <SelectField id={id} value={value} options={options.map(o => ({ value: o.value, label: o.label }))} onChange={onChange as any} className="w-48 text-[13px]" />
    </SettingContainer>
  );
}

function useLocalPreference<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readLocalPreference(key, initialValue));

  const updateValue = (nextValue: T) => {
    setValue(nextValue);
    writeLocalPreference(key, nextValue);
  };

  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; value?: unknown }>).detail;
      if (detail?.key !== key) return;
      setValue(detail.value as T);
    };
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    return () => {
      window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handlePreferenceChange);
    };
  }, [key]);

  return [value, updateValue] as const;
}

function ThemeSelectorPreview({ value, onChange }: { value: "light" | "dark" | "system", onChange: (v: "light" | "dark" | "system") => void }) {
  return (
    <div className="flex flex-col gap-6 p-6 border-b border-border-soft bg-surface-muted/10">
       <div className="flex items-center gap-6 justify-center">
          <ThemeCard mode="system" active={value === "system"} onClick={() => onChange("system")} />
          <ThemeCard mode="light" active={value === "light"} onClick={() => onChange("light")} />
          <ThemeCard mode="dark" active={value === "dark"} onClick={() => onChange("dark")} />
       </div>
       <div className="flex border border-border-soft rounded-lg overflow-hidden bg-[#1e1e1e] text-[12px] font-mono shadow-sm">
         <div className="w-1/2 p-4 border-r border-[#333]">
           <div className="text-gray-400 mb-2 leading-relaxed">1  <span className="text-[#c678dd]">const</span> <span className="text-[#61afef]">themePreview</span>: <span className="text-[#e5c07b]">ThemeConfig</span> = {'{'}</div>
           <div className="text-gray-400 mb-2 leading-relaxed">2    <span className="text-[#d19a66]">surface</span>: <span className="text-[#98c379]">"sidebar"</span>,</div>
           <div className="text-gray-400 mb-2 leading-relaxed">3    <span className="text-[#d19a66]">accent</span>: <span className="text-[#98c379]">"#2563eb"</span>,</div>
           <div className="text-gray-400 mb-2 leading-relaxed">4    <span className="text-[#d19a66]">contrast</span>: <span className="text-[#d19a66]">42</span>,</div>
           <div className="text-gray-400 leading-relaxed">5  {'}'};</div>
         </div>
         <div className="w-1/2 p-4 bg-[#0d1117]">
           <div className="text-gray-500 mb-2 leading-relaxed">1  <span className="text-[#ff7b72]">const</span> <span className="text-[#79c0ff]">themePreview</span>: <span className="text-[#ff7b72]">ThemeConfig</span> = {'{'}</div>
           <div className="text-gray-500 mb-2 leading-relaxed">2    <span className="text-[#a5d6ff]">surface</span>: <span className="text-[#a5d6ff]">"sidebar-elevated"</span>,</div>
           <div className="text-gray-500 mb-2 leading-relaxed">3    <span className="text-[#a5d6ff]">accent</span>: <span className="text-[#a5d6ff]">"#0ea5e9"</span>,</div>
           <div className="text-gray-500 mb-2 leading-relaxed">4    <span className="text-[#a5d6ff]">contrast</span>: <span className="text-[#79c0ff]">68</span>,</div>
           <div className="text-gray-500 leading-relaxed">5  {'}'};</div>
         </div>
       </div>
    </div>
  )
}

function ThemeCard({ mode, active, onClick }: { mode: string, active: boolean, onClick: () => void }) {
  return (
     <button type="button" onClick={onClick} className={cn("flex flex-col items-center gap-3 cursor-pointer outline-none group", active ? "opacity-100" : "opacity-60 hover:opacity-100 transition-opacity")}>
        <div className={cn("w-[180px] h-[120px] rounded-[14px] border-2 overflow-hidden flex", active ? "border-brand shadow-md" : "border-transparent bg-border-soft")}>
           {mode === "system" && (
             <div className="flex w-full h-full">
               <div className="w-1/2 bg-white flex flex-col p-3 border-r border-gray-200">
                 <div className="w-full h-2.5 bg-gray-200 rounded-full mb-3"></div>
                 <div className="w-3/4 h-2 bg-gray-100 rounded-full mb-2"></div>
                 <div className="w-1/2 h-2 bg-gray-100 rounded-full"></div>
               </div>
               <div className="w-1/2 bg-[#1e1e1e] flex flex-col p-3">
                 <div className="w-full h-2.5 bg-[#333] rounded-full mb-3"></div>
                 <div className="w-3/4 h-2 bg-[#222] rounded-full mb-2"></div>
                 <div className="w-1/2 h-2 bg-[#222] rounded-full"></div>
               </div>
             </div>
           )}
           {mode === "light" && (
             <div className="w-full h-full bg-white flex flex-col p-5">
               <div className="w-full h-3 bg-gray-200 rounded-full mb-4"></div>
               <div className="w-3/4 h-2.5 bg-gray-100 rounded-full mb-3"></div>
               <div className="w-1/2 h-2.5 bg-gray-100 rounded-full"></div>
             </div>
           )}
           {mode === "dark" && (
             <div className="w-full h-full bg-[#1e1e1e] flex flex-col p-5">
               <div className="w-full h-3 bg-[#333] rounded-full mb-4"></div>
               <div className="w-3/4 h-2.5 bg-[#222] rounded-full mb-3"></div>
               <div className="w-1/2 h-2.5 bg-[#222] rounded-full"></div>
             </div>
           )}
        </div>
        <span className={cn("text-[13px] font-medium", active ? "text-text" : "text-text-muted")}>
          {mode === "system" ? "跟随系统" : mode === "light" ? "浅色" : "深色"}
        </span>
     </button>
  )
}

function formatDiagnosticEntries(entries: FrontendDiagnosticEntry[]) {
  if (!entries.length) return "";
  return entries.map(e => `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] ${e.message}`).join("\\n");
}
