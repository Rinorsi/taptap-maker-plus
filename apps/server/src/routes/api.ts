import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { config, defaultMakerProjectsRoot, setMakerProjectsRoot } from "../lib/config.js";
import {
  clearSelectedProject,
  createWorkflowRun,
  deleteWorkflowGraph,
  deleteWorkflowRun,
  deleteTasks,
  finishWorkflowRun,
  getAssetByRelativePath,
  getProject,
  getAppSettingsPreferences,
  getAppSetting,
  getSelectedProjectId,
  getTask,
  getTool,
  getToolsListSnapshot,
  getWorkflowGraph,
  listAssets,
  listAssetProvenanceForAsset,
  listGenerations,
  listProjects,
  listTasks,
  listTools,
  listWorkflowGraphs,
  listWorkflowRuns,
  removeProjectRecord,
  saveWorkflowGraph,
  saveAppSettingsPreferences,
  setSelectedProject,
  setAppSetting,
  listCreditRecords
} from "../lib/db.js";
import { scanMakerProjects } from "../services/projectDiscovery.js";
import { scanProjectAssets } from "../services/assetScanner.js";
import { scanAssetReferences } from "../services/assetReferenceScanner.js";
import {
  AssetFileOperationError,
  copyAssetFolder,
  createAssetFolder,
  deleteAssetFolder,
  moveAssetFiles,
  moveAssetFolder,
  renameAssetFile,
  renameAssetFolder
} from "../services/assetFileOperations.js";
import { buildAssetDirectoryTree, listProjectAssetDirectories } from "../services/assetTree.js";
import { rebuildAssetProvenance } from "../services/assetProvenance.js";
import { runtimeManager } from "../services/mcpRuntime.js";
import { getMcpPackageUpdateStatus, installMcpPackage, saveMcpReleaseNotes } from "../services/mcpPackageManager.js";
import { executeToolCall, syncCreditRecordsFromTasks } from "../services/toolExecution.js";
import { buildAgentContext } from "../agent/contextBuilder.js";
import { getProjectBuildLogs } from "../services/projectLogs.js";
import { scanModelPackages, organizeModelPackage, bindModelPackage, discardModelPackage, restoreModelPackage, updateResourceTable, runModelPackageBatchAction } from "../services/modelPackage.js";
import { convertMdlToGltf, inspectMdlFile } from "../services/urhoMdl.js";
import type { AppSettingsPreferencesResponse, MakerWorkflowGraph, ProjectSummary, ToolSummary, WorkflowNodeRunResult, WorkflowRunStatus } from "../types.js";

const callToolSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  toolArgs: z.record(z.string(), z.unknown()).optional(),
  suggestedName: z.string().optional(),
  assetType: z.string().optional()
}).passthrough();

const settingsPreferenceKeySchema = z.string().regex(/^taptap\.settings\./);
const appSettingsPreferencesSchema = z.object({
  preferences: z.record(settingsPreferenceKeySchema, z.unknown())
});

const makerProjectsRootSchema = z.object({
  rootPath: z.string().min(1)
});

const mcpPackageInstallSchema = z.object({
  packageSpec: z.string().min(1)
});

const mcpPackageReleaseNotesSchema = z.object({
  releaseNotes: z.string()
});

const assetPathsSchema = z.object({
  relativePaths: z.array(z.string()).min(1)
});

const assetReferenceScanSchema = assetPathsSchema;

const assetMoveSchema = assetPathsSchema.extend({
  targetFolder: z.string().min(1),
  updateReferences: z.boolean().default(false)
});
const assetCopySchema = assetPathsSchema.extend({
  targetFolder: z.string().min(1)
});
const assetOpenSchema = z.object({
  relativePath: z.string().min(1),
  mode: z.enum(["file", "directory"]).default("file")
});
const assetRenameSchema = z.object({
  relativePath: z.string().min(1),
  newName: z.string().min(1),
  updateReferences: z.boolean().default(false)
});
const assetFolderCreateSchema = z.object({
  parentFolder: z.string().min(1),
  name: z.string().min(1)
});
const assetFolderRenameSchema = z.object({
  directoryPath: z.string().min(1),
  newName: z.string().min(1),
  updateReferences: z.boolean().default(false)
});
const assetFolderMoveSchema = z.object({
  directoryPath: z.string().min(1),
  targetFolder: z.string().min(1),
  updateReferences: z.boolean().default(false)
});
const assetFolderPathSchema = z.object({
  directoryPath: z.string().min(1)
});
const assetFolderCopySchema = z.object({
  directoryPath: z.string().min(1),
  targetFolder: z.string().min(1)
});

const assetImportSchema = z.object({
  fileName: z.string().min(1),
  targetFolder: z.string().min(1),
  dataUrl: z.string().min(1)
});
const assetImportLocalPathsSchema = z.object({
  sourcePaths: z.array(z.string().min(1)).min(1),
  targetFolder: z.string().min(1)
});

const modelConvertSchema = z.object({
  relativePath: z.string().min(1)
});

const assetListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  assetType: z.string().min(1).optional(),
  rootPrefix: z.string().min(1).optional(),
  q: z.string().optional()
});

const flowSaveSchema = z.object({
  name: z.string().min(1),
  data: z.any()
});

const flowAutoSaveSchema = z.object({
  data: z.any()
});

const flowRenameSchema = z.object({
  name: z.string().min(1)
});

function createFlowId(name: string) {
  const normalized = name.trim();
  const ascii = normalized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return ascii || `flow-${Date.now()}`;
}

function readFlowDisplayName(filePath: string, fallbackName: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const name = data?.meta?.displayName;
    return typeof name === "string" && name.trim() ? name : fallbackName;
  } catch {
    return fallbackName;
  }
}

function withFlowDisplayName(data: unknown, displayName: string) {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    const meta = record.meta && typeof record.meta === "object" && !Array.isArray(record.meta)
      ? record.meta as Record<string, unknown>
      : {};
    return {
      ...record,
      meta: {
        ...meta,
        displayName,
        updatedAt: new Date().toISOString(),
      },
    };
  }
  return {
    meta: { displayName, updatedAt: new Date().toISOString() },
    data,
  };
}

