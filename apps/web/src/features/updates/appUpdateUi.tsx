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
      const statusResponse = await checkAppUpdate(true);
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
        setNotice("开发者模式本地更新链路测试已启用；该测试项不会下载安装到本机。");
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
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col overflow-hidden rounded-panel bg-surface-panel shadow-sm ring-1 ring-border-soft">
        
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6 border-b border-border-soft">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-app ring-1 ring-border-soft shadow-sm shrink-0">
              <Download className="h-6 w-6 text-brand" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-text">当前版本 {appVersion.displayVersion}</span>
                {state.status?.updateAvailable ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand">
                    <Sparkles className="w-3 h-3" />
                    可更新
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
              <p className="m-0 text-[12px] text-text-muted">
                {state.notice || appVersion.announcementBody}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {releaseOptions.length ? (
              <SelectField
                id="app-update-release"
                value={state.selectedReleaseId ?? releaseOptions[0].value}
                options={releaseOptions}
                onChange={state.setSelectedReleaseId}
                className="w-[150px] text-xs"
                ariaLabel="选择软件版本"
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void state.refresh()}
              disabled={state.loading}
              className="h-9 px-3 text-[13px] font-medium"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", state.loading ? "animate-spin" : "")} />
              检查更新
            </Button>
            <Button
              size="sm"
              onClick={() => void state.downloadSelected()}
              disabled={!selectedRelease || !installerAsset || state.downloading}
              className={cn("h-9 px-4 text-[13px] font-semibold", state.status?.updateAvailable ? "shadow-[0_0_12px_rgba(0,217,197,0.18)]" : "")}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {state.downloading ? (downloadProgress || "正在下载") : selectedIsCurrent ? "覆盖安装" : "下载更新"}
            </Button>
          </div>
        </div>

        {/* Content Details */}
        <div className="flex flex-col p-6 bg-surface-app/20">
          {selectedRelease ? (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-[13px] font-bold text-text mb-2 flex items-center gap-2">
                  <span className="w-1 h-3 rounded-full bg-brand"></span>
                  {selectedRelease.name || selectedRelease.tagName}
                </h4>
                <div className="rounded-xl bg-surface-panel p-4 ring-1 ring-border-soft/50 shadow-sm max-h-64 overflow-y-auto scrollbar-thin">
                  <ReleaseMarkdown content={selectedRelease.body || "暂无更新日志"} skipFirstHeading={selectedRelease.name || selectedRelease.tagName} compact />
                </div>
              </div>
              
              {installerAsset ? (
                <div className="flex items-center gap-2 text-[12px] text-text-subtle bg-surface-muted/50 rounded-lg p-2.5 px-4 ring-1 ring-border-soft/30">
                  <span className="font-bold uppercase tracking-wider text-text-muted">
                    安装包
                  </span>
                  <span className="truncate flex-1" title={installerAsset.name}>
                    {installerAsset.name}
                  </span>
                  {state.downloadStatus && (
                    <span className="truncate text-text-muted shrink-0 max-w-[200px]" title={state.downloadStatus.installerPath}>
                      保存位置：{state.downloadStatus.installerPath}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
             <div className="text-center text-[12px] text-text-muted py-4">请选择一个版本查看详情</div>
          )}
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
      <div className="rounded-panel border border-border-soft bg-surface-app/50 p-6 text-[13px] text-text-muted text-center">
        暂无历史版本。发布 GitHub Release 后这里会自动显示版本记录。
      </div>
    );
  }
  return (
    <div className="rounded-panel border border-border-soft bg-surface-panel overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-soft bg-surface-app/40 px-6 py-4 text-[14px] font-bold text-text">
        <History className="h-4 w-4 text-text-muted" />
        历史版本
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-thin p-2">
        {releases.map((release) => (
          <article key={`${release.id}-${release.tagName}`} className="relative pl-6 pr-4 py-4 before:absolute before:left-[11px] before:top-6 before:bottom-[-16px] before:w-[2px] before:bg-border-soft last:before:hidden hover:bg-surface-app/30 rounded-lg transition-colors group">
            <div className="absolute left-[7px] top-[22px] w-[10px] h-[10px] rounded-full border-[2px] border-surface-panel bg-brand ring-1 ring-border-soft group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-start justify-between gap-4 ml-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="truncate text-[14px] font-bold text-text">{release.name || release.tagName}</span>
                  <span className="text-[12px] font-mono text-text-subtle bg-surface-muted px-2 py-0.5 rounded-md border border-border-soft">
                    {release.tagName}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-text-muted">
                  {release.publishedAt ? formatDateTime(release.publishedAt) : "未知时间"}
                </div>
                <div className="mt-3 bg-surface-app/50 rounded-xl p-4 ring-1 ring-border-soft/50">
                  <ReleaseMarkdown content={release.body || "暂无更新日志"} skipFirstHeading={release.name || release.tagName} compact />
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onOpenRelease?.(release)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-muted hover:text-text transition-colors ring-1 ring-border-soft bg-surface-panel shadow-sm"
                title="用系统浏览器打开版本页面"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function createDeveloperTestUpdateStatus(base?: AppUpdateStatus): AppUpdateStatus {
  const tagName = "v99.99";
  const publishedAt = new Date().toISOString();
  const latestRelease: AppReleaseSummary = {
    id: -9999,
    tagName,
    name: "v99.99 开发者模式测试更新",
    body: "开发者模式本地测试项，用于验证更新角标、公告弹窗、历史版本和设置页更新入口。该测试项不会下载安装到本机，也不会出现在远端发布包中。",
    htmlUrl: `${repositoryUrl}/releases`,
    publishedAt,
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
      id: "developer-update-link-test",
      title: "本地更新链路测试公告",
      summary: "用于验证公告红点、公告弹窗和版本更新提示。",
      severity: "info",
      publishedAt,
      markdown: "## 本地更新链路测试公告\n\n这条公告只在开发者模式下生成，用于验证公告入口、未读红点和弹窗展示。\n\n### 测试范围\n\n* 首页版本角标\n* 侧栏公告红点\n* 公告弹窗 Markdown 渲染\n* 设置页更新检测入口\n\n> 这是本地测试项，不是远端发布版本。",
    },
    announcements: [
      {
        id: "developer-update-link-test",
        title: "本地更新链路测试公告",
        summary: "用于验证公告红点、公告弹窗和版本更新提示。",
        severity: "info",
        publishedAt,
        markdown: "## 本地更新链路测试公告\n\n这条公告只在开发者模式下生成，用于验证公告入口、未读红点和弹窗展示。\n\n### 测试范围\n\n* 首页版本角标\n* 侧栏公告红点\n* 公告弹窗 Markdown 渲染\n* 设置页更新检测入口\n\n> 这是本地测试项，不是远端发布版本。",
      },
    ],
    releases: [latestRelease],
    updateAvailable: true,
    checkedAt: base?.checkedAt ?? publishedAt,
    repositoryUrl: base?.repositoryUrl ?? repositoryUrl,
  };
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

function ReleaseMarkdown({ content, compact = false, skipFirstHeading }: { content: string; compact?: boolean; skipFirstHeading?: string }) {
  const lines = content.split("\n");
  let skippedHeading = false;

  return (
    <div className={cn("flex flex-col text-text-muted", compact ? "gap-2 text-[12px] leading-relaxed" : "gap-3 text-[13px] leading-relaxed")}>
      {lines.map((line, index) => {
        if (skipFirstHeading && !skippedHeading && line.trim().startsWith("## ") && line.includes(skipFirstHeading)) {
          skippedHeading = true;
          return null;
        }
        return renderMarkdownLine(line, index, compact);
      })}
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
