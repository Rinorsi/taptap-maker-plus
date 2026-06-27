import fs from "node:fs";
import path from "node:path";

export function readUpdateManifest(workspaceRoot) {
  const manifestPath = path.join(workspaceRoot, "updates", "app-update-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateUpdateManifest(manifest, manifestPath);
  return manifest;
}

export function findManifestRelease(manifest, version) {
  const release = manifest.releases.find((item) => item.version === version);
  if (!release) {
    throw new Error(`updates/app-update-manifest.json missing release: ${version}`);
  }
  return release;
}

function validateUpdateManifest(manifest, manifestPath) {
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
    for (const key of ["version", "title", "changelog"]) {
      if (typeof release[key] !== "string" || !release[key].trim()) {
        throw new Error(`${manifestPath} release requires string key: ${key}`);
      }
    }
  }
  findManifestRelease(manifest, manifest.latestVersion);
}
