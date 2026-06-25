import { useEffect, useState } from "react";
import {
  Bug,
  Copy,
  Cpu,
  Database,
  FileJson,
  ServerCog,
  Settings,
  Trash2,
  PlaySquare,
  X,
} from "lucide-react";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../../api";
import {
  clearFrontendDiagnostics,
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

type Props = { project?: ProjectSummary; runtime?: RuntimeSummary; tools: ToolSummary[] };

export function SettingsView({ project, runtime, tools }: Props) {
  const [showPreview, setShowPreview] = useState(false);
  const [developerMode, setDeveloperMode] = useState(isDeveloperModeEnabled);
  const [developerLogVersion, setDeveloperLogVersion] = useState(0);
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

  void developerLogVersion;

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="shrink-0">
        <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
          <Settings className="h-3.5 w-3.5" />
          Settings
        </span>
        <h1 className="m-0 text-xl font-bold text-text">运行与绑定状态</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsPanel icon={<ServerCog className="h-4 w-4" />} title="当前项目">
          <SettingRow label="项目名" value={project?.name ?? "-"} />
          <SettingRow label="项目路径" value={project?.rootPath ?? "-"} />
          <SettingRow label="project_id" value={project?.makerProjectId ?? "-"} />
          <SettingRow label="config.json" value={project?.configPath ?? "-"} />
        </SettingsPanel>

        <SettingsPanel icon={<Cpu className="h-4 w-4" />} title="MCP Runtime">
          <SettingRow label="状态" value={runtime?.status ?? "idle"} />
          <SettingRow label="processId" value={runtime?.processId ? String(runtime.processId) : "-"} />
          <SettingRow label="cwd" value={runtime?.cwd ?? project?.rootPath ?? "-"} />
          <SettingRow label="tools/list 更新时间" value={runtime?.toolsListUpdatedAt ?? "-"} />
          <SettingRow label="启动命令" value="cmd.exe /d /s /c npx.cmd -y -p @taptap/maker taptap-maker" />
        </SettingsPanel>

        <SettingsPanel icon={<FileJson className="h-4 w-4" />} title="真实 MCP Schema">
          <SettingRow label="工具总数" value={String(tools.length)} />
          {Object.entries(categories).map(([category, count]) => (
            <SettingRow key={category} label={category} value={`${count} tools`} />
          ))}
          <SettingRow label="表单来源" value="tools/list inputSchema" />
        </SettingsPanel>

        <SettingsPanel icon={<Database className="h-4 w-4" />} title="本地工作台能力">
          <SettingRow label="HTTP API" value="Fastify / 127.0.0.1:8787" />
          <SettingRow label="前端" value="React + Vite" />
          <SettingRow label="Schema Form" value="@rjsf/core + validator-ajv8" />
          <SettingRow label="Workflow Canvas" value="@xyflow/react" />
          <SettingRow label="Asset Table" value="@tanstack/react-table" />
        </SettingsPanel>

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
      </div>

      <RawViewer
        title="前端诊断日志"
        language="log"
        value={visibleLogs}
        emptyText="暂无前端错误、警告或请求失败日志。"
        copyLabel="复制日志"
        copySuccessMessage="诊断日志已复制"
        height="260px"
      />

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

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="shrink-0 text-xs font-semibold text-text-subtle">{label}</span>
      <strong className="min-w-0 truncate text-right text-xs font-semibold text-text" title={value}>{value}</strong>
    </div>
  );
}
