import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const rootPackagePath = path.join(workspaceRoot, "package.json");
const tauriCliPackagePath = path.join(workspaceRoot, "node_modules", "@tauri-apps", "cli", "package.json");
const tauriConfigPath = path.join(workspaceRoot, "src-tauri", "tauri.conf.json");
const tauriCargoPath = path.join(workspaceRoot, "src-tauri", "Cargo.toml");
const tauriSrcDir = path.join(workspaceRoot, "src-tauri", "src");
const webViteConfigPath = path.join(workspaceRoot, "apps", "web", "vite.config.ts");
const webSourceIndex = path.join(workspaceRoot, "apps", "web", "index.html");
const webDistIndex = path.join(workspaceRoot, "apps", "web", "dist", "index.html");
const webDistDesktopLoading = path.join(workspaceRoot, "apps", "web", "dist", "desktop-loading.html");
const serverDistIndex = path.join(workspaceRoot, "apps", "server", "dist", "index.js");
const npmCacheDir = path.join(workspaceRoot, "data", "npm-cache");
const desktopDistDir = path.join(workspaceRoot, "desktop-dist");
const webIdentityName = 'name="taptap-maker-plus"';
const webIdentityContent = 'content="web"';

type JsonObject = Record<string, unknown>;

type MakerPackageCache = {
  packageDir: string;
  packageJsonPath: string;
  version: string;
  binPath: string;
  mainPath: string;
};

function relative(filePath: string) {
  return path.relative(workspaceRoot, filePath).replaceAll(path.sep, "/");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonObject(filePath: string) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!isObject(parsed)) {
    throw new Error(`Expected JSON object: ${relative(filePath)}`);
  }
  return parsed;
}

function commandVersion(command: string, args: string[]) {
  const usesCmdShim = process.platform === "win32" && ["npm", "npx"].includes(command);
  const executable = usesCmdShim ? "cmd.exe" : command;
  const spawnArgs = usesCmdShim ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;
  const result = spawnSync(executable, spawnArgs, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error) {
    throw new Error(`Command unavailable: ${command} ${args.join(" ")} (${result.error.message})`);
  }
  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(`Command failed: ${command} ${args.join(" ")}${details ? `\n${details}` : ""}`);
  }
  return result.stdout.trim();
}

function requireFile(filePath: string) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Required file missing: ${relative(filePath)}`);
  }
}

function requireDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    throw new Error(`Required directory missing: ${relative(dirPath)}`);
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected non-empty string: ${label}`);
  }
  return value;
}

function requireObject(value: unknown, label: string) {
  if (!isObject(value)) {
    throw new Error(`Expected object: ${label}`);
  }
  return value;
}

function requireArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array: ${label}`);
  }
  return value;
}

function requireExactString(value: unknown, expected: string, label: string) {
  const actual = requireString(value, label);
  if (actual !== expected) {
    throw new Error(`Unexpected ${label}: ${actual}`);
  }
  return actual;
}

function resolveFromDir(baseFile: string, relativePath: string) {
  return path.resolve(path.dirname(baseFile), relativePath);
}

function requirePackageScript(packageJson: JsonObject, scriptName: string, expectedCommand: string) {
  const scripts = requireObject(packageJson.scripts, "package.json scripts");
  requireExactString(scripts[scriptName], expectedCommand, `package.json scripts.${scriptName}`);
}

function requireWebAssets() {
  requireFile(webSourceIndex);
  requireFile(webDistIndex);
  requireFile(webDistDesktopLoading);
  const sourceHtml = fs.readFileSync(webSourceIndex, "utf8");
  if (!sourceHtml.includes(webIdentityName) || !sourceHtml.includes(webIdentityContent)) {
    throw new Error(`${relative(webSourceIndex)} does not include the desktop web identity meta`);
  }
  const html = fs.readFileSync(webDistIndex, "utf8");
  if (!html.includes(webIdentityName) || !html.includes(webIdentityContent)) {
    throw new Error(`${relative(webDistIndex)} does not include the desktop web identity meta`);
  }
  const assetPaths = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1])
    .filter((assetPath) => assetPath.startsWith("/assets/"));
  if (assetPaths.length === 0) {
    throw new Error(`No built assets referenced by ${relative(webDistIndex)}`);
  }
  for (const assetPath of assetPaths) {
    requireFile(path.join(workspaceRoot, "apps", "web", "dist", assetPath));
  }
  return assetPaths;
}

function requireViteDevServerConfig() {
  requireFile(webViteConfigPath);
  const viteConfig = fs.readFileSync(webViteConfigPath, "utf8");
  for (const requiredText of ['host: "127.0.0.1"', "port: 5173", "strictPort: true"]) {
    if (!viteConfig.includes(requiredText)) {
      throw new Error(`${relative(webViteConfigPath)} does not include ${requiredText}`);
    }
  }
}

function requireServerArtifact() {
  requireFile(serverDistIndex);
  requireFile(path.join(workspaceRoot, "apps", "server", "dist", "lib", "config.js"));
  requireFile(path.join(workspaceRoot, "apps", "server", "dist", "routes", "api.js"));
  requireFile(path.join(workspaceRoot, "apps", "server", "dist", "services", "mcpRuntime.js"));
  requireFile(path.join(workspaceRoot, "apps", "server", "dist", "services", "staticWeb.js"));
  const serverEntry = fs.readFileSync(serverDistIndex, "utf8");
  for (const requiredImport of ["./routes/api.js", "./services/staticWeb.js", "./services/mcpRuntime.js"]) {
    if (!serverEntry.includes(requiredImport)) {
      throw new Error(`${relative(serverDistIndex)} does not reference ${requiredImport}`);
    }
  }
  const serverConfigPath = path.join(workspaceRoot, "apps", "server", "dist", "lib", "config.js");
  const serverConfig = fs.readFileSync(serverConfigPath, "utf8");
  for (const requiredEnv of ["TAPTAP_DATA_DIR", "TAPTAP_WORKSPACE_ROOT", "TAPTAP_WEB_DIST_DIR", "TAPTAP_MAKER_NPM_CACHE_DIR", "TAPTAP_MCP_LOG_DIR", "TAPTAP_DESKTOP_INSTANCE_TOKEN"]) {
    if (!serverConfig.includes(requiredEnv)) {
      throw new Error(`${relative(serverConfigPath)} does not reference ${requiredEnv}`);
    }
  }
  const staticWebPath = path.join(workspaceRoot, "apps", "server", "dist", "services", "staticWeb.js");
  const staticWeb = fs.readFileSync(staticWebPath, "utf8");
  if (!staticWeb.includes("webDistDir")) {
    throw new Error(`${relative(staticWebPath)} does not reference config.webDistDir`);
  }
  const apiPath = path.join(workspaceRoot, "apps", "server", "dist", "routes", "api.js");
  const api = fs.readFileSync(apiPath, "utf8");
  for (const requiredText of ["/api/desktop/readiness", "taptap-maker-plus", "desktopInstanceToken", "TAPTAP_DESKTOP_INSTANCE_TOKEN"]) {
    if (!api.includes(requiredText)) {
      throw new Error(`${relative(apiPath)} does not include ${requiredText}`);
    }
  }
}

function requireNpmCache(cacheRoot: string) {
  requireDirectory(cacheRoot);
  requireDirectory(path.join(cacheRoot, "_cacache"));
  requireDirectory(path.join(cacheRoot, "_cacache", "content-v2"));
  requireDirectory(path.join(cacheRoot, "_cacache", "index-v5"));
  requireDirectory(path.join(cacheRoot, "_npx"));
}

function findMakerPackageCache(cacheRoot: string): MakerPackageCache | undefined {
  const npxRoot = path.join(cacheRoot, "_npx");
  if (!fs.existsSync(npxRoot)) return undefined;
  for (const entry of fs.readdirSync(npxRoot)) {
    const packageDir = path.join(npxRoot, entry, "node_modules", "@taptap", "maker");
    const packageJsonPath = path.join(packageDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const parsed = readJsonObject(packageJsonPath);
      requireExactString(parsed.name, "@taptap/maker", `${relative(packageJsonPath)} name`);
      const version = requireString(parsed.version, `${relative(packageJsonPath)} version`);
      const bin = requireObject(parsed.bin, `${relative(packageJsonPath)} bin`);
      const binPath = path.join(packageDir, requireString(bin["taptap-maker"], `${relative(packageJsonPath)} bin.taptap-maker`));
      const mainPath = path.join(packageDir, requireString(parsed.main, `${relative(packageJsonPath)} main`));
      requireFile(binPath);
      requireFile(mainPath);
      return { packageDir, packageJsonPath, version, binPath, mainPath };
    }
  }
  return undefined;
}

function requireCargoTauriDependency(cargoToml: string, crateName: string) {
  const match = cargoToml.match(new RegExp(`^${crateName} = \\{ version = "([^"]+)"`, "m"));
  if (!match) {
    throw new Error(`Missing Cargo dependency version for ${crateName}`);
  }
  return match[1];
}

