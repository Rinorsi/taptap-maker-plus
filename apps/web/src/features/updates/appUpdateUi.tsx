import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, History, RefreshCw, Sparkles, ChevronDown, ChevronRight, Search } from "lucide-react";
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
  selectedSourceUrl?: string;
  setSelectedReleaseId: (releaseId: string) => void;
  setSelectedSourceUrl: (sourceUrl: string) => void;
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
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string>();
  const selectedReleaseIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    selectedReleaseIdRef.current = selectedReleaseId;
  }, [selectedReleaseId]);

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
      const currentSelectedReleaseId = selectedReleaseIdRef.current;
      const nextSelectedReleaseId =
        currentSelectedReleaseId && nextReleases.some((release) => String(release.id) === currentSelectedReleaseId)
          ? currentSelectedReleaseId
          : nextStatus.latestRelease
            ? String(nextStatus.latestRelease.id)
            : nextReleases[0]
              ? String(nextReleases[0].id)
              : undefined;
      setSelectedReleaseId(nextSelectedReleaseId);
      selectedReleaseIdRef.current = nextSelectedReleaseId;
      const nextSelectedRelease = nextReleases.find((release) => String(release.id) === nextSelectedReleaseId) ?? nextStatus.latestRelease ?? nextReleases[0];
      const nextInstallerAsset = nextSelectedRelease?.assets.find((asset) => /\.exe$/i.test(asset.name));
      setSelectedSourceUrl((current) =>
        current && nextInstallerAsset?.downloadSources.some((source) => source.url === current)
          ? current
          : nextInstallerAsset?.downloadSources[0]?.url,
      );
      setNotice(formatUpdateStatusNotice(nextStatus));
    } catch (error) {
      if (forceDeveloperTest) {
        const nextStatus = createDeveloperTestUpdateStatus();
        setStatus(nextStatus);
        setReleases([nextStatus.latestRelease!]);
        setSelectedReleaseId(String(nextStatus.latestRelease!.id));
        setNotice("开发者模式本地更新链路测试已启用；该测试项不会下载安装到本机。");
      } else {
        setNotice(formatUpdateErrorNotice(error));
      }
    } finally {
      setLoading(false);
    }
  }, [forceDeveloperTest]);

  const selectRelease = useCallback((releaseId: string) => {
    setSelectedReleaseId(releaseId);
    selectedReleaseIdRef.current = releaseId;
    const nextRelease = releases.find((release) => String(release.id) === releaseId);
    const nextInstallerAsset = nextRelease?.assets.find((asset) => /\.exe$/i.test(asset.name));
    setSelectedSourceUrl(nextInstallerAsset?.downloadSources[0]?.url);
  }, [releases]);

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
    setNotice(`正在准备下载 ${installerAsset?.name ?? selectedRelease.tagName}，会按清单里的下载源顺序尝试，完成后校验安装包并打开安装程序...`);
    try {
      const initialStatus = await downloadAppUpdate(selectedRelease.id, installerAsset?.id, selectedRelease, selectedSourceUrl);
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
  }, [releases, selectedReleaseId, selectedSourceUrl, status?.latestRelease]);

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

  return { status, releases, loading, downloading, notice, downloadStatus, selectedReleaseId, selectedSourceUrl, setSelectedReleaseId: selectRelease, setSelectedSourceUrl, refresh, downloadSelected, openRelease };
}

function formatUpdateStatusNotice(status: AppUpdateStatus) {
  if (status.error) return formatUpdateErrorNotice(status.error);
  return status.updateAvailable ? `检测到新版本 ${status.latestVersion}` : "当前已是最新版本";
}

