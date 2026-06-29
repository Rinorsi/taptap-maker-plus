import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { config } from "../lib/config.js";
import { appVersion } from "../generated/appVersion.js";

const githubOwner = "Rinorsi";
const githubRepo = "taptap-maker-plus";
const githubRepositoryUrl = `https://github.com/${githubOwner}/${githubRepo}`;
const updateFeedRef = "updates-feed";
const staticManifestUrls = [
  `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/${updateFeedRef}/app-update-manifest.json`,
  `https://cdn.jsdelivr.net/gh/${githubOwner}/${githubRepo}@${updateFeedRef}/app-update-manifest.json`,
];
const updateManifestUnavailableMessage = "远端更新清单暂时无法访问，已显示安装包内置版本记录。请稍后重试，或检查本机网络、代理、防火墙和 GitHub 访问状态。";

export type AppReleaseAssetSummary = {
  id: number;
  name: string;
  size: number;
  browserDownloadUrl: string;
  contentType?: string;
  sha256?: string;
  downloadUrls: string[];
  downloadSources: AppReleaseDownloadSourceSummary[];
};

export type AppReleaseDownloadSourceSummary = {
  label: string;
  url: string;
};

export type AppReleaseSummary = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt?: string;
  prerelease: boolean;
  draft: boolean;
  assets: AppReleaseAssetSummary[];
};

export type AppAnnouncementSeverity = "info" | "warning" | "critical";

export type AppAnnouncementSummary = {
  id: string;
  title: string;
  summary: string;
  severity: AppAnnouncementSeverity;
  publishedAt: string;
  markdown: string;
  sourceUrl?: string;
};

export type AppUpdateStatus = {
  currentVersion: string;
  currentDisplayVersion: string;
  latestVersion?: string;
  latestRelease?: AppReleaseSummary;
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  releases: AppReleaseSummary[];
  updateAvailable: boolean;
  checkedAt: string;
  repositoryUrl: string;
  announcementError?: string;
  error?: string;
};

export type AppUpdateDownloadStatus = {
  id: string;
  status: "queued" | "downloading" | "downloaded" | "opening" | "opened" | "error";
  release: AppReleaseSummary;
  asset: AppReleaseAssetSummary;
  installerPath: string;
  downloadedBytes: number;
  totalBytes?: number;
  sourceIndex?: number;
  sourceLabel?: string;
  sourceUrl?: string;
  verifiedSha256?: string;
  sourceFailures: AppUpdateDownloadSourceFailure[];
  startedAt: string;
  updatedAt: string;
  downloadedAt?: string;
  openedAt?: string;
  error?: string;
};

export type AppUpdateDownloadSourceFailure = {
  label: string;
  url: string;
  error: string;
};

type ReadAppUpdateManifestResult = {
  latestVersion?: string;
  releases: AppReleaseSummary[];
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  announcementError?: string;
  error?: string;
};

const releasesCacheTtlMs = 10 * 60 * 1000;
let releasesCache:
  | {
      expiresAt: number;
      latestVersion?: string;
      releases: AppReleaseSummary[];
      announcement?: AppAnnouncementSummary;
      announcements: AppAnnouncementSummary[];
      announcementError?: string;
      error?: string;
    }
  | undefined;

const updateDownloads = new Map<string, AppUpdateDownloadStatus>();

type StaticUpdateManifest = {
  schemaVersion?: unknown;
  generatedAt?: unknown;
  repositoryUrl?: unknown;
  latestVersion?: unknown;
  announcements?: unknown;
  releases?: unknown;
};

type StaticManifestRelease = {
  version?: unknown;
  title?: unknown;
  publishedAt?: unknown;
  changelog?: unknown;
  changelogPath?: unknown;
  assets?: unknown;
};

type StaticManifestAsset = {
  name?: unknown;
  size?: unknown;
  sha256?: unknown;
  contentType?: unknown;
  browserDownloadUrl?: unknown;
  downloadUrls?: unknown;
  downloadSources?: unknown;
};

type StaticManifestAnnouncement = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  severity?: unknown;
  publishedAt?: unknown;
  markdownPath?: unknown;
};

