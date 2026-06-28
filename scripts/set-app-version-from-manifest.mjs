import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findManifestRelease, readUpdateManifest } from "./read-update-manifest.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));
const version = process.argv[2];

if (!version) {
  throw new Error("Usage: node scripts/set-app-version-from-manifest.mjs <version>");
}

const appVersionPath = path.join(workspaceRoot, "app-version.json");
const manifest = readUpdateManifest(workspaceRoot);
const release = findManifestRelease(manifest, version);
const appVersion = JSON.parse(fs.readFileSync(appVersionPath, "utf8"));

appVersion.displayVersion = displayVersionFromTag(version);
appVersion.packageVersion = packageVersionFromTag(version);
appVersion.announcementTitle = release.title;
appVersion.announcementBody = release.changelog;
appVersion.announcements = [
  {
    title: "静态更新清单",
    body: "版本号和更新日志来自 updates-feed 静态更新清单。",
  },
  {
    title: release.title,
    body: release.changelog,
  },
];

fs.writeFileSync(appVersionPath, `${JSON.stringify(appVersion, null, 2)}\n`, "utf8");
run("npm", ["run", "sync:version"]);

console.log(JSON.stringify({
  ok: true,
  version,
  displayVersion: appVersion.displayVersion,
  packageVersion: appVersion.packageVersion,
  title: release.title,
}, null, 2));

function displayVersionFromTag(tagName) {
  return `${tagName.replace(/^v/i, "v").replace("-alpha", "-ALPHA")}`;
}

function packageVersionFromTag(tagName) {
  const normalized = tagName.replace(/^v/i, "");
  if (/^\d+\.\d+$/.test(normalized)) return `${normalized}.0-alpha`;
  return normalized;
}

function run(command, args) {
  const usesCmdShim = process.platform === "win32" && command === "npm";
  const executable = usesCmdShim ? "cmd.exe" : command;
  const spawnArgs = usesCmdShim ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, spawnArgs, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}${result.stderr}`.trim());
  }
  if (result.stdout.trim()) process.stdout.write(result.stdout);
  if (result.stderr.trim()) process.stderr.write(result.stderr);
}
