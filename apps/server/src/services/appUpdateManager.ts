import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../lib/config.js";
import { appVersion } from "../generated/appVersion.js";

const githubOwner = "Rinorsi";
const githubRepo = "taptap-maker-plus";
const githubApiBase = `https://api.github.com/repos/${githubOwner}/${githubRepo}`;
const githubRepositoryUrl = `https://github.com/${githubOwner}/${githubRepo}`;
const staticManifestUrls = [
  `https://raw.githubusercontent.com/${githubOwner}/${githubRepo}/main/updates/app-update-manifest.json`,
  `https://cdn.jsdelivr.net/gh/${githubOwner}/${githubRepo}@main/updates/app-update-manifest.json`,
];
const releaseApiHeaders = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "TapTap-Maker-Plus-Updater",
  "X-GitHub-Api-Version": "2022-11-28",
};

export type AppReleaseAssetSummary = {
  id: number;
  name: string;
  size: number;
  browserDownloadUrl: string;
  contentType?: string;
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
  startedAt: string;
  updatedAt: string;
  downloadedAt?: string;
  openedAt?: string;
  error?: string;
};

type ReadAppUpdateManifestResult = {
  latestVersion?: string;
  releases: AppReleaseSummary[];
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  announcementError?: string;
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
    }
  | undefined;

const updateDownloads = new Map<string, AppUpdateDownloadStatus>();

type GitHubReleaseAsset = {
  id?: unknown;
  name?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
  content_type?: unknown;
};

type GitHubRelease = {
  id?: unknown;
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  html_url?: unknown;
  published_at?: unknown;
  prerelease?: unknown;
  draft?: unknown;
  assets?: unknown;
};

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
  changelog?: unknown;
  changelogPath?: unknown;
};

type StaticManifestAnnouncement = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  severity?: unknown;
  publishedAt?: unknown;
  markdownPath?: unknown;
};

export async function checkAppUpdate(): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const manifest = await readAppUpdateManifest();
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
        error: "GitHub Releases 暂无可用版本。",
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
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listAppReleases(): Promise<AppReleaseSummary[]> {
  return (await readAppUpdateManifest()).releases;
}

