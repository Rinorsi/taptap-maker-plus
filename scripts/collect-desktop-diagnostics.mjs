import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const appIdentifier = "com.taptap.makerplus";
const productName = "TapTap Maker Plus";
const workspaceRoot = path.resolve(import.meta.dirname, "..");
const installRoot = process.env.TAPTAP_INSTALL_ROOT
  ? path.resolve(process.env.TAPTAP_INSTALL_ROOT)
  : workspaceRoot;
const appDataDir = process.env.TAPTAP_DATA_DIR
  ? path.resolve(process.env.TAPTAP_DATA_DIR)
  : path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), appIdentifier);
const diagnosticsDir = process.env.TAPTAP_DIAGNOSTICS_DIR
  ? path.resolve(process.env.TAPTAP_DIAGNOSTICS_DIR)
  : path.join(installRoot, "diagnostics");
const generatedAt = new Date().toISOString();
const bundleRoot = path.join(diagnosticsDir, `taptap-maker-plus-diagnostics-${safeTimestamp(generatedAt)}`);
const zipPath = `${bundleRoot}.zip`;

fs.rmSync(bundleRoot, { recursive: true, force: true });
fs.mkdirSync(bundleRoot, { recursive: true });

const summary = {
  generatedAt,
  productName,
  appIdentifier,
  node: {
    version: process.version,
    execPath: process.execPath,
  },
  os: {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    version: os.version(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
  },
  paths: {
    installRoot,
    appDataDir,
    diagnosticsDir,
    logSourceDir: appDataDir,
  },
  resources: collectResourceChecks(),
};

writeJson(path.join(bundleRoot, "summary.json"), summary);

copyFileIfExists(path.join(appDataDir, "desktop.log"), path.join(bundleRoot, "logs", "desktop.log"));
copyFileIfExists(path.join(appDataDir, "server.log"), path.join(bundleRoot, "logs", "server.log"));
copyFileIfExists(path.join(appDataDir, "desktop-crash.log"), path.join(bundleRoot, "logs", "desktop-crash.log"));
copyFileIfExists(path.join(appDataDir, "logs", "frontend-diagnostics.log"), path.join(bundleRoot, "logs", "frontend-diagnostics.log"));
copyFileIfExists(path.join(appDataDir, "settings.json"), path.join(bundleRoot, "data", "settings.json"));
copyFileIfExists(path.join(appDataDir, "taptap-maker-plus.sqlite"), path.join(bundleRoot, "data", "taptap-maker-plus.sqlite"));
copyFileIfExists(path.join(appDataDir, "taptap-maker-plus.sqlite-wal"), path.join(bundleRoot, "data", "taptap-maker-plus.sqlite-wal"));
copyFileIfExists(path.join(appDataDir, "taptap-maker-plus.sqlite-shm"), path.join(bundleRoot, "data", "taptap-maker-plus.sqlite-shm"));
copyRecentFiles(path.join(appDataDir, "mcp-logs"), path.join(bundleRoot, "mcp-logs"), 80);

createZipWithPowerShell(bundleRoot, zipPath);
fs.rmSync(bundleRoot, { recursive: true, force: true });
console.log(`Diagnostics exported: ${zipPath}`);

if (process.argv.includes("--open")) {
  openFolder(diagnosticsDir);
}

function collectResourceChecks() {
  const checks = [
    fileCheck("Desktop executable", path.join(installRoot, "app.exe"), false),
    fileCheck("Bundled node.exe", path.join(installRoot, "node-runtime", "node.exe"), true),
    fileCheck("Bundled npm.cmd", path.join(installRoot, "node-runtime", "npm.cmd"), true),
    fileCheck("Bundled npx.cmd", path.join(installRoot, "node-runtime", "npx.cmd"), true),
    fileCheck("Server entry", path.join(installRoot, "apps", "server", "dist", "index.js"), true),
    fileCheck("Web index", path.join(installRoot, "apps", "web", "dist", "index.html"), true),
    fileCheck("Desktop loading page", path.join(installRoot, "apps", "web", "dist", "desktop-loading.html"), true),
    fileCheck("better-sqlite3 native binding", path.join(installRoot, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node"), true),
    directoryCheck("Bundled Maker npm cache seed", path.join(installRoot, "data", "npm-cache", "_npx"), true),
    directoryCheck("App data directory", appDataDir, true),
    directoryCheck("Runtime Maker npm cache", path.join(appDataDir, "npm-cache"), false),
    directoryCheck("MCP log directory", path.join(appDataDir, "mcp-logs"), false),
  ];
  return checks;
}

function fileCheck(label, filePath, required) {
  return {
    label,
    path: filePath,
    kind: "file",
    required,
    exists: fs.existsSync(filePath) && fs.statSync(filePath).isFile(),
  };
}

function directoryCheck(label, directoryPath, required) {
  return {
    label,
    path: directoryPath,
    kind: "directory",
    required,
    exists: fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(),
  };
}

function copyFileIfExists(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function copyRecentFiles(sourceDir, targetDir, maxFiles) {
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) return;
  const files = listRecentFiles(sourceDir, maxFiles);
  for (const source of files) {
    const relativePath = path.relative(sourceDir, source);
    copyFileIfExists(source, path.join(targetDir, relativePath));
  }
}

function listRecentFiles(directoryPath, maxFiles) {
  const files = [];
  const stack = [directoryPath];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        files.push({ path: entryPath, mtimeMs: fs.statSync(entryPath).mtimeMs });
      } catch {
        continue;
      }
    }
  }
  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, maxFiles)
    .map((item) => item.path);
}

function createZipWithPowerShell(sourceDir, targetZipPath) {
  fs.mkdirSync(path.dirname(targetZipPath), { recursive: true });
  fs.rmSync(targetZipPath, { force: true });
  const command = [
    "$ErrorActionPreference = 'Stop';",
    "Compress-Archive",
    "-Path",
    quotePowerShellPath(path.join(sourceDir, "*")),
    "-DestinationPath",
    quotePowerShellPath(targetZipPath),
    "-Force",
  ].join(" ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`诊断包压缩失败${details ? `：${details}` : ""}`);
  }
}

function openFolder(folderPath) {
  if (process.platform !== "win32") return;
  spawnSync("cmd.exe", ["/d", "/s", "/c", "start", "", folderPath], {
    stdio: "ignore",
    windowsHide: true,
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function quotePowerShellPath(filePath) {
  return `'${filePath.replaceAll("'", "''")}'`;
}

function safeTimestamp(value) {
  return value.replace(/[:.]/g, "-");
}