function formatUpdateErrorNotice(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split(/\r?\n/)[0]?.trim();
  if (firstLine) return firstLine;
  return "远端更新清单暂时无法访问，请稍后重试。";
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
  const selectedDownloadSource = useMemo(
    () => installerAsset?.downloadSources.find((source) => source.url === state.selectedSourceUrl) ?? installerAsset?.downloadSources[0],
    [installerAsset, state.selectedSourceUrl],
  );
  const releaseOptions = state.releases.map((release) => ({
    value: String(release.id),
    label: `${release.tagName}${release.id === latestRelease?.id ? " · 最新" : ""}`,
  }));
  const sourceOptions = (installerAsset?.downloadSources ?? []).map((source, index) => ({
    value: source.url,
    label: `${index + 1}. ${source.label}`,
  }));
  const selectedIsCurrent = selectedRelease ? normalizeVersion(selectedRelease.tagName) === normalizeVersion(appVersion.packageVersion) : false;
  const downloadProgress = state.downloadStatus ? formatDownloadProgress(state.downloadStatus) : "";

  return (
    <div className="flex min-w-0 flex-col gap-6">

      <div style={{ maxHeight: "400px" }} className="flex flex-col overflow-hidden rounded-panel bg-surface-panel shadow-sm ring-1 ring-border-soft">
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
                {state.notice || "检查远端更新清单，选择版本和下载源后下载并覆盖安装。"}
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
            {sourceOptions.length ? (
              <SelectField
                id="app-update-download-source"
                value={state.selectedSourceUrl ?? sourceOptions[0].value}
                options={sourceOptions}
                onChange={state.setSelectedSourceUrl}
                className="w-[170px] text-xs"
                ariaLabel="选择下载源"
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
        <div className="flex flex-col flex-1 min-h-0 bg-surface-app/30 p-6 overflow-y-auto custom-scrollbar">
          {selectedRelease ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1 h-3.5 rounded-full bg-brand"></span>
                <h4 className="text-[14px] font-bold text-text m-0">
                  {selectedRelease.name || selectedRelease.tagName}
                </h4>
              </div>

              <div className="mt-1 text-text-subtle text-[13px] pl-3 border-l-2 border-border-soft/50 ml-1">
                <ReleaseMarkdown content={selectedRelease.body || "暂无更新日志"} skipFirstHeading={selectedRelease.name || selectedRelease.tagName} compact />
              </div>
              
              {installerAsset ? (
                <div className="flex items-center gap-3 text-[12px] text-text-muted mt-3 pt-3 border-t border-border-soft ml-3">
                  <span className="font-bold uppercase tracking-wider">
                    安装包
                  </span>
                  <span className="truncate max-w-[300px]" title={installerAsset.name}>
                    {installerAsset.name}
                  </span>
                  {selectedDownloadSource ? (
                    <span className="shrink-0 rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-subtle" title={selectedDownloadSource.url}>
                      当前源：{selectedDownloadSource.label}
                    </span>
                  ) : null}
                  {state.downloadStatus && (
                    <span className="truncate text-text-subtle shrink-0 max-w-[200px]" title={state.downloadStatus.installerPath}>
                      · 保存至：{state.downloadStatus.installerPath}
                    </span>
                  )}
                </div>
              ) : null}
              {state.downloadStatus ? (
                <DownloadSourceStatus status={state.downloadStatus} />
              ) : installerAsset?.downloadSources?.length ? (
                <div className="ml-3 rounded-lg border border-border-soft bg-surface-panel/50 p-3 text-[12px] text-text-muted">
                  <div className="mb-2 font-bold text-text">下载源顺序</div>
                  <div className="flex flex-col gap-1.5">
                    {installerAsset.downloadSources.map((source, index) => (
                      <div key={`${source.label}-${source.url}`} className="flex items-start gap-2">
                        <span className="mt-0.5 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-text-subtle">{index + 1}</span>
                        <span className="min-w-0">
                          <span className="font-medium text-text">{source.label}</span>
                          <span className="ml-2 break-all text-text-subtle">{source.url}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  {installerAsset.sha256 ? (
                    <div className="mt-2 break-all font-mono text-[10px] text-text-subtle">SHA256: {installerAsset.sha256}</div>
                  ) : null}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredReleases = useMemo(() => {
    return releases.filter((r) => {
      if (filterType === "stable" && r.prerelease) return false;
      if (filterType === "prerelease" && !r.prerelease) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (r.name || "").toLowerCase().includes(q) || r.tagName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [releases, filterType, searchQuery]);

  if (!releases.length) {
    return (
      <div className="rounded-panel border border-border-soft bg-surface-app/50 p-6 text-[13px] text-text-muted text-center">
        暂无历史版本。发布 GitHub Release 后这里会自动显示版本记录。
      </div>
    );
  }
  return (
    <div style={{ maxHeight: "500px" }} className="flex flex-col rounded-panel border border-border-soft bg-surface-panel overflow-hidden shadow-sm">
      <div className="flex items-center justify-between border-b border-border-soft bg-surface-app/40 px-6 py-3">
        <div className="flex items-center gap-2 text-[14px] font-bold text-text">
          <History className="h-4 w-4 text-text-muted" />
          历史版本
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="搜索版本..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[140px] rounded-md border border-border-soft bg-surface-panel pl-8 pr-3 text-[12px] text-text placeholder:text-text-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <SelectField
            id="history-filter"
            value={filterType}
            onChange={setFilterType}
            options={[
              { label: "所有版本", value: "all" },
              { label: "正式版", value: "stable" },
              { label: "测试版", value: "prerelease" },
            ]}
            className="w-[100px] text-[12px] h-8"
            ariaLabel="版本筛选"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {filteredReleases.length ? (
          filteredReleases.map((release) => {
            const isExpanded = expandedIds.has(release.id);
            return (
              <article
                key={`${release.id}-${release.tagName}`}
                className="relative pl-6 pr-4 py-3 before:absolute before:left-[11px] before:top-6 before:bottom-[-16px] before:w-[2px] before:bg-border-soft last:before:hidden hover:bg-surface-app/30 rounded-lg transition-colors group"
              >
                <div
                  className={cn(
                    "absolute left-[7px] top-[18px] w-[10px] h-[10px] rounded-full border-[2px] border-surface-panel ring-1 ring-border-soft group-hover:scale-110 transition-transform",
                    isExpanded ? "bg-brand" : "bg-border"
                  )}
                ></div>

                <div className="flex items-start justify-between gap-4 ml-4">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleExpand(release.id)}
                      className="flex items-center gap-2 text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-sm"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
                      )}
                      <span className={cn("truncate text-[14px] font-bold transition-colors", isExpanded ? "text-brand" : "text-text")}>
                        {release.name || release.tagName}
                      </span>
                      <span className="text-[12px] font-mono text-text-subtle bg-surface-muted px-2 py-0.5 rounded-md border border-border-soft">
                        {release.tagName}
                      </span>
                      <span className="text-[12px] text-text-muted ml-auto mr-2">
                        {release.publishedAt ? formatDateTime(release.publishedAt) : "未知时间"}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 text-[13px] pl-6 border-l-2 border-border-soft/50 py-1 ml-2">
                        <div className="text-text-subtle pr-4">
                          <ReleaseMarkdown
                            content={release.body || "暂无更新日志"}
                            skipFirstHeading={release.name || release.tagName}
                            compact
                          />
                        </div>
                      </div>
                    )}
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
            );
          })
        ) : (
          <div className="py-8 text-center text-[12px] text-text-muted">没有找到匹配的版本</div>
        )}
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
  const source = status.sourceLabel ? `下载源：${status.sourceLabel}。` : "";
  if (status.status === "error") return status.error ?? "下载安装器失败。";
  if (status.status === "opened") return `安装器已下载、校验并启动：${status.installerPath}`;
  if (status.status === "opening") return `下载完成，校验通过，正在打开安装器：${status.installerPath}`;
  if (status.status === "downloaded") return `安装器已下载并校验：${status.installerPath}`;
  return `${source}正在下载到：${status.installerPath}${formatDownloadProgress(status) ? `（${formatDownloadProgress(status)}）` : ""}`;
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

function DownloadSourceStatus({ status }: { status: AppUpdateDownloadStatus }) {
  return (
    <div className="ml-3 rounded-lg border border-border-soft bg-surface-panel/50 p-3 text-[12px] text-text-muted">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-text">当前下载</span>
        <span className="rounded bg-surface-muted px-2 py-0.5 text-[11px] text-text-subtle">
          {status.sourceLabel ?? "等待选择下载源"}
        </span>
        {formatDownloadProgress(status) ? (
          <span className="font-mono text-brand">{formatDownloadProgress(status)}</span>
        ) : null}
      </div>
      {status.sourceUrl ? (
        <div className="mt-2 break-all font-mono text-[10px] text-text-subtle">{status.sourceUrl}</div>
      ) : null}
      {status.verifiedSha256 ? (
        <div className="mt-2 break-all font-mono text-[10px] text-brand">SHA256 校验通过：{status.verifiedSha256}</div>
      ) : null}
      {status.sourceFailures.length ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="font-bold text-amber-500">已跳过的失败源</span>
          {status.sourceFailures.map((failure) => (
            <div key={`${failure.label}-${failure.url}`} className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1">
              <span className="font-medium text-text">{failure.label}</span>
              <span className="ml-2 break-all text-text-subtle">{failure.error}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
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
