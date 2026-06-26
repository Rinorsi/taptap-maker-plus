import { useEffect, useState } from "react";
import { Download, RefreshCw, Save } from "lucide-react";
import {
  getMcpPackageStatus,
  installMcpPackage,
  saveMcpPackageReleaseNotes,
  type McpPackageUpdateStatus
} from "../../api";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";

type Props = {
  busy?: boolean;
};

export function McpPackageManager({ busy }: Props) {
  const [status, setStatus] = useState<McpPackageUpdateStatus>();
  const [packageDraft, setPackageDraft] = useState("");
  const [releaseNotesDraft, setReleaseNotesDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void refreshStatus(false);
  }, []);

  async function refreshStatus(checkRegistry: boolean) {
    setWorking(true);
    setNotice(checkRegistry ? "正在检查 MCP 包版本..." : "");
    try {
      const response = await getMcpPackageStatus(checkRegistry);
      setStatus(response.status);
      setPackageDraft(response.status.packageSpec);
      setReleaseNotesDraft(response.status.releaseNotes);
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
    const nextSpec = packageDraft.trim();
    if (!nextSpec) return;
    setWorking(true);
    setNotice("正在安装并预热 MCP 包缓存...");
    try {
      const result = await installMcpPackage(nextSpec);
      setStatus(result.status);
      setPackageDraft(result.status.packageSpec);
      setReleaseNotesDraft(result.status.releaseNotes);
      setNotice(`已安装：${result.status.packageSpec}。当前 MCP 会话已停止，重新启动后生效。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleSaveReleaseNotes() {
    setWorking(true);
    try {
      const response = await saveMcpPackageReleaseNotes(releaseNotesDraft);
      setReleaseNotesDraft(response.releaseNotes);
      setStatus((current) => current ? { ...current, releaseNotes: response.releaseNotes } : current);
      setNotice("更新日志已保存");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
    }
  }

  const disabled = Boolean(busy || working);

  return (
    <div className="flex flex-col gap-0 border-t border-border-soft">
      <div className="grid gap-4 border-b border-border-soft p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text">MCP 包更新</div>
          <div className="mt-1 text-xs leading-relaxed text-text-muted">
            当前启动链路使用 <span className="font-mono">{status?.packageSpec ?? "-"}</span>。
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-subtle">
            <StatusPill label="当前版本" value={status?.currentVersion ?? "未固定"} />
            <StatusPill label="最新版本" value={status?.latestVersion ?? "未检查"} />
            <StatusPill label="检查时间" value={formatTime(status?.lastCheckedAt)} />
            <StatusPill label="安装时间" value={formatTime(status?.lastInstalledAt)} />
          </div>
          {notice ? <div className="mt-2 text-xs text-text-subtle">{notice}</div> : null}
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshStatus(true)} disabled={disabled}>
          <RefreshCw className={cn("mr-1 h-3.5 w-3.5", working && "animate-spin")} />
          检查更新
        </Button>
      </div>

      <div className="grid gap-3 border-b border-border-soft p-4 md:grid-cols-[1fr_auto] md:items-center">
        <label className="min-w-0">
          <span className="text-[13px] font-medium text-text">指定 MCP 包版本</span>
          <input
            value={packageDraft}
            onChange={(event) => setPackageDraft(event.target.value)}
            className="mt-2 h-9 w-full rounded-control border border-border bg-surface-app px-3 font-mono text-[12px] text-text outline-none focus:border-brand"
            placeholder="@taptap/maker@latest"
          />
        </label>
        <Button variant="outline" size="sm" onClick={() => void handleInstall()} disabled={disabled || !packageDraft.trim()}>
          <Download className="mr-1 h-3.5 w-3.5" />
          安装/替换
        </Button>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-start">
        <label className="min-w-0">
          <span className="text-[13px] font-medium text-text">更新日志</span>
          <textarea
            value={releaseNotesDraft}
            onChange={(event) => setReleaseNotesDraft(event.target.value)}
            className="mt-2 min-h-24 w-full resize-y rounded-control border border-border bg-surface-app px-3 py-2 text-[12px] leading-relaxed text-text outline-none focus:border-brand"
            placeholder="暂无更新日志"
          />
        </label>
        <Button variant="outline" size="sm" onClick={() => void handleSaveReleaseNotes()} disabled={disabled}>
          <Save className="mr-1 h-3.5 w-3.5" />
          保存日志
        </Button>
      </div>
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
