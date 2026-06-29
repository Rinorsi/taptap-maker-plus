import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const nsisDir = path.join(workspaceRoot, "src-tauri", "target", "release", "bundle", "nsis");
const requiredArchivePaths = [
  "apps\\server\\dist\\index.js",
  "apps\\web\\dist\\index.html",
  "desktop-runtime-manifest.json",
  "Export Diagnostics.cmd",
  "collect-desktop-diagnostics.mjs",
  "node-runtime\\node.exe",
  "node-runtime\\npm.cmd",
  "node-runtime\\npx.cmd",
  "node-runtime\\node_modules\\npm\\bin\\npm-cli.js",
  "node-runtime\\node_modules\\npm\\bin\\npx-cli.js",
  "node_modules\\better-sqlite3\\build\\Release\\better_sqlite3.node",
  "data\\npm-cache\\_npx"
];

const explicitInstallerPath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
const installerPath = explicitInstallerPath ?? newestInstaller();
const sevenZipPath = find7z();

if (!installerPath) {
  throw new Error(`No NSIS installer found under ${relative(nsisDir)}`);
}

const result = spawnSync(sevenZipPath, ["l", installerPath], {
  cwd: workspaceRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const output = `${result.stdout}\n${result.stderr}`;
if (!output.includes("Listing archive:") && !output.includes("Path =")) {
  throw new Error(`Unable to list installer contents with ${sevenZipPath}\n${summarizeToolOutput(output)}`);
}

const missing = requiredArchivePaths.filter((archivePath) => !output.includes(archivePath));
if (missing.length) {
  throw new Error(`Installer is missing required runtime resources:\n${missing.join("\n")}\n\n${summarizeToolOutput(output)}`);
}

console.log(JSON.stringify({
  ok: true,
  installer: relative(installerPath),
  sevenZip: sevenZipPath,
  requiredArchivePaths
}, null, 2));

function newestInstaller() {
  if (!fs.existsSync(nsisDir)) return undefined;
  const installers = fs.readdirSync(nsisDir)
    .filter((name) => name.endsWith("_x64-setup.exe"))
    .map((name) => path.join(nsisDir, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  return installers[0];
}

function find7z() {
  const envPath = process.env.PATH ?? "";
  const pathEntries = envPath.split(path.delimiter).filter(Boolean);
  const executableNames = process.platform === "win32" ? ["7z.exe", "7za.exe"] : ["7z", "7za"];
  for (const dir of pathEntries) {
    for (const executableName of executableNames) {
      const filePath = path.join(dir, executableName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
    }
  }
  const knownWindowsPaths = [
    "C:\\Program Files\\7-Zip\\7z.exe",
    "C:\\Program Files\\AMD\\AMDInstallManager\\7z.exe",
    "C:\\Program Files\\AMD\\CNext\\CNext\\7z.exe"
  ];
  for (const filePath of knownWindowsPaths) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
  }
  throw new Error("7z executable was not found; install 7-Zip or add it to PATH before verifying NSIS bundle contents.");
}

function relative(filePath) {
  return path.relative(workspaceRoot, filePath).replaceAll(path.sep, "/");
}

function summarizeToolOutput(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.includes("ERROR") || line.includes("Error") || line.includes("Warnings") || line.includes("Type =") || line.includes("Path ="))
    .slice(0, 40)
    .join("\n");
}
