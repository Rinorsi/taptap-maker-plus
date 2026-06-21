import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createGeneration,
  createWorkflowRun,
  createTask,
  deleteWorkflowGraph,
  deleteWorkflowRun,
  deleteTasks,
  finishWorkflowRun,
  finishGeneration,
  finishTask,
  getAssetByRelativePath,
  getProject,
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
  saveWorkflowGraph,
  setSelectedProject,
  updateTaskStatus,
  addCreditRecord,
  listCreditRecords
} from "../lib/db.js";
import { scanMakerProjects } from "../services/projectDiscovery.js";
import { scanProjectAssets } from "../services/assetScanner.js";
import { buildAssetDirectoryTree } from "../services/assetTree.js";
import { rebuildAssetProvenance } from "../services/assetProvenance.js";
import { runtimeManager } from "../services/mcpRuntime.js";
import { getProjectBuildLogs } from "../services/projectLogs.js";
import { scanModelPackages, organizeModelPackage, bindModelPackage, discardModelPackage, restoreModelPackage, updateResourceTable, runModelPackageBatchAction } from "../services/modelPackage.js";
import { convertMdlToGltf, inspectMdlFile } from "../services/urhoMdl.js";
import type { MakerWorkflowGraph, ProjectSummary, TaskRecord, ToolSummary, WorkflowNodeRunResult, WorkflowRunStatus } from "../types.js";

const callToolSchema = z.object({
  arguments: z.record(z.string(), z.unknown()).optional(),
  toolArgs: z.record(z.string(), z.unknown()).optional(),
  suggestedName: z.string().optional(),
  assetType: z.string().optional()
}).passthrough();

const assetPathsSchema = z.object({
  relativePaths: z.array(z.string()).min(1)
});

const assetMoveSchema = assetPathsSchema.extend({
  targetFolder: z.string().min(1)
});
const assetRenameSchema = z.object({ relativePath: z.string(), newName: z.string() });

const assetImportSchema = z.object({
  fileName: z.string().min(1),
  targetFolder: z.string().min(1),
  dataUrl: z.string().min(1)
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

function extractArguments(body: z.infer<typeof callToolSchema>): Record<string, unknown> {
  return body.toolArgs ?? body.arguments ?? {};
}

function extractMcpText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return JSON.stringify(result, null, 2);

  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return JSON.stringify(result, null, 2);

  const text = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const next = item as { type?: unknown; text?: unknown };
      return next.type === "text" && typeof next.text === "string" ? next.text : "";
    })
    .filter(Boolean)
    .join("\n");

  return text || JSON.stringify(result, null, 2);
}

function requireProject(projectId: string): ProjectSummary {
  const project = getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

function withRuntime(project: ProjectSummary) {
  return { ...project, runtime: runtimeManager.getSummary(project.id) };
}

function extractCredits(result: unknown): number | undefined {
  for (const object of resultObjects(result)) {
    if (typeof object.credits === "number") return object.credits;
  }
  return undefined;
}

function extractAssetPath(result: unknown): string | undefined {
  for (const object of resultObjects(result)) {
    if (typeof object.localPath === "string") return object.localPath;
    if (typeof object.videoUrl === "string") return object.videoUrl;
    if (typeof object.imageUrl === "string") return object.imageUrl;
    if (typeof object.audioUrl === "string") return object.audioUrl;
    if (typeof object.modelUrl === "string") return object.modelUrl;
    if (typeof object.assetPath === "string") return object.assetPath;
  }
  return undefined;
}

function resultObjects(result: unknown): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const res = result as Record<string, unknown>;
    objects.push(res);
    if (res.structuredContent && typeof res.structuredContent === "object" && !Array.isArray(res.structuredContent)) {
      objects.push(res.structuredContent as Record<string, unknown>);
    }
  }

  const text = extractMcpText(result);
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  }

  return objects;
}

function parseTaskResult(task: TaskRecord): unknown {
  if (!task.rawResultJson) return undefined;
  try {
    return JSON.parse(task.rawResultJson);
  } catch {
    return undefined;
  }
}

function syncCreditRecordsFromTasks(projectId?: string) {
  const tasks = listTasks(projectId, 1000);
  for (const task of tasks) {
    if (task.status !== "succeeded") continue;
    const result = parseTaskResult(task);
    const credits = extractCredits(result);
    if (credits === undefined) continue;
    addCreditRecord({
      projectId: task.projectId,
      taskId: task.taskId,
      toolName: task.toolName,
      credits,
      assetPath: extractAssetPath(result),
      rawResultJson: task.rawResultJson
    });
  }
}

