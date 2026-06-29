import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Download, Package, RefreshCw, Trash2, Wrench } from "lucide-react";
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
  onDeveloperUnlock?: () => void;
};

const DEFAULT_CHANGELOG_TEXT = "暂无更新日志";

const pendingUninstallSteps = [
  { id: "stop_runtime", label: "停止 MCP 运行时", status: "done", detail: "正在请求停止当前 MCP 运行时。" },
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

function formatReleaseNotesSource(status?: McpPackageUpdateStatus) {
  if (!status) return "更新日志来源";
  if (status.releaseNotesSource === "cloud") return "云端更新日志";
  if (status.releaseNotesSource === "local") return "本地兜底更新日志";
  return "随包兜底更新日志";
}

function formatReleaseNotesError(status?: McpPackageUpdateStatus) {
  if (!status?.releaseNotesError) return "";
  const firstError = status.releaseNotesError.split("；").find(Boolean) ?? status.releaseNotesError;
  return `云端更新日志读取失败，已使用兜底内容：${firstError}`;
}

function getReleaseNotesForVersion(status: McpPackageUpdateStatus | undefined, version: string) {
  const content = status?.releaseNotes?.trim() || DEFAULT_CHANGELOG_TEXT;
  const normalizedVersion = version.trim().replace(/^v/i, "");
  if (!normalizedVersion) return content;

  const lines = content.split("\n");
  const headingPattern = /^##\s+@taptap\/maker@(.+?)\s*$/;
  let startIndex = -1;
  let endIndex = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const match = headingPattern.exec(lines[index].trim());
    if (!match) continue;
    const headingVersion = match[1].trim().replace(/^v/i, "");
    if (startIndex >= 0) {
      endIndex = index;
      break;
    }
    if (headingVersion === normalizedVersion) {
      startIndex = index;
    }
  }

  if (startIndex < 0) {
    return [
      `## @taptap/maker@${normalizedVersion}`,
      "",
      "当前更新日志中没有找到这个版本的条目。"
    ].join("\n");
  }

  return lines.slice(startIndex, endIndex).join("\n").trim() || DEFAULT_CHANGELOG_TEXT;
}

function isBetaVersion(version: string) {
  return version.toLowerCase().includes("-beta");
}

function BetaVersionMenuHeader({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center justify-between gap-3 text-[11px] font-bold text-text">
      <span>显示 Beta 版本</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-3.5 w-3.5 accent-brand"
      />
    </label>
  );
}

function VersionSummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "neutral" | "muted";
}) {
  return (
    <div className="flex w-fit max-w-[160px] flex-col gap-1">
      <span className="truncate text-[9px] font-bold text-text-subtle">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate rounded-md px-2 py-1 text-center font-mono text-[12px] font-bold shadow-sm",
          tone === "brand" && "border border-brand/20 bg-brand/10 text-brand",
          tone === "neutral" && "border border-border-soft/60 bg-surface-raised text-text",
          tone === "muted" && "bg-surface-muted text-text-muted",
        )}
        title={value}
      >
        v{value}
      </span>
    </div>
  );
}

