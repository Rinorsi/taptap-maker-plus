import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, History, RefreshCw, Sparkles } from "lucide-react";
import {
  checkAppUpdate,
  downloadAppUpdate,
  getAppUpdateDownloadStatus,
  openExternalUrl,
  type AppUpdateDownloadStatus,
  type AppReleaseSummary,
  type AppUpdateStatus,
} from "../../api";
import { Button } from "../../components/ui/Button";
import { SelectField } from "../../components/ui/SelectField";
import { appVersion } from "../../generated/appVersion";
import { cn } from "../../lib/utils";

const repositoryUrl = "https://github.com/Rinorsi/taptap-maker-plus";

export type AppUpdateUiState = {
  status?: AppUpdateStatus;
  releases: AppReleaseSummary[];
  loading: boolean;
  downloading: boolean;
  notice: string;
  downloadStatus?: AppUpdateDownloadStatus;
  selectedReleaseId?: string;
  setSelectedReleaseId: (releaseId: string) => void;
  refresh: () => Promise<void>;
  downloadSelected: () => Promise<void>;
  openRelease: (release: AppReleaseSummary) => Promise<void>;
};

export function useAppUpdateUi(forceDeveloperTest = false): AppUpdateUiState {
  const [status, setStatus] = useState<AppUpdateStatus>();
  const [releases, setReleases] = useState<AppReleaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");
  const [downloadStatus, setDownloadStatus] = useState<AppUpdateDownloadStatus>();
  const [selectedReleaseId, setSelectedReleaseId] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("正在检查远端更新清单...");
    try {
      const statusResponse = await checkAppUpdate();
      const nextStatus = forceDeveloperTest
        ? createDeveloperTestUpdateStatus(statusResponse.status)
        : statusResponse.status;
      setStatus(nextStatus);
      const nextReleases = forceDeveloperTest ? [nextStatus.latestRelease!, ...statusResponse.status.releases] : nextStatus.releases;
      setReleases(nextReleases);
      setSelectedReleaseId((current) =>
        current && nextReleases.some((release) => String(release.id) === current)
          ? current
          : nextStatus.latestRelease
            ? String(nextStatus.latestRelease.id)
            : nextReleases[0]
              ? String(nextReleases[0].id)
              : undefined,
      );
      setNotice(nextStatus.error ?? (nextStatus.updateAvailable ? `检测到新版本 ${nextStatus.latestVersion}` : "当前已是最新版本"));
    } catch (error) {
      if (forceDeveloperTest) {
        const nextStatus = createDeveloperTestUpdateStatus();
        setStatus(nextStatus);
        setReleases([nextStatus.latestRelease!]);
        setSelectedReleaseId(String(nextStatus.latestRelease!.id));
        setNotice("开发者模式测试更新已启用；真实远端更新清单暂时无法获取。");
      } else {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setLoading(false);
    }
  }, [forceDeveloperTest]);

  const downloadSelected = useCallback(async () => {
    const selectedRelease = releases.find((release) => String(release.id) === selectedReleaseId) ?? status?.latestRelease;
    if (!selectedRelease) {
      setNotice("没有可下载的版本。");
      return;
    }
    if (selectedRelease.id < 0) {
      setNotice("开发者模式测试版本只用于验证提示，不提供安装包下载。");
      return;
    }
    setDownloading(true);
    setDownloadStatus(undefined);
    const installerAsset = selectedRelease.assets.find((asset) => /\.exe$/i.test(asset.name));
    setNotice(`正在下载安装器 ${installerAsset?.name ?? selectedRelease.tagName}，保存到软件数据目录 updates，完成后会自动打开安装程序...`);
    try {
      const initialStatus = await downloadAppUpdate(selectedRelease.id, installerAsset?.id, selectedRelease);
      setDownloadStatus(initialStatus);
      setNotice(formatDownloadNotice(initialStatus));
      let currentStatus = initialStatus;
      while (currentStatus.status !== "opened" && currentStatus.status !== "error") {
        await delay(500);
        currentStatus = await getAppUpdateDownloadStatus(initialStatus.id);
        setDownloadStatus(currentStatus);
        setNotice(formatDownloadNotice(currentStatus));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  }, [releases, selectedReleaseId, status?.latestRelease]);

  const openRelease = useCallback(async (release: AppReleaseSummary) => {
    try {
      await openExternalUrl(release.htmlUrl);
      setNotice(`已用系统浏览器打开：${release.htmlUrl}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, releases, loading, downloading, notice, downloadStatus, selectedReleaseId, setSelectedReleaseId, refresh, downloadSelected, openRelease };
}

export function VersionPill({
  status,
  onClick,
  className,
}: {
  status?: AppUpdateStatus;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border-soft bg-surface-panel/80 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-text transition-colors hover:border-brand/50 hover:text-brand-strong",
        className,
      )}
      title={status?.updateAvailable ? `发现新版本 ${status.latestVersion}` : "查看版本历史"}
    >
      <span>Maker Plus {appVersion.displayVersion}</span>
      {status?.updateAvailable ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-white">
          <Sparkles className="h-3 w-3" />
          更新
        </span>
      ) : null}
    </button>
  );
}

export function AppUpdatePanel({
  state,
  compact = false,
}: {
  state: AppUpdateUiState;
  compact?: boolean;
}) {
  const latestRelease = state.status?.latestRelease;
  const selectedRelease = useMemo(
    () => state.releases.find((release) => String(release.id) === state.selectedReleaseId) ?? latestRelease,
    [latestRelease, state.releases, state.selectedReleaseId],
  );
  const installerAsset = useMemo(() => selectedRelease?.assets.find((asset) => /\.exe$/i.test(asset.name)), [selectedRelease]);
  const releaseOptions = state.releases.map((release) => ({
    value: String(release.id),
    label: `${release.tagName}${release.id === latestRelease?.id ? " · 最新" : ""}`,
  }));
  const selectedIsCurrent = selectedRelease ? normalizeVersion(selectedRelease.tagName) === normalizeVersion(appVersion.packageVersion) : false;
  const downloadProgress = state.downloadStatus ? formatDownloadProgress(state.downloadStatus) : "";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border-soft bg-surface-panel shadow-sm">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-soft bg-surface-app/40 px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-text">当前版本 {appVersion.displayVersion}</span>
              {state.status?.updateAvailable ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/30 px-2 py-0.5 text-[10px] font-bold text-brand shadow-[0_0_10px_rgba(0,217,197,0.1)]">
                  <Sparkles className="w-3 h-3" />
                  新版本 {state.status.latestVersion}
                </span>
              ) : state.status?.error ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">
                  检查受限
                </span>
              ) : (
                <span className="rounded-full border border-border-soft bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-subtle">
                  已是最新
                </span>
              )}
            </div>
            <p className="m-0 text-[11px] text-text-muted">
              {state.notice || appVersion.announcementBody}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {releaseOptions.length ? (
              <SelectField
                id="app-update-release"
                value={state.selectedReleaseId ?? releaseOptions[0].value}
                options={releaseOptions}
                onChange={state.setSelectedReleaseId}
                className="w-[140px] h-8 text-xs"
                ariaLabel="选择软件版本"
              />
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void state.refresh()} disabled={state.loading} className="h-8 px-3">
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", state.loading ? "animate-spin" : "")} />
              检查更新
            </Button>
            <Button
              size="sm"
              onClick={() => void state.downloadSelected()}
              disabled={!selectedRelease || !installerAsset || state.downloading}
              className={cn("h-8 px-4", state.status?.updateAvailable ? "shadow-[0_0_15px_rgba(0,217,197,0.2)]" : "")}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {state.downloading ? (downloadProgress || "正在下载") : selectedIsCurrent ? "覆盖安装" : "安装更新"}
            </Button>
          </div>
        </div>

        {/* Content Details */}
        <div className="flex flex-col gap-3 p-4">
          {selectedRelease ? (
            <div className="max-h-48 overflow-auto rounded-lg border border-border-soft/50 bg-surface-app/40 p-3">
              <ReleaseMarkdown content={selectedRelease.body || "暂无更新日志"} compact />
            </div>
          ) : null}
          {installerAsset ? (
            <div className="flex flex-col gap-1.5 text-[11px] text-text-subtle">
              <div className="flex items-center gap-2">
                <span className="flex h-5 items-center rounded bg-surface-muted px-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  安装器
                </span>
                <span className="truncate" title={installerAsset.name}>
                  {installerAsset.name}
                </span>
              </div>
              {state.downloadStatus ? (
                <div className="truncate" title={state.downloadStatus.installerPath}>
                  保存位置：{state.downloadStatus.installerPath}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <ReleaseHistory releases={state.releases} onOpenRelease={state.openRelease} />
    </div>
  );
}

export function ReleaseHistory({
  releases,
  onOpenRelease,
}: {
  releases: AppReleaseSummary[];
  onOpenRelease?: (release: AppReleaseSummary) => void | Promise<void>;
}) {
  if (!releases.length) {
    return (
      <div className="rounded-xl border border-border-soft bg-surface-app/50 p-4 text-xs text-text-muted text-center">
        暂无历史版本。发布 GitHub Release 后这里会自动显示版本记录。
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border-soft bg-surface-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border-soft bg-surface-app/40 px-4 py-2.5 text-[12px] font-semibold text-text">
        <History className="h-4 w-4 text-text-muted" />
        历史版本
      </div>
      <div className="max-h-64 overflow-auto">
        {releases.map((release) => (
          <article key={`${release.id}-${release.tagName}`} className="border-b border-border-soft/50 px-4 py-3.5 last:border-b-0 hover:bg-surface-app/20 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-bold text-text">{release.name || release.tagName}</span>
                </div>
                <div className="mt-1 text-[11px] text-text-subtle">
                  {release.tagName}
                  {release.publishedAt && ` · ${formatDateTime(release.publishedAt)}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onOpenRelease?.(release)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
                title="用系统浏览器打开版本页面"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2.5 line-clamp-4">
              <ReleaseMarkdown content={release.body || "暂无更新日志"} compact />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function createDeveloperTestUpdateStatus(base?: AppUpdateStatus): AppUpdateStatus {
  const latestRelease: AppReleaseSummary = {
    id: -9999,
    tagName: "v99.99",
    name: "v99.99 测试更新",
    body: "开发者模式测试更新提示，用于验证角标、弹窗、历史版本和设置页更新入口。这个版本不会下载安装到本机。",
    htmlUrl: `${repositoryUrl}/releases`,
    prerelease: true,
    draft: false,
    assets: [],
  };
  return {
    currentVersion: appVersion.packageVersion,
    currentDisplayVersion: appVersion.displayVersion,
    latestVersion: latestRelease.tagName,
    latestRelease,
    announcement: {
      id: "developer-test-v99.99",
      title: "v99.99 开发者模式测试公告",
      summary: "用于验证公告红点、公告弹窗和版本更新提示。",
      severity: "info",
      publishedAt: new Date().toISOString(),
      markdown: "## v99.99 开发者模式测试公告\n\n这条公告只在开发者模式下生成，用于验证公告入口、未读红点和弹窗展示。\n\n### 测试范围\n\n* 首页版本角标\n* 侧栏公告红点\n* 公告弹窗 Markdown 渲染\n* 设置页更新检测入口",
    },
    announcements: [
      {
        id: "developer-test-v99.99",
        title: "v99.99 开发者模式测试公告",
        summary: "用于验证公告红点、公告弹窗和版本更新提示。",
        severity: "info",
        publishedAt: new Date().toISOString(),
        markdown: "## v99.99 开发者模式测试公告\n\n这条公告只在开发者模式下生成，用于验证公告入口、未读红点和弹窗展示。\n\n### 测试范围\n\n* 首页版本角标\n* 侧栏公告红点\n* 公告弹窗 Markdown 渲染\n* 设置页更新检测入口",
      },
    ],
    releases: [latestRelease],
    updateAvailable: true,
    checkedAt: base?.checkedAt ?? new Date().toISOString(),
    repositoryUrl: base?.repositoryUrl ?? repositoryUrl,
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function normalizeVersion(value: string) {
  return value.replace(/^v/i, "").toLowerCase();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDownloadNotice(status: AppUpdateDownloadStatus) {
  if (status.status === "error") return status.error ?? "下载安装器失败。";
  if (status.status === "opened") return `安装器已下载并启动：${status.installerPath}`;
  if (status.status === "opening") return `下载完成，正在打开安装器：${status.installerPath}`;
  if (status.status === "downloaded") return `安装器已下载：${status.installerPath}`;
  return `正在下载到：${status.installerPath}${formatDownloadProgress(status) ? `（${formatDownloadProgress(status)}）` : ""}`;
}

function formatDownloadProgress(status: AppUpdateDownloadStatus) {
  if (status.totalBytes && status.totalBytes > 0) {
    const percent = Math.min(100, Math.round((status.downloadedBytes / status.totalBytes) * 100));
    return `${percent}%`;
  }
  if (status.downloadedBytes > 0) return `${formatBytes(status.downloadedBytes)}`;
  return "";
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function ReleaseMarkdown({ content, compact = false }: { content: string; compact?: boolean }) {
  const lines = content.split("\n");
  return (
    <div className={cn("flex flex-col text-text-muted", compact ? "gap-2 text-[11.5px] leading-relaxed" : "gap-3 text-[13px] leading-relaxed")}>
      {lines.map((line, index) => renderMarkdownLine(line, index, compact))}
    </div>
  );
}

function renderMarkdownLine(line: string, index: number, compact: boolean) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("## ")) {
    return (
      <h3 key={index} className={cn("m-0 font-bold text-text", compact ? "text-[13px]" : "text-[16px]")}>
        {renderInlineMarkdown(trimmed.slice(3))}
      </h3>
    );
  }
  if (trimmed.startsWith("### ")) {
    return (
      <h4 key={index} className={cn("m-0 font-semibold text-text", compact ? "text-[12px]" : "text-[14px]")}>
        {renderInlineMarkdown(trimmed.slice(4))}
      </h4>
    );
  }
  if (trimmed.startsWith("* ")) {
    return (
      <div key={index} className="flex items-start gap-2">
        <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-brand" />
        <span className="min-w-0">{renderInlineMarkdown(trimmed.slice(2))}</span>
      </div>
    );
  }
  if (trimmed.startsWith("> ")) {
    return (
      <blockquote key={index} className="m-0 rounded-r-md border-l-2 border-brand/50 bg-brand/5 py-2 pl-3 text-text-subtle">
        {renderInlineMarkdown(trimmed.slice(2))}
      </blockquote>
    );
  }
  return (
    <p key={index} className="m-0">
      {renderInlineMarkdown(trimmed)}
    </p>
  );
}

function renderInlineMarkdown(text: string) {
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
