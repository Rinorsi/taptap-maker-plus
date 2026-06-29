import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import { config, setMakerPackage } from "../lib/config.js";
import { deleteAppSettings, getAppSetting, setAppSetting } from "../lib/db.js";
import { runtimeManager } from "./mcpRuntime.js";

const MAKER_PACKAGE_SETTING_KEY = "maker_package_spec";
const DEFAULT_CHANGELOG_TEXT = "暂无更新日志";
const RELEASE_NOTES_FILE_NAME = "mcp-release-notes.md";
const GITHUB_OWNER = "Rinorsi";
const GITHUB_REPO = "taptap-maker-plus";
const UPDATE_FEED_REF = "updates-feed";
const REMOTE_RELEASE_NOTES_URLS = [
  `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${UPDATE_FEED_REF}/${RELEASE_NOTES_FILE_NAME}`,
  `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${UPDATE_FEED_REF}/${RELEASE_NOTES_FILE_NAME}`
];
const MCP_PACKAGE_SETTING_KEYS = [
  MAKER_PACKAGE_SETTING_KEY,
  "maker_package_resolved_version",
  "maker_package_latest_version",
  "maker_package_last_checked_at",
  "maker_package_versions",
  "maker_package_last_installed_at"
];

export type McpPackageUpdateStatus = {
  packageName: string;
  packageSpec: string;
  installedSpec: string;
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable: boolean;
  lastCheckedAt?: string;
  lastInstalledAt?: string;
  localInstalled: boolean;
  packageConfigured: boolean;
  cachePath: string;
  cacheExists: boolean;
  cacheSizeBytes: number;
  cacheEntryCount: number;
  releaseNotes: string;
  releaseNotesPath: string;
  releaseNotesSource: "cloud" | "local" | "fallback";
  releaseNotesError?: string;
  availableVersions: string[];
  registryError?: string;
};

export type McpPackageInstallResult = {
  status: McpPackageUpdateStatus;
  installOutput: string;
};

export type McpPackageUninstallStep = {
  id: "stop_runtime" | "clear_settings" | "clear_cache" | "preserve_projects" | "ai_client_config";
  label: string;
  status: "done" | "skipped";
  detail: string;
};

export type McpPackageUninstallResult = {
  ok: true;
  stoppedRuntime: true;
  clearedSettingKeys: string[];
  clearedCachePath: string;
  removedCache: boolean;
  steps: McpPackageUninstallStep[];
  aiClientConfigCleanup: {
    supported: false;
    message: string;
  };
  status: McpPackageUpdateStatus;
};

export function loadStoredMakerPackage() {
  const stored = getAppSetting(MAKER_PACKAGE_SETTING_KEY);
  if (stored) setMakerPackage(stored);
}

export type McpReleaseNotes = {
  text: string;
  source: "cloud" | "local" | "fallback";
  path: string;
  error?: string;
};

