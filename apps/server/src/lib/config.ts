import path from "node:path";
import { fileURLToPath } from "node:url";

const thisFile = fileURLToPath(import.meta.url);
const serverSrcDir = path.dirname(path.dirname(thisFile));
const serverAppDir = path.dirname(serverSrcDir);
const appsDir = path.dirname(serverAppDir);
export const workspaceRoot = process.env.TAPTAP_WORKSPACE_ROOT ?? path.dirname(appsDir);
export const defaultMakerProjectsRoot = path.dirname(workspaceRoot);
const dataDir = process.env.TAPTAP_DATA_DIR ?? path.join(workspaceRoot, "data");
const nodeRuntimeDir = process.env.TAPTAP_NODE_RUNTIME_DIR;

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
  nodeRuntimeDir,
  npmCommand: nodeRuntimeDir ? path.join(nodeRuntimeDir, "npm.cmd") : "npm.cmd",
  npxCommand: nodeRuntimeDir ? path.join(nodeRuntimeDir, "npx.cmd") : "npx.cmd",
  desktopInstanceToken: process.env.TAPTAP_DESKTOP_INSTANCE_TOKEN
};

export function setMakerProjectsRoot(rootPath: string) {
  config.makerProjectsRoot = rootPath;
}

export function setMakerPackage(packageSpec: string) {
  config.makerPackage = packageSpec;
}
