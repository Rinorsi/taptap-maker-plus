import { execa } from "execa";
import fs from "node:fs";
import path from "node:path";
import { config, setMakerPackage } from "../lib/config.js";
import { deleteAppSettings, getAppSetting, setAppSetting } from "../lib/db.js";
import { runtimeManager } from "./mcpRuntime.js";

const MAKER_PACKAGE_SETTING_KEY = "maker_package_spec";
const DEFAULT_CHANGELOG_TEXT = "暂无更新日志";
const RELEASE_NOTES_FILE_NAME = "mcp-release-notes.md";
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
  releaseNotes: string;
  releaseNotesPath: string;
  availableVersions: string[];
  registryError?: string;
};

export type McpPackageInstallResult = {
  status: McpPackageUpdateStatus;
  installOutput: string;
};

export type McpPackageUninstallResult = {
  ok: true;
  stoppedRuntime: true;
  clearedSettingKeys: string[];
  clearedCachePath: string;
  removedCache: boolean;
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

export function getMcpReleaseNotes() {
  const releaseNotesPath = getMcpReleaseNotesPath();
  if (!fs.existsSync(releaseNotesPath)) return DEFAULT_CHANGELOG_TEXT;
  const text = fs.readFileSync(releaseNotesPath, "utf8").trim();
  return text || DEFAULT_CHANGELOG_TEXT;
}

export function getMcpReleaseNotesPath() {
  return path.join(config.workspaceRoot, "docs", RELEASE_NOTES_FILE_NAME);
}

export async function getMcpPackageUpdateStatus(options: { checkRegistry?: boolean } = {}): Promise<McpPackageUpdateStatus> {
  const packageSpec = config.makerPackage;
  const packageName = extractPackageName(packageSpec);
  const currentVersion = getAppSetting("maker_package_resolved_version") ?? extractFixedPackageVersion(packageSpec);
  let resolvedCurrentVersion = currentVersion;
  let latestVersion: string | undefined;
  let availableVersions: string[] = [];
  let registryError: string | undefined;

  if (options.checkRegistry) {
    try {
      resolvedCurrentVersion = await readPackageVersion(packageSpec);
      setAppSetting("maker_package_resolved_version", resolvedCurrentVersion);
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
    currentVersion: resolvedCurrentVersion,
    latestVersion,
    updateAvailable: Boolean(resolvedCurrentVersion && latestVersion && resolvedCurrentVersion !== latestVersion),
    lastCheckedAt: getAppSetting("maker_package_last_checked_at"),
    lastInstalledAt: getAppSetting("maker_package_last_installed_at"),
    releaseNotes: getMcpReleaseNotes(),
    releaseNotesPath: getMcpReleaseNotesPath(),
    availableVersions,
    registryError
  };
}

export async function installMcpPackage(packageSpec: string): Promise<McpPackageInstallResult> {
  const nextPackageSpec = packageSpec.trim();
  if (!nextPackageSpec) throw new Error("MCP package spec is required");
  const packageName = extractPackageName(nextPackageSpec);
  const resolvedVersion = await readPackageVersion(nextPackageSpec);
  const installedAt = new Date().toISOString();
  const result = await execa("npm.cmd", ["exec", "--yes", "--package", nextPackageSpec, "--", "taptap-maker", "--help"], {
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
  deleteAppSettings(MCP_PACKAGE_SETTING_KEYS);
  setMakerPackage("@taptap/maker");

  let removedCache = false;
  if (fs.existsSync(config.makerNpmCacheDir)) {
    fs.rmSync(config.makerNpmCacheDir, { recursive: true, force: true });
    removedCache = true;
  }
  fs.mkdirSync(config.makerNpmCacheDir, { recursive: true });

  return {
    ok: true,
    stoppedRuntime: true,
    clearedSettingKeys: MCP_PACKAGE_SETTING_KEYS,
    clearedCachePath: config.makerNpmCacheDir,
    removedCache,
    aiClientConfigCleanup: {
      supported: false,
      message: "暂未接入 AI client MCP 配置清理；不会改动任何 AI client 配置文件。"
    },
    status: await getMcpPackageUpdateStatus()
  };
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
  const result = await execa("npm.cmd", ["view", packageName, "versions", "--json"], {
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
  const result = await execa("npm.cmd", ["view", packageSpec, "version", "--json"], {
    env: process.env,
    timeout: 30_000
  });
  const text = result.stdout.trim();
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  throw new Error(`Unable to read package version for ${packageSpec}`);
}
