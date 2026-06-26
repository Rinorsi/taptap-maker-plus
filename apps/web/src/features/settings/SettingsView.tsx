import { useEffect, useState } from "react";
import {
  Bug,
  Cpu,
  Download,
  FolderCog,
  RefreshCw,
  Settings,
  Square,
  Trash2,
  Play,
  PlaySquare,
  Palette,
  Bell,
  Box,
  Grid3X3,
  Images,
  Workflow,
  Info,
  Keyboard,
  Shield,
  MonitorCog,
  Bot,
  Monitor,
  Terminal,
  Globe,
  Code
} from "lucide-react";
import type { MakerProjectsRootSettings, ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";
import {
  clearFrontendDiagnostics,
  getMakerProjectsRootSettings,
  listFrontendDiagnostics,
  saveMakerProjectsRootSettings,
  type FrontendDiagnosticEntry,
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/SelectField";
import { Switch } from "../../components/ui/Switch";
import { commandShortcuts, formatShortcut, type Command } from "../../commands";
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
import type { SettingsTab } from "./settingsTabs";
import { cn } from "../../lib/utils";
import React from "react";
import {
  defaultSettingsPreferences,
  readStoredPreference,
  settingsPreferenceKeys,
  SETTINGS_PREFERENCES_CHANGED_EVENT,
  subscribeSettingsRemoteSync,
  writeLocalPreference,
  type SettingsPreferences
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
  onProjectsRootChanged?: (projects: ProjectSummary[], selectedProjectId?: string) => void;
  commands: Command[];
};

function shouldApplyServerLogRetention(value: SettingsPreferences["logRetention"]): value is Exclude<SettingsPreferences["logRetention"], "manual"> {
  return value !== "manual";
}

function useSettingsPreferences() {
  const readPrefs = () => {
    const p: any = {};
    for (const key of Object.keys(defaultSettingsPreferences)) {
      p[key] = readStoredPreference(key as keyof SettingsPreferences);
    }
    return p as SettingsPreferences;
  };
  const [prefs, setPrefs] = useState<SettingsPreferences>(() => {
    return readPrefs();
  });

  useEffect(() => {
    const handle = (e: Event) => {
      const customEvent = e as CustomEvent<{ key: string, value: any }>;
      const k = Object.entries(settingsPreferenceKeys).find(([_, v]) => v === customEvent.detail.key)?.[0] as keyof SettingsPreferences | undefined;
      if (k) {
        setPrefs(prev => ({ ...prev, [k]: customEvent.detail.value as any }));
      }
    };
    const unsubscribeRemote = subscribeSettingsRemoteSync(() => setPrefs(readPrefs()));
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handle);
    return () => {
      unsubscribeRemote();
      window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handle);
    };
  }, []);

  const update = <K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) => {
    writeLocalPreference(settingsPreferenceKeys[key], value);
  };

  return [prefs, update] as const;
}

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
  commands,
}: Props) {
  const [prefs, setPref] = useSettingsPreferences();
  const [developerMode, setDeveloperMode] = useState(isDeveloperModeEnabled());
  const [developerLogVersion, setDeveloperLogVersion] = useState(0);

  const [serverLogPath, setServerLogPath] = useState("");
  const [serverLogEntries, setServerLogEntries] = useState<
    FrontendDiagnosticEntry[]
  >([]);
  const [makerRootSettings, setMakerRootSettings] = useState<MakerProjectsRootSettings>();
  const [makerRootDraft, setMakerRootDraft] = useState("");
  const [makerRootNotice, setMakerRootNotice] = useState("");

  const developerLogs = formatDeveloperLogsForDisplay();
  const serverLogs = formatDiagnosticEntries(serverLogEntries);
  const visibleLogs = serverLogs || developerLogs;
  const developerLogCount = Math.max(
    getDeveloperLogEntries().length,
    serverLogEntries.length,
  );

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

  useEffect(() => {
    let cancelled = false;
    getMakerProjectsRootSettings()
      .then((response) => {
        if (cancelled) return;
        setMakerRootSettings(response.settings);
        setMakerRootDraft(response.settings.rootPath);
      })
      .catch(() => {
        if (!cancelled) setMakerRootNotice("无法读取 Maker 项目根目录设置");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveMakerRoot = async () => {
    const nextRoot = makerRootDraft.trim();
    if (!nextRoot) return;
    setMakerRootNotice("正在保存并重新扫描项目...");
    try {
      const response = await saveMakerProjectsRootSettings(nextRoot);
      setMakerRootSettings(response.settings);
      setMakerRootDraft(response.settings.rootPath);
      if (response.projects) onProjectsRootChanged?.(response.projects, response.selectedProjectId);
      setMakerRootNotice(`已更新 Maker 项目根目录：${response.settings.rootPath}`);
    } catch (error) {
      setMakerRootNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const refreshServerLogs = async () => {
    try {
      const response = await listFrontendDiagnostics();
      setServerLogPath(response.logPath);
      setServerLogEntries(response.entries);
    } catch {
      setServerLogPath("");
    }
  };

  useEffect(() => {
    const retention = prefs.logRetention;
    if (!shouldApplyServerLogRetention(retention)) return;

    let cancelled = false;
    const applyRetention = async () => {
      await clearFrontendDiagnostics(retention).catch(() => undefined);
      if (!cancelled) {
        await refreshServerLogs();
      }
    };

    void applyRetention();
    return () => {
      cancelled = true;
    };
  }, [prefs.logRetention]);

  useEffect(() => {
    let cancelled = false;
    const refreshLogs = async () => {
      try {
        const response = await listFrontendDiagnostics();
        if (cancelled) return;
        setServerLogPath(response.logPath);
        setServerLogEntries(response.entries);
      } catch {
        if (!cancelled) setServerLogPath("");
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
    clearDeveloperLogEntries();
    setServerLogEntries([]);
    await clearFrontendDiagnostics("all").catch(() => undefined);
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
        serverLogPath,
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-app">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-12 pb-32 scrollbar-thin flex flex-col gap-12 max-w-4xl mx-auto w-full pt-12">

            {/* General */}
            <div id="settings-general" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="通用" icon={<Settings />} description="基础应用行为偏好。" />
              <SettingsGroup>
                <SegmentedSetting
                  label="启动时打开"
                  value={prefs.startupPreference}
                  options={[{label: "上次的项目", value: "last-project"}, {label: "主页", value: "home"}, {label: "项目选择器", value: "home-picker"}]}
                  onChange={(v) => setPref("startupPreference", v as any)}
                />
                <SegmentedSetting
                  label="默认工作区"
                  value={prefs.defaultWorkspace}
                  options={[{label: "资产库", value: "assets"}, {label: "视频", value: "studio-video"}, {label: "图像", value: "studio-image"}, {label: "音频", value: "studio-music"}, {label: "3D", value: "studio-3d"}]}
                  onChange={(v) => setPref("defaultWorkspace", v as any)}
                />
                <SegmentedSetting
                  label="UI 密度"
                  value={prefs.density}
                  options={[{label: "宽松", value: "comfortable"}, {label: "标准", value: "standard"}, {label: "紧凑", value: "compact"}]}
                  onChange={(v) => setPref("density", v as any)}
                />
                <SegmentedSetting
                  label="危险操作确认强度"
                  value={prefs.confirmationPreference}
                  options={[{label: "标准", value: "standard"}, {label: "严格", value: "strict"}]}
                  onChange={(v) => setPref("confirmationPreference", v as any)}
                />
              </SettingsGroup>

              <SectionHeader title="全局侧边栏偏好" icon={<Monitor />} description="默认的侧栏开合策略。" />
              <SettingsGroup>
                <SegmentedSetting
                  label="左栏默认状态"
                  value={prefs.sidebarPreference}
                  options={[{label: "记住状态", value: "remember"}, {label: "始终展开", value: "expanded"}, {label: "始终折叠", value: "collapsed"}]}
                  onChange={(v) => setPref("sidebarPreference", v as any)}
                />
                <SegmentedSetting
                  label="右栏 (Inspector) 默认状态"
                  value={prefs.inspectorPreference}
                  options={[{label: "记住状态", value: "remember"}, {label: "始终展开", value: "expanded"}, {label: "始终折叠", value: "collapsed"}]}
                  onChange={(v) => setPref("inspectorPreference", v as any)}
                />
              </SettingsGroup>
            </div>

            {/* Appearance */}
            <div id="settings-appearance" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="外观" icon={<Palette />} description="软件界面及代码编辑器样式主题。" />
              <SettingsGroup preview={<WorkbenchPreview prefs={prefs} />}>
                <ThemeSelectorPreview prefs={prefs} onChange={(v) => setPref("themePreference", v as any)} />
              </SettingsGroup>

              <SectionHeader title="代码编辑器" icon={<Code />} description="内置代码及文本编辑器视图偏好。" />
              <SettingsGroup preview={<CodeEditorPreview prefs={prefs} />}>
                <SegmentedSetting
                  label="编辑器主题"
                  value={prefs.codeEditorTheme}
                  options={[{label: "跟随主应用", value: "app"}, {label: "浅色", value: "light"}, {label: "深色", value: "dark"}, {label: "高对比度", value: "high-contrast"}]}
                  onChange={(v) => setPref("codeEditorTheme", v as any)}
                />
                <SegmentedSetting
                  label="字体大小"
                  value={prefs.codeEditorFontSize}
                  options={[{label: "小", value: "small"}, {label: "标准", value: "standard"}, {label: "大", value: "large"}]}
                  onChange={(v) => setPref("codeEditorFontSize", v as any)}
                />
                <SwitchSetting
                  label="自动换行"
                  checked={prefs.codeEditorWrap === "wrap"}
                  onChange={(v) => setPref("codeEditorWrap", v ? "wrap" : "scroll")}
                />
                <SwitchSetting
                  label="显示行号"
                  checked={prefs.codeEditorLineNumbers === "show"}
                  onChange={(v) => setPref("codeEditorLineNumbers", v ? "show" : "hide")}
                />
              </SettingsGroup>
            </div>

            {/* Personalization (Prototype) */}
            <div id="settings-personalization" className="scroll-mt-12 flex flex-col gap-6 opacity-60 grayscale pointer-events-none">
              <SectionHeader title="个性化" icon={<Bot />} badge="雏形" description="AI 智能助手的偏好与自定义指令。" />
              <SettingsGroup>
                <PreferenceNote text="该分类仍在开发中，以下为界面原型预览。" />
                <SegmentedSetting label="默认模型偏好" value="gemini" options={[{label: "Gemini 1.5 Pro", value: "gemini"}, {label: "Claude 3.5 Sonnet", value: "claude"}]} onChange={() => {}} />
                <SwitchSetting label="自动附加项目上下文" checked={true} onChange={() => {}} />
                <SettingContainer label="自定义指令" description="助手生成代码和思考时的基础规则">
                   <Button variant="outline" size="sm">编辑规则 (0)</Button>
                </SettingContainer>
              </SettingsGroup>
            </div>

            {/* Shortcuts (Prototype) */}
            <div id="settings-shortcuts" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="快捷键" icon={<Keyboard />} badge="只读" description="查看当前可用命令与快捷键，改键能力待接入。" />
              <SettingsGroup>
                <PreferenceNote text="这里读取真实命令注册表；当前仅用于查看，不会修改快捷键绑定。" />
                <CommandShortcutList commands={commands} />
              </SettingsGroup>
            </div>

            {/* Browser (Prototype) */}
            <div id="settings-browser" className="scroll-mt-12 flex flex-col gap-6 opacity-60 grayscale pointer-events-none">
              <SectionHeader title="浏览器" icon={<MonitorCog />} badge="雏形" description="内置 Chromium 浏览器设置。" />
              <SettingsGroup>
                <PreferenceNote text="此功能暂未开放配置。" />
                <SwitchSetting label="禁用同源策略 (CORS)" checked={false} onChange={() => {}} />
                <SwitchSetting label="默认清空缓存并硬性重新加载" checked={true} onChange={() => {}} />
              </SettingsGroup>
            </div>

            {/* Permissions (Prototype) */}
            <div id="settings-permissions" className="scroll-mt-12 flex flex-col gap-6 opacity-60 grayscale pointer-events-none">
              <SectionHeader title="权限" icon={<Shield />} badge="待接入" description="管理 MCP 工具的自动审批与访问策略。" />
              <SettingsGroup>
                <PreferenceNote text="文件及命令审计系统开发中。" />
                <SettingContainer label="工作区访问策略" description="定义智能助手读写文件的范围和确认机制。">
                   <Button variant="outline" size="sm">管理策略</Button>
                </SettingContainer>
                <SwitchSetting label="执行终端命令前总是询问" checked={true} onChange={() => {}} />
              </SettingsGroup>
            </div>

            {/* Project Preferences */}
            <div id="settings-project" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="项目偏好" icon={<FolderCog />} description="当前打开项目的相关行为。" />
              <SettingsGroup>
                <SwitchSetting label="打开被隐藏的旧版工作区" checked={prefs.openHiddenLegacyWorkspaces} onChange={(v) => setPref("openHiddenLegacyWorkspaces", v)} />
                <SettingContainer
                  label="Maker 项目根目录"
                  description={
                    <div className="flex flex-col gap-1">
                      <span>扫描项目和删除本地项目文件夹时都会使用该根目录作为边界。</span>
                      <span className="font-mono text-[11px] text-text-subtle">
                        来源：{makerRootSettings?.source ?? "-"} · 当前状态：{makerRootSettings?.exists ? "目录存在" : "目录不存在"}
                      </span>
                      {makerRootSettings?.envRootPath ? (
                        <span className="font-mono text-[11px] text-text-subtle">TAPTAP_MAKER_PROJECTS_ROOT={makerRootSettings.envRootPath}</span>
                      ) : null}
                      {makerRootNotice ? <span className="text-[11px] text-text-subtle">{makerRootNotice}</span> : null}
                    </div>
                  }
                >
                  <div className="flex min-w-[320px] max-w-[520px] items-center gap-2">
                    <input
                      value={makerRootDraft}
                      onChange={(event) => setMakerRootDraft(event.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-control border border-border bg-surface-app px-3 font-mono text-[11px] text-text outline-none focus:border-brand"
                      placeholder={makerRootSettings?.defaultRootPath ?? "Maker projects root"}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleSaveMakerRoot()}
                      disabled={!makerRootDraft.trim() || makerRootDraft.trim() === makerRootSettings?.rootPath}
                    >
                      保存
                    </Button>
                  </div>
                </SettingContainer>
              </SettingsGroup>
            </div>

            {/* Workspaces */}
            <div id="settings-workspaces" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="工作区默认值" icon={<Box />} description="所有新项目的全局初始化规则与默认模型设置。" />
              <SettingsGroup>
                <WorkspaceDefaultsPreview prefs={prefs} />
              </SettingsGroup>

              <SettingsGroup>
                <SettingContainer label={<span className="font-bold">图像生成默认值</span>} note>
                  <Palette className="w-4 h-4 text-brand" />
                </SettingContainer>
                <SegmentedSetting label="默认模型" value={prefs.imageModel} options={[{label: "自动", value: "auto"}, {label: "NanoBanana", value: "nanobanana"}, {label: "GPT", value: "gpt"}]} onChange={(v) => setPref("imageModel", v as any)} />
                <SegmentedSetting label="清晰度" value={prefs.imageResolution} options={[{label: "0.5K", value: "0.5K"}, {label: "1K", value: "1K"}, {label: "2K", value: "2K"}, {label: "4K", value: "4K"}]} onChange={(v) => setPref("imageResolution", v as any)} />
                <SegmentedSetting label="推理深度" value={prefs.imageThinkingLevel} options={[{label: "极速", value: "minimal"}, {label: "深度", value: "high"}]} onChange={(v) => setPref("imageThinkingLevel", v as any)} />
              </SettingsGroup>

              <SettingsGroup>
                <SettingContainer label={<span className="font-bold">视频生成默认值</span>} note>
                  <PlaySquare className="w-4 h-4 text-brand" />
                </SettingContainer>
                <SegmentedSetting label="默认模型" value={prefs.videoModel} options={[{label: "默认", value: "default"}, {label: "极速模式", value: "fast"}]} onChange={(v) => setPref("videoModel", v as any)} />
                <SegmentedSetting label="视频分辨率" value={prefs.videoResolution} options={[{label: "480p", value: "480p"}, {label: "720p", value: "720p"}]} onChange={(v) => setPref("videoResolution", v as any)} />
                <SwitchSetting label="生成配套音效" checked={prefs.videoGenerateAudio} onChange={(v) => setPref("videoGenerateAudio", v)} />
                <SwitchSetting label="启用联网搜索补充上下文" checked={prefs.videoEnableWebSearch} onChange={(v) => setPref("videoEnableWebSearch", v)} />
              </SettingsGroup>

              <SettingsGroup>
                <SettingContainer label={<span className="font-bold">音乐生成默认值</span>} note>
                  <Globe className="w-4 h-4 text-brand" />
                </SettingContainer>
                <SegmentedSetting label="引擎版本" value={prefs.musicModel} options={[{label: "V3.5", value: "V3_5"}, {label: "V4", value: "V4"}, {label: "V4.5", value: "V4_5"}, {label: "V5", value: "V5"}]} onChange={(v) => setPref("musicModel", v as any)} />
                <SwitchSetting label="纯音乐 (Instrumental)" checked={prefs.musicInstrumental} onChange={(v) => setPref("musicInstrumental", v)} />
              </SettingsGroup>

              <SettingsGroup>
                <SettingContainer label={<span className="font-bold">3D 生成默认值</span>} note>
                  <Box className="w-4 h-4 text-brand" />
                </SettingContainer>
                <SegmentedSetting label="贴图质量" value={prefs.model3dTextureQuality} options={[{label: "标准", value: "standard"}, {label: "精细", value: "detailed"}]} onChange={(v) => setPref("model3dTextureQuality", v as any)} />
                <SwitchSetting label="自动生成骨骼绑定 (Rig)" checked={prefs.model3dRig} onChange={(v) => setPref("model3dRig", v)} />
              </SettingsGroup>
            </div>

            {/* Canvas */}
            <div id="settings-canvas" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="画布" icon={<Workflow />} description="节点编辑器行为偏好。" />
              <SettingsGroup preview={<CanvasPreview prefs={prefs} />}>
                <SwitchSetting label="显示网格背景" checked={prefs.canvasGrid === "visible"} onChange={(v) => setPref("canvasGrid", v ? "visible" : "hidden")} />
                <SwitchSetting label="显示迷你地图 (MiniMap)" checked={prefs.canvasMiniMap === "visible"} onChange={(v) => setPref("canvasMiniMap", v ? "visible" : "hidden")} />
                <SwitchSetting label="画布更改自动保存" checked={prefs.canvasAutoSave === "on"} onChange={(v) => setPref("canvasAutoSave", v ? "on" : "off")} />
                <SegmentedSetting
                  label="进入画布时侧边栏折叠"
                  value={prefs.canvasSidebarBehavior}
                  options={[{label: "保持原状", value: "keep"}, {label: "折叠左侧", value: "collapse-left"}, {label: "折叠两侧", value: "collapse-both"}]}
                  onChange={(v) => setPref("canvasSidebarBehavior", v as any)}
                />
                <SwitchSetting
                  label="离开画布时恢复侧栏状态"
                  checked={prefs.canvasLeaveBehavior === "restore"}
                  onChange={(v) => setPref("canvasLeaveBehavior", v ? "restore" : "keep")}
                />
              </SettingsGroup>
            </div>

            {/* Assets */}
            <div id="settings-assets" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="资产" icon={<Images />} description="素材库与文件流转行为偏好。" />
              <SettingsGroup preview={<AssetDropPreview prefs={prefs} />}>
                <SegmentedSetting
                  label="外部拖入资产时"
                  value={prefs.assetDropBehavior}
                  options={[{label: "自动复制到项目", value: "copy"}, {label: "每次询问", value: "ask"}]}
                  onChange={(v) => setPref("assetDropBehavior", v as any)}
                />
                <SegmentedSetting
                  label="移动/删除资产前"
                  value={prefs.assetReferenceCheck}
                  options={[{label: "扫描依赖引用", value: "scan"}, {label: "跳过检查", value: "skip"}]}
                  onChange={(v) => setPref("assetReferenceCheck", v as any)}
                />
              </SettingsGroup>
            </div>

            {/* Tasks */}
            <div id="settings-tasks" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="任务" icon={<Grid3X3 />} description="任务面板展现与通知策略。" />
              <SettingsGroup preview={<TaskInspectorPreview prefs={prefs} />}>
                <SegmentedSetting
                  label="点击任务默认展示"
                  value={prefs.taskDefaultPanel}
                  options={[{label: "状态", value: "status"}, {label: "日志", value: "logs"}, {label: "错误", value: "errors"}]}
                  onChange={(v) => setPref("taskDefaultPanel", v as any)}
                />
                <SwitchSetting label="开启任务异常桌面通知" checked={prefs.failureNotifications} onChange={(v) => setPref("failureNotifications", v)} />
                <SwitchSetting label="任务失败时自动弹出错误日志" checked={prefs.autoOpenErrors} onChange={(v) => setPref("autoOpenErrors", v)} />
                <SwitchSetting label="生成类任务完成后自动刷新" checked={prefs.taskCompletionRefresh === "on"} onChange={(v) => setPref("taskCompletionRefresh", v ? "on" : "off")} />
              </SettingsGroup>
            </div>

            {/* Runtime */}
            <div id="settings-runtime" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="Runtime" icon={<Cpu />} description="MCP 运行时控制。" />
              <SettingsGroup>
                <SegmentedSetting
                  label="自动启动策略"
                  value={prefs.autoRuntime}
                  options={[{label: "手动控制", value: "manual"}, {label: "选中项目后启动", value: "selected-project"}]}
                  onChange={(v) => setPref("autoRuntime", v as any)}
                />
                <SettingContainer label="服务管理" description="管理当前项目的运行时进程。">
                   <div className="flex gap-2">
                     <Button variant="outline" size="sm" onClick={onStartRuntime} disabled={busy || runtime?.status === "ready"}>
                       <Play className="w-3.5 h-3.5 mr-1" />
                       启动
                     </Button>
                     <Button variant="outline" size="sm" onClick={onStopRuntime} disabled={busy || runtime?.status === "idle"}>
                       <Square className="w-3.5 h-3.5 mr-1" />
                       停止
                     </Button>
                     <Button variant="outline" size="sm" onClick={onRefreshTools} disabled={busy}>
                       <RefreshCw className="w-3.5 h-3.5 mr-1" />
                       重载 Tools
                     </Button>
                   </div>
                </SettingContainer>
              </SettingsGroup>
            </div>

            {/* Logs */}
            <div id="settings-logs" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="日志与通知" icon={<Bell />} description="软件诊断日志及运行记录留存策略。" />
              <SettingsGroup>
                <SettingContainer label="高级诊断报告" description="打包当前软件、MCP Runtime 与项目上下文快照。">
                  <Button variant="outline" size="sm" onClick={handleExportLogs}>
                    <Download className="w-3.5 h-3.5 mr-1" /> 导出诊断包
                  </Button>
                </SettingContainer>
                <SettingContainer label="本地运行日志缓存" description={`当前已缓存 ${developerLogCount} 条开发者日志记录`}>
                  <Button variant="outline" size="sm" onClick={() => void handleClearLogs()} className="hover:text-red-400 hover:border-red-400">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> 清空日志
                  </Button>
                </SettingContainer>
                <SegmentedSetting
                  label="诊断日志保留策略"
                  value={prefs.logRetention}
                  options={[{label: "14 天", value: "14d"}, {label: "30 天", value: "30d"}, {label: "100 MB", value: "100mb"}, {label: "手动", value: "manual"}]}
                  onChange={(v) => setPref("logRetention", v as any)}
                />
              </SettingsGroup>
            </div>

            {/* Developer */}
            <div id="settings-developer" className="scroll-mt-12 flex flex-col gap-6">
              <SectionHeader title="Developer" icon={<Bug />} description="供开发者或高级用户使用的实验性功能。" />
              <SettingsGroup>
                <SwitchSetting label="启用开发者模式" description="开启后将记录更详尽的系统级调试日志" checked={developerMode} onChange={(val) => setDeveloperModeEnabled(val)} />
                <SettingContainer label="Chromium DevTools" description="开启内置浏览器及前端环境的检查器">
                  <Button variant="outline" size="sm" onClick={() => void openDesktopDevtools()}>
                    <Terminal className="w-3.5 h-3.5 mr-1" />
                    Open Devtools
                  </Button>
                </SettingContainer>
              </SettingsGroup>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------
// Components
// ---------------------------------------------------------

function SectionHeader({ title, icon, description, badge }: { title: string; icon: React.ReactNode; description: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1.5 pb-2">
      <div className="flex items-center gap-2">
        <div className="text-text">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-[18px] h-[18px]" })}</div>
        <h2 className="text-base font-semibold text-text m-0">{title}</h2>
        {badge && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">{badge}</span>}
      </div>
      <p className="text-[13px] text-text-subtle m-0 leading-relaxed">{description}</p>
    </div>
  );
}

function SettingsGroup({ children, preview }: { children: React.ReactNode; preview?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row rounded-xl border border-border-soft bg-surface-panel shadow-sm overflow-hidden items-stretch">
      {preview && (
        <div className="w-full md:w-[320px] shrink-0 border-b md:border-b-0 md:border-r border-border-soft bg-surface-muted/10 flex flex-col items-center justify-center p-6 relative">
          {preview}
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0 justify-center">
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

function CommandShortcutList({ commands }: { commands: Command[] }) {
  const sortedCommands = [...commands].sort((a, b) => {
    const aHasShortcut = commandShortcuts(a.shortcut, a.shortcuts).length > 0;
    const bHasShortcut = commandShortcuts(b.shortcut, b.shortcuts).length > 0;
    if (aHasShortcut !== bHasShortcut) return aHasShortcut ? -1 : 1;
    return a.title.localeCompare(b.title, "zh-CN");
  });

  return (
    <div className="flex max-h-[460px] flex-col overflow-y-auto border-t border-border-soft text-sm scrollbar-thin">
      {sortedCommands.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-text-muted">暂无可用命令</div>
      ) : (
        sortedCommands.map((command) => {
          const shortcuts = commandShortcuts(command.shortcut, command.shortcuts);
          const scopeLabel = Array.isArray(command.scope) ? command.scope.join(" / ") : command.scope;
          return (
            <div
              key={command.commandId}
              className="grid gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-surface-muted/30 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-text">{command.title}</span>
                  <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-subtle">
                    {scopeLabel}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] font-mono text-text-muted">{command.commandId}</div>
                {command.description ? (
                  <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{command.description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-start gap-1.5 md:max-w-[260px] md:justify-end">
                {shortcuts.length > 0 ? (
                  shortcuts.map((shortcut) => (
                    <kbd
                      key={`${command.commandId}-${formatShortcut(shortcut)}`}
                      className="rounded border border-border-soft bg-surface-app px-2 py-1 text-[11px] font-semibold text-text shadow-sm"
                    >
                      {formatShortcut(shortcut)}
                    </kbd>
                  ))
                ) : (
                  <span className="rounded border border-dashed border-border-soft px-2 py-1 text-[11px] text-text-muted">
                    未绑定
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SwitchSetting({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingContainer label={label} description={description}>
      <Switch checked={checked} onChange={onChange} />
    </SettingContainer>
  );
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

function formatDiagnosticEntries(entries: FrontendDiagnosticEntry[]) {
  if (!entries.length) return "";
  return entries.map(e => `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] ${e.message}`).join("\n");
}

// ---------------------------------------------------------
// Previews
// ---------------------------------------------------------

function ThemeSelectorPreview({ prefs, onChange }: { prefs: SettingsPreferences, onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4 p-8 items-center justify-center w-full">
       <ThemeCard type="system" label="跟随系统" active={prefs.themePreference === "system"} onClick={() => onChange("system")} />
       <ThemeCard type="light" label="浅色" active={prefs.themePreference === "light"} onClick={() => onChange("light")} />
       <ThemeCard type="dark" label="深色" active={prefs.themePreference === "dark"} onClick={() => onChange("dark")} />
    </div>
  );
}

function ThemeCard({ type, label, active, onClick }: { type: string, label: string, active: boolean, onClick: () => void }) {
  const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = type === "dark" || (type === "system" && isSystemDark);
  return (
    <div className="flex flex-col gap-2 items-center cursor-pointer" onClick={onClick}>
      <div className={cn("w-28 h-20 rounded-md border-2 p-1 overflow-hidden transition-all duration-200",
        active ? "border-brand ring-2 ring-brand/20" : "border-border-soft hover:border-text-muted",
        isDark ? "bg-[#1e1e1e]" : "bg-gray-100"
      )}>
        <div className={cn("w-full h-full rounded flex flex-col gap-1 p-1", isDark ? "bg-[#252526]" : "bg-white")}>
           <div className={cn("w-full h-2.5 rounded-sm flex items-center px-1 gap-1", isDark ? "bg-[#333]" : "bg-gray-200")}>
              <div className={cn("w-1 h-1 rounded-full", isDark ? "bg-[#555]" : "bg-gray-400")}></div>
              <div className={cn("w-1 h-1 rounded-full", isDark ? "bg-[#555]" : "bg-gray-400")}></div>
           </div>
           <div className="flex flex-1 gap-1">
              <div className={cn("w-1/3 h-full rounded-sm", isDark ? "bg-[#333]" : "bg-gray-200")}></div>
              <div className={cn("flex-1 h-full rounded-sm border", isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-gray-50 border-gray-200")}></div>
           </div>
        </div>
      </div>
      <span className={cn("text-[12px] font-medium transition-colors", active ? "text-brand" : "text-text-subtle")}>{label}</span>
    </div>
  );
}

function WorkbenchPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#1e1e1e]" : "bg-[#f3f4f6]";
  const border = isDark ? "border-[#333]" : "border-gray-200";
  const panelBg = isDark ? "bg-[#252526]" : "bg-white";
  const activeColor = isDark ? "bg-brand/30" : "bg-brand/20";
  const itemColor = isDark ? "bg-[#333]" : "bg-gray-100";

  const sidebarWidth = prefs.sidebarPreference === "collapsed" ? "w-4" : "w-12";
  const inspectorWidth = prefs.inspectorPreference === "collapsed" ? "w-0 overflow-hidden border-l-0" : "w-16";
  const itemHeight = prefs.density === "comfortable" ? "h-3" : prefs.density === "compact" ? "h-1.5" : "h-2";
  const gap = prefs.density === "comfortable" ? "gap-2" : prefs.density === "compact" ? "gap-0.5" : "gap-1";

  return (
    <div className="flex flex-col items-center justify-center w-full">
       <div className={cn("w-[240px] h-[140px] rounded-lg border-2 shadow-sm overflow-hidden flex flex-col transition-all duration-300", border, bg)}>
          {/* Topbar */}
          <div className={cn("h-4 w-full border-b flex items-center px-1 gap-1", border, panelBg)}>
             <div className={cn("w-1.5 h-1.5 rounded-full", itemColor)}></div>
             <div className={cn("w-1.5 h-1.5 rounded-full", itemColor)}></div>
             <div className="flex-1"></div>
             <div className={cn("w-4 h-1.5 rounded-full", itemColor)}></div>
          </div>
          {/* Main Area */}
          <div className="flex flex-1 min-h-0">
             {/* Sidebar */}
             <div className={cn("h-full border-r flex flex-col items-center pt-2 transition-all duration-300", border, panelBg, sidebarWidth, gap)}>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, activeColor)}></div>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
             </div>
             {/* Content */}
             <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                <div className={cn("w-full h-8 rounded border", border, panelBg)}></div>
                <div className={cn("w-full flex-1 rounded border", border, panelBg)}></div>
             </div>
             {/* Inspector */}
             <div className={cn("h-full border-l flex flex-col p-1.5 transition-all duration-300", border, panelBg, inspectorWidth, gap)}>
                <div className={cn("w-full rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-3/4 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-1/2 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
             </div>
          </div>
       </div>
    </div>
  );
}

function CodeEditorPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.codeEditorTheme === "dark" || prefs.codeEditorTheme === "high-contrast" || (prefs.codeEditorTheme === "app" && (prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)));
  const isHc = prefs.codeEditorTheme === "high-contrast";
  const bg = isHc ? "bg-black border-gray-600" : isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200";
  const text = isHc ? "text-white" : isDark ? "text-gray-300" : "text-gray-700";
  const keyword = isHc ? "text-pink-500" : isDark ? "text-[#c678dd]" : "text-blue-600";
  const stringColor = isHc ? "text-yellow-400" : isDark ? "text-[#98c379]" : "text-green-600";
  const lineNoColor = isHc ? "text-gray-400 border-gray-700" : isDark ? "text-gray-600 border-[#333]" : "text-gray-400 border-gray-200";
  const lineBg = isHc ? "bg-gray-900" : isDark ? "bg-[#252526]" : "bg-gray-50";
  const headerBg = isHc ? "bg-gray-800" : isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  const textSize = prefs.codeEditorFontSize === "small" ? "text-[10px]" : prefs.codeEditorFontSize === "large" ? "text-[14px]" : "text-[12px]";
  const wrap = prefs.codeEditorWrap === "wrap" ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-hidden";

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className={cn("w-[260px] rounded-lg border shadow-sm flex flex-col overflow-hidden transition-all duration-300", bg)}>
        <div className={cn("h-6 w-full flex items-center px-2 gap-1.5 border-b border-inherit", headerBg)}>
           <div className="w-2 h-2 rounded-full bg-red-400/80"></div>
           <div className="w-2 h-2 rounded-full bg-yellow-400/80"></div>
           <div className="w-2 h-2 rounded-full bg-green-400/80"></div>
           <div className="flex-1 text-center text-[9px] font-medium opacity-60">example.js</div>
        </div>
        <div className={cn("flex font-mono leading-relaxed transition-all duration-300", textSize)}>
          {prefs.codeEditorLineNumbers === "show" && (
            <div className={cn("flex flex-col items-end px-2 py-2 border-r shrink-0 select-none", lineBg, lineNoColor)}>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              {prefs.codeEditorWrap === "wrap" ? <><span>4</span><span>5</span></> : <span>4</span>}
            </div>
          )}
          <div className={cn("flex-1 p-2", wrap, text)}>
            <div><span className={keyword}>function</span> demoSettings() {'{'}</div>
            <div className="pl-4"><span className={keyword}>const</span> sample = <span className={stringColor}>"A long string to demonstrate wrapping..."</span>;</div>
            <div className="pl-4">console.log(sample);</div>
            <div className="pl-4">return true;</div>
            <div>{'}'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CanvasPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#121212]" : "bg-gray-100";
  const nodeBg = isDark ? "bg-[#2a2a2a] border-[#444]" : "bg-white border-gray-300";
  const grid = prefs.canvasGrid === "visible" ? (isDark ? "[background-size:8px_8px] [background-image:radial-gradient(#444_1px,transparent_1px)]" : "[background-size:8px_8px] [background-image:radial-gradient(#ccc_1px,transparent_1px)]") : "";
  const sideWidth = prefs.canvasSidebarBehavior === "collapse-both" ? "w-0 border-0" : prefs.canvasSidebarBehavior === "collapse-left" ? "w-0 border-0" : "w-10";
  const sideRightWidth = prefs.canvasSidebarBehavior === "collapse-both" ? "w-0 border-0" : "w-12";
  const border = isDark ? "border-[#333]" : "border-gray-200";

  return (
    <div className="flex flex-col items-center justify-center w-full">
       <div className={cn("w-[260px] h-[140px] rounded-lg border-2 shadow-sm overflow-hidden flex transition-all duration-300", isDark ? "border-[#444]" : "border-gray-300", isDark ? "bg-[#1e1e1e]" : "bg-white")}>
          {/* Left Sidebar */}
          <div className={cn("h-full border-r transition-all duration-300 flex flex-col p-1 gap-1", border, isDark ? "bg-[#252526]" : "bg-gray-50", sideWidth, prefs.canvasSidebarBehavior === "keep" ? "opacity-100" : "opacity-0 overflow-hidden p-0")}>
             <div className={cn("w-full h-2 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
             <div className={cn("w-full h-2 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
          </div>
          {/* Canvas Area */}
          <div className={cn("flex-1 relative overflow-hidden transition-all duration-300", bg, grid)}>
             {/* Nodes */}
             <div className={cn("absolute top-3 left-4 w-12 h-6 rounded border shadow-sm", nodeBg)}></div>
             <div className={cn("absolute top-10 left-16 w-14 h-8 rounded border shadow-sm", nodeBg)}></div>
             {/* Line */}
             <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
               <path d="M 28 20 C 40 20, 40 40, 64 40" fill="none" stroke={isDark ? "#888" : "#999"} strokeWidth="1.5" />
             </svg>
             {/* Minimap */}
             {prefs.canvasMiniMap === "visible" && (
                <div className={cn("absolute bottom-1 right-1 w-10 h-8 rounded border shadow-sm bg-black/5 dark:bg-white/5", isDark ? "border-[#444]" : "border-gray-300")}>
                   <div className="absolute top-1 left-1 w-2 h-1 bg-brand/50 rounded-sm"></div>
                   <div className="absolute top-3 left-3 w-3 h-1.5 bg-brand/50 rounded-sm"></div>
                   <div className="absolute top-0 left-0 w-6 h-5 border border-brand/80 bg-brand/10"></div>
                </div>
             )}
          </div>
          {/* Right Sidebar */}
          <div className={cn("h-full border-l transition-all duration-300 flex flex-col p-1 gap-1", border, isDark ? "bg-[#252526]" : "bg-gray-50", sideRightWidth, prefs.canvasSidebarBehavior === "collapse-both" ? "opacity-0 overflow-hidden p-0" : "opacity-100")}>
             <div className={cn("w-full h-1.5 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
             <div className={cn("w-2/3 h-1.5 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
          </div>
       </div>
    </div>
  );
}

function AssetDropPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const ask = prefs.assetDropBehavior === "ask";
  const scan = prefs.assetReferenceCheck === "scan";

  const boxBg = isDark ? "bg-[#252526] border-[#444]" : "bg-white border-gray-200";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => (t + 1) % 7), 1000);
    return () => clearInterval(timer);
  }, []);

  const fileX = tick <= 1 ? "16px" : ask ? "124px" : "232px";
  const fileOpacity = tick === 0 || tick >= 4 ? 0 : 1;

  const showDialog = ask && tick >= 3 && tick < 6;
  const flashFolder = !ask && tick === 3;

  const isScanning = scan && tick === 4;
  const showScanSuccess = scan && tick >= 5;

  return (
    <div className="flex flex-col items-center justify-center w-full gap-5 mt-2">
       <div className="flex items-center justify-between w-full max-w-[280px] relative">

          <div
             className="absolute top-4 z-20 w-8 h-8 rounded bg-brand flex items-center justify-center text-white shadow-md transition-all duration-700 ease-in-out"
             style={{ transform: `translateX(${fileX})`, opacity: fileOpacity }}
          >
             <Images className="w-4 h-4" />
          </div>

          <div className={cn("absolute left-1/2 -translate-x-1/2 -top-8 w-28 p-1.5 rounded shadow-xl border flex flex-col gap-1 transition-all duration-300 origin-bottom z-30",
             showDialog ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-4 pointer-events-none",
             isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200"
          )}>
             <div className="text-[10px] font-medium text-center mb-0.5 text-text">外部拖入资产</div>
             <div className="flex gap-1">
                <div className="flex-1 text-center bg-brand text-white text-[9px] py-0.5 rounded cursor-default">复制</div>
                <div className={cn("flex-1 text-center text-[9px] py-0.5 rounded cursor-default", isDark ? "bg-[#444] text-gray-300" : "bg-gray-100 text-gray-600")}>取消</div>
             </div>
          </div>

          <div className={cn("w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-text-subtle", isDark ? "border-gray-600 bg-gray-800/50" : "border-gray-300 bg-gray-50")}>
             <Images className={cn("w-5 h-5 mb-1 transition-opacity", tick === 0 ? "opacity-70" : "opacity-30")} />
             <span className="text-[9px] font-medium">外部文件</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative px-2">
             <div className="text-[10px] font-bold text-brand mb-1 whitespace-nowrap bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20 shadow-sm">
                {ask ? "每次询问" : "自动复制"}
             </div>
             <div className="w-full h-[2px] bg-brand/40 relative flex items-center justify-end">
                <div className="w-2 h-2 border-t-2 border-r-2 border-brand/40 rotate-45 -mr-[1px]"></div>
             </div>
          </div>

          <div className={cn("w-16 h-16 rounded-lg border flex flex-col items-center justify-center shadow-sm text-text transition-all duration-300", boxBg, flashFolder ? "scale-110 border-brand text-brand" : "")}>
             <FolderCog className="w-5 h-5 mb-1" />
             <span className="text-[9px] font-medium">项目资产</span>
          </div>
       </div>

       <div className={cn("w-full max-w-[280px] p-2.5 rounded border relative transition-all duration-300", boxBg, isScanning ? "border-brand/50" : "")}>
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                <RefreshCw className={cn("w-3.5 h-3.5", isScanning && "animate-spin text-brand")} /> 移动/删除检查
             </div>
             <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border transition-all duration-300",
               scan ? "text-gray-500 bg-gray-500/10 border-gray-500/20" : "text-gray-400 bg-transparent border-transparent"
             )}>
                {scan ? "扫描依赖" : "跳过检查"}
             </span>
          </div>

          <div className={cn("absolute bottom-[120%] left-1/2 -translate-x-1/2 w-48 p-1.5 rounded shadow-xl border flex flex-col gap-1 transition-all duration-300 origin-bottom z-30",
             isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200",
             showScanSuccess ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-4 pointer-events-none"
          )}>
             <div className="text-[10px] font-medium text-center text-orange-500 mb-0.5">⚠️ 发现依赖引用</div>
             <div className="text-[9px] text-center text-text-subtle mb-1">该资产被 'Scene_01' 等引用，是否继续？</div>
             <div className="flex gap-1">
                <div className="flex-1 text-center bg-orange-500 text-white text-[9px] py-0.5 rounded cursor-default">强制执行</div>
                <div className={cn("flex-1 text-center text-[9px] py-0.5 rounded cursor-default", isDark ? "bg-[#444] text-gray-300" : "bg-gray-100 text-gray-600")}>取消</div>
             </div>
          </div>
       </div>
    </div>
  );
}

function TaskInspectorPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#252526]" : "bg-white";
  const border = isDark ? "border-[#333]" : "border-gray-200";
  const headerBg = isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  const defaultTab = prefs.taskDefaultPanel;
  const autoErrors = prefs.autoOpenErrors;
  const notify = prefs.failureNotifications;
  const refresh = prefs.taskCompletionRefresh;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => (t + 1) % 6), 1200);
    return () => clearInterval(timer);
  }, []);

  const isFailed = tick >= 2;
  const showTab = (autoErrors && tick >= 3) ? "errors" : defaultTab;
  const showNotification = notify && tick >= 3 && tick < 5;

  const progress = tick === 0 ? 0 : 65;
  const statusLabel = isFailed ? "FAILED" : "RUNNING";
  const statusColor = isFailed ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500";
  const barColor = isFailed ? "bg-red-500" : "bg-brand";
  const timeStr = tick === 0 ? "0s" : tick === 1 ? "1m 24s" : "1m 25s";

  const tabStyle = (tabId: string) => cn(
    "flex-1 text-center py-2 border-b-2 text-[11px] font-medium transition-all duration-300",
    showTab === tabId ? "text-brand border-brand" : isDark ? "text-gray-500 border-transparent" : "text-gray-400 border-transparent"
  );

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className={cn("w-full max-w-[320px] h-[260px] rounded-lg border shadow-sm flex flex-col overflow-hidden transition-all duration-300 relative", bg, border, (showTab === "errors" && tick === 3) ? "ring-2 ring-red-500/50" : "")}>

         <div className={cn("absolute top-12 left-1/2 -translate-x-1/2 w-[240px] p-2 rounded shadow-xl border flex items-center gap-2 z-50 transition-all duration-300",
            isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200",
            showNotification ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
         )}>
            <div className="w-6 h-6 rounded bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
               <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-text">任务执行失败</span>
               <span className="text-[9px] text-text-subtle">Build Model_X 发生异常</span>
            </div>
         </div>

         <div className={cn("flex items-center justify-between px-3 py-2 border-b transition-colors", headerBg, border)}>
            <div className="text-[12px] font-medium text-text">任务详情</div>
            <div className="relative">
               <Bell className={cn("w-3.5 h-3.5 transition-colors duration-300", notify ? (showNotification ? "text-red-500 animate-pulse" : "text-brand") : "text-gray-400 opacity-50")} />
            </div>
         </div>

         <div className={cn("flex border-b", border)}>
           <div className={tabStyle("status")}>状态</div>
           <div className={tabStyle("logs")}>日志</div>
           <div className={tabStyle("errors")}>错误</div>
         </div>

         <div className="flex-1 flex flex-col p-3 relative h-full">
            {showTab === "status" && (
               <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded bg-brand/10 text-brand flex items-center justify-center")}>
                           <Cpu className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                           <div className="text-[11px] font-medium text-text">Build Model_X</div>
                           <div className="text-[9px] text-text-subtle">ID: TASK-8492</div>
                        </div>
                     </div>
                     <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors", statusColor)}>{statusLabel}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <div className="flex justify-between text-[10px] text-text-subtle">
                        <span>进度</span>
                        <span>{progress}%</span>
                     </div>
                     <div className={cn("w-full h-1.5 rounded-full overflow-hidden", isDark ? "bg-[#333]" : "bg-gray-200")}>
                        <div className={cn("h-full transition-all duration-500", barColor)} style={{ width: `${progress}%` }}></div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                     <div className={cn("p-1.5 rounded flex flex-col gap-0.5 transition-colors", isDark ? "bg-[#333]" : "bg-gray-100", isFailed ? "opacity-70" : "")}>
                        <span className="text-[9px] text-text-subtle">已耗时</span>
                        <span className="text-[11px] font-medium text-text">{timeStr}</span>
                     </div>
                     <div className={cn("p-1.5 rounded flex flex-col gap-0.5 transition-colors", isDark ? "bg-[#333]" : "bg-gray-100", isFailed ? "opacity-70" : "")}>
                        <span className="text-[9px] text-text-subtle">预估剩余</span>
                        <span className="text-[11px] font-medium text-text">{isFailed ? "--" : "~2m 10s"}</span>
                     </div>
                  </div>

                  {refresh !== "off" && (
                     <div className="mt-auto self-start flex items-center gap-1.5 text-[9px] text-brand bg-brand/10 px-1.5 py-1 rounded border border-brand/20">
                        <RefreshCw className="w-2.5 h-2.5" />
                        完成后刷新资产
                     </div>
                  )}
               </div>
            )}

            {showTab === "logs" && (
               <div className={cn("flex flex-col gap-1.5 font-mono text-[9px] leading-relaxed p-2 rounded h-full", isDark ? "bg-[#1e1e1e] text-gray-400" : "bg-gray-50 text-gray-500")}>
                  <div className="flex gap-2">
                     <span className="opacity-50">14:02:11</span>
                     <span>[INFO] Starting build...</span>
                  </div>
                  {tick >= 1 && (
                    <div className="flex gap-2">
                       <span className="opacity-50">14:02:12</span>
                       <span>[INFO] Analyzing dependencies...</span>
                    </div>
                  )}
                  {tick >= 2 && (
                    <div className="flex gap-2">
                       <span className="opacity-50">14:02:15</span>
                       <span className="text-red-500">[ERROR] Module not found!</span>
                    </div>
                  )}
               </div>
            )}

            {showTab === "errors" && (
               <div className="flex flex-col gap-2">
                  {isFailed ? (
                     <>
                        <div className="flex gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-500">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></div>
                           <div className="flex flex-col gap-1">
                              <span className="font-bold text-[11px]">Error: Module not found</span>
                              <span className="opacity-90">Cannot resolve dependency 'React' in /src/components</span>
                           </div>
                        </div>
                        <div className={cn("w-full py-1.5 mt-2 text-center text-[10px] font-medium rounded border cursor-default transition-colors", isDark ? "border-[#444] text-gray-300 bg-[#333]" : "border-gray-300 text-gray-700 bg-gray-100")}>
                           查看原始错误
                        </div>
                     </>
                  ) : (
                     <div className="flex items-center justify-center h-20 text-[10px] text-text-subtle">
                        暂无错误
                     </div>
                  )}
               </div>
            )}
         </div>
      </div>

      <div className={cn("mt-4 text-[10px] flex items-center gap-1.5 transition-opacity duration-300", autoErrors ? "text-text-subtle opacity-100" : "text-gray-500 opacity-30")}>
         <Info className={cn("w-3.5 h-3.5", autoErrors ? "text-brand" : "text-current")} /> 失败任务会自动切到错误页签
      </div>
    </div>
  );
}

function WorkspaceDefaultsPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const cardBg = isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200";
  const hoverBg = isDark ? "hover:bg-[#252526] hover:border-brand/50" : "hover:bg-gray-50 hover:border-brand/40";
  const artBg = isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  return (
    <div className="grid grid-cols-2 gap-4 p-5 border-b border-border-soft bg-surface-muted/10">

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden", cardBg, hoverBg)}>
          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 opacity-10 flex items-center justify-center rotate-12 pointer-events-none">
             <div className="w-12 h-16 border-[3px] border-current rounded absolute"></div>
             <div className="w-16 h-12 border-[3px] border-current rounded absolute rotate-12"></div>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500"><Images className="w-4 h-4" /></div> 图像生成
          </div>
          <div className="flex flex-col gap-1.5 z-10">
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">默认模型</span>
               <span className="text-text font-medium truncate max-w-[80px]">{prefs.imageModel}</span>
            </div>
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">清晰度</span>
               <span className="text-text font-medium">{prefs.imageResolution}</span>
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden", cardBg, hoverBg)}>
          <div className="absolute right-2 top-2 w-20 h-16 opacity-10 flex flex-col gap-2 items-end justify-center pointer-events-none">
             <div className="w-full h-2 rounded-full bg-current"></div>
             <div className="w-3/4 h-2 rounded-full bg-current"></div>
             <div className="w-5/6 h-2 rounded-full bg-current"></div>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500"><PlaySquare className="w-4 h-4" /></div> 视频生成
          </div>
          <div className="flex flex-col gap-1.5 z-10">
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">默认模型</span>
               <span className="text-text font-medium">{prefs.videoModel}</span>
            </div>
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">分辨率</span>
               <span className="text-text font-medium">{prefs.videoResolution}</span>
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden", cardBg, hoverBg)}>
          <div className="absolute right-2 top-4 w-20 h-12 opacity-10 flex items-center justify-end gap-1.5 pointer-events-none">
             <div className="w-1.5 h-6 bg-current rounded-full"></div>
             <div className="w-1.5 h-10 bg-current rounded-full"></div>
             <div className="w-1.5 h-4 bg-current rounded-full"></div>
             <div className="w-1.5 h-8 bg-current rounded-full"></div>
             <div className="w-1.5 h-5 bg-current rounded-full"></div>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-green-500/10 text-green-500"><Globe className="w-4 h-4" /></div> 音乐与音效
          </div>
          <div className="flex flex-col gap-1.5 z-10">
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">引擎版本</span>
               <span className="text-text font-medium">{prefs.musicModel}</span>
            </div>
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">纯音乐</span>
               <span className="text-text font-medium">{prefs.musicInstrumental ? "是" : "否"}</span>
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden", cardBg, hoverBg)}>
          <div className="absolute right-0 top-0 w-24 h-24 opacity-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(currentcolor 1px, transparent 1px), linear-gradient(90deg, currentcolor 1px, transparent 1px)", backgroundSize: "8px 8px", transform: "perspective(100px) rotateX(60deg) rotateZ(45deg)" }}></div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500"><Box className="w-4 h-4" /></div> 3D 模型
          </div>
          <div className="flex flex-col gap-1.5 z-10">
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">贴图质量</span>
               <span className="text-text font-medium">{prefs.model3dTextureQuality}</span>
            </div>
            <div className={cn("flex justify-between items-center text-[11px] p-1.5 px-2 rounded", artBg)}>
               <span className="text-text-subtle">骨骼绑定</span>
               <span className="text-text font-medium">{prefs.model3dRig ? "是" : "否"}</span>
            </div>
          </div>
       </div>
    </div>
  );
}
