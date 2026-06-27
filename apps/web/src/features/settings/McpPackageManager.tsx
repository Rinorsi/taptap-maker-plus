import { useEffect, useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import {
  getMcpPackageStatus,
  installMcpPackage,
  uninstallMcpPackage,
  type McpPackageUninstallResult,
  type McpPackageUpdateStatus
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/SelectField";
import { cn } from "../../lib/utils";

type Props = {
  busy?: boolean;
  compact?: boolean;
};

const pendingUninstallSteps = [
  { id: "stop_runtime", label: "停止 MCP runtime", status: "done", detail: "正在请求停止当前 MCP runtime。" },
  { id: "clear_settings", label: "清理版本设置", status: "done", detail: "等待清理桌面端 MCP 包版本设置。" },
  { id: "clear_cache", label: "清理 npm-cache", status: "done", detail: "等待清理本地 MCP 包缓存。" },
  { id: "preserve_projects", label: "保留 Maker 项目", status: "done", detail: "不会删除 Maker 项目目录。" },
  { id: "ai_client_config", label: "AI client 配置", status: "skipped", detail: "不会改动 AI client 配置文件。" },
] as const;

function formatCheckNotice(status: McpPackageUpdateStatus) {
  if (!status.localInstalled) {
    return status.latestVersion
      ? `本地 MCP 未安装；云端最新版本为 ${status.latestVersion}，可以选择版本安装。`
      : "本地 MCP 未安装；云端版本列表暂未读取到。";
  }
  return status.updateAvailable ? "检测到云端新版本" : "本地 MCP 已是当前云端最新版本";
}

function formatLocalStatus(status?: McpPackageUpdateStatus) {
  if (!status) return "未检查";
  if (!status.localInstalled) return "未安装";
  return status.currentVersion ?? "已安装";
}

function formatCloudStatus(status?: McpPackageUpdateStatus) {
  if (!status) return "未检查";
  if (status.registryError) return "检查失败";
  return status.latestVersion ?? "未检查";
}

function formatCache(status?: McpPackageUpdateStatus) {
  if (!status) return "-";
  if (!status.cacheExists) return "不存在";
  return `${status.cacheEntryCount} 项 / ${formatBytes(status.cacheSizeBytes)}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function McpPackageManager({ busy, compact = false }: Props) {
  const [status, setStatus] = useState<McpPackageUpdateStatus>();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [working, setWorking] = useState(false);
  const [operation, setOperation] = useState<"check" | "install" | "uninstall" | undefined>();
  const [notice, setNotice] = useState("");
  const [uninstallConfirmText, setUninstallConfirmText] = useState("");
  const [uninstallResult, setUninstallResult] = useState<McpPackageUninstallResult>();

  useEffect(() => {
    void refreshStatus(true);
  }, []);

  async function refreshStatus(checkRegistry: boolean) {
    setWorking(true);
    setOperation(checkRegistry ? "check" : undefined);
    setNotice(checkRegistry ? "正在检查云端 MCP 包版本..." : "");
    try {
      const response = await getMcpPackageStatus(checkRegistry);
      setStatus(response.status);
      setSelectedVersion(response.status.latestVersion ?? response.status.availableVersions.at(-1) ?? response.status.currentVersion ?? "");
      if (response.status.registryError) {
        setNotice(`云端版本检查失败：${response.status.registryError}`);
      } else if (checkRegistry) {
        setNotice(formatCheckNotice(response.status));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
      setOperation(undefined);
    }
  }

  async function handleInstall() {
    if (!status || !selectedVersion) return;
    const nextSpec = `${status.packageName}@${selectedVersion}`;
    setWorking(true);
    setOperation("install");
    setUninstallResult(undefined);
    setNotice("正在安装并预热 MCP 包缓存...");
    try {
      const result = await installMcpPackage(nextSpec);
      setStatus(result.status);
      setSelectedVersion(result.status.currentVersion ?? selectedVersion);
      setNotice(`已安装：${result.status.packageSpec}。重新启动 MCP 后使用此版本。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
      setOperation(undefined);
    }
  }

  async function handleUninstall() {
    if (uninstallConfirmText !== "卸载 MCP") return;
    setWorking(true);
    setOperation("uninstall");
    setUninstallResult(undefined);
    setNotice("正在停止 MCP runtime 并清理本地 MCP 包缓存...");
    try {
      const result = await uninstallMcpPackage();
      setStatus(result.status);
      setSelectedVersion(result.status.latestVersion ?? result.status.availableVersions.at(-1) ?? "");
      setUninstallResult(result);
      setUninstallConfirmText("");
      setNotice(`本地 MCP 已卸载；云端版本仍可检查。项目目录未删除。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
      setOperation(undefined);
    }
  }

  const disabled = Boolean(busy || working);
  const versionOptions = [...(status?.availableVersions ?? [])]
    .reverse()
    .map((version) => ({
      value: version,
      label: version === status?.latestVersion ? `${version}（最新版）` : version,
    }));
  const canInstall = Boolean(status && selectedVersion && versionOptions.some((option) => option.value === selectedVersion));
  const localStatus = formatLocalStatus(status);
  const cloudStatus = formatCloudStatus(status);
  const uninstallSteps = uninstallResult?.steps ?? (operation === "uninstall" ? pendingUninstallSteps : []);

  if (compact) {
    return (
      <div className="rounded-panel border border-border-soft bg-surface-raised">
        <div className="border-b border-border-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-text">MCP 包状态</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-text-subtle" title={status?.packageSpec ?? "-"}>
                {status?.packageSpec ?? "等待检查"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled} className="h-7 shrink-0 px-2 text-[10px]">
              <RefreshCw className={cn("mr-1 h-3 w-3", operation === "check" && "animate-spin")} />
              查云端
            </Button>
          </div>
          {notice ? <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-brand">{notice}</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-b border-border-soft px-3 py-2 text-[10px] text-text-subtle">
          <CompactStatus label="本地" value={localStatus} title={status?.cachePath} />
          <CompactStatus label="云端" value={cloudStatus} />
          <CompactStatus label="检查" value={formatTime(status?.lastCheckedAt)} />
          <CompactStatus label="安装" value={formatTime(status?.lastInstalledAt)} />
        </div>

        <div className="grid gap-2 border-b border-border-soft px-3 py-2.5">
          <SelectField
            id="mcp-package-version-compact"
            value={selectedVersion}
            options={versionOptions.length ? versionOptions : [{ value: "", label: "请先检查更新" }]}
            onChange={setSelectedVersion}
            className="h-8 w-full text-[11px]"
            ariaLabel="选择 MCP 包版本"
          />
          <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={disabled || !canInstall} className="h-8 w-full text-[11px]">
            <Download className="mr-1 h-3.5 w-3.5" />
            安装/替换所选版本
          </Button>
        </div>

        <details className="group">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-text-muted hover:text-text">
            更新日志
          </summary>
          <div className="border-t border-border-soft px-3 py-2">
            <div className="mb-2 truncate font-mono text-[10px] text-text-subtle" title={status?.releaseNotesPath ?? "-"}>
              {status?.releaseNotesPath ?? "-"}
            </div>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-surface-app px-2 py-2 text-[11px] leading-relaxed text-text scrollbar-thin">
              {status?.releaseNotes ?? "暂无更新日志"}
            </pre>
          </div>
        </details>

        <details className="group border-t border-border-soft">
          <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-red-500 hover:text-red-400">
            卸载 MCP
          </summary>
          <div className="grid gap-2 border-t border-border-soft px-3 py-2">
            <p className="text-[11px] leading-relaxed text-text-subtle">
              停止当前 MCP runtime，清理版本设置和 npm-cache，不删除 Maker 项目目录。
            </p>
            <UninstallStepList steps={uninstallSteps} working={operation === "uninstall"} />
            <input
              value={uninstallConfirmText}
              onChange={(event) => setUninstallConfirmText(event.target.value)}
              placeholder="输入：卸载 MCP"
              className="h-8 rounded-control border border-border bg-surface-app px-2 text-[11px] text-text outline-none focus:border-red-500"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleUninstall()}
              disabled={disabled || uninstallConfirmText !== "卸载 MCP"}
              className="h-8 w-full text-[11px] hover:border-red-500 hover:text-red-500"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              确认卸载 MCP
            </Button>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border-soft bg-surface-panel shadow-sm overflow-hidden">
      {/* Animated Header & Actions Area */}
      <div className="flex flex-col xl:flex-row gap-6 p-5 bg-surface-app/40 border-b border-border-soft items-center justify-between relative overflow-hidden">

        {/* Left Side: Status & Animation */}
        <div className="flex flex-col md:flex-row items-center gap-5 flex-1 min-w-0">
          {/* Animated SVG Graphic */}
          <div className="shrink-0 relative w-20 h-20 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
              {/* Background glowing circle */}
              <circle cx="50" cy="50" r="40" className="fill-brand/5 animate-pulse" style={{ animationDuration: '3s' }} />
              {/* Outer rotating dashed ring */}
              <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" className="text-brand/40 animate-spin origin-center" style={{ animationDuration: '12s' }} />
              {/* Inner Hexagon or Box */}
              <path d="M50 22 L74 36 L74 64 L50 78 L26 64 L26 36 Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="1.5" className="text-brand" />
              {/* Center dot */}
              <circle cx="50" cy="50" r="4" className={cn("fill-brand transition-all", working && "animate-ping")} />
              <circle cx="50" cy="50" r="4" className="fill-brand" />

              {/* Data transfer lines */}
              <path d="M26 36 L50 50 L74 36" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" className="text-brand" />
              <path d="M50 78 L50 50" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.3" className="text-brand" />
            </svg>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1 text-center md:text-left mt-2 md:mt-0">
            <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
              <span className="text-[15px] font-bold text-text tracking-wide">MCP Runtime</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand/10 text-brand font-mono border border-brand/20 shadow-[0_0_8px_rgba(0,217,197,0.1)] w-fit mx-auto md:mx-0">
                {status?.packageName ?? "@taptap/maker"}
              </span>
            </div>

            <div className="flex flex-row items-center justify-center md:justify-start gap-8 mt-3">
              <div className="flex flex-col gap-1 items-center md:items-start">
                <span className="text-[9px] text-text-subtle uppercase tracking-wider font-bold">本地环境 Local</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[14px] font-bold font-mono tracking-tight", localStatus === "未安装" ? "text-text-muted" : "text-text")}>
                    {localStatus}
                  </span>
                  {localStatus !== "未安装" && status?.latestVersion === status?.currentVersion && (
                    <span className="text-[9px] bg-brand/10 text-brand px-1 py-0.5 rounded border border-brand/20">最新</span>
                  )}
                </div>
              </div>

              <div className="w-px h-8 bg-border-soft hidden md:block"></div>

              <div className="flex flex-col gap-1 items-center md:items-start">
                <span className="text-[9px] text-text-subtle uppercase tracking-wider font-bold">云端仓库 Cloud</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold font-mono text-brand tracking-tight">{cloudStatus}</span>
                  <Button variant="ghost" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled} className="h-5 w-5 p-0 rounded-full hover:bg-brand/10 hover:text-brand" title="检查云端版本">
                    <RefreshCw className={cn("w-3 h-3", operation === "check" && "animate-spin")} />
                  </Button>
                </div>
              </div>
            </div>
            {notice && <div className="mt-3 text-[10px] text-brand/80 font-medium bg-brand/5 border border-brand/10 rounded px-2 py-1 w-fit mx-auto md:mx-0">{notice}</div>}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-col gap-2.5 shrink-0 w-full xl:w-[260px]">
          <div className="flex flex-col gap-2 p-3 rounded-lg border border-border-soft bg-surface-panel shadow-sm transition-colors hover:border-brand/30">
            <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
              <Download className="w-3 h-3" /> 运行时版本管理
            </span>
            <div className="flex gap-2">
              <SelectField
                id="mcp-package-version"
                value={selectedVersion}
                options={versionOptions.length ? versionOptions : [{ value: "", label: "请先检查更新" }]}
                onChange={setSelectedVersion}
                className="flex-1 min-w-0 h-8 text-[11px]"
                ariaLabel="选择 MCP 包版本"
              />
              <Button size="sm" onClick={() => void handleInstall()} disabled={disabled || !canInstall} className="h-8 px-3 shrink-0 bg-brand text-white shadow-[0_0_10px_rgba(0,217,197,0.2)] hover:bg-brand/90 transition-colors">
                安装
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3 rounded-lg border border-red-500/10 bg-red-500/5 transition-colors hover:border-red-500/30">
            <span className="text-[10px] font-bold text-red-500/80 flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> 危险操作
            </span>
            <div className="flex gap-2">
              <input
                value={uninstallConfirmText}
                onChange={(event) => setUninstallConfirmText(event.target.value)}
                placeholder="输入: 卸载 MCP"
                className="flex-1 min-w-0 h-8 rounded-md border border-border-soft bg-surface-app px-2 text-[11px] text-text outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleUninstall()}
                disabled={disabled || uninstallConfirmText !== "卸载 MCP"}
                className="h-8 px-3 shrink-0 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="停止并清理本地 MCP 环境"
              >
                卸载
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Accordion */}
      <details className="group">
        <summary className="flex items-center gap-2 px-4 py-3 text-[11px] font-bold text-text-subtle hover:text-text cursor-pointer select-none bg-surface-app/30 hover:bg-surface-app/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between w-full">
            <span>查看高级环境详情与更新日志</span>
            <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </summary>
        <div className="p-4 border-t border-border-soft bg-surface-app/20 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-6 p-3 rounded-lg border border-border-soft bg-surface-panel/50">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-text-subtle">安装时间</span>
              <span className="text-[11px] font-mono text-text">{formatTime(status?.lastInstalledAt)}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-text-subtle">包缓存占用</span>
              <span className="text-[11px] font-mono text-text">{formatCache(status)}</span>
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-text-subtle">缓存路径</span>
              <span className="text-[11px] font-mono text-text truncate max-w-full" title={status?.cachePath}>
                {status?.cachePath || "-"}
              </span>
            </div>
          </div>

          <UninstallStepList steps={uninstallSteps} working={operation === "uninstall"} />

          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-bold text-text-subtle">版本日志</span>
            <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border-soft bg-surface-panel p-3 text-[11.5px] leading-relaxed text-text-subtle font-sans scrollbar-thin">
              {status?.releaseNotes ?? "暂无更新日志"}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}

function CompactStatus({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted px-2 py-1" title={title}>
      <span className="mr-1 text-text-subtle">{label}</span>
      <span className="font-mono text-text">{value}</span>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-surface-muted/40 px-2.5 py-1 text-[11px] border border-border-soft/50">
      <span className="text-text-muted">{label}:</span>
      <span className="font-mono text-text font-medium">{value}</span>
    </span>
  );
}

function StatusCard({ label, value, detail, title }: { label: string; value: string; detail: string; title?: string }) {
  return (
    <div className="flex flex-col min-w-0 rounded-lg border border-border-soft/60 bg-surface-app/40 p-3" title={title}>
      <span className="text-[12px] font-bold text-text mb-1">{label}</span>
      <span className="break-all font-mono text-[13px] text-text font-medium">{value}</span>
      <span className="mt-1 break-all text-[11px] text-text-subtle">{detail}</span>
    </div>
  );
}

function UninstallStepList({
  steps,
  working
}: {
  steps: ReadonlyArray<{ label: string; status: "done" | "skipped"; detail: string }>;
  working: boolean;
}) {
  if (!steps.length) return null;
  return (
    <div className="grid gap-1.5 rounded-lg border border-border-soft/50 bg-surface-app/30 p-2.5">
      {steps.map((step, index) => (
        <div key={`${step.label}-${index}`} className="grid grid-cols-[18px_1fr] gap-2 text-[11px] leading-relaxed">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border text-[9px]",
              step.status === "done"
                ? "border-brand bg-brand text-white"
                : "border-border-soft bg-surface-muted text-text-subtle",
              working && index === 0 && "animate-pulse"
            )}
          >
            {step.status === "done" ? "✓" : "-"}
          </span>
          <span className="min-w-0">
            <span className="font-bold text-text">{step.label}</span>
            <span className="ml-1 break-all text-text-subtle">{step.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
