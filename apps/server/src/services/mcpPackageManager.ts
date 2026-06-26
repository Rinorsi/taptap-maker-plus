import { execa } from "execa";
import { config, setMakerPackage } from "../lib/config.js";
import { getAppSetting, setAppSetting } from "../lib/db.js";

const MAKER_PACKAGE_SETTING_KEY = "maker_package_spec";
const MCP_RELEASE_NOTES_SETTING_KEY = "mcp_release_notes";
const DEFAULT_CHANGELOG_TEXT = "暂无更新日志";

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
  registryError?: string;
};

export type McpPackageInstallResult = {
  status: McpPackageUpdateStatus;
  installOutput: string;
};

export function loadStoredMakerPackage() {
  const stored = getAppSetting(MAKER_PACKAGE_SETTING_KEY);
  if (stored) setMakerPackage(stored);
}

export function getMcpReleaseNotes() {
  return getAppSetting(MCP_RELEASE_NOTES_SETTING_KEY) ?? DEFAULT_CHANGELOG_TEXT;
}

export function saveMcpReleaseNotes(releaseNotes: string) {
  const nextValue = releaseNotes.trim() || DEFAULT_CHANGELOG_TEXT;
  setAppSetting(MCP_RELEASE_NOTES_SETTING_KEY, nextValue);
  return nextValue;
}

export async function getMcpPackageUpdateStatus(options: { checkRegistry?: boolean } = {}): Promise<McpPackageUpdateStatus> {
  const packageSpec = config.makerPackage;
  const packageName = extractPackageName(packageSpec);
  const currentVersion = getAppSetting("maker_package_resolved_version") ?? extractFixedPackageVersion(packageSpec);
  let latestVersion: string | undefined;
  let registryError: string | undefined;

  if (options.checkRegistry) {
    try {
      latestVersion = await readLatestVersion(packageName);
      setAppSetting("maker_package_latest_version", latestVersion);
      setAppSetting("maker_package_last_checked_at", new Date().toISOString());
    } catch (error) {
      registryError = error instanceof Error ? error.message : String(error);
    }
  } else {
    latestVersion = getAppSetting("maker_package_latest_version");
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
    releaseNotes: getMcpReleaseNotes(),
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
