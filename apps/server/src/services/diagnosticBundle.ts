import { ZipArchive, type Archiver } from "archiver";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { config } from "../lib/config.js";
import { getProject, getSelectedProjectId, listProjects } from "../lib/db.js";
import { appVersion } from "../generated/appVersion.js";
import type { ProjectSummary } from "../types.js";

export type DesktopResourceCheck = {
  label: string;
  path: string;
  exists: boolean;
  kind: "file" | "directory";
  required: boolean;
};

export type DesktopResourceReadiness = {
  ok: boolean;
  checkedAt: string;
  mode: "development" | "production";
  resources: DesktopResourceCheck[];
};

export type DiagnosticBundleResult = {
  ok: true;
  generatedAt: string;
  zipPath: string;
  downloadUrl: string;
  fileName: string;
  includedFiles: string[];
  skippedFiles: string[];
  resourceReadiness: DesktopResourceReadiness;
};

type AddFileResult = {
  included: string[];
  skipped: string[];
};

export function getDesktopResourceReadiness(): DesktopResourceReadiness {
  const checks: DesktopResourceCheck[] = [
    directoryCheck("Web dist", config.webDistDir, true),
    fileCheck("Web index", path.join(config.webDistDir, "index.html"), true),
    fileCheck("Desktop loading page", path.join(config.webDistDir, "desktop-loading.html"), true),
    directoryCheck("Server dist", path.join(config.workspaceRoot, "apps", "server", "dist"), true),
    fileCheck("Server entry", path.join(config.workspaceRoot, "apps", "server", "dist", "index.js"), true),
    directoryCheck("Server production dependencies", path.join(config.workspaceRoot, "node_modules"), true),
    directoryCheck("Bundled Node runtime", path.join(config.workspaceRoot, "node-runtime"), process.env.NODE_ENV === "production"),
    fileCheck("Bundled node.exe", path.join(config.workspaceRoot, "node-runtime", process.platform === "win32" ? "node.exe" : "node"), process.env.NODE_ENV === "production"),
    fileCheck("Bundled npm command", config.npmCommand, true),
    directoryCheck("App data directory", config.dataDir, true),
    directoryCheck("MCP log directory", config.mcpLogDir, true),
    directoryCheck("Maker npm cache", config.makerNpmCacheDir, false),
  ];
  const requiredChecks = checks.filter((check) => check.required);
  return {
    ok: requiredChecks.every((check) => check.exists),
    checkedAt: new Date().toISOString(),
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    resources: checks,
  };
}

export async function createDiagnosticBundle(projectId?: string): Promise<DiagnosticBundleResult> {
  fs.mkdirSync(config.dataDir, { recursive: true });
  const diagnosticsDir = path.join(config.dataDir, "diagnostics");
  fs.mkdirSync(diagnosticsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const fileName = `taptap-maker-plus-diagnostics-${safeTimestamp(generatedAt)}.zip`;
  const zipPath = path.join(diagnosticsDir, fileName);
  const selectedProjectId = projectId || getSelectedProjectId();
  const project = selectedProjectId ? getProject(selectedProjectId) : undefined;
  const resourceReadiness = getDesktopResourceReadiness();
  const includedFiles: string[] = [];
  const skippedFiles: string[] = [];

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const output = fs.createWriteStream(zipPath);
  const archiveDone = pipeline(archive, output);

  archive.append(JSON.stringify(buildSummary(generatedAt, project, resourceReadiness), null, 2), {
    name: "summary.json",
  });
  includedFiles.push("summary.json");

  for (const item of [
    addFileIfExists(archive, path.join(config.dataDir, "desktop.log"), "logs/desktop.log"),
    addFileIfExists(archive, path.join(config.dataDir, "server.log"), "logs/server.log"),
    addFileIfExists(archive, path.join(config.dataDir, "logs", "frontend-diagnostics.log"), "logs/frontend-diagnostics.log"),
    addFileIfExists(archive, config.databasePath, "data/taptap-maker-plus.sqlite"),
  ]) {
    includedFiles.push(...item.included);
    skippedFiles.push(...item.skipped);
  }

  const mcpLogs = addDirectoryIfExists(archive, config.mcpLogDir, "mcp-logs", 40);
  includedFiles.push(...mcpLogs.included);
  skippedFiles.push(...mcpLogs.skipped);

  if (project) {
    const projectLogs = addDirectoryIfExists(archive, path.join(project.rootPath, ".maker", "logs"), "project/.maker/logs", 80);
    includedFiles.push(...projectLogs.included);
    skippedFiles.push(...projectLogs.skipped);
    const configFile = addFileIfExists(archive, project.configPath, "project/.maker-mcp/config.json");
    includedFiles.push(...configFile.included);
    skippedFiles.push(...configFile.skipped);
  }

  await archive.finalize();
  await archiveDone;

  return {
    ok: true,
    generatedAt,
    zipPath,
    downloadUrl: `/api/developer/diagnostics/${encodeURIComponent(fileName)}`,
    fileName,
    includedFiles,
    skippedFiles,
    resourceReadiness,
  };
}

export function resolveDiagnosticBundlePath(fileName: string) {
  const diagnosticsDir = path.resolve(config.dataDir, "diagnostics");
  const resolved = path.resolve(diagnosticsDir, path.basename(fileName));
  if (resolved !== path.join(diagnosticsDir, path.basename(fileName))) {
    throw new Error("Invalid diagnostic bundle path.");
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`Diagnostic bundle not found: ${fileName}`);
  }
  return resolved;
}

