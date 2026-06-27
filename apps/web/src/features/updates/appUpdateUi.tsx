import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, History, RefreshCw, Sparkles } from "lucide-react";
import {
  checkAppUpdate,
  downloadAppUpdate,
  listAppReleases,
  type AppReleaseSummary,
  type AppUpdateStatus,
} from "../../api";
import { Button } from "../../components/ui/Button";
import { appVersion } from "../../generated/appVersion";
import { cn } from "../../lib/utils";

const repositoryUrl = "https://github.com/Rinorsi/taptap-maker-plus";

export type AppUpdateUiState = {
  status?: AppUpdateStatus;
  releases: AppReleaseSummary[];
  loading: boolean;
  downloading: boolean;
  notice: string;
  refresh: () => Promise<void>;
  downloadLatest: () => Promise<void>;
};

export function useAppUpdateUi(forceDeveloperTest = false): AppUpdateUiState {
  const [status, setStatus] = useState<AppUpdateStatus>();
  const [releases, setReleases] = useState<AppReleaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("正在检查 GitHub Releases...");
    try {
      const [statusResponse, releasesResponse] = await Promise.all([
        checkAppUpdate(),
        listAppReleases().catch(() => ({ releases: [] as AppReleaseSummary[] })),
      ]);
      const nextStatus = forceDeveloperTest
        ? createDeveloperTestUpdateStatus(statusResponse.status)
        : statusResponse.status;
      setStatus(nextStatus);
      setReleases(forceDeveloperTest ? [nextStatus.latestRelease!, ...releasesResponse.releases] : releasesResponse.releases);
      setNotice(nextStatus.error ?? (nextStatus.updateAvailable ? `检测到新版本 ${nextStatus.latestVersion}` : "当前已是最新版本"));
    } catch (error) {
      if (forceDeveloperTest) {
        const nextStatus = createDeveloperTestUpdateStatus();
        setStatus(nextStatus);
        setReleases([nextStatus.latestRelease!]);
        setNotice("开发者模式测试更新已启用；真实 GitHub Releases 暂时无法获取。");
      } else {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setLoading(false);
    }
  }, [forceDeveloperTest]);

  const downloadLatest = useCallback(async () => {
    const latestRelease = status?.latestRelease;
    if (!latestRelease) {
      setNotice("没有可下载的版本。");
      return;
    }
    if (latestRelease.id < 0) {
      setNotice("开发者模式测试版本只用于验证提示，不提供安装包下载。");
      return;
    }
    setDownloading(true);
    setNotice("正在下载安装器，完成后会打开安装程序...");
    try {
      const result = await downloadAppUpdate(latestRelease.id);
      setNotice(`安装器已下载：${result.installerPath}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setDownloading(false);
    }
  }, [status?.latestRelease]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, releases, loading, downloading, notice, refresh, downloadLatest };
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
  const installerAsset = useMemo(() => latestRelease?.assets.find((asset) => /\.exe$/i.test(asset.name)), [latestRelease]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "md:grid-cols-[1fr_auto]")}>
        <div className="min-w-0 rounded-xl border border-border-soft bg-surface-app/60 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-text">当前版本 {appVersion.displayVersion}</span>
            {state.status?.updateAvailable ? (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                新版本 {state.status.latestVersion}
              </span>
            ) : (
              <span className="rounded-full border border-border-soft bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-subtle">
                已检查
              </span>
            )}
          </div>
          <p className="m-0 mt-2 text-xs leading-relaxed text-text-muted">
            {state.notice || appVersion.announcementBody}
          </p>
          {latestRelease ? (
            <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-border-soft bg-surface-panel p-3 text-xs leading-relaxed text-text">
              {latestRelease.body || "暂无更新日志"}
            </pre>
          ) : null}
          {installerAsset ? (
            <p className="m-0 mt-2 truncate text-[11px] text-text-subtle" title={installerAsset.name}>
              安装器：{installerAsset.name}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 md:flex-col">
          <Button variant="outline" size="sm" onClick={() => void state.refresh()} disabled={state.loading}>
            <RefreshCw className={cn("mr-1 h-3.5 w-3.5", state.loading ? "animate-spin" : "")} />
            检查版本
          </Button>
          <Button
            size="sm"
            onClick={() => void state.downloadLatest()}
            disabled={!state.status?.updateAvailable || state.downloading}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            {state.downloading ? "下载中" : "下载更新"}
          </Button>
        </div>
      </div>
      <ReleaseHistory releases={state.releases} />
    </div>
  );
}

export function ReleaseHistory({ releases }: { releases: AppReleaseSummary[] }) {
  if (!releases.length) {
    return (
      <div className="rounded-xl border border-border-soft bg-surface-app/50 p-3 text-xs text-text-muted">
        暂无历史版本。发布 GitHub Release 后这里会自动显示版本记录。
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border-soft bg-surface-panel">
      <div className="flex items-center gap-2 border-b border-border-soft px-3 py-2 text-[12px] font-semibold text-text">
        <History className="h-4 w-4" />
        历史版本
      </div>
      <div className="max-h-64 overflow-auto">
        {releases.map((release) => (
          <article key={`${release.id}-${release.tagName}`} className="border-b border-border-soft px-3 py-3 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-text">{release.name || release.tagName}</div>
                <div className="mt-0.5 text-[11px] text-text-subtle">
                  {release.publishedAt ? formatDateTime(release.publishedAt) : "未发布"} · {release.tagName}
                </div>
              </div>
              <a
                href={release.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-control px-2 text-text-muted hover:bg-surface-muted hover:text-text"
                title="打开 GitHub Release"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <p className="m-0 mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
              {release.body || "暂无更新日志"}
            </p>
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