const frontendDiagnosticSchema = z.object({
  entries: z.array(z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    level: z.enum(["info", "warn", "error"]),
    source: z.enum(["console", "window", "promise", "fetch", "devtools"]),
    message: z.string().max(20000),
    detail: z.string().max(50000).optional()
  })).min(1).max(50)
});
const frontendDiagnosticDeleteQuerySchema = z.object({
  retention: z.enum(["all", "14d", "30d", "100mb"]).optional()
});

const workflowGraphSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  source: z.literal("tools-list"),
  version: z.literal(1)
});

const workflowSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  graph: workflowGraphSchema
});

const workflowRunSchema = z.object({
  workflowId: z.string().optional(),
  name: z.string().optional(),
  graph: workflowGraphSchema,
  nodeIds: z.array(z.string()).min(1)
});

const agentContextQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  activeTab: z.enum(["status", "tools", "logs", "errors"]).optional(),
  selectionType: z.enum(["project", "tool", "task", "asset"]).optional(),
  projectSelectionId: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  assetRelativePath: z.string().min(1).optional()
});

function pageStateFromQuery(query: z.infer<typeof agentContextQuerySchema>) {
  const page = {
    activeTab: query.activeTab,
    selection: undefined as ReturnType<typeof buildAgentContext>["page"]["selection"]
  };
  if (query.selectionType === "project" && query.projectSelectionId) {
    page.selection = { type: "project", projectId: query.projectSelectionId };
  }
  if (query.selectionType === "tool" && query.toolName) {
    page.selection = { type: "tool", toolName: query.toolName };
  }
  if (query.selectionType === "task" && query.taskId) {
    page.selection = { type: "task", taskId: query.taskId };
  }
  if (query.selectionType === "asset" && query.assetRelativePath) {
    page.selection = { type: "asset", relativePath: query.assetRelativePath };
  }
  return page;
}

function extractArguments(body: z.infer<typeof callToolSchema>): Record<string, unknown> {
  return body.toolArgs ?? body.arguments ?? {};
}

function frontendDiagnosticsPath() {
  return path.join(config.dataDir, "logs", "frontend-diagnostics.log");
}

function serializeDiagnosticEntry(entry: z.infer<typeof frontendDiagnosticSchema>["entries"][number]) {
  return JSON.stringify(entry);
}

function readRecentFrontendDiagnostics(limit = 200) {
  const logPath = frontendDiagnosticsPath();
  if (!fs.existsSync(logPath)) return { logPath, entries: [] as unknown[] };

  const text = fs.readFileSync(logPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean).slice(-limit);
  const entries = lines.map((line) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      return { timestamp: new Date().toISOString(), level: "warn", source: "server", message: line };
    }
  });
  return { logPath, entries };
}

function applyFrontendDiagnosticsRetention(retention: "all" | "14d" | "30d" | "100mb") {
  const logPath = frontendDiagnosticsPath();
  if (!fs.existsSync(logPath)) return { logPath, removed: 0 };
  if (retention === "all") {
    fs.writeFileSync(logPath, "", "utf8");
    return { logPath, removed: undefined };
  }
  const text = fs.readFileSync(logPath, "utf8");
  if (retention === "100mb") {
    const maxBytes = 100 * 1024 * 1024;
    const buffer = Buffer.from(text, "utf8");
    if (buffer.byteLength <= maxBytes) return { logPath, removed: 0 };
    fs.writeFileSync(logPath, buffer.subarray(buffer.byteLength - maxBytes).toString("utf8"), "utf8");
    return { logPath, removed: undefined };
  }
  const days = retention === "14d" ? 14 : 30;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const lines = text.split(/\r?\n/).filter(Boolean);
  const kept = lines.filter((line) => {
    try {
      const parsed = JSON.parse(line) as { timestamp?: unknown };
      if (typeof parsed.timestamp !== "string") return true;
      const timestampMs = Date.parse(parsed.timestamp);
      return Number.isNaN(timestampMs) || timestampMs >= cutoffMs;
    } catch {
      return true;
    }
  });
  fs.writeFileSync(logPath, `${kept.join("\n")}${kept.length ? "\n" : ""}`, "utf8");
  return { logPath, removed: lines.length - kept.length };
}

function requireProject(projectId: string): ProjectSummary {
  const project = getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

function assertProjectRootAllowed(project: ProjectSummary) {
  const projectRoot = path.resolve(project.rootPath);
  const makerRoot = path.resolve(config.makerProjectsRoot);
  if (projectRoot === makerRoot || !projectRoot.startsWith(`${makerRoot}${path.sep}`)) {
    throw new Error(`Refusing to delete project outside maker projects root: ${project.rootPath}`);
  }
  return projectRoot;
}

function sendAssetFileOperationError(reply: FastifyReply, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof AssetFileOperationError) {
    return reply.code(error.statusCode).send({ error: message });
  }
  return reply.code(500).send({ error: message });
}

function withRuntime(project: ProjectSummary) {
  return {
    ...project,
    configExists: fs.existsSync(project.configPath),
    toolCount: listTools(project.id).length,
    runtime: runtimeManager.getSummary(project.id)
  };
}

function getMakerProjectsRootSettings() {
  const storedRoot = getAppSetting("maker_projects_root");
  const rootPath = config.makerProjectsRoot;
  return {
    rootPath,
    defaultRootPath: defaultMakerProjectsRoot,
    storedRootPath: storedRoot,
    envRootPath: process.env.TAPTAP_MAKER_PROJECTS_ROOT,
    exists: fs.existsSync(rootPath),
    source: storedRoot ? "app_settings" : process.env.TAPTAP_MAKER_PROJECTS_ROOT ? "env" : "default"
  };
}