function buildSummary(generatedAt: string, project: ProjectSummary | undefined, resourceReadiness: DesktopResourceReadiness) {
  return {
    generatedAt,
    app: {
      appId: appVersion.appId,
      productName: appVersion.productName,
      displayVersion: appVersion.displayVersion,
      packageVersion: appVersion.packageVersion,
      channel: appVersion.channel,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      env: process.env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
    },
    os: {
      type: os.type(),
      release: os.release(),
      version: os.version(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
    },
    paths: {
      workspaceRoot: config.workspaceRoot,
      dataDir: config.dataDir,
      databasePath: config.databasePath,
      webDistDir: config.webDistDir,
      makerProjectsRoot: config.makerProjectsRoot,
      makerNpmCacheDir: config.makerNpmCacheDir,
      mcpLogDir: config.mcpLogDir,
      nodeRuntimeDir: config.nodeRuntimeDir,
      npmCommand: config.npmCommand,
      npxCommand: config.npxCommand,
    },
    server: {
      host: config.host,
      port: config.port,
      desktopInstanceTokenPresent: Boolean(config.desktopInstanceToken),
    },
    maker: {
      makerPackage: config.makerPackage,
      makerEnv: config.makerEnv,
    },
    project: project
      ? {
          id: project.id,
          name: project.name,
          rootPath: project.rootPath,
          makerProjectId: project.makerProjectId,
          configPath: project.configPath,
        }
      : undefined,
    projects: listProjects().map((item) => ({
      id: item.id,
      name: item.name,
      rootPath: item.rootPath,
      makerProjectId: item.makerProjectId,
      selected: item.selected,
    })),
    resourceReadiness,
  };
}

function fileCheck(label: string, filePath: string, required: boolean): DesktopResourceCheck {
  return {
    label,
    path: filePath,
    exists: fs.existsSync(filePath) && fs.statSync(filePath).isFile(),
    kind: "file",
    required,
  };
}

function directoryCheck(label: string, directoryPath: string, required: boolean): DesktopResourceCheck {
  return {
    label,
    path: directoryPath,
    exists: fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(),
    kind: "directory",
    required,
  };
}

function addFileIfExists(archive: Archiver, filePath: string, archivePath: string): AddFileResult {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return { included: [], skipped: [archivePath] };
  }
  archive.file(filePath, { name: archivePath });
  return { included: [archivePath], skipped: [] };
}

function addDirectoryIfExists(
  archive: Archiver,
  directoryPath: string,
  archiveRoot: string,
  maxFiles: number,
): AddFileResult {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    return { included: [], skipped: [archiveRoot] };
  }
  const files = listRecentFiles(directoryPath, maxFiles);
  const included: string[] = [];
  for (const filePath of files) {
    const relativePath = path.relative(directoryPath, filePath).replaceAll(path.sep, "/");
    const archivePath = `${archiveRoot}/${relativePath}`;
    archive.file(filePath, { name: archivePath });
    included.push(archivePath);
  }
  return { included, skipped: [] };
}

function listRecentFiles(directoryPath: string, maxFiles: number) {
  const files: { path: string; mtimeMs: number }[] = [];
  const stack = [directoryPath];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
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

function safeTimestamp(value: string) {
  return value.replace(/[:.]/g, "-");
}