export async function getMcpReleaseNotes(): Promise<McpReleaseNotes> {
  const remoteErrors: string[] = [];
  for (const releaseNotesUrl of REMOTE_RELEASE_NOTES_URLS) {
    try {
      return {
        text: await fetchRemoteReleaseNotes(releaseNotesUrl),
        source: "cloud",
        path: releaseNotesUrl
      };
    } catch (error) {
      remoteErrors.push(`${releaseNotesUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const releaseNotesPath = getMcpReleaseNotesPath();
  if (!fs.existsSync(releaseNotesPath)) {
    return {
      text: DEFAULT_CHANGELOG_TEXT,
      source: "fallback",
      path: releaseNotesPath,
      error: remoteErrors.length ? remoteErrors.join("；") : undefined
    };
  }
  const text = fs.readFileSync(releaseNotesPath, "utf8").trim();
  if (text) {
    return {
      text,
      source: "local",
      path: releaseNotesPath,
      error: remoteErrors.length ? remoteErrors.join("；") : undefined
    };
  }
  return {
    text: DEFAULT_CHANGELOG_TEXT,
    source: "fallback",
    path: releaseNotesPath,
    error: remoteErrors.length ? remoteErrors.join("；") : undefined
  };
}

export function getMcpReleaseNotesPath() {
  return path.join(config.workspaceRoot, "docs", RELEASE_NOTES_FILE_NAME);
}

export async function getMcpPackageUpdateStatus(options: { checkRegistry?: boolean } = {}): Promise<McpPackageUpdateStatus> {
  const packageSpec = config.makerPackage;
  const packageName = extractPackageName(packageSpec);
  const configuredPackageSpec = getAppSetting(MAKER_PACKAGE_SETTING_KEY);
  const storedCurrentVersion = getAppSetting("maker_package_resolved_version");
  const currentVersion = storedCurrentVersion ?? (configuredPackageSpec ? extractFixedPackageVersion(packageSpec) : undefined);
  const packageConfigured = Boolean(configuredPackageSpec || storedCurrentVersion);
  const cacheStats = readCacheStats(config.makerNpmCacheDir);
  let latestVersion: string | undefined;
  let availableVersions: string[] = [];
  let registryError: string | undefined;
  const releaseNotes = await getMcpReleaseNotes();

  if (options.checkRegistry) {
    try {
      availableVersions = await readPackageVersions(packageName);
      latestVersion = availableVersions[availableVersions.length - 1];
      if (!latestVersion) latestVersion = await readLatestVersion(packageName);
      setAppSetting("maker_package_latest_version", latestVersion);
      setAppSetting("maker_package_last_checked_at", new Date().toISOString());
      setAppSetting("maker_package_versions", JSON.stringify(availableVersions));
    } catch (error) {
      registryError = error instanceof Error ? error.message : String(error);
    }
  } else {
    latestVersion = getAppSetting("maker_package_latest_version");
    availableVersions = parseStoredVersions(getAppSetting("maker_package_versions"));
  }

  return {
    packageName,
    packageSpec,
    installedSpec: config.makerPackage,
    currentVersion,
    latestVersion,
    updateAvailable: Boolean(currentVersion && latestVersion && currentVersion !== latestVersion),
    lastCheckedAt: getAppSetting("maker_package_last_checked_at"),
    lastInstalledAt: getAppSetting("maker_package_last_installed_at"),
    localInstalled: Boolean(packageConfigured && currentVersion && cacheStats.exists && cacheStats.entryCount > 0),
    packageConfigured,
    cachePath: config.makerNpmCacheDir,
    cacheExists: cacheStats.exists,
    cacheSizeBytes: cacheStats.sizeBytes,
    cacheEntryCount: cacheStats.entryCount,
    releaseNotes: releaseNotes.text,
    releaseNotesPath: releaseNotes.path,
    releaseNotesSource: releaseNotes.source,
    releaseNotesError: releaseNotes.error,
    availableVersions,
    registryError
  };
}

async function fetchRemoteReleaseNotes(releaseNotesUrl: string) {
  const response = await fetch(releaseNotesUrl, {
    headers: {
      "Accept": "text/markdown,text/plain,*/*",
      "User-Agent": "TapTap-Maker-Plus-MCP-Updater"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const text = (await response.text()).trim();
  if (!text) throw new Error("远端 Maker MCP 更新日志为空。");
  return text;
}

export async function installMcpPackage(packageSpec: string): Promise<McpPackageInstallResult> {
  const nextPackageSpec = packageSpec.trim();
  if (!nextPackageSpec) throw new Error("MCP package spec is required");
  const packageName = extractPackageName(nextPackageSpec);
  const resolvedVersion = await readPackageVersion(nextPackageSpec);
  const installedAt = new Date().toISOString();
  const result = await execa(config.npmCommand, ["exec", "--yes", "--package", nextPackageSpec, "--", "taptap-maker", "--help"], {
    env: {
      ...process.env,
      npm_config_cache: config.makerNpmCacheDir,
      NPM_CONFIG_CACHE: config.makerNpmCacheDir
    },
    timeout: 120_000,
    reject: false
  });
  const installOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.failed) {
    throw new Error(installOutput || `Failed to install ${nextPackageSpec}`);
  }

  setAppSetting(MAKER_PACKAGE_SETTING_KEY, nextPackageSpec);
  setAppSetting("maker_package_resolved_version", resolvedVersion);
  setAppSetting("maker_package_last_installed_at", installedAt);
  setMakerPackage(nextPackageSpec);
  const latestVersion = await readLatestVersion(packageName).catch(() => undefined);
  if (latestVersion) {
    setAppSetting("maker_package_latest_version", latestVersion);
    setAppSetting("maker_package_last_checked_at", new Date().toISOString());
  }
  return {
    status: await getMcpPackageUpdateStatus(),
    installOutput
  };
}

export async function uninstallMcpPackage(): Promise<McpPackageUninstallResult> {
  await runtimeManager.stopAll();
  const steps: McpPackageUninstallStep[] = [
    {
      id: "stop_runtime",
      label: "停止 MCP runtime",
      status: "done",
      detail: "已请求停止当前桌面端内所有 MCP runtime。"
    }
  ];

  deleteAppSettings(MCP_PACKAGE_SETTING_KEYS);
  steps.push({
    id: "clear_settings",
    label: "清理版本设置",
    status: "done",
    detail: `已清理 ${MCP_PACKAGE_SETTING_KEYS.length} 项桌面端 MCP 包版本设置。`
  });
  setMakerPackage("@taptap/maker");

  let removedCache = false;
  if (fs.existsSync(config.makerNpmCacheDir)) {
    fs.rmSync(config.makerNpmCacheDir, { recursive: true, force: true });
    removedCache = true;
  }
  fs.mkdirSync(config.makerNpmCacheDir, { recursive: true });
  steps.push({
    id: "clear_cache",
    label: "清理 npm-cache",
    status: removedCache ? "done" : "skipped",
    detail: removedCache
      ? `已清空本地缓存目录：${config.makerNpmCacheDir}`
      : `本地缓存目录原本不存在，已创建空目录：${config.makerNpmCacheDir}`
  });
  steps.push({
    id: "preserve_projects",
    label: "保留 Maker 项目",
    status: "done",
    detail: "未删除任何 Maker 项目目录。"
  });
  steps.push({
    id: "ai_client_config",
    label: "AI client 配置",
    status: "skipped",
    detail: "暂未接入 AI client MCP 配置清理；没有改动任何 AI client 配置文件。"
  });

  return {
    ok: true,
    stoppedRuntime: true,
    clearedSettingKeys: MCP_PACKAGE_SETTING_KEYS,
    clearedCachePath: config.makerNpmCacheDir,
    removedCache,
    steps,
    aiClientConfigCleanup: {
      supported: false,
      message: "暂未接入 AI client MCP 配置清理；不会改动任何 AI client 配置文件。"
    },
    status: await getMcpPackageUpdateStatus({ checkRegistry: true })
  };
}

function readCacheStats(cachePath: string) {
  if (!fs.existsSync(cachePath)) {
    return { exists: false, sizeBytes: 0, entryCount: 0 };
  }

  let sizeBytes = 0;
  let entryCount = 0;
  const stack = [cachePath];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      entryCount += 1;
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      try {
        sizeBytes += fs.statSync(entryPath).size;
      } catch {
        continue;
      }
    }
  }

  return { exists: true, sizeBytes, entryCount };
}

function extractPackageName(packageSpec: string) {
  const trimmed = packageSpec.trim();
  if (trimmed.startsWith("@")) {
    const [scope, name] = trimmed.split("/");
    const packageName = `${scope}/${(name ?? "").split("@")[0]}`;
    if (scope && name) return packageName;
  }
  return trimmed.split("@")[0] || trimmed;
}

function extractPackageVersionToken(packageSpec: string) {
  const trimmed = packageSpec.trim();
  if (trimmed.startsWith("@")) {
    const version = trimmed.split("/")[1]?.split("@")[1];
    return version || undefined;
  }
  const version = trimmed.split("@")[1];
  return version || undefined;
}

function extractFixedPackageVersion(packageSpec: string) {
  const version = extractPackageVersionToken(packageSpec);
  return version && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : undefined;
}

async function readLatestVersion(packageName: string) {
  return readPackageVersion(packageName);
}

async function readPackageVersions(packageName: string) {
  const result = await execa(config.npmCommand, ["view", packageName, "versions", "--json"], {
    env: process.env,
    timeout: 30_000
  });
  const parsed = JSON.parse(result.stdout.trim()) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseStoredVersions(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

async function readPackageVersion(packageSpec: string) {
  const result = await execa(config.npmCommand, ["view", packageSpec, "version", "--json"], {
    env: process.env,
    timeout: 30_000
  });
  const text = result.stdout.trim();
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  throw new Error(`Unable to read package version for ${packageSpec}`);
}
