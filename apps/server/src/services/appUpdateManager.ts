import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../lib/config.js";
import { appVersion } from "../generated/appVersion.js";

const githubOwner = "Rinorsi";
const githubRepo = "taptap-maker-plus";
const githubApiBase = `https://api.github.com/repos/${githubOwner}/${githubRepo}`;
const githubRepositoryUrl = `https://github.com/${githubOwner}/${githubRepo}`;
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

export type AppUpdateStatus = {
  currentVersion: string;
  currentDisplayVersion: string;
  latestVersion?: string;
  latestRelease?: AppReleaseSummary;
  updateAvailable: boolean;
  checkedAt: string;
  repositoryUrl: string;
  error?: string;
};

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

export async function checkAppUpdate(): Promise<AppUpdateStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const releases = await listAppReleases();
    const latestRelease = releases.find((release) => !release.draft);
    if (!latestRelease) {
      return {
        currentVersion: appVersion.packageVersion,
        currentDisplayVersion: appVersion.displayVersion,
        updateAvailable: false,
        checkedAt,
        repositoryUrl: githubRepositoryUrl,
        error: "GitHub Releases 暂无可用版本。",
      };
    }
    return {
      currentVersion: appVersion.packageVersion,
      currentDisplayVersion: appVersion.displayVersion,
      latestVersion: latestRelease.tagName,
      latestRelease,
      updateAvailable: compareVersions(latestRelease.tagName, appVersion.packageVersion) > 0,
      checkedAt,
      repositoryUrl: githubRepositoryUrl,
    };
  } catch (error) {
    return {
      currentVersion: appVersion.packageVersion,
      currentDisplayVersion: appVersion.displayVersion,
      updateAvailable: false,
      checkedAt,
      repositoryUrl: githubRepositoryUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listAppReleases(): Promise<AppReleaseSummary[]> {
  const response = await fetch(`${githubApiBase}/releases?per_page=20`, {
    headers: releaseApiHeaders,
  });
  if (!response.ok) {
    throw new Error(`无法获取 GitHub Releases：HTTP ${response.status} ${response.statusText}`);
  }
  const data = await response.json() as unknown;
  if (!Array.isArray(data)) throw new Error("GitHub Releases 返回结构不是数组。");
  return data.map(normalizeRelease).filter((release) => !release.draft);
}

export async function downloadAndOpenAppUpdate(releaseId: number, assetId?: number) {
  const releases = await listAppReleases();
  const release = releases.find((item) => item.id === releaseId);
  if (!release) throw new Error(`找不到 Release：${releaseId}`);
  const asset = assetId
    ? release.assets.find((item) => item.id === assetId)
    : pickInstallerAsset(release);
  if (!asset) throw new Error(`Release ${release.tagName} 没有可下载的 Windows 安装器资产。`);

  const downloadDir = path.join(config.dataDir, "updates");
  fs.mkdirSync(downloadDir, { recursive: true });
  const installerPath = path.join(downloadDir, sanitizeDownloadName(asset.name));
  await downloadFile(asset.browserDownloadUrl, installerPath);
  openInstaller(installerPath);
  return {
    ok: true,
    release,
    asset,
    installerPath,
    downloadedAt: new Date().toISOString(),
  };
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

async function downloadFile(url: string, targetPath: string) {
  const response = await fetch(url, { headers: releaseApiHeaders });
  if (!response.ok) {
    throw new Error(`下载安装器失败：HTTP ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
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