export async function checkAppUpdate(options: { forceRefresh?: boolean } = {}): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const manifest = await readAppUpdateManifest(options);
    const releases = manifest.releases;
    const latestRelease = manifest.latestVersion
      ? releases.find((release) => release.tagName === manifest.latestVersion)
      : releases.find((release) => !release.draft);
    if (!latestRelease) {
      return {
        currentVersion: appVersion.packageVersion,
        currentDisplayVersion: appVersion.displayVersion,
        announcement: manifest.announcement,
        announcements: manifest.announcements,
        releases,
        updateAvailable: false,
        checkedAt,
        repositoryUrl: githubRepositoryUrl,
        announcementError: manifest.announcementError,
        error: manifest.error ?? "更新清单暂无可用版本。",
      };
    }
    return {
      currentVersion: appVersion.packageVersion,
      currentDisplayVersion: appVersion.displayVersion,
      latestVersion: latestRelease.tagName,
      latestRelease,
      announcement: manifest.announcement,
      announcements: manifest.announcements,
      releases,
      updateAvailable: compareVersions(latestRelease.tagName, appVersion.packageVersion) > 0,
      checkedAt,
      repositoryUrl: githubRepositoryUrl,
      announcementError: manifest.announcementError,
      error: manifest.error,
    };
  } catch (error) {
    return {
      currentVersion: appVersion.packageVersion,
      currentDisplayVersion: appVersion.displayVersion,
      announcement: releasesCache?.announcement,
      announcements: releasesCache?.announcements ?? [],
      releases: releasesCache?.releases ?? [],
      updateAvailable: false,
      checkedAt,
      repositoryUrl: githubRepositoryUrl,
      announcementError: releasesCache?.announcementError,
      error: releasesCache?.error ?? (error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function listAppReleases(options: { forceRefresh?: boolean } = {}): Promise<AppReleaseSummary[]> {
  return (await readAppUpdateManifest(options)).releases;
}

async function readAppUpdateManifest(options: { forceRefresh?: boolean } = {}): Promise<{
  latestVersion?: string;
  releases: AppReleaseSummary[];
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  announcementError?: string;
  error?: string;
}> {
  if (!options.forceRefresh && releasesCache && releasesCache.expiresAt > Date.now()) {
    return {
      latestVersion: releasesCache.latestVersion,
      releases: releasesCache.releases,
      announcement: releasesCache.announcement,
      announcements: releasesCache.announcements,
      announcementError: releasesCache.announcementError,
      error: releasesCache.error,
    };
  }
  const manifestErrorMessages: string[] = [];
  for (const manifestUrl of staticManifestUrls) {
    try {
      const manifest = await readStaticManifest(manifestUrl);
      releasesCache = {
        expiresAt: Date.now() + releasesCacheTtlMs,
        latestVersion: manifest.latestVersion,
        releases: manifest.releases,
        announcement: manifest.announcement,
        announcements: manifest.announcements,
        announcementError: manifest.announcementError,
        error: manifest.error,
      };
      return manifest;
    } catch (error) {
      manifestErrorMessages.push(`${manifestUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const localFallback = readBundledUpdateManifest(manifestErrorMessages);
  releasesCache = {
    expiresAt: Date.now() + releasesCacheTtlMs,
    latestVersion: localFallback.latestVersion,
    releases: localFallback.releases,
    announcement: localFallback.announcement,
    announcements: localFallback.announcements,
    announcementError: localFallback.announcementError,
    error: localFallback.error,
  };
  return localFallback;
}

async function readStaticManifest(manifestUrl: string): Promise<ReadAppUpdateManifestResult> {
  const response = await fetch(manifestUrl, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "TapTap-Maker-Plus-Updater",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as StaticUpdateManifest;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("静态更新清单返回结构不是对象。");
  }
  if (data.schemaVersion !== 1) {
    throw new Error("静态更新清单 schemaVersion 不支持。");
  }
  if (typeof data.latestVersion !== "string" || !data.latestVersion.trim()) {
    throw new Error("静态更新清单 latestVersion 缺失或格式不正确。");
  }
  if (!Array.isArray(data.releases)) {
    throw new Error("静态更新清单 releases 不是数组。");
  }
  const releases = await Promise.all(
    data.releases.map((release) => normalizeStaticRelease(release, manifestUrl)),
  );
  const visibleReleases = releases.filter((release) => !release.draft);
  if (!visibleReleases.some((release) => release.tagName === data.latestVersion)) {
    throw new Error("静态更新清单 latestVersion 未出现在 releases 中。");
  }
  try {
    const announcements = await readStaticAnnouncements(data.announcements, manifestUrl);
    return { latestVersion: data.latestVersion, releases: visibleReleases, announcement: announcements[0], announcements };
  } catch (error) {
    return {
      latestVersion: data.latestVersion,
      releases: visibleReleases,
      announcements: [],
      announcementError: error instanceof Error ? error.message : String(error),
    };
  }
}

function readBundledUpdateManifest(manifestErrorMessages: string[]): ReadAppUpdateManifestResult {
  const publishedAt = new Date().toISOString();
  const tagName = appVersion.displayVersion;
  const release: AppReleaseSummary = {
    id: stableReleaseId(appVersion.packageVersion),
    tagName,
    name: appVersion.announcementTitle,
    body: appVersion.announcementBody,
    htmlUrl: githubRepositoryUrl,
    publishedAt,
    prerelease: appVersion.channel === "ALPHA",
    draft: false,
    assets: [],
  };
  const announcementMarkdown = appVersion.announcementMarkdown || appVersion.announcementBody;
  const announcements: AppAnnouncementSummary[] = [
    {
      id: `${appVersion.packageVersion}:bundled-announcement`,
      title: "TapTap Maker Plus Alpha 公告",
      summary: "远端公告不可用时显示的随包内置公告。",
      severity: "info",
      publishedAt,
      markdown: announcementMarkdown,
    },
    ...appVersion.announcements.map((announcement, index) => ({
      id: `${appVersion.packageVersion}:bundled-release-${index}`,
      title: announcement.title,
      summary: "",
      severity: "info" as const,
      publishedAt,
      markdown: announcement.body,
    })),
  ];
  const manifestError = manifestErrorMessages.length
    ? `${updateManifestUnavailableMessage}\n详细信息：${formatManifestErrorDetails(manifestErrorMessages)}`
    : updateManifestUnavailableMessage;
  return {
    latestVersion: tagName,
    releases: [release],
    announcement: announcements[0],
    announcements,
    announcementError: manifestError,
    error: manifestError,
  };
}

function formatManifestErrorDetails(messages: string[]) {
  return messages
    .map((message, index) => {
      const sourceLabel = index === 0 ? "GitHub raw" : index === 1 ? "jsDelivr CDN" : `下载源 ${index + 1}`;
      const reason = message.includes(": ")
        ? message.slice(message.indexOf(": ") + 2)
        : message;
      return `${sourceLabel}: ${reason}`;
    })
    .join("；");
}

export async function downloadAndOpenAppUpdate(releaseId: number, assetId?: number, releaseFallback?: AppReleaseSummary) {
  const task = await startAppUpdateDownload(releaseId, assetId, releaseFallback);
  return await waitForAppUpdateDownload(task.id);
}

export async function startAppUpdateDownload(
  releaseId: number,
  assetId?: number,
  releaseFallback?: AppReleaseSummary,
  preferredSourceUrl?: string,
) {
  const releases = await listAppReleases().catch(() => releaseFallback ? [releaseFallback] : []);
  const release = releases.find((item) => item.id === releaseId) ?? (releaseFallback?.id === releaseId ? releaseFallback : undefined);
  if (!release) throw new Error(`找不到 Release：${releaseId}`);
  const selectedAsset = assetId
    ? release.assets.find((item) => item.id === assetId)
    : pickInstallerAsset(release);
  const asset = selectedAsset && preferredSourceUrl
    ? prioritizeAssetDownloadSource(selectedAsset, preferredSourceUrl)
    : selectedAsset;
  if (!asset) throw new Error(`Release ${release.tagName} 没有可下载的 Windows 安装器资产。`);

  const downloadDir = path.join(config.workspaceRoot, "updates");
  fs.mkdirSync(downloadDir, { recursive: true });
  const installerPath = path.join(downloadDir, sanitizeDownloadName(asset.name));
  const now = new Date().toISOString();
  const task: AppUpdateDownloadStatus = {
    id: createDownloadId(release.tagName, asset.id),
    status: "queued",
    release,
    asset,
    installerPath,
    downloadedBytes: 0,
    totalBytes: asset.size > 0 ? asset.size : undefined,
    sourceFailures: [],
    startedAt: now,
    updatedAt: now,
  };
  updateDownloads.set(task.id, task);
  void runAppUpdateDownload(task);
  return task;
}

function prioritizeAssetDownloadSource(asset: AppReleaseAssetSummary, preferredSourceUrl: string): AppReleaseAssetSummary {
  const sources = asset.downloadSources.length
    ? asset.downloadSources
    : [{ label: "安装包下载源", url: asset.browserDownloadUrl }];
  const selectedIndex = sources.findIndex((source) => source.url === preferredSourceUrl);
  if (selectedIndex < 0) return asset;
  const selected = sources[selectedIndex];
  const reorderedSources = [
    selected,
    ...sources.filter((_, index) => index !== selectedIndex),
  ];
  return {
    ...asset,
    browserDownloadUrl: selected.url,
    downloadUrls: reorderedSources.map((source) => source.url),
    downloadSources: reorderedSources,
  };
}

export function getAppUpdateDownloadStatus(downloadId: string) {
  const status = updateDownloads.get(downloadId);
  if (!status) throw new Error(`找不到下载任务：${downloadId}`);
  return status;
}

export function openExternalUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("只能打开 http 或 https 链接。");
  }
  openUrl(parsed.toString());
  return {
    ok: true,
    url: parsed.toString(),
  };
}

async function waitForAppUpdateDownload(downloadId: string) {
  while (true) {
    const status = getAppUpdateDownloadStatus(downloadId);
    if (status.status === "opened") {
      return {
        ok: true,
        release: status.release,
        asset: status.asset,
        installerPath: status.installerPath,
        downloadedAt: status.downloadedAt ?? status.updatedAt,
      };
    }
    if (status.status === "error") {
      throw new Error(status.error ?? "下载安装器失败。");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function runAppUpdateDownload(task: AppUpdateDownloadStatus) {
  try {
    updateDownloadTask(task.id, { status: "downloading" });
    const result = await downloadInstallerFromSources(task, (downloadedBytes, totalBytes) => {
      updateDownloadTask(task.id, { downloadedBytes, totalBytes });
    });
    updateDownloadTask(task.id, {
      status: "downloaded",
      sourceIndex: result.sourceIndex,
      sourceLabel: result.source.label,
      sourceUrl: result.source.url,
      verifiedSha256: result.verifiedSha256,
      downloadedAt: new Date().toISOString(),
    });
    updateDownloadTask(task.id, { status: "opening" });
    openInstaller(task.installerPath);
    updateDownloadTask(task.id, {
      status: "opened",
      openedAt: new Date().toISOString(),
    });
  } catch (error) {
    updateDownloadTask(task.id, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function updateDownloadTask(downloadId: string, patch: Partial<AppUpdateDownloadStatus>) {
  const current = updateDownloads.get(downloadId);
  if (!current) return;
  updateDownloads.set(downloadId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

async function normalizeStaticRelease(raw: unknown, manifestUrl: string): Promise<AppReleaseSummary> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("静态更新清单 release 不是对象。");
  }
  const source = raw as StaticManifestRelease;
  const tagName = readString(source.version, "manifest.release.version");
  const title = readString(source.title, "manifest.release.title");
  const changelog = await readStaticReleaseChangelog(source, manifestUrl);
  const assets = normalizeStaticReleaseAssets(source.assets, tagName);
  return {
    id: stableReleaseId(tagName),
    tagName,
    name: title,
    body: changelog,
    htmlUrl: `${githubRepositoryUrl}/releases/tag/${encodeURIComponent(tagName)}`,
    publishedAt: readString(source.publishedAt, "manifest.release.publishedAt"),
    prerelease: true,
    draft: false,
    assets,
  };
}

async function readStaticReleaseChangelog(source: StaticManifestRelease, manifestUrl: string) {
  if (typeof source.changelogPath === "string" && source.changelogPath.trim()) {
    return fetchStaticMarkdown(resolveStaticManifestUrl(manifestUrl, source.changelogPath.trim()), "更新日志");
  }
  return readString(source.changelog, "manifest.release.changelog");
}

async function readStaticAnnouncements(raw: unknown, manifestUrl: string): Promise<AppAnnouncementSummary[]> {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error("静态更新清单 announcements 不是数组。");
  return Promise.all(
    raw.map((announcement) => normalizeStaticAnnouncement(announcement, manifestUrl)),
  );
}

async function normalizeStaticAnnouncement(raw: unknown, manifestUrl: string): Promise<AppAnnouncementSummary> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("静态更新清单 announcement 不是对象。");
  }
  const source = raw as StaticManifestAnnouncement;
  const severity = readAnnouncementSeverity(source.severity);
  const markdownPath = readString(source.markdownPath, "manifest.announcement.markdownPath");
  const sourceUrl = resolveStaticManifestUrl(manifestUrl, markdownPath.trim());
  return {
    id: readString(source.id, "manifest.announcement.id"),
    title: readString(source.title, "manifest.announcement.title"),
    summary: readOptionalString(source.summary) || "",
    severity,
    publishedAt: readString(source.publishedAt, "manifest.announcement.publishedAt"),
    markdown: await fetchStaticMarkdown(sourceUrl, "公告 Markdown"),
    sourceUrl,
  };
}

function readAnnouncementSeverity(value: unknown): AppAnnouncementSeverity {
  if (value === "info" || value === "warning" || value === "critical") return value;
  throw new Error("静态更新清单 announcement.severity 缺失或格式不正确。");
}

function resolveStaticManifestUrl(manifestUrl: string, relativePath: string) {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return new URL(relativePath, manifestUrl).toString();
}

async function fetchStaticMarkdown(markdownUrl: string, label: string) {
  const response = await fetch(markdownUrl, {
    headers: {
      "Accept": "text/markdown,text/plain,*/*",
      "User-Agent": "TapTap-Maker-Plus-Updater",
    },
  });
  if (!response.ok) {
    throw new Error(`无法获取${label}：HTTP ${response.status} ${response.statusText}`);
  }
  const text = (await response.text()).trim();
  if (!text) throw new Error(`${label}内容为空。`);
  return text;
}

function buildStaticInstallerAsset(tagName: string): AppReleaseAssetSummary {
  const fileName = `TapTap.Maker.Plus._${installerVersionFromTag(tagName)}_x64-setup.exe`;
  const browserDownloadUrl = githubReleaseInstallerUrl(tagName, fileName);
  const acceleratedDownloadUrl = `https://gh-proxy.com/${browserDownloadUrl}`;
  return {
    id: stableReleaseId(`${tagName}:installer`),
    name: fileName,
    size: 0,
    browserDownloadUrl: acceleratedDownloadUrl,
    contentType: "application/x-msdownload",
    downloadUrls: [acceleratedDownloadUrl, browserDownloadUrl],
    downloadSources: [
      { label: "gh-proxy.com 加速源（第三方非官方）", url: acceleratedDownloadUrl },
      { label: "GitHub 官方源", url: browserDownloadUrl },
    ],
  };
}

function normalizeStaticReleaseAssets(rawAssets: unknown, tagName: string): AppReleaseAssetSummary[] {
  if (rawAssets === undefined) return [buildStaticInstallerAsset(tagName)];
  if (!Array.isArray(rawAssets)) throw new Error("静态更新清单 release.assets 不是数组。");
  if (!rawAssets.length) throw new Error("静态更新清单 release.assets 不能为空。");
  return rawAssets.map((rawAsset, index) => normalizeStaticReleaseAsset(rawAsset, tagName, index));
}

function normalizeStaticReleaseAsset(raw: unknown, tagName: string, index: number): AppReleaseAssetSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("静态更新清单 release.assets[] 不是对象。");
  }
  const source = raw as StaticManifestAsset;
  const name = readString(source.name, "manifest.release.assets.name");
  const size = readOptionalPositiveNumber(source.size, "manifest.release.assets.size") ?? 0;
  const sha256 = readOptionalSha256(source.sha256, "manifest.release.assets.sha256");
  const contentType = readOptionalString(source.contentType);
  const downloadSources = normalizeDownloadSources(source, tagName, name);
  const browserDownloadUrl = readOptionalString(source.browserDownloadUrl) ?? downloadSources[0].url;
  return {
    id: stableReleaseId(`${tagName}:asset:${name}:${index}`),
    name,
    size,
    browserDownloadUrl,
    contentType,
    sha256,
    downloadUrls: downloadSources.map((item) => item.url),
    downloadSources,
  };
}

function normalizeDownloadSources(source: StaticManifestAsset, tagName: string, assetName: string): AppReleaseDownloadSourceSummary[] {
  if (Array.isArray(source.downloadSources) && source.downloadSources.length) {
    return source.downloadSources.map((entry, index) => normalizeDownloadSource(entry, index));
  }
  if (Array.isArray(source.downloadUrls) && source.downloadUrls.length) {
    return source.downloadUrls.map((entry, index) => ({
      label: index === 0 ? "下载源 1" : `下载源 ${index + 1}`,
      url: readUrlString(entry, "manifest.release.assets.downloadUrls[]"),
    }));
  }
  const browserDownloadUrl = readOptionalString(source.browserDownloadUrl);
  if (browserDownloadUrl) {
    return [{ label: "安装包下载源", url: readUrlString(browserDownloadUrl, "manifest.release.assets.browserDownloadUrl") }];
  }
  const fallback = buildStaticInstallerAsset(tagName);
  if (fallback.name !== assetName) {
    const githubUrl = githubReleaseInstallerUrl(tagName, assetName);
    return [
      { label: "gh-proxy.com 加速源（第三方非官方）", url: `https://gh-proxy.com/${githubUrl}` },
      { label: "GitHub 官方源", url: githubUrl },
    ];
  }
  return fallback.downloadSources;
}

function githubReleaseInstallerUrl(tagName: string, fileName: string) {
  return `${githubRepositoryUrl}/releases/download/${encodeURIComponent(tagName)}/${encodeURIComponent(fileName)}`;
}

function normalizeDownloadSource(raw: unknown, index: number): AppReleaseDownloadSourceSummary {
  if (typeof raw === "string") {
    return { label: index === 0 ? "下载源 1" : `下载源 ${index + 1}`, url: readUrlString(raw, "manifest.release.assets.downloadSources[]") };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("静态更新清单 release.assets.downloadSources[] 不是对象。");
  }
  const source = raw as { label?: unknown; url?: unknown };
  return {
    label: readOptionalString(source.label) || (index === 0 ? "下载源 1" : `下载源 ${index + 1}`),
    url: readUrlString(source.url, "manifest.release.assets.downloadSources.url"),
  };
}

function installerVersionFromTag(tagName: string) {
  const normalized = tagName.replace(/^v/i, "");
  if (/^\d+\.\d+$/.test(normalized)) return `${normalized}.0-alpha`;
  return normalized;
}

function stableReleaseId(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  }
  return hash || 1;
}

function pickInstallerAsset(release: AppReleaseSummary) {
  const assets = release.assets;
  return (
    assets.find((asset) => /setup.*\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.msi$/i.test(asset.name))
  );
}

function readString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`GitHub Release 字段 ${key} 缺失或格式不正确。`);
  }
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readOptionalPositiveNumber(value: unknown, key: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`GitHub Release 字段 ${key} 缺失或格式不正确。`);
  }
  return value;
}