export function McpPackageManager({ busy, compact = false, onDeveloperUnlock }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const developerUnlockClicksRef = useRef<number[]>([]);
  const developerUnlockToastTimerRef = useRef<number | undefined>(undefined);
  const developerUnlockToastUnmountTimerRef = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<McpPackageUpdateStatus>();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [working, setWorking] = useState(false);
  const [operation, setOperation] = useState<"check" | "install" | "uninstall" | undefined>();
  const [notice, setNotice] = useState("");
  const [uninstallConfirmText, setUninstallConfirmText] = useState("");
  const [uninstallResult, setUninstallResult] = useState<McpPackageUninstallResult>();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [developerUnlockToastMounted, setDeveloperUnlockToastMounted] = useState(false);
  const [developerUnlockToastActive, setDeveloperUnlockToastActive] = useState(false);
  const [showBetaVersions, setShowBetaVersions] = useState(false);

  useEffect(() => {
    void refreshStatus(true);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateWidth = () => setLayoutWidth(element.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setLayoutWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(developerUnlockToastTimerRef.current);
      window.clearTimeout(developerUnlockToastUnmountTimerRef.current);
    };
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
    await installSelectedPackage(status, selectedVersion, "install");
  }

  async function handleRepairInstall() {
    setWorking(true);
    setOperation("install");
    setUninstallResult(undefined);
    setNotice("正在检查并修复本机 MCP 包缓存...");
    try {
      const response = await getMcpPackageStatus(true);
      const nextStatus = response.status;
      setStatus(nextStatus);
      const nextVersion = nextStatus.latestVersion ?? nextStatus.availableVersions.at(-1) ?? nextStatus.currentVersion;
      if (!nextVersion) {
        throw new Error(nextStatus.registryError
          ? `无法读取可安装的 MCP 版本：${nextStatus.registryError}`
          : "无法读取可安装的 MCP 版本。");
      }
      setSelectedVersion(nextVersion);
      await installSelectedPackage(nextStatus, nextVersion, "repair");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      setWorking(false);
      setOperation(undefined);
    }
  }

  async function installSelectedPackage(nextStatus: McpPackageUpdateStatus, version: string, mode: "install" | "repair") {
    const nextSpec = `${nextStatus.packageName}@${version}`;
    setWorking(true);
    setOperation("install");
    setUninstallResult(undefined);
    setNotice(mode === "repair" ? "正在安装并修复本机 MCP 包缓存..." : "正在安装并预热 MCP 包缓存...");
    try {
      const result = await installMcpPackage(nextSpec);
      setStatus(result.status);
      setSelectedVersion(result.status.currentVersion ?? version);
      setNotice(
        mode === "repair"
          ? `已修复 MCP 包环境：${result.status.packageSpec}。重新启动 MCP 后使用此版本。`
          : `已安装：${result.status.packageSpec}。重新启动 MCP 后使用此版本。`
      );
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
    setNotice("正在停止 MCP 运行时并清理本地 MCP 包缓存...");
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

  function handleDeveloperUnlockClick() {
    if (!onDeveloperUnlock) return;

    const now = Date.now();
    const nextClicks = [
      ...developerUnlockClicksRef.current.filter((timestamp) => now - timestamp <= 1000),
      now,
    ];
    developerUnlockClicksRef.current = nextClicks;

    if (nextClicks.length < 5) return;

    developerUnlockClicksRef.current = [];
    onDeveloperUnlock();
    setNotice((current) => current.includes("已解锁 DEV") ? "" : current);
    window.clearTimeout(developerUnlockToastTimerRef.current);
    window.clearTimeout(developerUnlockToastUnmountTimerRef.current);
    setDeveloperUnlockToastMounted(true);
    window.requestAnimationFrame(() => setDeveloperUnlockToastActive(true));
    developerUnlockToastTimerRef.current = window.setTimeout(() => {
      setDeveloperUnlockToastActive(false);
      developerUnlockToastUnmountTimerRef.current = window.setTimeout(() => {
        setDeveloperUnlockToastMounted(false);
      }, 240);
    }, 4000);
  }

  const disabled = Boolean(busy || working);
  const visibleVersions = (status?.availableVersions ?? []).filter((version) => showBetaVersions || !isBetaVersion(version));
  const versionOptions = [...visibleVersions]
    .reverse()
    .map((version) => ({
      value: version,
      label: version === status?.latestVersion ? `${version}（最新版）` : version,
    }));
  const canInstall = Boolean(status && selectedVersion && versionOptions.some((option) => option.value === selectedVersion));
  const localStatus = formatLocalStatus(status);
  const cloudStatus = formatCloudStatus(status);
  const uninstallSteps = uninstallResult?.steps ?? (operation === "uninstall" ? pendingUninstallSteps : []);
  const useOriginalLayout = layoutWidth >= 725;
  const useTwoColumnActions = layoutWidth >= 560;
  const releaseNotesVersion = selectedVersion || status?.latestVersion || status?.currentVersion || "";
  const releaseNotesContent = getReleaseNotesForVersion(status, releaseNotesVersion);

  useEffect(() => {
    if (!status || versionOptions.length === 0) return;
    if (versionOptions.some((option) => option.value === selectedVersion)) return;
    setSelectedVersion(versionOptions[0].value);
  }, [selectedVersion, status, versionOptions]);

  const betaVersionMenuHeader = (
    <BetaVersionMenuHeader checked={showBetaVersions} onChange={setShowBetaVersions} />
  );

  if (compact) {
    return (
      <div className="flex flex-col w-full gap-4">
        {/* 1. Info Header (Enclosed in a card so it doesn't look lonely) */}
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-[11px] font-bold text-text-muted tracking-wider ml-1">MCP 运行时</span>

          <div className="flex flex-col bg-surface-app/40 border border-border-soft/50 rounded-panel p-3 gap-2 shadow-sm relative overflow-hidden">
            <div className="flex flex-wrap gap-2 min-w-0 relative z-10">
              <VersionSummaryPill label="本地版本" value={localStatus} tone={localStatus === "未安装" ? "muted" : "brand"} />
              <VersionSummaryPill label="云端版本" value={cloudStatus} tone={status?.registryError ? "muted" : "neutral"} />
            </div>
            <span className="text-[10px] text-text-muted font-mono truncate w-full relative z-10" title={status?.packageSpec ?? "-"}>
              {status?.packageSpec ?? "等待检查..."}
            </span>
            <Package className="absolute -right-2 -bottom-2 w-16 h-16 text-text-subtle opacity-[0.03] pointer-events-none" />
          </div>
        </div>

        {/* 2. Actions Row (Responsive wrap) */}
        <div className="flex flex-col gap-2 min-w-0">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider ml-1 shrink-0">版本控制</span>
          <div className="flex flex-wrap items-center gap-2 w-full">
            <div className="flex-1 min-w-[140px]">
              <SelectField
                id="mcp-package-version-compact"
                value={selectedVersion}
                options={versionOptions.length ? versionOptions : [{ value: "", label: "请先检查" }]}
                onChange={setSelectedVersion}
                className="h-8 text-[11px] w-full bg-surface-app border-border-soft hover:bg-surface-hover hover:border-border-soft shadow-sm"
                ariaLabel="选择版本"
                menuHeader={betaVersionMenuHeader}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                className="text-text-muted hover:text-text transition-colors disabled:opacity-50 h-8 w-8 flex items-center justify-center rounded-md hover:bg-surface-hover border border-border-soft bg-surface-app shadow-sm"
                onClick={() => void refreshStatus(true)}
                disabled={disabled}
                title="检查云端更新"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", operation === "check" && "animate-spin")} />
              </button>
              <button
                className="text-brand/90 hover:text-brand transition-colors disabled:opacity-50 h-8 w-8 flex items-center justify-center rounded-md bg-brand/10 hover:bg-brand/20 border border-brand/20 shadow-sm"
                onClick={() => void handleInstall()}
                disabled={disabled || !canInstall}
                title="安装选定版本"
              >
                <Download className={cn("w-3.5 h-3.5", operation === "install" && "animate-bounce")} />
              </button>
            </div>
          </div>
        </div>

        {notice && (
          <div className="text-[11px] font-medium text-brand bg-brand/5 px-3 py-2 rounded-md border border-brand/20 leading-relaxed shadow-sm">
            {notice}
          </div>
        )}

        {/* 3. Advanced Options Accordion */}
        <details className="group border-t border-border-soft/30">
          <summary className="cursor-pointer px-3 py-3 text-[12px] font-bold text-text-muted hover:text-text list-none flex items-center justify-between transition-colors hover:bg-surface-panel/30">
            <span>高级选项与更新日志</span>
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-text-muted/70 group-hover:text-text-muted" />
          </summary>
          <div className="px-3 pt-2.5 pb-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2 min-w-0 border-b border-border-soft/30 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0">更新日志</span>
                <span className="min-w-0 truncate text-right text-[10px] text-text-subtle" title={status?.releaseNotesPath ?? "-"}>
                  {formatReleaseNotesSource(status)}
                </span>
              </div>
              {status?.releaseNotesError ? (
                <div className="rounded-control border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] leading-relaxed text-amber-500">
                  {formatReleaseNotesError(status)}
                </div>
              ) : null}
              <ReleaseNotesMarkdown content={releaseNotesContent} compact />
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-border-soft bg-surface-app px-4 py-2.5 text-[11px] font-bold text-text hover:bg-surface-hover hover:text-text transition-colors shadow-sm"
              onClick={() => void handleRepairInstall()}
              disabled={disabled}
            >
              <Wrench className="h-3.5 w-3.5 text-text-muted" />
              一键安装 / 修复本地环境
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-md border border-red-900/30 bg-red-500/5 px-4 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-500/10 transition-colors shadow-sm"
              onClick={() => void handleUninstall()}
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {uninstallConfirmText === "卸载 MCP" ? "确认卸载" : "卸载 MCP 运行时"}
            </button>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col rounded-xl border border-border-soft bg-surface-panel shadow-sm overflow-hidden">
      {developerUnlockToastMounted ? (
        <div
          className={cn(
            "pointer-events-none fixed left-1/2 top-16 z-[10000] w-[min(360px,calc(100vw-40px))] -translate-x-1/2 transition-all duration-300 ease-out",
            developerUnlockToastActive
              ? "translate-y-0 scale-100 opacity-100"
              : "-translate-y-4 scale-95 opacity-0",
          )}
        >
          <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-surface-panel/95 px-4 py-3 text-text shadow-popover ring-1 ring-brand/10 backdrop-blur-md">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold">已解锁 DEV 选项</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">
                可在高级底部开启或关闭调试模式。
              </span>
            </span>
          </div>
        </div>
      ) : null}
      {/* Animated Header & Actions Area */}
      <div
        className={cn(
          "gap-5 p-5 bg-surface-app/40 border-b border-border-soft relative overflow-hidden",
          useOriginalLayout ? "flex items-center justify-center gap-8" : "flex flex-col",
        )}
      >

        {/* Left Side: Status & Animation */}
        <div
          className={cn(
            "flex min-w-0 flex-col items-center gap-5 md:flex-row",
            useOriginalLayout ? "w-[360px] justify-center" : "mx-auto max-w-full justify-center",
          )}
        >
          {/* Animated SVG Graphic */}
          <button
            type="button"
            aria-label="MCP 更新状态图标"
            title="MCP 更新状态"
            onClick={handleDeveloperUnlockClick}
            className="shrink-0 relative w-20 h-20 flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
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
          </button>

          <div
            className={cn(
              "min-w-0 flex flex-col gap-1 mt-2 md:mt-0",
              useOriginalLayout ? "flex-1 text-center md:text-left" : "text-center md:text-left",
            )}
          >
            <div className={cn("flex flex-col md:flex-row md:items-center gap-2", useOriginalLayout ? "justify-center md:justify-start" : "justify-center")}>
              <span className="text-[15px] font-bold text-text tracking-wide">MCP 运行时</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand/10 text-brand font-mono border border-brand/20 shadow-[0_0_8px_rgba(0,217,197,0.1)] w-fit mx-auto md:mx-0">
                {status?.packageName ?? "@taptap/maker"}
              </span>
            </div>

            <div className={cn("flex flex-row items-center gap-8 mt-3", useOriginalLayout ? "justify-center md:justify-start" : "justify-center")}>
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
            {notice && <div className={cn("mt-3 text-[10px] text-brand/80 font-medium bg-brand/5 border border-brand/10 rounded px-2 py-1 w-fit", useOriginalLayout ? "mx-auto md:mx-0" : "mx-auto")}>{notice}</div>}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div
          className={cn(
            "min-w-0 gap-3",
            useOriginalLayout
              ? "flex w-[260px] shrink-0 flex-col gap-2.5"
              : useTwoColumnActions
                ? "grid grid-cols-2"
                : "grid grid-cols-1",
          )}
        >
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
                menuHeader={betaVersionMenuHeader}
              />
              <Button size="sm" onClick={() => void handleInstall()} disabled={disabled || !canInstall} className="h-8 px-3 shrink-0 bg-brand text-white shadow-[0_0_10px_rgba(0,217,197,0.2)] hover:bg-brand/90 transition-colors">
                安装
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRepairInstall()}
              disabled={disabled}
              className="h-8 w-full gap-1.5"
              title="检查云端版本并修复本机 MCP 包缓存；运行时会在当前 Maker 项目目录启动。"
            >
              <Wrench className="h-3.5 w-3.5" />
              一键安装/修复 MCP
            </Button>
            <span className="text-[10px] leading-relaxed text-text-subtle">
              安装到本机 MCP 包缓存；启动运行时时使用当前项目目录。
            </span>
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
            <div className="truncate font-mono text-[10px] text-text-subtle" title={status?.releaseNotesPath ?? "-"}>
              {formatReleaseNotesSource(status)} · {status?.releaseNotesPath ?? "-"}
            </div>
            {status?.releaseNotesError ? (
              <div className="rounded-control border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] leading-relaxed text-amber-500">
                {formatReleaseNotesError(status)}
              </div>
            ) : null}
            <ReleaseNotesMarkdown content={releaseNotesContent} />
          </div>
        </div>
      </details>
    </div>
  );
}

function ReleaseNotesMarkdown({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = content.split("\n");
  return (
    <div className={cn(
      "max-h-48 overflow-auto rounded-lg border border-border-soft bg-surface-panel p-3 scrollbar-thin",
      "flex flex-col text-text-subtle",
      compact ? "gap-1.5 text-[11px] leading-relaxed" : "gap-2 text-[12px] leading-relaxed",
    )}>
      {lines.map((line, index) => renderReleaseNotesMarkdownLine(line, index, compact))}
    </div>
  );
}

function renderReleaseNotesMarkdownLine(line: string, index: number, compact: boolean) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("# ")) {
    return (
      <h3 key={index} className={cn("m-0 font-bold text-text", compact ? "text-[13px]" : "text-[15px]")}>
        {renderReleaseNotesInlineMarkdown(trimmed.slice(2))}
      </h3>
    );
  }
  if (trimmed.startsWith("## ")) {
    return (
      <h4 key={index} className={cn("m-0 font-bold text-text", compact ? "text-[12px]" : "text-[14px]")}>
        {renderReleaseNotesInlineMarkdown(trimmed.slice(3))}
      </h4>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h5 key={index} className={cn("m-0 font-semibold text-text", compact ? "text-[11px]" : "text-[13px]")}>
        {renderReleaseNotesInlineMarkdown(trimmed.slice(4))}
      </h5>
    );
  }
  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return (
      <div key={index} className="flex items-start gap-2">
        <span className="mt-[0.58em] h-1 w-1 shrink-0 rounded-full bg-brand" />
        <span className="min-w-0">{renderReleaseNotesInlineMarkdown(trimmed.slice(2))}</span>
      </div>
    );
  }
  if (/^\d+\.\s/.test(trimmed)) {
    const marker = trimmed.match(/^(\d+)\.\s/);
    const text = trimmed.replace(/^\d+\.\s/, "");
    return (
      <div key={index} className="grid grid-cols-[auto_1fr] gap-2">
        <span className="font-mono text-brand">{marker?.[1]}.</span>
        <span className="min-w-0">{renderReleaseNotesInlineMarkdown(text)}</span>
      </div>
    );
  }
  if (trimmed.startsWith("> ")) {
    return (
      <blockquote key={index} className="m-0 rounded-r-md border-l-2 border-brand/50 bg-brand/5 py-1.5 pl-3 text-text-subtle">
        {renderReleaseNotesInlineMarkdown(trimmed.slice(2))}
      </blockquote>
    );
  }
  return (
    <p key={index} className="m-0">
      {renderReleaseNotesInlineMarkdown(trimmed)}
    </p>
  );
}

function renderReleaseNotesInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-text">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded border border-border-soft bg-surface-muted px-1 py-0.5 font-mono text-[0.92em] text-brand">{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
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
