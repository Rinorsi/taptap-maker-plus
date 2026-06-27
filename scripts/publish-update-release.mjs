import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findManifestRelease, readUpdateManifest } from "./read-update-manifest.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));
const version = process.argv[2];

if (!version) {
  throw new Error("Usage: node scripts/publish-update-release.mjs <version>");
}

const manifest = readUpdateManifest(workspaceRoot);
const release = findManifestRelease(manifest, version);
const installerPath = path.join(
  workspaceRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
  `TapTap Maker Plus 桌面端_${installerVersionFromTag(version)}_x64-setup.exe`,
);

if (!fs.existsSync(installerPath)) {
  throw new Error(`Installer not found: ${installerPath}`);
}

const notesPath = path.join(os.tmpdir(), `taptap-maker-plus-${installerVersionFromTag(version)}-notes.md`);
fs.writeFileSync(notesPath, `${release.changelog.trim()}\n`, "utf8");

const view = spawnSync("gh", ["release", "view", version, "--repo", "Rinorsi/taptap-maker-plus"], {
  cwd: workspaceRoot,
  stdio: "ignore",
});

if (view.status === 0) {
  runGh(["release", "edit", version, "--repo", "Rinorsi/taptap-maker-plus", "--title", release.title, "--notes-file", notesPath, "--prerelease"]);
} else {
  runGh(["release", "create", version, "--repo", "Rinorsi/taptap-maker-plus", "--target", "main", "--title", release.title, "--notes-file", notesPath, "--prerelease"]);
}

runGh(["release", "upload", version, installerPath, "--repo", "Rinorsi/taptap-maker-plus", "--clobber"]);

console.log(JSON.stringify({
  ok: true,
  version,
  title: release.title,
  installerPath,
  size: fs.statSync(installerPath).size,
}, null, 2));

function runGh(args) {
  const result = spawnSync("gh", args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`gh ${args.join(" ")} failed\n${result.stdout}${result.stderr}`.trim());
  }
}

function installerVersionFromTag(tagName) {
  const normalized = tagName.replace(/^v/i, "");
  if (/^\d+\.\d+$/.test(normalized)) return `${normalized}.0-alpha`;
  return normalized;
}