function readOptionalSha256(value: unknown, key: string) {
  if (value === undefined) return undefined;
  const text = readString(value, key).toUpperCase();
  if (!/^[A-F0-9]{64}$/.test(text)) {
    throw new Error(`GitHub Release 字段 ${key} 不是有效 SHA256。`);
  }
  return text;
}

function readUrlString(value: unknown, key: string) {
  const text = readString(value, key);
  const parsed = new URL(text);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`GitHub Release 字段 ${key} 不是 http/https URL。`);
  }
  return parsed.toString();
}

function compareVersions(left: string, right: string) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function versionParts(value: string) {
  return value
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part))
    .filter((part) => Number.isFinite(part));
}

function sanitizeDownloadName(fileName: string) {
  const sanitized = path.basename(fileName).replace(/[\\/:*?"<>|]/g, "_").trim();
  if (!sanitized) throw new Error("安装器文件名为空。");
  return sanitized;
}

async function downloadInstallerFromSources(
  task: AppUpdateDownloadStatus,
  onProgress?: (downloadedBytes: number, totalBytes?: number) => void,
) {
  const sources = task.asset.downloadSources.length
    ? task.asset.downloadSources
    : [{ label: "安装包下载源", url: task.asset.browserDownloadUrl }];
  const failures: AppUpdateDownloadSourceFailure[] = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    try {
      updateDownloadTask(task.id, {
        status: "downloading",
        sourceIndex: index,
        sourceLabel: source.label,
        sourceUrl: source.url,
        downloadedBytes: 0,
        totalBytes: task.asset.size > 0 ? task.asset.size : undefined,
        sourceFailures: failures,
      });
      await downloadFile(source.url, task.installerPath, onProgress);
      const verifiedSha256 = verifyDownloadedInstaller(task.installerPath, task.asset.sha256);
      return { sourceIndex: index, source, verifiedSha256 };
    } catch (error) {
      cleanupPartialDownload(task.installerPath);
      failures.push({
        label: source.label,
        url: source.url,
        error: error instanceof Error ? error.message : String(error),
      });
      updateDownloadTask(task.id, { sourceFailures: failures });
    }
  }
  throw new Error(`所有下载源均失败：${failures.map((failure) => `${failure.label}：${failure.error}`).join("；")}`);
}

async function downloadFile(url: string, targetPath: string, onProgress?: (downloadedBytes: number, totalBytes?: number) => void) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 45_000);
  const response = await fetch(url, {
    signal: abortController.signal,
    headers: {
      "User-Agent": "TapTap-Maker-Plus-Updater",
    },
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`下载安装器失败：HTTP ${response.status} ${response.statusText}`);
  }
  const totalHeader = response.headers.get("content-length");
  const parsedTotalBytes = totalHeader ? Number(totalHeader) : undefined;
  const total = parsedTotalBytes !== undefined && Number.isFinite(parsedTotalBytes) && parsedTotalBytes > 0 ? parsedTotalBytes : undefined;
  const tempPath = `${targetPath}.download`;
  const body = response.body;
  if (!body) throw new Error("下载安装器失败：响应体为空。");
  const file = fs.createWriteStream(tempPath);
  const reader = body.getReader();
  let downloadedBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      downloadedBytes += chunk.length;
      if (!file.write(chunk)) {
        await new Promise<void>((resolve, reject) => {
          file.once("drain", resolve);
          file.once("error", reject);
        });
      }
      onProgress?.(downloadedBytes, total);
    }
  } finally {
    reader.releaseLock();
  }
  await new Promise<void>((resolve, reject) => {
    file.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
  fs.renameSync(tempPath, targetPath);
}

function verifyDownloadedInstaller(filePath: string, expectedSha256?: string) {
  const actualSha256 = fileSha256(filePath);
  if (expectedSha256 && actualSha256 !== expectedSha256.toUpperCase()) {
    fs.rmSync(filePath, { force: true });
    throw new Error(`安装包 SHA256 校验失败：实际 ${actualSha256}，预期 ${expectedSha256.toUpperCase()}`);
  }
  return actualSha256;
}

function fileSha256(filePath: string) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function cleanupPartialDownload(targetPath: string) {
  fs.rmSync(`${targetPath}.download`, { force: true });
  fs.rmSync(targetPath, { force: true });
}

function createDownloadId(tagName: string, assetId: number) {
  return `${Date.now()}-${stableReleaseId(`${tagName}:${assetId}`)}`;
}

function openInstaller(installerPath: string) {
  if (process.platform === "win32") {
    spawn(installerPath, { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [installerPath], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [installerPath], { detached: true, stdio: "ignore" }).unref();
}

function openUrl(url: string) {
  if (process.platform === "win32") {
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}
