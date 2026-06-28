import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));

export function readUpdateManifest(workspaceRoot) {
  const manifestRoot = process.env.TAPTAP_UPDATE_MANIFEST_ROOT
    ? path.resolve(workspaceRoot, process.env.TAPTAP_UPDATE_MANIFEST_ROOT)
    : path.join(workspaceRoot, "update-feed");
  const manifestPath = path.join(manifestRoot, "app-update-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateUpdateManifest(manifest, manifestPath, manifestRoot);
  return {
    ...manifest,
    __manifestRoot: manifestRoot,
    __manifestPath: manifestPath,
  };
}

export function findManifestRelease(manifest, version) {
  const release = manifest.releases.find((item) => item.version === version);
  if (!release) {
    throw new Error(`${manifest.__manifestPath ?? "app-update-manifest.json"} missing release: ${version}`);
  }
  return {
    ...release,
    changelog: readReleaseChangelog(release, manifest.__manifestRoot ?? path.join(workspaceRoot, "update-feed")),
  };
}

function validateUpdateManifest(manifest, manifestPath, manifestRoot) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error(`${manifestPath} must be a JSON object`);
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error(`${manifestPath} schemaVersion must be 1`);
  }
  for (const key of ["generatedAt", "repositoryUrl", "latestVersion"]) {
    if (typeof manifest[key] !== "string" || !manifest[key].trim()) {
      throw new Error(`${manifestPath} requires string key: ${key}`);
    }
  }
  if (!Array.isArray(manifest.releases) || manifest.releases.length === 0) {
    throw new Error(`${manifestPath} releases must be a non-empty array`);
  }
  for (const release of manifest.releases) {
    if (!release || typeof release !== "object" || Array.isArray(release)) {
      throw new Error(`${manifestPath} release entries must be objects`);
    }
    for (const key of ["version", "title"]) {
      if (typeof release[key] !== "string" || !release[key].trim()) {
        throw new Error(`${manifestPath} release requires string key: ${key}`);
      }
    }
    const hasInlineChangelog = typeof release.changelog === "string" && release.changelog.trim();
    const hasChangelogPath = typeof release.changelogPath === "string" && release.changelogPath.trim();
    if (!hasInlineChangelog && !hasChangelogPath) {
      throw new Error(`${manifestPath} release requires string key: changelog or changelogPath`);
    }
    if (release.assets !== undefined) {
      validateReleaseAssets(release.assets, manifestPath);
    }
  }
  findManifestRelease({
    ...manifest,
    __manifestRoot: manifestRoot,
    __manifestPath: manifestPath,
  }, manifest.latestVersion);
}

function validateReleaseAssets(assets, manifestPath) {
  if (!Array.isArray(assets) || assets.length === 0) {
    throw new Error(`${manifestPath} release.assets must be a non-empty array when provided`);
  }
  for (const asset of assets) {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      throw new Error(`${manifestPath} release.assets entries must be objects`);
    }
    if (typeof asset.name !== "string" || !asset.name.trim()) {
      throw new Error(`${manifestPath} release.assets requires string key: name`);
    }
    if (asset.size !== undefined && (typeof asset.size !== "number" || !Number.isFinite(asset.size) || asset.size < 0)) {
      throw new Error(`${manifestPath} release.assets size must be a non-negative number`);
    }
    if (asset.sha256 !== undefined && (typeof asset.sha256 !== "string" || !/^[A-Fa-f0-9]{64}$/.test(asset.sha256))) {
      throw new Error(`${manifestPath} release.assets sha256 must be a 64-character hex string`);
    }
    if (asset.downloadSources !== undefined) {
      validateDownloadSources(asset.downloadSources, manifestPath);
    } else if (asset.downloadUrls !== undefined) {
      validateDownloadUrls(asset.downloadUrls, manifestPath);
    } else if (typeof asset.browserDownloadUrl !== "string" || !asset.browserDownloadUrl.trim()) {
      throw new Error(`${manifestPath} release.assets requires downloadSources, downloadUrls, or browserDownloadUrl`);
    }
  }
}

function validateDownloadSources(downloadSources, manifestPath) {
  if (!Array.isArray(downloadSources) || downloadSources.length === 0) {
    throw new Error(`${manifestPath} release.assets.downloadSources must be a non-empty array`);
  }
  for (const source of downloadSources) {
    if (typeof source === "string") {
      validateUrl(source, manifestPath);
      continue;
    }
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      throw new Error(`${manifestPath} release.assets.downloadSources entries must be strings or objects`);
    }
    if (typeof source.url !== "string" || !source.url.trim()) {
      throw new Error(`${manifestPath} release.assets.downloadSources requires string key: url`);
    }
    validateUrl(source.url, manifestPath);
    if (source.label !== undefined && (typeof source.label !== "string" || !source.label.trim())) {
      throw new Error(`${manifestPath} release.assets.downloadSources label must be a non-empty string`);
    }
  }
}

function validateDownloadUrls(downloadUrls, manifestPath) {
  if (!Array.isArray(downloadUrls) || downloadUrls.length === 0) {
    throw new Error(`${manifestPath} release.assets.downloadUrls must be a non-empty array`);
  }
  for (const url of downloadUrls) {
    if (typeof url !== "string" || !url.trim()) {
      throw new Error(`${manifestPath} release.assets.downloadUrls entries must be strings`);
    }
    validateUrl(url, manifestPath);
  }
}

function validateUrl(value, manifestPath) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${manifestPath} release asset URL must be http or https`);
  }
}

function readReleaseChangelog(release, manifestRoot) {
  if (typeof release.changelog === "string" && release.changelog.trim()) {
    return release.changelog;
  }
  const changelogPath = path.join(
    manifestRoot,
    release.changelogPath,
  );
  if (!fs.existsSync(changelogPath)) {
    throw new Error(`Release changelog file not found: ${changelogPath}`);
  }
  const changelog = fs.readFileSync(changelogPath, "utf8").trim();
  if (!changelog) {
    throw new Error(`Release changelog file is empty: ${changelogPath}`);
  }
  return changelog;
}