function readProjectConfigHealth(project: ProjectSummary) {
  const rootExists = fs.existsSync(project.rootPath);
  const configExists = fs.existsSync(project.configPath);
  let configProjectId: string | undefined;
  let configParseError: string | undefined;

  if (configExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(project.configPath, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const value = (parsed as { project_id?: unknown }).project_id;
        if (typeof value === "string") configProjectId = value;
      }
    } catch (error) {
      configParseError = error instanceof Error ? error.message : String(error);
    }
  }

  const projectIdMatches = configProjectId === project.makerProjectId;
  const toolsListSnapshot = getToolsListSnapshot(project.id);
  return {
    projectId: project.id,
    rootPath: project.rootPath,
    configPath: project.configPath,
    rootExists,
    configExists,
    configProjectId,
    makerProjectId: project.makerProjectId,
    projectIdMatches,
    configParseError,
    runtime: runtimeManager.getSummary(project.id),
    toolsListUpdatedAt: toolsListSnapshot?.updatedAt,
    makerPackage: config.makerPackage,
    makerEnv: config.makerEnv
  };
}

function readNodeId(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const id = (node as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

function readToolNode(node: unknown): { nodeId: string; toolName: string; inputs: Record<string, unknown> } | undefined {
  if (!node || typeof node !== "object") return undefined;
  const raw = node as { id?: unknown; data?: unknown };
  if (typeof raw.id !== "string" || !raw.data || typeof raw.data !== "object") return undefined;
  const data = raw.data as { kind?: unknown; toolName?: unknown; inputs?: unknown };
  if (data.kind !== "tool" || typeof data.toolName !== "string") return undefined;
  const inputs = data.inputs && typeof data.inputs === "object" && !Array.isArray(data.inputs) ? data.inputs as Record<string, unknown> : {};
  return { nodeId: raw.id, toolName: data.toolName, inputs };
}

function missingRequiredFields(tool: ToolSummary, inputs: Record<string, unknown>) {
  return tool.required.filter((field) => !Object.prototype.hasOwnProperty.call(inputs, field));
}

function workflowStatusFromNodes(nodes: WorkflowNodeRunResult[]): WorkflowRunStatus {
  if (nodes.some((node) => node.status === "failed")) return "failed";
  if (nodes.some((node) => node.status === "skipped")) return nodes.some((node) => node.status === "succeeded") ? "partial" : "partial";
  return "succeeded";
}

async function executeWorkflowRun(project: ProjectSummary, graph: MakerWorkflowGraph, nodeIds: string[], name: string, workflowId?: string) {
  const nodeIdSet = new Set(nodeIds);
  const run = createWorkflowRun(project.id, name, graph, workflowId);
  const nodeResults: WorkflowNodeRunResult[] = [];

  for (const rawNode of graph.nodes) {
    const nodeId = readNodeId(rawNode);
    if (!nodeId || !nodeIdSet.has(nodeId)) continue;

    const toolNode = readToolNode(rawNode);
    if (!toolNode) {
      nodeResults.push({ nodeId, status: "skipped", errorMessage: "Node is not a tool node" });
      continue;
    }

    const tool = getTool(project.id, toolNode.toolName);
    if (!tool) {
      nodeResults.push({ nodeId: toolNode.nodeId, toolName: toolNode.toolName, status: "skipped", errorMessage: `Tool not found: ${toolNode.toolName}` });
      continue;
    }

    const missingRequired = missingRequiredFields(tool, toolNode.inputs);
    if (missingRequired.length) {
      nodeResults.push({ nodeId: toolNode.nodeId, toolName: tool.name, status: "skipped", inputJson: JSON.stringify(toolNode.inputs, null, 2), missingRequired });
      continue;
    }

    const startedAt = new Date().toISOString();
    try {
      const response = await executeToolCall(project, tool, toolNode.inputs);
      nodeResults.push({
        nodeId: toolNode.nodeId,
        toolName: tool.name,
        status: "succeeded",
        inputJson: JSON.stringify(toolNode.inputs, null, 2),
        taskId: response.task.taskId,
        rawResultJson: JSON.stringify(response.result ?? {}, null, 2),
        startedAt,
        finishedAt: new Date().toISOString()
      });
    } catch (error) {
      const task = (error as { task?: { taskId?: string } }).task;
      nodeResults.push({
        nodeId: toolNode.nodeId,
        toolName: tool.name,
        status: "failed",
        inputJson: JSON.stringify(toolNode.inputs, null, 2),
        taskId: typeof task?.taskId === "string" ? task.taskId : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        startedAt,
        finishedAt: new Date().toISOString()
      });
    }
  }

  return finishWorkflowRun(run.id, workflowStatusFromNodes(nodeResults), nodeResults);
}

function isSafeProjectPath(projectRoot: string, targetPath: string) {
  const root = path.resolve(projectRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function resolveProjectPath(projectRoot: string, relativePath: string) {
  const resolved = path.resolve(projectRoot, relativePath);
  if (!isSafeProjectPath(projectRoot, resolved)) throw new Error(`Unsafe project path: ${relativePath}`);
  return resolved;
}

function sanitizeFileName(fileName: string) {
  return path.basename(fileName).replace(/[\\/:*?"<>|]/g, "_").trim();
}

function nextAvailablePath(targetPath: string) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const baseName = path.basename(targetPath, extension);
  let index = 1;
  let nextPath = path.join(directory, `${baseName}_${index}${extension}`);
  while (fs.existsSync(nextPath)) {
    index += 1;
    nextPath = path.join(directory, `${baseName}_${index}${extension}`);
  }
  return nextPath;
}

function copyLocalFileIntoDirectory(sourcePath: string, targetDir: string) {
  const fileName = sanitizeFileName(path.basename(sourcePath));
  if (!fileName) return 0;
  const requestedTarget = path.join(targetDir, fileName);
  fs.copyFileSync(sourcePath, nextAvailablePath(requestedTarget));
  return 1;
}

function copyLocalDirectoryIntoDirectory(sourceDir: string, targetDir: string) {
  const directoryName = sanitizeFileName(path.basename(sourceDir));
  if (!directoryName) return 0;
  const rootTarget = path.join(targetDir, directoryName);
  let count = 0;
  const walk = (currentSource: string, currentTarget: string) => {
    fs.mkdirSync(currentTarget, { recursive: true });
    for (const entry of fs.readdirSync(currentSource, { withFileTypes: true })) {
      const sourcePath = path.join(currentSource, entry.name);
      const targetPath = path.join(currentTarget, sanitizeFileName(entry.name));
      if (entry.isDirectory()) {
        walk(sourcePath, targetPath);
        continue;
      }
      if (entry.isFile()) {
        fs.copyFileSync(sourcePath, nextAvailablePath(targetPath));
        count += 1;
      }
    }
  };
  walk(sourceDir, nextAvailablePath(rootTarget));
  return count;
}

function openSystemPath(projectRoot: string, targetPath: string, mode: "file" | "directory") {
  if (!isSafeProjectPath(projectRoot, targetPath)) throw new Error(`Unsafe open path: ${targetPath}`);
  const statPath = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
  if (!fs.existsSync(statPath)) throw new Error(`Path does not exist: ${statPath}`);
  const directoryPath = fs.statSync(statPath).isDirectory() ? statPath : path.dirname(statPath);
  const openDirectory = mode === "directory" || fs.statSync(statPath).isDirectory();

  if (process.platform === "win32") {
    const args = openDirectory ? [directoryPath] : ["/select,", statPath];
    spawn("explorer.exe", args, { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (process.platform === "darwin") {
    const args = openDirectory ? [directoryPath] : ["-R", statPath];
    spawn("open", args, { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [directoryPath], { detached: true, stdio: "ignore" }).unref();
}

function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid dataUrl");
  const encoded = match[3];
  return match[2] ? Buffer.from(encoded, "base64") : Buffer.from(decodeURIComponent(encoded));
}

function assetContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".webp" ? "image/webp"
        : ext === ".gif" ? "image/gif"
          : ext === ".mp4" ? "video/mp4"
            : ext === ".webm" ? "video/webm"
              : ext === ".mov" ? "video/quicktime"
                : ext === ".mp3" ? "audio/mpeg"
                  : ext === ".ogg" ? "audio/ogg"
                    : ext === ".wav" ? "audio/wav"
                      : ext === ".m4a" ? "audio/mp4"
                        : ext === ".gltf" ? "model/gltf+json"
                          : ext === ".glb" ? "model/gltf-binary"
                            : ext === ".bin" ? "application/octet-stream"
                              : "application/octet-stream";
}

function sendAssetFile(reply: FastifyReply, filePath: string, range?: string) {
  const contentType = assetContentType(filePath);
  const stat = fs.statSync(filePath);
  reply.header("Accept-Ranges", "bytes");
  reply.header("Content-Type", contentType);

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
        const boundedEnd = Math.min(end, stat.size - 1);
        reply
          .code(206)
          .header("Content-Length", String(boundedEnd - start + 1))
          .header("Content-Range", `bytes ${start}-${boundedEnd}/${stat.size}`);
        return reply.send(fs.createReadStream(filePath, { start, end: boundedEnd }));
      }
    }
    reply.header("Content-Range", `bytes */${stat.size}`);
    return reply.code(416).send();
  }

  reply.header("Content-Length", String(stat.size));
  return reply.send(fs.createReadStream(filePath));
}

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ ok: true, name: "taptap-maker-plus" }));

  app.get("/api/settings/preferences", async (): Promise<AppSettingsPreferencesResponse> => {
    return getAppSettingsPreferences();
  });

  app.put<{ Body: unknown }>("/api/settings/preferences", async (request, reply): Promise<AppSettingsPreferencesResponse | FastifyReply> => {
    const parsed = appSettingsPreferencesSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return saveAppSettingsPreferences(parsed.data.preferences);
  });

  app.get("/api/settings/maker-projects-root", async () => {
    return { settings: getMakerProjectsRootSettings() };
  });

  app.put<{ Body: unknown }>("/api/settings/maker-projects-root", async (request, reply) => {
    const parsed = makerProjectsRootSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const nextRoot = path.resolve(parsed.data.rootPath);
    if (!fs.existsSync(nextRoot) || !fs.statSync(nextRoot).isDirectory()) {
      return reply.code(400).send({ error: `Maker projects root must be an existing directory: ${nextRoot}` });
    }
    setAppSetting("maker_projects_root", nextRoot);
    setMakerProjectsRoot(nextRoot);
    const projects = await scanMakerProjects(nextRoot);
    const projectIds = new Set(projects.map((project) => project.id));
    const storedSelectedProjectId = getSelectedProjectId();
    const selectedProjectId = storedSelectedProjectId && projectIds.has(storedSelectedProjectId)
      ? storedSelectedProjectId
      : undefined;
    if (storedSelectedProjectId && !selectedProjectId) clearSelectedProject();
    return { settings: getMakerProjectsRootSettings(), selectedProjectId, projects: projects.map((project) => withRuntime(project)) };
  });

  app.get("/api/developer/frontend-diagnostics", async () => {
    const { logPath, entries } = readRecentFrontendDiagnostics();
    return { logPath, entries };
  });

  app.post<{ Body: unknown }>("/api/developer/frontend-diagnostics", async (request, reply) => {
    const parsed = frontendDiagnosticSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const logPath = frontendDiagnosticsPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${parsed.data.entries.map(serializeDiagnosticEntry).join("\n")}\n`, "utf8");
    return { ok: true, logPath };
  });

  app.delete<{ Querystring: unknown }>("/api/developer/frontend-diagnostics", async (request, reply) => {
    const parsed = frontendDiagnosticDeleteQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = applyFrontendDiagnosticsRetention(parsed.data.retention ?? "all");
    return { ok: true, ...result };
  });

  app.get("/api/desktop/readiness", async () => ({
    ok: true,
    appId: "taptap-maker-plus",
    desktopInstanceToken: config.desktopInstanceToken,
    mode: process.env.NODE_ENV ?? "development",
    server: {
      host: config.host,
      port: config.port
    },
    paths: {
      dataDir: config.dataDir,
      databasePath: config.databasePath,
      workspaceRoot: config.workspaceRoot,
      webDistDir: config.webDistDir,
      makerNpmCacheDir: config.makerNpmCacheDir,
      mcpLogDir: config.mcpLogDir,
      makerProjectsRoot: config.makerProjectsRoot
    },
    env: {
      TAPTAP_DATA_DIR: process.env.TAPTAP_DATA_DIR,
      TAPTAP_WORKSPACE_ROOT: process.env.TAPTAP_WORKSPACE_ROOT,
      TAPTAP_WEB_DIST_DIR: process.env.TAPTAP_WEB_DIST_DIR,
      TAPTAP_MAKER_PROJECTS_ROOT: process.env.TAPTAP_MAKER_PROJECTS_ROOT,
      TAPTAP_DESKTOP_PARENT_PID: process.env.TAPTAP_DESKTOP_PARENT_PID,
      TAPTAP_MAKER_NPM_CACHE_DIR: process.env.TAPTAP_MAKER_NPM_CACHE_DIR,
      TAPTAP_MCP_LOG_DIR: process.env.TAPTAP_MCP_LOG_DIR,
      TAPTAP_SERVER_PORT: String(config.port),
      TAPTAP_SERVER_HOST: config.host,
      TAPTAP_DESKTOP_INSTANCE_TOKEN: process.env.TAPTAP_DESKTOP_INSTANCE_TOKEN,
      TAPTAP_MCP_ENV: config.makerEnv,
      TAPTAP_MAKER_PACKAGE: config.makerPackage
    }
  }));

  app.get<{ Querystring: unknown }>("/api/agent/context", async (request, reply) => {
    const parsed = agentContextQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { context: buildAgentContext({ projectId: parsed.data.projectId, page: pageStateFromQuery(parsed.data) }) };
  });

  app.get("/api/projects", async () => {
    const selectedProjectId = getSelectedProjectId();
    const projects = listProjects();
    return { selectedProjectId, projects: projects.map((project) => withRuntime(project)) };
  });

  app.post("/api/projects/scan", async () => {
    const projects = await scanMakerProjects();
    const selectedProjectId = getSelectedProjectId();
    return { selectedProjectId, projects: projects.map((project) => withRuntime(project)) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId", async (request) => {
    const project = requireProject(request.params.projectId);
    return { project: withRuntime(project) };
  });

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/select", async (request) => {
    const project = requireProject(request.params.projectId);
    setSelectedProject(project.id);
    return { selectedProjectId: project.id, project: withRuntime(project) };
  });

  app.delete<{ Params: { projectId: string } }>("/api/projects/:projectId/record", async (request) => {
    const project = requireProject(request.params.projectId);
    await runtimeManager.stop(project.id).catch(() => undefined);
    removeProjectRecord(project.id);
    return { ok: true, removedProjectId: project.id, deletedLocalFolder: false, projects: listProjects().map((item) => withRuntime(item)), selectedProjectId: getSelectedProjectId() };
  });

  app.delete<{ Params: { projectId: string } }>("/api/projects/:projectId/local-folder", async (request) => {
    const project = requireProject(request.params.projectId);
    const projectRoot = assertProjectRootAllowed(project);
    await runtimeManager.stop(project.id).catch(() => undefined);
    if (fs.existsSync(projectRoot)) fs.rmSync(projectRoot, { recursive: true, force: true });
    removeProjectRecord(project.id);
    return { ok: true, removedProjectId: project.id, deletedLocalFolder: true, deletedPath: project.rootPath, projects: listProjects().map((item) => withRuntime(item)), selectedProjectId: getSelectedProjectId() };
  });

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/mcp/start", async (request) => {
    const project = requireProject(request.params.projectId);
    const runtime = await runtimeManager.start(project);
    return { runtime, tools: listTools(project.id), toolsListSnapshot: getToolsListSnapshot(project.id) };
  });

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/mcp/stop", async (request) => {
    await runtimeManager.stop(request.params.projectId);
    return { runtime: runtimeManager.getSummary(request.params.projectId) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/mcp/status", async (request) => {
    const project = requireProject(request.params.projectId);
    return { project: withRuntime(project), runtime: runtimeManager.getSummary(project.id), toolsListSnapshot: getToolsListSnapshot(project.id) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/health", async (request) => {
    const project = requireProject(request.params.projectId);
    return { health: readProjectConfigHealth(project) };
  });

  app.get("/api/mcp/status", async () => {
    const selectedProjectId = getSelectedProjectId();
    return { selectedProjectId, runtimes: runtimeManager.listSummaries() };
  });

  app.get<{ Querystring: { check?: string } }>("/api/mcp/package", async (request) => {
    return { status: await getMcpPackageUpdateStatus({ checkRegistry: request.query?.check === "true" }) };
  });

  app.put<{ Body: unknown }>("/api/mcp/package/release-notes", async (request, reply) => {
    const parsed = mcpPackageReleaseNotesSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const releaseNotes = saveMcpReleaseNotes(parsed.data.releaseNotes);
    return { releaseNotes };
  });

  app.post<{ Body: unknown }>("/api/mcp/package/install", async (request, reply) => {
    const parsed = mcpPackageInstallSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await installMcpPackage(parsed.data.packageSpec);
      await runtimeManager.stopAll();
      return result;
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/tools", async (request) => {
    requireProject(request.params.projectId);
    return { tools: listTools(request.params.projectId), runtime: runtimeManager.getSummary(request.params.projectId), toolsListSnapshot: getToolsListSnapshot(request.params.projectId) };
  });

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/tools/refresh", async (request) => {
    const project = requireProject(request.params.projectId);
    const tools = await runtimeManager.refreshTools(project);
    return { tools, runtime: runtimeManager.getSummary(project.id), toolsListSnapshot: getToolsListSnapshot(project.id) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/tools/list/raw", async (request) => {
    requireProject(request.params.projectId);
    return { toolsListSnapshot: getToolsListSnapshot(request.params.projectId) };
  });

  app.get<{ Params: { projectId: string; toolName: string } }>("/api/projects/:projectId/tools/:toolName/schema", async (request, reply) => {
    requireProject(request.params.projectId);
    const tool = getTool(request.params.projectId, request.params.toolName);
    if (!tool) return reply.code(404).send({ error: `Tool not found: ${request.params.toolName}` });
    return { toolName: tool.name, inputSchema: tool.inputSchema, required: tool.required, description: tool.description, category: tool.category };
  });

  app.get("/api/mcp/tools", async () => {
    const selectedProjectId = getSelectedProjectId();
    if (!selectedProjectId) return { tools: [], runtime: undefined };
    return { tools: listTools(selectedProjectId), runtime: runtimeManager.getSummary(selectedProjectId) };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/mcp/status-lite", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = callToolSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const tool = getTool(project.id, "maker_status_lite");
    if (!tool) return reply.code(404).send({ error: "Tool not found for selected project: maker_status_lite" });
    try {
      const response = await executeToolCall(project, tool, extractArguments(parsed.data));
      return { projectId: project.id, ...response };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ projectId: project.id, error: message, task: (error as { task?: unknown }).task, generation: (error as { generation?: unknown }).generation });
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/scan", async (request) => {
    const project = requireProject(request.params.projectId);
    const assets = await scanProjectAssets(project);
    const provenance = rebuildAssetProvenance(project);
    return { assets: listAssets(project.id), count: assets.length, provenanceCount: provenance.length };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/references/scan", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetReferenceScanSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const results = await scanAssetReferences(project.rootPath, parsed.data.relativePaths);
    return { ok: true, results };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/delete", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetPathsSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    for (const relativePath of parsed.data.relativePaths) {
      const asset = getAssetByRelativePath(project.id, relativePath);
      if (!asset) continue;
      const absolutePath = resolveProjectPath(project.rootPath, asset.relativePath);
      if (fs.existsSync(absolutePath)) fs.rmSync(absolutePath, { force: true });
    }
    const assets = await scanProjectAssets(project);
    return { ok: true, assets, count: assets.length };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/move", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetMoveSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const mutation = await moveAssetFiles(
        project.rootPath,
        parsed.data.relativePaths,
        parsed.data.targetFolder,
        parsed.data.updateReferences
      );
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...mutation };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/copy", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetCopySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const targetDir = resolveProjectPath(project.rootPath, parsed.data.targetFolder);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const relativePath of parsed.data.relativePaths) {
      const asset = getAssetByRelativePath(project.id, relativePath);
      if (!asset) continue;
      const from = resolveProjectPath(project.rootPath, asset.relativePath);
      if (!fs.existsSync(from)) continue;
      const requestedTarget = path.join(targetDir, path.basename(asset.relativePath));
      if (!isSafeProjectPath(project.rootPath, requestedTarget)) throw new Error(`Unsafe target path: ${parsed.data.targetFolder}`);
      fs.copyFileSync(from, nextAvailablePath(requestedTarget));
    }
    const assets = await scanProjectAssets(project);
    return { ok: true, assets, count: assets.length };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/folders/create", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetFolderCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await createAssetFolder(project.rootPath, parsed.data.parentFolder, parsed.data.name);
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...result };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/folders/rename", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetFolderRenameSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const mutation = await renameAssetFolder(
        project.rootPath,
        parsed.data.directoryPath,
        parsed.data.newName,
        parsed.data.updateReferences
      );
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...mutation };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/folders/move", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetFolderMoveSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const mutation = await moveAssetFolder(
        project.rootPath,
        parsed.data.directoryPath,
        parsed.data.targetFolder,
        parsed.data.updateReferences
      );
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...mutation };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/folders/delete", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetFolderPathSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await deleteAssetFolder(project.rootPath, parsed.data.directoryPath);
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...result };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/folders/copy", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetFolderCopySchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = await copyAssetFolder(project.rootPath, parsed.data.directoryPath, parsed.data.targetFolder);
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...result };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/open-local", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetOpenSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const targetPath = resolveProjectPath(project.rootPath, parsed.data.relativePath);
    openSystemPath(project.rootPath, targetPath, parsed.data.mode);
    return { ok: true };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/import", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetImportSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const fileName = sanitizeFileName(parsed.data.fileName);
    if (!fileName) return reply.code(400).send({ error: "fileName is required" });

    const targetDir = resolveProjectPath(project.rootPath, parsed.data.targetFolder);
    fs.mkdirSync(targetDir, { recursive: true });

    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    let targetPath = path.join(targetDir, fileName);
    let index = 1;
    while (fs.existsSync(targetPath)) {
      targetPath = path.join(targetDir, `${baseName}_${index}${extension}`);
      index += 1;
    }
    if (!isSafeProjectPath(project.rootPath, targetPath)) throw new Error(`Unsafe target path: ${parsed.data.targetFolder}`);
    fs.writeFileSync(targetPath, decodeDataUrl(parsed.data.dataUrl));

    const assets = await scanProjectAssets(project);
    return { ok: true, assets, count: assets.length };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/import-local-paths", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetImportLocalPathsSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const targetDir = resolveProjectPath(project.rootPath, parsed.data.targetFolder);
    fs.mkdirSync(targetDir, { recursive: true });

    let importedCount = 0;
    for (const sourcePath of parsed.data.sourcePaths) {
      const absoluteSourcePath = path.resolve(sourcePath);
      if (!fs.existsSync(absoluteSourcePath)) continue;
      const stat = fs.statSync(absoluteSourcePath);
      if (stat.isFile()) {
        importedCount += copyLocalFileIntoDirectory(absoluteSourcePath, targetDir);
        continue;
      }
      if (stat.isDirectory()) {
        importedCount += copyLocalDirectoryIntoDirectory(absoluteSourcePath, targetDir);
      }
    }

    const assets = await scanProjectAssets(project);
    return { ok: true, assets, importedCount, count: assets.length };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/rename", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetRenameSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const mutation = await renameAssetFile(
        project.rootPath,
        parsed.data.relativePath,
        parsed.data.newName,
        parsed.data.updateReferences
      );
      const assets = await scanProjectAssets(project);
      return { ok: true, assets, count: assets.length, ...mutation };
    } catch (error) {
      return sendAssetFileOperationError(reply, error);
    }
  });

  app.get<{ Params: { projectId: string }; Querystring: unknown }>("/api/projects/:projectId/assets", async (request, reply) => {
    requireProject(request.params.projectId);
    const parsed = assetListQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { assets: listAssets(request.params.projectId, parsed.data) };
  });

  app.get<{ Params: { projectId: string }; Querystring: { rootPath?: string } }>("/api/projects/:projectId/assets/tree", async (request) => {
    const project = requireProject(request.params.projectId);
    const rootPath = request.query.rootPath?.trim() || "assets";
    const assets = listAssets(request.params.projectId, { rootPrefix: rootPath, limit: 10000 });
    const directories = listProjectAssetDirectories(project.rootPath, rootPath);
    return { tree: buildAssetDirectoryTree(assets, rootPath, directories) };
  });

  app.post<{ Params: { projectId: string } }>("/api/projects/:projectId/assets/provenance/rebuild", async (request) => {
    const project = requireProject(request.params.projectId);
    const provenance = rebuildAssetProvenance(project);
    return { ok: true, provenanceCount: provenance.length, assets: listAssets(project.id) };
  });

  app.get<{ Params: { projectId: string }; Querystring: { relativePath?: string } }>("/api/projects/:projectId/assets/provenance", async (request, reply) => {
    requireProject(request.params.projectId);
    const relativePath = request.query.relativePath;
    if (!relativePath) return reply.code(400).send({ error: "relativePath is required" });
    return { provenance: listAssetProvenanceForAsset(request.params.projectId, relativePath) };
  });

  app.get<{ Params: { projectId: string }; Querystring: { relativePath?: string } }>("/api/projects/:projectId/assets/preview", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const relativePath = request.query.relativePath;
    if (!relativePath) return reply.code(400).send({ error: "relativePath is required" });
    const asset = getAssetByRelativePath(project.id, relativePath);
    if (!asset) return reply.code(404).send({ error: "Asset not found" });
    if (!isSafeProjectPath(project.rootPath, asset.absolutePath) || !fs.existsSync(asset.absolutePath)) {
      return reply.code(404).send({ error: "Asset file unavailable" });
    }
    return sendAssetFile(reply, asset.absolutePath, request.headers.range);
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/model-packages", async (request) => {
    const project = requireProject(request.params.projectId);
    await scanProjectAssets(project);
    return { packages: scanModelPackages(request.params.projectId) };
  });

  app.post<{ Params: { projectId: string; id: string } }>("/api/projects/:projectId/model-packages/:id/organize", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    try {
      organizeModelPackage(request.params.projectId, request.params.id);
      await scanProjectAssets(project);
      return { ok: true, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string; id: string }; Body: { mdlPath: string } }>("/api/projects/:projectId/model-packages/:id/bind", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    if (!request.body?.mdlPath) return reply.code(400).send({ error: "mdlPath is required" });
    try {
      bindModelPackage(request.params.projectId, request.params.id, request.body.mdlPath);
      await scanProjectAssets(project);
      return { ok: true, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string; id: string } }>("/api/projects/:projectId/model-packages/:id/discard", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    try {
      discardModelPackage(request.params.projectId, request.params.id);
      await scanProjectAssets(project);
      return { ok: true, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string; id: string } }>("/api/projects/:projectId/model-packages/:id/restore", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    try {
      restoreModelPackage(request.params.projectId, request.params.id);
      await scanProjectAssets(project);
      return { ok: true, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string; id: string }; Body: { action: "add" | "remove" } }>("/api/projects/:projectId/model-packages/:id/resource", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    if (!request.body?.action) return reply.code(400).send({ error: "action is required" });
    try {
      updateResourceTable(request.params.projectId, request.params.id, request.body.action);
      await scanProjectAssets(project);
      return { ok: true, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string }; Body: { packageIds?: string[]; action?: "organize" | "discard" | "restore" | "add_to_resource" | "remove_from_resource" } }>("/api/projects/:projectId/model-packages/batch", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const packageIds = request.body?.packageIds;
    const action = request.body?.action;
    if (!Array.isArray(packageIds) || packageIds.length === 0) return reply.code(400).send({ error: "packageIds is required" });
    if (!action) return reply.code(400).send({ error: "action is required" });
    try {
      const results = runModelPackageBatchAction(request.params.projectId, packageIds, action);
      await scanProjectAssets(project);
      return { ok: results.every((result) => result.ok), results, packages: scanModelPackages(request.params.projectId) };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/model-convert/mdl-to-gltf", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = modelConvertSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const result = convertMdlToGltf(project.rootPath, parsed.data.relativePath);
      const assets = await scanProjectAssets(project);
      return { ok: true, ...result, assetsIndexed: assets.length };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/model-convert/mdl-info", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = modelConvertSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const fullPath = resolveProjectPath(project.rootPath, parsed.data.relativePath);
      return { ok: true, info: inspectMdlFile(fullPath) };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/generations", async (request) => {
    requireProject(request.params.projectId);
    return { generations: listGenerations(request.params.projectId) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/build/logs", async (request) => {
    const project = requireProject(request.params.projectId);
    return { logs: getProjectBuildLogs(project) };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/workflows", async (request) => {
    requireProject(request.params.projectId);
    return { workflows: listWorkflowGraphs(request.params.projectId) };
  });

  app.get<{ Params: { projectId: string; workflowId: string } }>("/api/projects/:projectId/workflows/:workflowId", async (request, reply) => {
    requireProject(request.params.projectId);
    const workflow = getWorkflowGraph(request.params.projectId, request.params.workflowId);
    if (!workflow) return reply.code(404).send({ error: `Workflow not found: ${request.params.workflowId}` });
    return { workflow };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/workflows", async (request, reply) => {
    requireProject(request.params.projectId);
    const parsed = workflowSaveSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const workflow = saveWorkflowGraph(request.params.projectId, parsed.data.name, parsed.data.graph, parsed.data.id);
    return { workflow, workflows: listWorkflowGraphs(request.params.projectId) };
  });

  app.delete<{ Params: { projectId: string; workflowId: string } }>("/api/projects/:projectId/workflows/:workflowId", async (request) => {
    requireProject(request.params.projectId);
    deleteWorkflowGraph(request.params.projectId, request.params.workflowId);
    return { ok: true, workflows: listWorkflowGraphs(request.params.projectId) };
  });

  // Flows (Multimodal Canvas)
  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/flows", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const flowsDir = path.join(project.rootPath, "assets", "flows");
    if (!fs.existsSync(flowsDir)) return { flows: [] };
    const files = fs.readdirSync(flowsDir).filter(f => f.endsWith('.json'));
    const flows = files.map(f => {
      const flowPath = path.join(flowsDir, f);
      const stat = fs.statSync(flowPath);
      const id = f.replace('.json', '');
      return { id, name: readFlowDisplayName(flowPath, id), mtimeMs: stat.mtimeMs };
    }).sort((a, b) => b.mtimeMs - a.mtimeMs);
    return { flows };
  });

  app.get<{ Params: { projectId: string; name: string } }>("/api/projects/:projectId/flows/:name", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const safeName = request.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const flowPath = path.join(project.rootPath, "assets", "flows", `${safeName}.json`);
    if (!fs.existsSync(flowPath)) return reply.code(404).send({ error: "Flow not found" });
    const data = fs.readFileSync(flowPath, "utf8");
    return { data: JSON.parse(data) };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/flows", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = flowSaveSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const displayName = parsed.data.name.trim();
    const safeName = createFlowId(displayName);
    if (!safeName) return reply.code(400).send({ error: "Invalid name" });
    
    const flowsDir = path.join(project.rootPath, "assets", "flows");
    fs.mkdirSync(flowsDir, { recursive: true });
    
    const flowPath = path.join(flowsDir, `${safeName}.json`);
    fs.writeFileSync(flowPath, JSON.stringify(withFlowDisplayName(parsed.data.data, displayName), null, 2), "utf8");
    const stat = fs.statSync(flowPath);
    return { ok: true, id: safeName, name: displayName, mtimeMs: stat.mtimeMs };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/flows/auto-save", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = flowAutoSaveSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    
    const flowsDir = path.join(project.rootPath, "assets", "flows");
    fs.mkdirSync(flowsDir, { recursive: true });
    
    const flowPath = path.join(flowsDir, `_autosave.json`);
    fs.writeFileSync(flowPath, JSON.stringify(parsed.data.data, null, 2), "utf8");
    return { ok: true, name: "_autosave" };
  });

  app.patch<{ Params: { projectId: string; name: string }; Body: unknown }>("/api/projects/:projectId/flows/:name", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = flowRenameSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const safeName = request.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const flowPath = path.join(project.rootPath, "assets", "flows", `${safeName}.json`);
    if (!fs.existsSync(flowPath)) return reply.code(404).send({ error: "Flow not found" });
    const data = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    const displayName = parsed.data.name.trim();
    fs.writeFileSync(flowPath, JSON.stringify(withFlowDisplayName(data, displayName), null, 2), "utf8");
    return { ok: true, id: safeName, name: displayName };
  });

  app.delete<{ Params: { projectId: string; name: string } }>("/api/projects/:projectId/flows/:name", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const safeName = request.params.name.replace(/[^a-zA-Z0-9_-]/g, '');
    const flowPath = path.join(project.rootPath, "assets", "flows", `${safeName}.json`);
    if (fs.existsSync(flowPath)) fs.unlinkSync(flowPath);
    return { ok: true };
  });

  app.get<{ Params: { projectId: string } }>("/api/projects/:projectId/workflow-runs", async (request) => {
    requireProject(request.params.projectId);
    return { runs: listWorkflowRuns(request.params.projectId) };
  });

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/workflow-runs", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = workflowRunSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const run = await executeWorkflowRun(project, parsed.data.graph, parsed.data.nodeIds, parsed.data.name ?? `${project.name} workflow run`, parsed.data.workflowId);
    return { run, runs: listWorkflowRuns(project.id), tasks: listTasks(project.id) };
  });

  app.delete<{ Params: { projectId: string; runId: string } }>("/api/projects/:projectId/workflow-runs/:runId", async (request) => {
    requireProject(request.params.projectId);
    deleteWorkflowRun(request.params.projectId, request.params.runId);
    return { ok: true, runs: listWorkflowRuns(request.params.projectId) };
  });

  app.get<{ Querystring: { projectId?: string } }>("/api/tasks", async (request) => {
    return { tasks: listTasks(request.query.projectId) };
  });

  app.delete<{ Querystring: { projectId?: string } }>("/api/tasks", async (request) => {
    deleteTasks(request.query.projectId);
    return { ok: true, tasks: listTasks(request.query.projectId) };
  });

  app.get<{ Querystring: { projectId?: string } }>("/api/credits", async (request) => {
    syncCreditRecordsFromTasks(request.query.projectId);
    return { credits: listCreditRecords(request.query.projectId) };
  });

  app.get<{ Params: { taskId: string } }>("/api/tasks/:taskId", async (request, reply) => {
    const task = getTask(request.params.taskId);
    if (!task) return reply.code(404).send({ error: `Task not found: ${request.params.taskId}` });
    return { task };
  });

  app.post<{ Params: { projectId: string; toolName: string }; Body: unknown }>("/api/projects/:projectId/tools/:toolName/call", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = callToolSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const tool = getTool(project.id, request.params.toolName);
    if (!tool) return reply.code(404).send({ error: `Tool not found for selected project: ${request.params.toolName}` });

    try {
      const response = await executeToolCall(project, tool, extractArguments(parsed.data));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ error: message, task: (error as { task?: unknown }).task, generation: (error as { generation?: unknown }).generation, assetsIndexed: 0 });
    }
  });

  app.post<{ Body: unknown }>("/api/mcp/call", async (request, reply) => {
    const selectedProjectId = getSelectedProjectId();
    if (!selectedProjectId) return reply.code(400).send({ error: "No selected project" });
    const body = request.body as { toolName?: unknown } | undefined;
    if (typeof body?.toolName !== "string") return reply.code(400).send({ error: "toolName is required" });
    const project = requireProject(selectedProjectId);
    const parsed = callToolSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const tool = getTool(project.id, body.toolName);
    if (!tool) return reply.code(404).send({ error: `Tool not found for selected project: ${body.toolName}` });
    try {
      return await executeToolCall(project, tool, extractArguments(parsed.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ error: message, task: (error as { task?: unknown }).task, generation: (error as { generation?: unknown }).generation, assetsIndexed: 0 });
    }
  });
}