async function readAppUpdateManifest(): Promise<{
  latestVersion?: string;
  releases: AppReleaseSummary[];
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  announcementError?: string;
}> {
  if (releasesCache && releasesCache.expiresAt > Date.now()) {
    return {
      latestVersion: releasesCache.latestVersion,
      releases: releasesCache.releases,
      announcement: releasesCache.announcement,
      announcements: releasesCache.announcements,
      announcementError: releasesCache.announcementError,
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
      };
      return manifest;
    } catch (error) {
      manifestErrorMessages.push(`${manifestUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const response = await fetch(`${githubApiBase}/releases?per_page=20`, {
    headers: releaseApiHeaders,
  });
  if (!response.ok) {
    const manifestDetails = manifestErrorMessages.length ? `静态更新清单不可用：${manifestErrorMessages.join("；")}；` : "";
    throw new Error(`${manifestDetails}${formatReleaseFetchError(response.status, response.statusText)}`);
  }
  const data = await response.json() as unknown;
  if (!Array.isArray(data)) throw new Error("GitHub Releases 返回结构不是数组。");
  const releases = data.map(normalizeRelease).filter((release) => !release.draft);
  releasesCache = {
    expiresAt: Date.now() + releasesCacheTtlMs,
    releases,
    announcements: [],
  };
  return { releases, announcements: [] };
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

export async function downloadAndOpenAppUpdate(releaseId: number, assetId?: number, releaseFallback?: AppReleaseSummary) {
  const task = await startAppUpdateDownload(releaseId, assetId, releaseFallback);
  return await waitForAppUpdateDownload(task.id);
}

export async function startAppUpdateDownload(releaseId: number, assetId?: number, releaseFallback?: AppReleaseSummary) {
  const releases = await listAppReleases().catch(() => releaseFallback ? [releaseFallback] : []);
  const release = releases.find((item) => item.id === releaseId) ?? (releaseFallback?.id === releaseId ? releaseFallback : undefined);
  if (!release) throw new Error(`找不到 Release：${releaseId}`);
  const asset = assetId
    ? release.assets.find((item) => item.id === assetId)
    : pickInstallerAsset(release);
  if (!asset) throw new Error(`Release ${release.tagName} 没有可下载的 Windows 安装器资产。`);

  const downloadDir = path.join(config.dataDir, "updates");
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
    startedAt: now,
    updatedAt: now,
  };
  updateDownloads.set(task.id, task);
  void runAppUpdateDownload(task, asset.browserDownloadUrl);
  return task;
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

async function runAppUpdateDownload(task: AppUpdateDownloadStatus, url: string) {
  try {
    updateDownloadTask(task.id, { status: "downloading" });
    await downloadFile(url, task.installerPath, (downloadedBytes, totalBytes) => {
      updateDownloadTask(task.id, { downloadedBytes, totalBytes });
    });
    updateDownloadTask(task.id, {
      status: "downloaded",
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

function normalizeRelease(raw: GitHubRelease): AppReleaseSummary {
  const id = readNumber(raw.id, "id");
  const tagName = readString(raw.tag_name, "tag_name");
  const assetsRaw = Array.isArray(raw.assets) ? raw.assets : [];
  return {
    id,
    tagName,
    name: readOptionalString(raw.name) || tagName,
    body: readOptionalString(raw.body) || "暂无更新日志",
    htmlUrl: readOptionalString(raw.html_url) || `${githubRepositoryUrl}/releases/tag/${encodeURIComponent(tagName)}`,
    publishedAt: readOptionalString(raw.published_at),
    prerelease: raw.prerelease === true,
    draft: raw.draft === true,
    assets: assetsRaw.map((asset) => normalizeAsset(asset as GitHubReleaseAsset)),
  };
}

async function normalizeStaticRelease(raw: unknown, manifestUrl: string): Promise<AppReleaseSummary> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("静态更新清单 release 不是对象。");
  }
  const source = raw as StaticManifestRelease;
  const tagName = readString(source.version, "manifest.release.version");
  const title = readString(source.title, "manifest.release.title");
  const changelog = await readStaticReleaseChangelog(source, manifestUrl);
  const asset = buildStaticInstallerAsset(tagName);
  return {
    id: stableReleaseId(tagName),
    tagName,
    name: title,
    body: changelog,
    htmlUrl: `${githubRepositoryUrl}/releases/tag/${encodeURIComponent(tagName)}`,
    prerelease: true,
    draft: false,
    assets: [asset],
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
  return {
    id: stableReleaseId(`${tagName}:installer`),
    name: fileName,
    size: 0,
    browserDownloadUrl: `${githubRepositoryUrl}/releases/download/${encodeURIComponent(tagName)}/${encodeURIComponent(fileName)}`,
    contentType: "application/x-msdownload",
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

function normalizeAsset(raw: GitHubReleaseAsset): AppReleaseAssetSummary {
  return {
    id: readNumber(raw.id, "asset.id"),
    name: readString(raw.name, "asset.name"),
    size: typeof raw.size === "number" ? raw.size : 0,
    browserDownloadUrl: readString(raw.browser_download_url, "asset.browser_download_url"),
    contentType: readOptionalString(raw.content_type),
  };
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

function readNumber(value: unknown, key: string) {
  if (typeof value !== "number") {
    throw new Error(`GitHub Release 字段 ${key} 缺失或格式不正确。`);
  }
  return value;
}

function formatReleaseFetchError(status: number, statusText: string) {
  if (status === 403) {
    return "GitHub Releases 检查频率过高，暂时被 GitHub 限流。请稍后再试；如果已经打开过本页，会优先显示上次缓存的版本记录。";
  }
  return `无法获取 GitHub Releases：HTTP ${status} ${statusText}`;
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

async function downloadFile(url: string, targetPath: string, onProgress?: (downloadedBytes: number, totalBytes?: number) => void) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "TapTap-Maker-Plus-Updater",
    },
  });
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
