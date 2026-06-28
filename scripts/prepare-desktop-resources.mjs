import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(workspaceRoot, "desktop-dist");

const requiredRuntimePaths = [
  "apps/server/dist",
  "apps/server/package.json",
  "apps/web/dist"
];

const bundledNodeRuntimePaths = [
  "node.exe",
  "npm.cmd",
  "npx.cmd",
  "node_modules/npm"
];

const optionalBundledReadOnlyPaths = [
  "docs/help",
  "docs/templates",
  "docs/workflow-templates"
];

const requiredNativeRuntimeFiles = [
  "node_modules/better-sqlite3/build/Release/better_sqlite3.node"
];

const defaultMakerPackage = "@taptap/maker";

function run(command, args) {
  const usesCmdShim = process.platform === "win32" && command === "npm";
  const executable = usesCmdShim ? "cmd.exe" : command;
  const spawnArgs = usesCmdShim ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, spawnArgs, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed${details ? `\n${details}` : ""}`);
  }
  return result.stdout.trim();
}

function copyRelative(relativePath, options = {}) {
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(outputRoot, relativePath);
  if (!fs.existsSync(source)) {
    if (options.optional) return false;
    throw new Error(`Missing desktop resource source: ${relativePath}`);
  }
  fs.cpSync(source, target, { recursive: true, dereference: true });
  return true;
}

function copyPackage(packagePath) {
  const relativePath = path.relative(workspaceRoot, packagePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Unexpected dependency path outside workspace: ${packagePath}`);
  }
  copyRelative(relativePath);
}

function copyBundledNodeRuntime() {
  const nodeExecutable = process.execPath;
  const nodeRoot = path.dirname(nodeExecutable);
  const runtimeRoot = path.join(outputRoot, "node-runtime");
  fs.mkdirSync(runtimeRoot, { recursive: true });

  for (const relativePath of bundledNodeRuntimePaths) {
    const source = path.join(nodeRoot, relativePath);
    const target = path.join(runtimeRoot, relativePath);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing bundled Node runtime source: ${source}`);
    }
    fs.cpSync(source, target, { recursive: true, dereference: true });
  }
}

function prepareMakerNpmCacheSeed() {
  const seededCacheRoot = path.join(outputRoot, "data", "npm-cache");
  fs.mkdirSync(seededCacheRoot, { recursive: true });
  const npmCommand = process.platform === "win32" ? path.join(outputRoot, "node-runtime", "npm.cmd") : path.join(outputRoot, "node-runtime", "npm");
  const npmArgs = [
    "exec",
    "--yes",
    "--package",
    defaultMakerPackage,
    "--",
    "taptap-maker",
    "--help"
  ];
  const executable = process.platform === "win32" ? "cmd.exe" : npmCommand;
  const spawnArgs = process.platform === "win32" ? ["/d", "/s", "/c", npmCommand, ...npmArgs] : npmArgs;
  const result = spawnSync(executable, spawnArgs, {
    cwd: outputRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_cache: seededCacheRoot,
      NPM_CONFIG_CACHE: seededCacheRoot
    }
  });
  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`Failed to seed bundled ${defaultMakerPackage} npm cache${details ? `\n${details}` : ""}`);
  }

  const packageJsonPath = findMakerPackageJson(seededCacheRoot);
  if (!packageJsonPath) {
    throw new Error(`Seeded npm cache does not contain ${defaultMakerPackage}`);
  }
  return packageJsonPath;
}

function findMakerPackageJson(cacheRoot) {
  const npxRoot = path.join(cacheRoot, "_npx");
  if (!fs.existsSync(npxRoot)) return undefined;
  const stack = [npxRoot];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name === "package.json" && entryPath.includes(`${path.sep}@taptap${path.sep}maker${path.sep}`)) {
        return entryPath;
      }
    }
  }
  return undefined;
}

function writeDiagnosticsCommand() {
  const scriptPath = path.join(outputRoot, "collect-desktop-diagnostics.mjs");
  fs.copyFileSync(path.join(workspaceRoot, "scripts", "collect-desktop-diagnostics.mjs"), scriptPath);
  const commandPath = path.join(outputRoot, "Export Diagnostics.cmd");
  const command = [
    "@echo off",
    "chcp 65001 >nul",
    "setlocal",
    "set \"ROOT=%~dp0\"",
    "set \"TAPTAP_INSTALL_ROOT=%ROOT:~0,-1%\"",
    "set \"TAPTAP_DIAGNOSTICS_DIR=%TAPTAP_INSTALL_ROOT%\\diagnostics\"",
    "\"%ROOT%node-runtime\\node.exe\" \"%ROOT%collect-desktop-diagnostics.mjs\" --open",
    "echo.",
    "echo If the diagnostics folder did not open, check: %TAPTAP_DIAGNOSTICS_DIR%",
    "pause"
  ].join("\r\n");
  fs.writeFileSync(commandPath, `${command}\r\n`, "utf8");
}

fs.rmSync(outputRoot, { recursive: true, force: true });

for (const relativePath of requiredRuntimePaths) {
  copyRelative(relativePath);
}

copyBundledNodeRuntime();
writeDiagnosticsCommand();
const seededMakerPackageJson = prepareMakerNpmCacheSeed();

const bundledReadOnlyPaths = [];
const skippedReadOnlyPaths = [];
for (const relativePath of optionalBundledReadOnlyPaths) {
  if (copyRelative(relativePath, { optional: true })) {
    bundledReadOnlyPaths.push(relativePath);
  } else {
    skippedReadOnlyPaths.push(relativePath);
  }
}

const dependencyPaths = run("npm", ["ls", "--workspace", "@taptap/server", "--omit=dev", "--parseable", "--all"])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => line !== workspaceRoot && line !== path.join(workspaceRoot, "node_modules", "@taptap", "server"));

for (const dependencyPath of dependencyPaths) {
  copyPackage(dependencyPath);
}

for (const relativePath of requiredNativeRuntimeFiles) {
  const outputPath = path.join(outputRoot, relativePath);
  if (!fs.existsSync(outputPath) || !fs.statSync(outputPath).isFile()) {
    throw new Error(`Missing desktop native runtime file after dependency copy: ${relativePath}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  outputRoot: path.relative(workspaceRoot, outputRoot).replaceAll(path.sep, "/"),
  bundledNodeRuntime: path.relative(workspaceRoot, path.join(outputRoot, "node-runtime")).replaceAll(path.sep, "/"),
  seededNpmCache: path.relative(workspaceRoot, path.join(outputRoot, "data", "npm-cache")).replaceAll(path.sep, "/"),
  seededMakerPackageJson: path.relative(workspaceRoot, seededMakerPackageJson).replaceAll(path.sep, "/"),
  dependencies: dependencyPaths.length,
  bundledReadOnlyPaths,
  skippedReadOnlyPaths
}, null, 2));