function requireTauriConfig(rootPackage: JsonObject, tauriCliPackage: JsonObject) {
  requireFile(tauriConfigPath);
  const tauriConfig = readJsonObject(tauriConfigPath);
  const schema = requireString(tauriConfig.$schema, "tauri.conf.json $schema");
  requireFile(resolveFromDir(tauriConfigPath, schema));
  requireString(tauriConfig.productName, "tauri.conf.json productName");
  requireString(tauriConfig.version, "tauri.conf.json version");
  requireString(tauriConfig.identifier, "tauri.conf.json identifier");

  const build = requireObject(tauriConfig.build, "tauri.conf.json build");
  const frontendDist = requireExactString(build.frontendDist, "../apps/web/dist", "tauri.conf.json build.frontendDist");
  const devUrl = requireExactString(build.devUrl, "http://127.0.0.1:5173", "tauri.conf.json build.devUrl");
  const beforeDevCommand = requireExactString(build.beforeDevCommand, "npm run dev:web", "tauri.conf.json build.beforeDevCommand");
  const beforeBuildCommand = requireExactString(build.beforeBuildCommand, "npm run build:desktop", "tauri.conf.json build.beforeBuildCommand");
  requirePackageScript(rootPackage, "dev:web", "npm run dev --workspace @taptap/web");
  requirePackageScript(rootPackage, "dev:server", "npm run dev --workspace @taptap/server");
  requirePackageScript(rootPackage, "build", "npm run build --workspace @taptap/server && npm run build --workspace @taptap/web");
  requirePackageScript(rootPackage, "prepare:desktop", "node scripts/prepare-desktop-resources.mjs");
  requirePackageScript(rootPackage, "build:desktop", "npm run build && npm run prepare:desktop");
  requireDirectory(resolveFromDir(tauriConfigPath, frontendDist));

  const app = requireObject(tauriConfig.app, "tauri.conf.json app");
  const windows = requireArray(app.windows, "tauri.conf.json app.windows");
  if (windows.length === 0) {
    throw new Error("tauri.conf.json app.windows is empty");
  }
  const mainWindow = requireObject(windows[0], "tauri.conf.json app.windows[0]");
  requireExactString(mainWindow.url, "desktop-loading.html", "tauri.conf.json app.windows[0].url");
  const bundle = requireObject(tauriConfig.bundle, "tauri.conf.json bundle");
  requireExactString(bundle.targets, "nsis", "tauri.conf.json bundle.targets");
  const resources = requireObject(bundle.resources, "tauri.conf.json bundle.resources");
  if (resources["../desktop-dist"] !== "") {
    throw new Error("Unexpected tauri.conf.json bundle.resources../desktop-dist");
  }
  requireDirectory(desktopDistDir);
  requireFile(path.join(desktopDistDir, "apps", "server", "dist", "index.js"));
  requireFile(path.join(desktopDistDir, "apps", "server", "package.json"));
  requireFile(path.join(desktopDistDir, "apps", "web", "dist", "index.html"));
  requireDirectory(path.join(desktopDistDir, "node_modules", "fastify"));
  requireDirectory(path.join(desktopDistDir, "node_modules", "better-sqlite3"));
  const icons = requireArray(bundle.icon, "tauri.conf.json bundle.icon");
  if (icons.length === 0) {
    throw new Error("tauri.conf.json bundle.icon is empty");
  }
  for (const icon of icons) {
    requireFile(resolveFromDir(tauriConfigPath, requireString(icon, "tauri.conf.json bundle.icon entry")));
  }

  requireDirectory(tauriSrcDir);
  requireFile(path.join(tauriSrcDir, "main.rs"));
  const tauriLibPath = path.join(tauriSrcDir, "lib.rs");
  requireFile(tauriLibPath);
  const tauriLib = fs.readFileSync(tauriLibPath, "utf8");
  for (const requiredText of ["DesktopServer", "resource_dir", "find_available_local_port", "make_desktop_instance_token", "wait_for_desktop_server_identity", "wait_for_dev_desktop_identity", "TAPTAP_WORKSPACE_ROOT", "TAPTAP_WEB_DIST_DIR", "TAPTAP_MAKER_PROJECTS_ROOT", "TAPTAP_DESKTOP_PARENT_PID", "TAPTAP_DATA_DIR", "TAPTAP_MAKER_NPM_CACHE_DIR", "TAPTAP_MCP_LOG_DIR", "TAPTAP_SERVER_PORT", "TAPTAP_DESKTOP_INSTANCE_TOKEN", "RunEvent::Exit", "RunEvent::ExitRequested"]) {
    if (!tauriLib.includes(requiredText)) {
      throw new Error(`${relative(tauriLibPath)} does not reference ${requiredText}`);
    }
  }
  requireFile(path.join(workspaceRoot, "src-tauri", "build.rs"));
  requireFile(path.join(workspaceRoot, "src-tauri", "capabilities", "default.json"));

  requireFile(tauriCargoPath);
  const cargoToml = fs.readFileSync(tauriCargoPath, "utf8");
  const tauriCargoVersion = requireCargoTauriDependency(cargoToml, "tauri");
  const tauriBuildVersion = requireCargoTauriDependency(cargoToml, "tauri-build");
  const tauriCliVersion = requireString(tauriCliPackage.version, "@tauri-apps/cli package version");
  if (tauriCargoVersion !== tauriCliVersion) {
    throw new Error(`Tauri Cargo dependency version ${tauriCargoVersion} does not match @tauri-apps/cli ${tauriCliVersion}`);
  }

  const cliBin = requireObject(tauriCliPackage.bin, "@tauri-apps/cli bin");
  const tauriBin = requireString(cliBin.tauri, "@tauri-apps/cli bin.tauri");
  requireFile(path.join(workspaceRoot, "node_modules", "@tauri-apps", "cli", tauriBin));

  return {
    productName: tauriConfig.productName,
    identifier: tauriConfig.identifier,
    frontendDist,
    devUrl,
    beforeDevCommand,
    beforeBuildCommand,
    windowCount: windows.length,
    iconCount: icons.length,
    resourceCount: Object.keys(resources).length,
    cargo: {
      tauri: tauriCargoVersion,
      tauriBuild: tauriBuildVersion
    },
    cli: {
      version: tauriCliVersion,
      bin: tauriBin
    }
  };
}

