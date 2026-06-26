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
    <div className="flex flex-col gap-0 border-t border-border-soft">
      {/* MCP Package Update */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border-soft hover:bg-surface-muted/30 transition-colors gap-4">
        <div className="flex flex-col flex-1 pr-0 md:pr-8">
          <span className="text-[13px] font-medium text-text">MCP 包状态</span>
          <span className="mt-1 text-xs text-text-muted leading-relaxed">
            本地安装状态和云端版本检查分开显示；卸载本地 MCP 不影响继续检查云端版本。
          </span>
          <div className="mt-3 grid gap-2 text-[11px] text-text-subtle md:grid-cols-2">
            <StatusCard
              label="本地 MCP"
              value={localStatus}
              detail={`缓存：${formatCache(status)}`}
              title={status?.cachePath}
            />
            <StatusCard
              label="云端版本"
              value={cloudStatus}
              detail={`检查时间：${formatTime(status?.lastCheckedAt)}`}
            />
            <StatusPill label="安装时间" value={formatTime(status?.lastInstalledAt)} />
            <StatusPill label="包名" value={status?.packageName ?? "-"} />
          </div>
          {notice ? <div className="mt-2 text-xs text-brand">{notice}</div> : null}
        </div>
        <div className="shrink-0 flex items-center md:justify-end">
          <Button variant="outline" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", operation === "check" && "animate-spin")} />
            检查云端版本
          </Button>
        </div>
      </div>

      {/* Specify MCP Package Version */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border-soft hover:bg-surface-muted/30 transition-colors gap-4">
        <div className="flex flex-col pr-0 md:pr-8">
          <span className="text-[13px] font-medium text-text">指定 MCP 包版本</span>
          <span className="mt-1 text-xs text-text-muted leading-relaxed">
            从云端版本列表选择一个版本，安装后会写入桌面端 MCP 包设置并预热本地缓存。
          </span>
        </div>
        <div className="shrink-0 flex items-center justify-end gap-2">
          <SelectField
            id="mcp-package-version"
            value={selectedVersion}
            options={versionOptions.length ? versionOptions : [{ value: "", label: "请先检查更新" }]}
            onChange={setSelectedVersion}
            className="w-[200px]"
            ariaLabel="选择 MCP 包版本"
          />
          <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={disabled || !canInstall}>
            <Download className="mr-1 h-3.5 w-3.5" />
            安装/替换
          </Button>
        </div>
      </div>

      {/* Changelog */}
      <div className="flex flex-col p-4 border-b border-border-soft last:border-b-0 hover:bg-surface-muted/30 transition-colors">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-text">更新日志</span>
          <span className="mt-1 text-xs text-text-muted leading-relaxed">
            读取文件：<span className="font-mono">{status?.releaseNotesPath ?? "-"}</span>
          </span>
        </div>
        <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-control border border-border bg-surface-app px-3 py-2 text-[12px] leading-relaxed text-text">
          {status?.releaseNotes ?? "暂无更新日志"}
        </pre>
      </div>

      {/* Uninstall MCP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border-soft last:border-b-0 hover:bg-red-500/5 transition-colors gap-4">
        <div className="flex flex-col flex-1 pr-0 md:pr-8">
          <span className="text-[13px] font-medium text-red-500">卸载 MCP</span>
          <span className="mt-1 text-xs text-text-muted leading-relaxed">
            停止当前 MCP runtime，清理桌面端保存的 MCP 包版本设置和 <span className="font-mono">data/npm-cache</span> 下的 MCP 包缓存。不删除 Maker 项目目录，也不会改动 AI client 配置文件。
          </span>
          <UninstallStepList steps={uninstallSteps} working={operation === "uninstall"} />
        </div>
        <div className="shrink-0 flex flex-col items-stretch justify-end gap-2">
          <input
            value={uninstallConfirmText}
            onChange={(event) => setUninstallConfirmText(event.target.value)}
            placeholder="输入：卸载 MCP"
            className="h-9 w-[220px] rounded-control border border-border bg-surface-app px-3 text-[12px] text-text outline-none focus:border-red-500"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleUninstall()}
            disabled={disabled || uninstallConfirmText !== "卸载 MCP"}
            className="justify-center hover:border-red-500 hover:text-red-500"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            确认卸载
          </Button>
        </div>
      </div>
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
    <span className="rounded-control border border-border-soft bg-surface-muted px-2 py-1">
      {label}: <span className="font-mono text-text">{value}</span>
    </span>
  );
}

function StatusCard({ label, value, detail, title }: { label: string; value: string; detail: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-panel border border-border-soft bg-surface-muted px-3 py-2" title={title}>
      <div className="text-[11px] font-bold text-text">{label}</div>
      <div className="mt-1 break-all font-mono text-[12px] text-text">{value}</div>
      <div className="mt-1 break-all text-[11px] text-text-subtle">{detail}</div>
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
    <div className="mt-3 grid gap-1.5 rounded-panel border border-border-soft bg-surface-app/70 p-2">
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