async function executeToolCall(project: ProjectSummary, toolName: string, args: Record<string, unknown>) {
  const task = createTask(project.id, toolName, args, "queued");
  updateTaskStatus(task.taskId, "running");
  const generation = createGeneration(project.id, toolName, args);
  try {
    const result = await runtimeManager.callTool(project, toolName, args);
    const typedResult = result as { isError?: boolean };
    if (typedResult?.isError) {
      throw new Error(extractMcpText(result) || "MCP Tool returned an error");
    }
    const finishedTask = finishTask(task.taskId, "succeeded", result);
    const finishedGeneration = finishGeneration(generation.id, "succeeded", result);
    
    const credits = extractCredits(result);
    if (credits !== undefined) {
      addCreditRecord({
        projectId: project.id,
        taskId: task.taskId,
        toolName: toolName,
        credits: credits,
        assetPath: extractAssetPath(result),
        rawResultJson: JSON.stringify(result)
      });
    }

    const assets = await scanProjectAssets(project);
    return { task: finishedTask, generation: finishedGeneration, result, text: extractMcpText(result), assetsIndexed: assets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedTask = finishTask(task.taskId, "failed", undefined, message);
    const failedGeneration = finishGeneration(generation.id, "failed", undefined, message);
    throw Object.assign(new Error(message), { task: failedTask, generation: failedGeneration });
  }
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
      const response = await executeToolCall(project, tool.name, toolNode.inputs);
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

function decodeDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("Invalid dataUrl");
  const encoded = match[3];
  return match[2] ? Buffer.from(encoded, "base64") : Buffer.from(decodeURIComponent(encoded));
}

function sendAssetFile(reply: FastifyReply, filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : ext === ".webp" ? "image/webp"
        : ext === ".gif" ? "image/gif"
          : ext === ".gltf" ? "model/gltf+json"
            : ext === ".glb" ? "model/gltf-binary"
              : ext === ".bin" ? "application/octet-stream"
                : "application/octet-stream";
  reply.header("Content-Type", contentType);
  return reply.send(fs.createReadStream(filePath));
}

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => ({ ok: true, name: "taptap-maker-plus" }));

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

  app.get("/api/mcp/status", async () => {
    const selectedProjectId = getSelectedProjectId();
    return { selectedProjectId, runtimes: runtimeManager.listSummaries() };
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
    try {
      const response = await executeToolCall(project, "maker_status_lite", extractArguments(parsed.data));
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
    const targetDir = resolveProjectPath(project.rootPath, parsed.data.targetFolder);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const relativePath of parsed.data.relativePaths) {
      const asset = getAssetByRelativePath(project.id, relativePath);
      if (!asset) continue;
      const from = resolveProjectPath(project.rootPath, asset.relativePath);
      const to = path.join(targetDir, path.basename(asset.relativePath));
      if (!isSafeProjectPath(project.rootPath, to)) throw new Error(`Unsafe target path: ${parsed.data.targetFolder}`);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    const assets = await scanProjectAssets(project);
    return { ok: true, assets, count: assets.length };
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

  app.post<{ Params: { projectId: string }; Body: unknown }>("/api/projects/:projectId/assets/rename", async (request, reply) => {
    const project = requireProject(request.params.projectId);
    const parsed = assetRenameSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const asset = getAssetByRelativePath(project.id, parsed.data.relativePath);
    if (!asset) return reply.code(404).send({ error: "Asset not found" });

    const newName = sanitizeFileName(parsed.data.newName);
    if (!newName) return reply.code(400).send({ error: "newName is required" });

    const from = resolveProjectPath(project.rootPath, asset.relativePath);
    const targetPath = path.join(path.dirname(from), newName);
    if (!isSafeProjectPath(project.rootPath, targetPath)) throw new Error(`Unsafe target path: ${newName}`);
    if (fs.existsSync(targetPath)) return reply.code(409).send({ error: "Target file already exists" });
    if (fs.existsSync(from)) fs.renameSync(from, targetPath);

    const assets = await scanProjectAssets(project);
    return { ok: true, assets, count: assets.length };
  });

  app.get<{ Params: { projectId: string }; Querystring: unknown }>("/api/projects/:projectId/assets", async (request, reply) => {
    requireProject(request.params.projectId);
    const parsed = assetListQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { assets: listAssets(request.params.projectId, parsed.data) };
  });

  app.get<{ Params: { projectId: string }; Querystring: { rootPath?: string } }>("/api/projects/:projectId/assets/tree", async (request) => {
    requireProject(request.params.projectId);
    const rootPath = request.query.rootPath?.trim() || "assets";
    const assets = listAssets(request.params.projectId, { rootPrefix: rootPath, limit: 10000 });
    return { tree: buildAssetDirectoryTree(assets, rootPath) };
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
    return sendAssetFile(reply, asset.absolutePath);
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
      const stat = fs.statSync(path.join(flowsDir, f));
      return { name: f.replace('.json', ''), mtimeMs: stat.mtimeMs };
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
    
    const safeName = parsed.data.name.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeName) return reply.code(400).send({ error: "Invalid name" });
    
    const flowsDir = path.join(project.rootPath, "assets", "flows");
    fs.mkdirSync(flowsDir, { recursive: true });
    
    const flowPath = path.join(flowsDir, `${safeName}.json`);
    fs.writeFileSync(flowPath, JSON.stringify(parsed.data.data, null, 2), "utf8");
    return { ok: true, name: safeName };
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

    try {
      const response = await executeToolCall(project, request.params.toolName, extractArguments(parsed.data));
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
    try {
      return await executeToolCall(project, body.toolName, extractArguments(parsed.data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(500).send({ error: message, task: (error as { task?: unknown }).task, generation: (error as { generation?: unknown }).generation, assetsIndexed: 0 });
    }
  });
}