requireFile(rootPackagePath);
requireFile(tauriCliPackagePath);
const rootPackage = readJsonObject(rootPackagePath);
const tauriCliPackage = readJsonObject(tauriCliPackagePath);

requirePackageScript(rootPackage, "verify:desktop", "tsx scripts/verify-desktop-readiness.ts");
const tauri = requireTauriConfig(rootPackage, tauriCliPackage);
requireViteDevServerConfig();
requireServerArtifact();
const webAssets = requireWebAssets();
requireNpmCache(npmCacheDir);

const makerCache = findMakerPackageCache(npmCacheDir);
if (!makerCache) {
  throw new Error("No cached @taptap/maker package found under data/npm-cache/_npx");
}

const versions = {
  node: commandVersion("node", ["-v"]),
  npm: commandVersion("npm", ["-v"]),
  npx: commandVersion("npx", ["--version"]),
  rustc: commandVersion("rustc", ["--version"]),
  cargo: commandVersion("cargo", ["--version"]),
  tauri: commandVersion("npx", ["tauri", "--version"])
};

console.log(JSON.stringify({
  ok: true,
  tauri,
  server: {
    supportsDataDirEnv: "TAPTAP_DATA_DIR",
    supportsMcpLogDirEnv: "TAPTAP_MCP_LOG_DIR",
    defaultDataDir: relative(path.join(workspaceRoot, "data")),
    serverDist: relative(serverDistIndex),
    webDist: relative(webDistIndex),
    desktopLoading: relative(webDistDesktopLoading),
    desktopDist: relative(desktopDistDir),
    webAssets
  },
  maker: {
    npmCacheDir: relative(npmCacheDir),
    cachedPackageDir: relative(makerCache.packageDir),
    cachedPackageJson: relative(makerCache.packageJsonPath),
    cachedVersion: makerCache.version,
    bin: relative(makerCache.binPath),
    main: relative(makerCache.mainPath)
  },
  versions
}, null, 2));
