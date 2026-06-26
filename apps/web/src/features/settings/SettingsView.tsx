import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bug,
  Copy,
  Cpu,
  Database,
  Download,
  FileJson,
  FolderCog,
  RefreshCw,
  ServerCog,
  Settings,
  Square,
  Trash2,
  Play,
  PlaySquare,
  X,
} from "lucide-react";
import type { DesktopReadiness, ProjectHealthSummary, ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";
import {
  clearFrontendDiagnostics,
  getDesktopReadiness,
  getProjectHealth,
  listFrontendDiagnostics,
  type FrontendDiagnosticEntry,
} from "../../api";
import { RawViewer } from "../../components/developer";
import { Button } from "../../components/ui/Button";
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
  onExitSettings,
  onStartRuntime,
  onStopRuntime,
  onRefreshTools,
  onStatusLite,
}: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [developerMode, setDeveloperMode] = useState(isDeveloperModeEnabled);
  const [developerLogVersion, setDeveloperLogVersion] = useState(0);
  const [desktopReadiness, setDesktopReadiness] = useState<DesktopReadiness>();
  const [readinessError, setReadinessError] = useState("");
  const [projectHealth, setProjectHealth] = useState<ProjectHealthSummary>();
  const [projectHealthError, setProjectHealthError] = useState("");
  const [serverLogPath, setServerLogPath] = useState("");
  const [serverLogEntries, setServerLogEntries] = useState<
    FrontendDiagnosticEntry[]
  >([]);
  const categories = tools.reduce<Record<string, number>>((acc, tool) => {
    acc[tool.category] = (acc[tool.category] ?? 0) + 1;
    return acc;
  }, {});
  const developerLogs = formatDeveloperLogsForDisplay();
  const serverLogs = formatDiagnosticEntries(serverLogEntries);
  const visibleLogs = serverLogs || developerLogs;
  const developerLogCount = Math.max(
    getDeveloperLogEntries().length,
    serverLogEntries.length,
  );
  const runtimeActionLabel = runtime?.status === "ready" ? "重启 Runtime" : "启动 Runtime";

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

  const refreshDesktopReadiness = async () => {
    try {
      const response = await getDesktopReadiness();
      setDesktopReadiness(response);
      setReadinessError("");
    } catch (error) {
      setDesktopReadiness(undefined);
      setReadinessError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void refreshDesktopReadiness();
  }, []);

  const refreshProjectHealth = async (projectId: string) => {
    try {
      const response = await getProjectHealth(projectId);
      setProjectHealth(response.health);
      setProjectHealthError("");
    } catch (error) {
      setProjectHealth(undefined);
      setProjectHealthError(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    if (!project?.id) {
      setProjectHealth(undefined);
      setProjectHealthError("");
      return;
    }
    void refreshProjectHealth(project.id);
  }, [project?.id]);

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
    await clearFrontendDiagnostics().catch(() => undefined);
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
        desktopReadiness,
        projectHealth,
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

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-6">
      <div className="mb-4 flex shrink-0 items-start gap-3">
        {sidebarCollapsed ? (
          <button
            type="button"
            onClick={onExitSettings}
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            title="返回工作台"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            <Settings className="h-3.5 w-3.5" />
            Settings
          </span>
          <h1 className="m-0 text-xl font-bold text-text">设置中心</h1>
          <p className="mt-1 text-xs text-text-subtle">
            项目绑定、Runtime、MCP schema 与诊断日志集中管理。
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {activeTab === "project" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="当前项目">
                  <SettingRow label="项目名" value={project?.name ?? "-"} />
                  <SettingRow label="项目路径" value={project?.rootPath ?? "-"} />
                  <SettingRow label="project_id" value={project?.makerProjectId ?? "-"} />
                  <SettingRow label="config.json" value={project?.configPath ?? "-"} />
                </SettingsPanel>

                <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="项目健康">
                  <SettingRow label="root exists" value={formatHealthValue(projectHealth?.rootExists)} tone={projectHealth && !projectHealth.rootExists ? "bad" : "neutral"} />
                  <SettingRow label="config exists" value={formatHealthValue(projectHealth?.configExists)} tone={projectHealth && !projectHealth.configExists ? "bad" : "neutral"} />
                  <SettingRow label="config project_id" value={projectHealth?.configProjectId ?? "-"} tone={projectHealth?.configExists && !projectHealth?.configProjectId ? "bad" : "neutral"} />
                  <SettingRow label="project_id match" value={formatHealthValue(projectHealth?.projectIdMatches)} tone={projectHealth && !projectHealth.projectIdMatches ? "bad" : "neutral"} />
                  <SettingRow label="tools/list 更新时间" value={projectHealth?.toolsListUpdatedAt ?? "-"} />
                  <SettingRow label="maker package" value={projectHealth?.makerPackage ?? desktopReadiness?.env.TAPTAP_MAKER_PACKAGE ?? "-"} />
                  <SettingRow label="maker env" value={projectHealth?.makerEnv ?? desktopReadiness?.env.TAPTAP_MCP_ENV ?? "-"} />
                  {projectHealth?.configParseError ? (
                    <SettingRow label="config parse error" value={projectHealth.configParseError} tone="bad" />
                  ) : null}
                  {projectHealthError ? (
                    <SettingRow label="health error" value={projectHealthError} tone="bad" />
                  ) : null}
                  <div className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!project}
                      onClick={() => project?.id ? void refreshProjectHealth(project.id) : undefined}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      刷新健康状态
                    </Button>
                  </div>
                </SettingsPanel>

                <SettingsPanel icon={<Database className="h-4 w-4" />} title="本地工作台能力">
                  <SettingRow label="HTTP API" value={desktopReadiness ? `Fastify / ${desktopReadiness.server.host}:${desktopReadiness.server.port}` : "-"} />
                  <SettingRow label="mode" value={desktopReadiness?.mode ?? "-"} />
                  <SettingRow label="前端" value="React + Vite" />
                  <SettingRow label="Schema Form" value="@rjsf/core + validator-ajv8" />
                  <SettingRow label="Workflow Canvas" value="@xyflow/react" />
                  <SettingRow label="Asset Table" value="@tanstack/react-table" />
                  {readinessError ? <SettingRow label="readiness error" value={readinessError} tone="bad" /> : null}
                </SettingsPanel>

                <SettingsPanel icon={<FolderCog className="h-4 w-4" />} title="本地路径">
                  <SettingRow label="dataDir" value={desktopReadiness?.paths.dataDir ?? "-"} />
                  <SettingRow label="databasePath" value={desktopReadiness?.paths.databasePath ?? "-"} />
                  <SettingRow label="workspaceRoot" value={desktopReadiness?.paths.workspaceRoot ?? "-"} />
                  <SettingRow label="webDistDir" value={desktopReadiness?.paths.webDistDir ?? "-"} />
                  <SettingRow label="makerProjectsRoot" value={desktopReadiness?.paths.makerProjectsRoot ?? "-"} />
                  <SettingRow label="mcpLogDir" value={desktopReadiness?.paths.mcpLogDir ?? "-"} />
                  <SettingRow label="makerNpmCacheDir" value={desktopReadiness?.paths.makerNpmCacheDir ?? "-"} />
                </SettingsPanel>

                <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="环境变量">
                  <SettingRow label="TAPTAP_DATA_DIR" value={desktopReadiness?.env.TAPTAP_DATA_DIR ?? "-"} />
                  <SettingRow label="TAPTAP_WORKSPACE_ROOT" value={desktopReadiness?.env.TAPTAP_WORKSPACE_ROOT ?? "-"} />
                  <SettingRow label="TAPTAP_WEB_DIST_DIR" value={desktopReadiness?.env.TAPTAP_WEB_DIST_DIR ?? "-"} />
                  <SettingRow label="TAPTAP_MAKER_PROJECTS_ROOT" value={desktopReadiness?.env.TAPTAP_MAKER_PROJECTS_ROOT ?? "-"} />
                  <SettingRow label="TAPTAP_SERVER_HOST" value={desktopReadiness?.env.TAPTAP_SERVER_HOST ?? "-"} />
                  <SettingRow label="TAPTAP_SERVER_PORT" value={desktopReadiness?.env.TAPTAP_SERVER_PORT ?? "-"} />
                  <SettingRow label="TAPTAP_MAKER_NPM_CACHE_DIR" value={desktopReadiness?.env.TAPTAP_MAKER_NPM_CACHE_DIR ?? "-"} />
                  <SettingRow label="TAPTAP_MCP_LOG_DIR" value={desktopReadiness?.env.TAPTAP_MCP_LOG_DIR ?? "-"} />
                  <SettingRow label="TAPTAP_MCP_ENV" value={desktopReadiness?.env.TAPTAP_MCP_ENV ?? "-"} />
                  <SettingRow label="TAPTAP_MAKER_PACKAGE" value={desktopReadiness?.env.TAPTAP_MAKER_PACKAGE ?? "-"} />
                  <div className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => void refreshDesktopReadiness()}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      刷新配置
                    </Button>
                  </div>
                </SettingsPanel>
              </div>
            ) : null}

            {activeTab === "runtime" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="MCP Runtime">
                  <SettingRow label="状态" value={runtime?.status ?? "idle"} />
                  <SettingRow label="processId" value={runtime?.processId ? String(runtime.processId) : "-"} />
                  <SettingRow label="cwd" value={runtime?.cwd ?? project?.rootPath ?? "-"} />
                  <SettingRow label="tools/list 更新时间" value={runtime?.toolsListUpdatedAt ?? "-"} />
                  <SettingRow label="启动命令" value="cmd.exe /d /s /c npx.cmd -y -p @taptap/maker taptap-maker" />
                  <SettingRow label="TAPTAP_MCP_ENV" value={desktopReadiness?.env.TAPTAP_MCP_ENV ?? "-"} />
                  <SettingRow label="TAPTAP_MAKER_PACKAGE" value={desktopReadiness?.env.TAPTAP_MAKER_PACKAGE ?? "@taptap/maker"} />
                  <SettingRow label="npm cache" value={desktopReadiness?.paths.makerNpmCacheDir ?? "-"} />
                  <SettingRow label="MCP logs" value={desktopReadiness?.paths.mcpLogDir ?? "-"} />
                </SettingsPanel>

                <SettingsPanel icon={<RefreshCw className="h-4 w-4" />} title="运行时动作">
                  <div className="grid gap-2 p-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={!project || busy}
                      onClick={onStartRuntime}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {runtimeActionLabel}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!project || busy || runtime?.status === "idle"}
                      onClick={onStopRuntime}
                    >
                      <Square className="h-3.5 w-3.5" />
                      停止 Runtime
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!project || busy}
                      onClick={onRefreshTools}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      刷新 tools/list
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!project || busy}
                      onClick={onStatusLite}
                    >
                      <Cpu className="h-3.5 w-3.5" />
                      状态检查
                    </Button>
                  </div>
                  <p className="m-0 px-3 pb-3 text-[11px] leading-relaxed text-text-muted">
                    这些动作仍走现有 Fastify / MCP runtime 链路，不由浏览器直接启动 MCP。
                  </p>
                </SettingsPanel>
              </div>
            ) : null}

            {activeTab === "schema" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <SettingsPanel icon={<FileJson className="h-4 w-4" />} title="真实 MCP Schema">
                  <SettingRow label="工具总数" value={String(tools.length)} />
                  {Object.entries(categories).map(([category, count]) => (
                    <SettingRow key={category} label={category} value={`${count} tools`} />
                  ))}
                  <SettingRow label="表单来源" value="tools/list inputSchema" />
                </SettingsPanel>
              </div>
            ) : null}

            {activeTab === "diagnostics" ? (
              <div className="grid gap-4">
                <SettingsPanel icon={<Bug className="h-4 w-4" />} title="开发者模式">
          <div className="flex items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-text">允许 F12 打开 DevTools</div>
              <div className="mt-0.5 text-[11px] text-text-muted">
                仅用于本地调试；关闭后会拦截 F12 / Ctrl+Shift+I。
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={developerMode}
              className={`flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors ${
                developerMode
                  ? "border-brand/40 bg-brand/70"
                  : "border-border bg-surface-muted"
              }`}
              onClick={() => setDeveloperModeEnabled(!developerMode)}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  developerMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <SettingRow label="前端诊断日志" value={`${developerLogCount} 条`} />
          <SettingRow label="日志文件" value={serverLogPath || "等待 Fastify 连接"} />
          <SettingRow label="DevTools 状态" value={developerMode ? "F12 可用" : "F12 已拦截"} />
          <div className="flex flex-wrap gap-2 px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!developerMode}
              onClick={() => void openDesktopDevtools()}
            >
              <Bug className="h-3.5 w-3.5" />
              打开 DevTools
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowPreview(true)}
            >
              <PlaySquare className="h-3.5 w-3.5" />
              预览启动动画
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void refreshServerLogs()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新日志
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!visibleLogs.trim()}
              onClick={handleExportLogs}
            >
              <Download className="h-3.5 w-3.5" />
              导出日志
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                void copyText(visibleLogs, {
                  successMessage: "诊断日志已复制",
                  errorMessage: "复制诊断日志失败",
                })
              }
            >
              <Copy className="h-3.5 w-3.5" />
              复制日志
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1.5 text-text-muted"
              onClick={() => void handleClearLogs()}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </Button>
          </div>
                </SettingsPanel>

                <RawViewer
                  title="前端诊断日志"
                  language="log"
                  value={visibleLogs}
                  emptyText="暂无前端错误、警告或请求失败日志。"
                  copyLabel="复制日志"
                  copySuccessMessage="诊断日志已复制"
                  height="320px"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {runtime?.lastError ? (
        <div className="rounded-large border border-[#b03939]/25 bg-[#b03939]/5 p-4">
          <h2 className="m-0 mb-2 text-sm font-bold text-[#b03939]">Runtime Error</h2>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[#b03939]">{runtime.lastError}</pre>
        </div>
      ) : null}

      {showPreview && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
          <div className="relative flex h-14 items-center justify-end bg-black px-4 shadow-sm">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" />
              关闭预览
            </button>
          </div>
          <iframe
            src="/desktop-loading.html?preview=true"
            className="h-full w-full border-0 bg-white dark:bg-[#09090b]"
            title="Splash Preview"
          />
        </div>
      )}
    </section>
  );
}

function formatDiagnosticEntries(entries: FrontendDiagnosticEntry[]) {
  if (entries.length === 0) return "";
  return entries
    .slice()
    .reverse()
    .map((entry) => {
      const header = `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`;
      return entry.detail ? `${header}\n${entry.detail}` : header;
    })
    .join("\n\n");
}

function formatHealthValue(value?: boolean) {
  if (value === undefined) return "-";
  return value ? "yes" : "no";
}

function SettingsPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-control bg-brand/10 text-brand-strong">{icon}</div>
        <h2 className="m-0 text-sm font-bold text-text">{title}</h2>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function SettingRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="shrink-0 text-xs font-semibold text-text-subtle">{label}</span>
      <strong className={`min-w-0 truncate text-right text-xs font-semibold ${tone === "bad" ? "text-[#b03939]" : "text-text"}`} title={value}>{value}</strong>
    </div>
  );
}
