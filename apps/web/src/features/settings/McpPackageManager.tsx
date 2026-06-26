import { useEffect, useState } from "react";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import {
  getMcpPackageStatus,
  installMcpPackage,
  uninstallMcpPackage,
  type McpPackageUpdateStatus
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/SelectField";
import { cn } from "../../lib/utils";

type Props = {
  busy?: boolean;
  compact?: boolean;
};

export function McpPackageManager({ busy, compact = false }: Props) {
  const [status, setStatus] = useState<McpPackageUpdateStatus>();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [uninstallConfirmText, setUninstallConfirmText] = useState("");

  useEffect(() => {
    void refreshStatus(true);
  }, []);

  async function refreshStatus(checkRegistry: boolean) {
    setWorking(true);
    setNotice(checkRegistry ? "正在检查 MCP 包版本..." : "");
    try {
      const response = await getMcpPackageStatus(checkRegistry);
      setStatus(response.status);
      setSelectedVersion(response.status.currentVersion ?? response.status.latestVersion ?? response.status.availableVersions.at(-1) ?? "");
      if (response.status.registryError) {
        setNotice(`版本检查失败：${response.status.registryError}`);
      } else if (checkRegistry) {
        setNotice(response.status.updateAvailable ? "检测到可用更新" : "当前没有检测到新版本");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleInstall() {
    if (!status || !selectedVersion) return;
    const nextSpec = `${status.packageName}@${selectedVersion}`;
    setWorking(true);
    setNotice("正在安装并预热 MCP 包缓存...");
    try {
      const result = await installMcpPackage(nextSpec);
      setStatus(result.status);
      setSelectedVersion(result.status.currentVersion ?? selectedVersion);
      setNotice(`已安装：${result.status.packageSpec}。当前 MCP 会话已停止，重新启动后生效。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleUninstall() {
    if (uninstallConfirmText !== "卸载 MCP") return;
    setWorking(true);
    setNotice("正在停止 MCP runtime 并清理本地 MCP 包缓存...");
    try {
      const result = await uninstallMcpPackage();
      setStatus(result.status);
      setSelectedVersion(result.status.currentVersion ?? result.status.latestVersion ?? "");
      setUninstallConfirmText("");
      setNotice(`已卸载 MCP 包缓存；已清理 ${result.clearedSettingKeys.length} 项版本设置。项目目录未删除。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
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

  if (compact) {
    return (
      <div className="rounded-panel border border-border-soft bg-surface-raised">
        <div className="border-b border-border-soft px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="block truncate text-[12px] font-bold text-text">MCP 包更新</span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-text-subtle" title={status?.packageSpec ?? "-"}>
                {status?.packageSpec ?? "等待检查"}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled} className="h-7 shrink-0 px-2 text-[10px]">
              <RefreshCw className={cn("mr-1 h-3 w-3", working && "animate-spin")} />
              检查
            </Button>
          </div>
          {notice ? <div className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-brand">{notice}</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-1.5 border-b border-border-soft px-3 py-2 text-[10px] text-text-subtle">
          <CompactStatus label="当前" value={status?.currentVersion ?? "未检查"} />
          <CompactStatus label="最新" value={status?.latestVersion ?? "未检查"} />
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
          <span className="text-[13px] font-medium text-text">MCP 包更新</span>
          <span className="mt-1 text-xs text-text-muted leading-relaxed">
            当前启动链路使用 <span className="font-mono">{status?.packageSpec ?? "-"}</span>。
          </span>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-subtle">
            <StatusPill label="当前版本" value={status?.currentVersion ?? "未检查"} />
            <StatusPill label="最新版本" value={status?.latestVersion ?? "未检查"} />
            <StatusPill label="检查时间" value={formatTime(status?.lastCheckedAt)} />
            <StatusPill label="安装时间" value={formatTime(status?.lastInstalledAt)} />
          </div>
          {notice ? <div className="mt-2 text-xs text-brand">{notice}</div> : null}
        </div>
        <div className="shrink-0 flex items-center md:justify-end">
          <Button variant="outline" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", working && "animate-spin")} />
            检查更新
          </Button>
        </div>
      </div>

      {/* Specify MCP Package Version */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-border-soft hover:bg-surface-muted/30 transition-colors gap-4">
        <div className="flex flex-col pr-0 md:pr-8">
          <span className="text-[13px] font-medium text-text">指定 MCP 包版本</span>
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

function CompactStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-control bg-surface-muted px-2 py-1">
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

function formatTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
