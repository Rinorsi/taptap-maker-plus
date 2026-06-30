import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const thisFile = fileURLToPath(import.meta.url);
const serverSrcDir = path.dirname(path.dirname(thisFile));
const serverAppDir = path.dirname(serverSrcDir);
const appsDir = path.dirname(serverAppDir);
export const workspaceRoot = process.env.TAPTAP_WORKSPACE_ROOT ?? path.dirname(appsDir);
export const defaultMakerProjectsRoot = path.dirname(workspaceRoot);
const dataDir = process.env.TAPTAP_DATA_DIR ?? path.join(workspaceRoot, "data");
const nodeRuntimeDir = process.env.TAPTAP_NODE_RUNTIME_DIR;
const isProductionRuntime = process.env.NODE_ENV === "production";
const nodeRuntimeCommands = resolveNodeRuntimeCommands(nodeRuntimeDir);

export const config = {
  port: Number(process.env.TAPTAP_SERVER_PORT ?? 8787),
  host: process.env.TAPTAP_SERVER_HOST ?? "127.0.0.1",
  workspaceRoot,
  dataDir,
  databasePath: path.join(dataDir, "taptap-maker-plus.sqlite"),
  webDistDir: process.env.TAPTAP_WEB_DIST_DIR ?? path.join(workspaceRoot, "apps", "web", "dist"),
  makerNpmCacheDir: process.env.TAPTAP_MAKER_NPM_CACHE_DIR ?? path.join(dataDir, "npm-cache"),
  mcpLogDir: process.env.TAPTAP_MCP_LOG_DIR ?? path.join(dataDir, "mcp-logs"),
  makerProjectsRoot: process.env.TAPTAP_MAKER_PROJECTS_ROOT ?? defaultMakerProjectsRoot,
  makerPackage: process.env.TAPTAP_MAKER_PACKAGE ?? "@taptap/maker",
  makerEnv: process.env.TAPTAP_MCP_ENV ?? "production",
  agentModelId: process.env.TAPTAP_AGENT_MODEL_ID,
  agentModelUrl: process.env.TAPTAP_AGENT_MODEL_URL,
  agentModelApiKey: process.env.TAPTAP_AGENT_MODEL_API_KEY,
  nodeRuntimeDir: nodeRuntimeCommands.nodeRuntimeDir,
  nodeCommand: nodeRuntimeCommands.nodeCommand,
  npmCommand: nodeRuntimeCommands.npmCommand,
  npxCommand: nodeRuntimeCommands.npxCommand,
  desktopInstanceToken: process.env.TAPTAP_DESKTOP_INSTANCE_TOKEN
};

function resolveNodeRuntimeCommands(runtimeDir?: string) {
  const nodeFallback = process.execPath;
  const nodeName = process.platform === "win32" ? "node.exe" : "node";
  const npmFallback = process.platform === "win32" ? "npm.cmd" : "npm";
  const npxFallback = process.platform === "win32" ? "npx.cmd" : "npx";
  if (!runtimeDir) {
    if (isProductionRuntime) {
      throw new Error("Bundled Node runtime is required in production, but TAPTAP_NODE_RUNTIME_DIR is not set.");
    }
    return {
      nodeRuntimeDir: undefined,
      nodeCommand: nodeFallback,
      npmCommand: npmFallback,
      npxCommand: npxFallback
    };
  }

  const nodeCommand = path.join(runtimeDir, nodeName);
  const npmCommand = path.join(runtimeDir, npmFallback);
  const npxCommand = path.join(runtimeDir, npxFallback);
  if (!fs.existsSync(nodeCommand) || !fs.existsSync(npmCommand) || !fs.existsSync(npxCommand)) {
    if (isProductionRuntime) {
      throw new Error(`Bundled Node runtime is incomplete: ${runtimeDir}`);
    }
    return {
      nodeRuntimeDir: undefined,
      nodeCommand: nodeFallback,
      npmCommand: npmFallback,
      npxCommand: npxFallback
    };
  }

  return {
    nodeRuntimeDir: runtimeDir,
    nodeCommand,
    npmCommand,
    npxCommand
  };
}

export function setMakerProjectsRoot(rootPath: string) {
  config.makerProjectsRoot = rootPath;
}

export function setMakerPackage(packageSpec: string) {
  config.makerPackage = packageSpec;
}

export function buildManagedRuntimeEnv(extra: NodeJS.ProcessEnv = {}) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...extra,
    npm_config_cache: config.makerNpmCacheDir,
    NPM_CONFIG_CACHE: config.makerNpmCacheDir
  };
  if (config.nodeRuntimeDir) {
    env.PATH = prependPathEntry(config.nodeRuntimeDir, env.PATH);
    env.Path = prependPathEntry(config.nodeRuntimeDir, env.Path);
    env.NODE = path.join(config.nodeRuntimeDir, process.platform === "win32" ? "node.exe" : "node");
  }
  return env;
}

function prependPathEntry(entry: string, currentValue?: string) {
  if (!currentValue) return entry;
  const parts = currentValue.split(path.delimiter).filter(Boolean);
  const normalizedEntry = path.resolve(entry).toLowerCase();
  const alreadyPresent = parts.some((item) => path.resolve(item).toLowerCase() === normalizedEntry);
  return alreadyPresent ? currentValue : [entry, currentValue].join(path.delimiter);
}
