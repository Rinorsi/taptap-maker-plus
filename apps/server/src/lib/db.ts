import fs from "node:fs";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { config } from "./config.js";
import type { AssetProvenanceSummary, AssetSummary, GenerationRecord, MakerWorkflowGraph, ProjectSummary, TaskRecord, TaskStatus, ToolSummary, ToolsListSnapshot, WorkflowGraphRecord, WorkflowNodeRunResult, WorkflowRunRecord, WorkflowRunStatus } from "../types.js";

fs.mkdirSync(config.dataDir, { recursive: true });

export const sqlite = new Database(config.databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    root_path TEXT NOT NULL UNIQUE,
    maker_project_id TEXT NOT NULL,
    config_path TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    last_scanned_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    required_json TEXT NOT NULL,
    input_schema_json TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, name),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tools_list_snapshots (
    project_id TEXT PRIMARY KEY,
    raw_result_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    absolute_path TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    extension TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    mtime_ms REAL NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, relative_path),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS asset_provenance (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    asset_relative_path TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    tool_name TEXT,
    workflow_run_id TEXT,
    workflow_node_id TEXT,
    input_summary TEXT,
    prompt TEXT,
    matched_by TEXT NOT NULL,
    source_created_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(project_id, asset_relative_path, source_type, source_id, workflow_node_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    status TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    input_json TEXT NOT NULL,
    raw_result_json TEXT,
    error_message TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT NOT NULL,
    raw_result_json TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workflow_graphs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    graph_json TEXT NOT NULL,
    node_count INTEGER NOT NULL,
    edge_count INTEGER NOT NULL,
    tool_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    workflow_id TEXT,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    graph_json TEXT NOT NULL,
    node_results_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toProject = (row: any, selectedProjectId?: string): ProjectSummary => ({
  id: row.id,
  name: row.name,
  rootPath: row.root_path,
  makerProjectId: row.maker_project_id,
  configPath: row.config_path,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
  selected: selectedProjectId === row.id
});

const toAsset = (row: any): AssetSummary => ({
  id: row.id,
  projectId: row.project_id,
  absolutePath: row.absolute_path,
  relativePath: row.relative_path,
  fileName: row.file_name,
  extension: row.extension,
  assetType: row.asset_type,
  sizeBytes: row.size_bytes,
  mtimeMs: row.mtime_ms,
  status: row.status,
  updatedAt: row.updated_at
});

const toAssetProvenance = (row: any): AssetProvenanceSummary => ({
  id: row.id,
  projectId: row.project_id,
  assetId: row.asset_id,
  assetRelativePath: row.asset_relative_path,
  sourceType: row.source_type,
  sourceId: row.source_id,
  toolName: row.tool_name ?? undefined,
  workflowRunId: row.workflow_run_id ?? undefined,
  workflowNodeId: row.workflow_node_id ?? undefined,
  inputSummary: row.input_summary ?? undefined,
  prompt: row.prompt ?? undefined,
  matchedBy: row.matched_by,
  sourceCreatedAt: row.source_created_at ?? undefined,
  createdAt: row.created_at
});

const toTask = (row: any): TaskRecord => ({
  taskId: row.task_id,
  projectId: row.project_id,
  toolName: row.tool_name,
  status: row.status,
  inputSummary: row.input_summary,
  inputJson: row.input_json,
  rawResultJson: row.raw_result_json ?? undefined,
  errorMessage: row.error_message ?? undefined,
  startedAt: row.started_at,
  finishedAt: row.finished_at ?? undefined
});

const toGeneration = (row: any): GenerationRecord => ({
  id: row.id,
  projectId: row.project_id,
  toolName: row.tool_name,
  status: row.status,
  inputJson: row.input_json,
  rawResultJson: row.raw_result_json ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  finishedAt: row.finished_at ?? undefined
});

const toWorkflowGraph = (row: any): WorkflowGraphRecord => ({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  graph: parseJson<MakerWorkflowGraph>(row.graph_json, { nodes: [], edges: [], source: "tools-list", version: 1 }),
  nodeCount: row.node_count,
  edgeCount: row.edge_count,
  toolCount: row.tool_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const toWorkflowRun = (row: any): WorkflowRunRecord => ({
  id: row.id,
  projectId: row.project_id,
  workflowId: row.workflow_id ?? undefined,
  name: row.name,
  status: row.status,
  graph: parseJson<MakerWorkflowGraph>(row.graph_json, { nodes: [], edges: [], source: "tools-list", version: 1 }),
  nodeResults: parseJson<WorkflowNodeRunResult[]>(row.node_results_json, []),
  createdAt: row.created_at,
  finishedAt: row.finished_at ?? undefined
});

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== "object") return JSON.stringify(input ?? {});
  const entries = Object.entries(input as Record<string, unknown>);
  if (!entries.length) return "{}";
  return entries.slice(0, 4).map(([key, value]) => `${key}: ${typeof value === "string" ? value.slice(0, 48) : JSON.stringify(value)}`).join("; ");
}

export function upsertProject(project: ProjectSummary) {
  sqlite.prepare(`
    INSERT INTO projects (id, name, root_path, maker_project_id, config_path, created_at, updated_at, last_scanned_at)
    VALUES (@id, @name, @rootPath, @makerProjectId, @configPath, @createdAt, @updatedAt, @lastScannedAt)
    ON CONFLICT(root_path) DO UPDATE SET
      name = excluded.name,
      maker_project_id = excluded.maker_project_id,
      config_path = excluded.config_path,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_scanned_at = excluded.last_scanned_at
  `).run({ ...project, lastScannedAt: new Date().toISOString() });
}

export function setSelectedProject(projectId: string) {
  sqlite.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('selected_project_id', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(projectId, new Date().toISOString());
}

export function getSelectedProjectId(): string | undefined {
  const row = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'selected_project_id'").get() as { value?: string } | undefined;
  return row?.value;
}

export function listProjects(): ProjectSummary[] {
  const selectedProjectId = getSelectedProjectId();
  return sqlite.prepare("SELECT * FROM projects ORDER BY name COLLATE NOCASE").all().map((row: any) => toProject(row, selectedProjectId));
}

export function getProject(id: string): ProjectSummary | undefined {
  const row = sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  return row ? toProject(row, getSelectedProjectId()) : undefined;
}

export function saveTools(projectId: string, tools: ToolSummary[], rawResult?: unknown) {
  const now = new Date().toISOString();
  const insert = sqlite.prepare(`
    INSERT INTO tools (id, project_id, name, category, required_json, input_schema_json, description, updated_at)
    VALUES (@id, @projectId, @name, @category, @requiredJson, @inputSchemaJson, @description, @updatedAt)
    ON CONFLICT(project_id, name) DO UPDATE SET
      category = excluded.category,
      required_json = excluded.required_json,
      input_schema_json = excluded.input_schema_json,
      description = excluded.description,
      updated_at = excluded.updated_at
  `);
  const snapshot = sqlite.prepare(`
    INSERT INTO tools_list_snapshots (project_id, raw_result_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET raw_result_json = excluded.raw_result_json, updated_at = excluded.updated_at
  `);
  const tx = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM tools WHERE project_id = ?").run(projectId);
    for (const tool of tools) {
      insert.run({
        id: `${projectId}:${tool.name}`,
        projectId,
        name: tool.name,
        category: tool.category,
        requiredJson: JSON.stringify(tool.required),
        inputSchemaJson: JSON.stringify(tool.inputSchema),
        description: tool.description ?? null,
        updatedAt: now
      });
    }
    if (rawResult !== undefined) {
      snapshot.run(projectId, JSON.stringify(rawResult, null, 2), now);
    }
  });
  tx();
}

export function getToolsListSnapshot(projectId: string): ToolsListSnapshot | undefined {
  const row = sqlite.prepare("SELECT * FROM tools_list_snapshots WHERE project_id = ?").get(projectId) as any;
  if (!row) return undefined;
  return { projectId: row.project_id, rawResultJson: row.raw_result_json, updatedAt: row.updated_at };
}

export function listTools(projectId: string): ToolSummary[] {
  return sqlite.prepare("SELECT * FROM tools WHERE project_id = ? ORDER BY name").all(projectId).map((row: any) => ({
    name: row.name,
    category: row.category,
    required: parseJson<string[]>(row.required_json, []),
    inputSchema: parseJson<Record<string, unknown>>(row.input_schema_json, { type: "object", properties: {} }),
    description: row.description ?? undefined
  }));
}

export function getTool(projectId: string, name: string): ToolSummary | undefined {
  const row = sqlite.prepare("SELECT * FROM tools WHERE project_id = ? AND name = ?").get(projectId, name) as any;
  if (!row) return undefined;
  return {
    name: row.name,
    category: row.category,
    required: parseJson<string[]>(row.required_json, []),
    inputSchema: parseJson<Record<string, unknown>>(row.input_schema_json, { type: "object", properties: {} }),
    description: row.description ?? undefined
  };
}

export function upsertAssets(projectId: string, assets: AssetSummary[]) {
  const insert = sqlite.prepare(`
    INSERT INTO assets (id, project_id, absolute_path, relative_path, file_name, extension, asset_type, size_bytes, mtime_ms, status, updated_at)
    VALUES (@id, @projectId, @absolutePath, @relativePath, @fileName, @extension, @assetType, @sizeBytes, @mtimeMs, @status, @updatedAt)
    ON CONFLICT(project_id, relative_path) DO UPDATE SET
      absolute_path = excluded.absolute_path,
      file_name = excluded.file_name,
      extension = excluded.extension,
      asset_type = excluded.asset_type,
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const tx = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM assets WHERE project_id = ?").run(projectId);
    for (const asset of assets) insert.run(asset);
  });
  tx();
}

export function listAssets(projectId: string, limit = 200): AssetSummary[] {
  const assets = sqlite.prepare("SELECT * FROM assets WHERE project_id = ? ORDER BY mtime_ms DESC, relative_path COLLATE NOCASE LIMIT ?").all(projectId, limit).map(toAsset);
  const provenance = listAssetProvenance(projectId);
  const byPath = new Map<string, AssetProvenanceSummary[]>();
  for (const item of provenance) {
    const list = byPath.get(item.assetRelativePath) ?? [];
    list.push(item);
    byPath.set(item.assetRelativePath, list);
  }
  return assets.map((asset) => ({ ...asset, provenance: byPath.get(asset.relativePath) ?? [] }));
}

export function getAssetByRelativePath(projectId: string, relativePath: string): AssetSummary | undefined {
  const row = sqlite.prepare("SELECT * FROM assets WHERE project_id = ? AND relative_path = ?").get(projectId, relativePath);
  if (!row) return undefined;
  const asset = toAsset(row);
  return { ...asset, provenance: listAssetProvenanceForAsset(projectId, relativePath) };
}

export function replaceAssetProvenance(projectId: string, records: AssetProvenanceSummary[]) {
  const insert = sqlite.prepare(`
    INSERT INTO asset_provenance (id, project_id, asset_id, asset_relative_path, source_type, source_id, tool_name, workflow_run_id, workflow_node_id, input_summary, prompt, matched_by, source_created_at, created_at)
    VALUES (@id, @projectId, @assetId, @assetRelativePath, @sourceType, @sourceId, @toolName, @workflowRunId, @workflowNodeId, @inputSummary, @prompt, @matchedBy, @sourceCreatedAt, @createdAt)
    ON CONFLICT(project_id, asset_relative_path, source_type, source_id, workflow_node_id) DO UPDATE SET
      tool_name = excluded.tool_name,
      workflow_run_id = excluded.workflow_run_id,
      input_summary = excluded.input_summary,
      prompt = excluded.prompt,
      matched_by = excluded.matched_by,
      source_created_at = excluded.source_created_at,
      created_at = excluded.created_at
  `);
  const tx = sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM asset_provenance WHERE project_id = ?").run(projectId);
    for (const record of records) insert.run({ ...record, toolName: record.toolName ?? null, workflowRunId: record.workflowRunId ?? null, workflowNodeId: record.workflowNodeId ?? null, inputSummary: record.inputSummary ?? null, prompt: record.prompt ?? null, sourceCreatedAt: record.sourceCreatedAt ?? null });
  });
  tx();
}

export function listAssetProvenance(projectId: string, limit = 500): AssetProvenanceSummary[] {
  return sqlite.prepare("SELECT * FROM asset_provenance WHERE project_id = ? ORDER BY source_created_at DESC, created_at DESC LIMIT ?").all(projectId, limit).map(toAssetProvenance);
}

export function listAssetProvenanceForAsset(projectId: string, relativePath: string): AssetProvenanceSummary[] {
  return sqlite.prepare("SELECT * FROM asset_provenance WHERE project_id = ? AND asset_relative_path = ? ORDER BY source_created_at DESC, created_at DESC").all(projectId, relativePath).map(toAssetProvenance);
}

export function createTask(projectId: string, toolName: string, input: unknown, status: TaskStatus = "queued"): TaskRecord {
  const record: TaskRecord = {
    taskId: randomUUID(),
    projectId,
    toolName,
    status,
    inputSummary: summarizeInput(input),
    inputJson: JSON.stringify(input ?? {}, null, 2),
    startedAt: new Date().toISOString()
  };
  sqlite.prepare(`
    INSERT INTO tasks (task_id, project_id, tool_name, status, input_summary, input_json, started_at)
    VALUES (@taskId, @projectId, @toolName, @status, @inputSummary, @inputJson, @startedAt)
  `).run(record);
  return record;
}

export function updateTaskStatus(taskId: string, status: TaskStatus): TaskRecord {
  sqlite.prepare("UPDATE tasks SET status = ? WHERE task_id = ?").run(status, taskId);
  return getTask(taskId)!;
}

export function finishTask(taskId: string, status: Exclude<TaskStatus, "queued" | "running">, result?: unknown, errorMessage?: string): TaskRecord {
  sqlite.prepare(`
    UPDATE tasks SET status = ?, raw_result_json = ?, error_message = ?, finished_at = ? WHERE task_id = ?
  `).run(status, result === undefined ? null : JSON.stringify(result, null, 2), errorMessage ?? null, new Date().toISOString(), taskId);
  return getTask(taskId)!;
}

export function getTask(taskId: string): TaskRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM tasks WHERE task_id = ?").get(taskId);
  return row ? toTask(row) : undefined;
}

export function listTasks(projectId?: string, limit = 80): TaskRecord[] {
  const sql = projectId
    ? "SELECT * FROM tasks WHERE project_id = ? ORDER BY started_at DESC LIMIT ?"
    : "SELECT * FROM tasks ORDER BY started_at DESC LIMIT ?";
  const rows = projectId ? sqlite.prepare(sql).all(projectId, limit) : sqlite.prepare(sql).all(limit);
  return rows.map(toTask);
}

export function deleteTasks(projectId?: string) {
  if (projectId) {
    sqlite.prepare("DELETE FROM tasks WHERE project_id = ?").run(projectId);
    sqlite.prepare("DELETE FROM generations WHERE project_id = ?").run(projectId);
    return;
  }
  sqlite.prepare("DELETE FROM tasks").run();
  sqlite.prepare("DELETE FROM generations").run();
}

export function createGeneration(projectId: string, toolName: string, input: unknown): GenerationRecord {
  const record: GenerationRecord = {
    id: randomUUID(),
    projectId,
    toolName,
    status: "running",
    inputJson: JSON.stringify(input ?? {}, null, 2),
    createdAt: new Date().toISOString()
  };
  sqlite.prepare(`
    INSERT INTO generations (id, project_id, tool_name, status, input_json, created_at)
    VALUES (@id, @projectId, @toolName, @status, @inputJson, @createdAt)
  `).run(record);
  return record;
}

export function finishGeneration(id: string, status: "succeeded" | "failed", result?: unknown, errorMessage?: string): GenerationRecord {
  sqlite.prepare(`
    UPDATE generations SET status = ?, raw_result_json = ?, error_message = ?, finished_at = ? WHERE id = ?
  `).run(status, result === undefined ? null : JSON.stringify(result, null, 2), errorMessage ?? null, new Date().toISOString(), id);
  return toGeneration(sqlite.prepare("SELECT * FROM generations WHERE id = ?").get(id));
}

export function listGenerations(projectId: string, limit = 40): GenerationRecord[] {
  return sqlite.prepare("SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(projectId, limit).map(toGeneration);
}

export function listWorkflowGraphs(projectId: string, limit = 40): WorkflowGraphRecord[] {
  return sqlite.prepare("SELECT * FROM workflow_graphs WHERE project_id = ? ORDER BY updated_at DESC LIMIT ?").all(projectId, limit).map(toWorkflowGraph);
}

export function getWorkflowGraph(projectId: string, id: string): WorkflowGraphRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM workflow_graphs WHERE project_id = ? AND id = ?").get(projectId, id);
  return row ? toWorkflowGraph(row) : undefined;
}

export function saveWorkflowGraph(projectId: string, name: string, graph: MakerWorkflowGraph, id?: string): WorkflowGraphRecord {
  const now = new Date().toISOString();
  const workflowId = id || randomUUID();
  const existing = sqlite.prepare("SELECT created_at FROM workflow_graphs WHERE project_id = ? AND id = ?").get(projectId, workflowId) as { created_at?: string } | undefined;
  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const toolCount = graph.nodes.filter((node) => {
    if (!node || typeof node !== "object") return false;
    const data = (node as { data?: unknown }).data;
    return !!data && typeof data === "object" && (data as { kind?: unknown }).kind === "tool";
  }).length;
  const record: WorkflowGraphRecord = {
    id: workflowId,
    projectId,
    name,
    graph,
    nodeCount,
    edgeCount,
    toolCount,
    createdAt: existing?.created_at ?? now,
    updatedAt: now
  };
  sqlite.prepare(`
    INSERT INTO workflow_graphs (id, project_id, name, graph_json, node_count, edge_count, tool_count, created_at, updated_at)
    VALUES (@id, @projectId, @name, @graphJson, @nodeCount, @edgeCount, @toolCount, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      graph_json = excluded.graph_json,
      node_count = excluded.node_count,
      edge_count = excluded.edge_count,
      tool_count = excluded.tool_count,
      updated_at = excluded.updated_at
  `).run({ ...record, graphJson: JSON.stringify(graph, null, 2) });
  return record;
}

export function deleteWorkflowGraph(projectId: string, id: string) {
  sqlite.prepare("DELETE FROM workflow_graphs WHERE project_id = ? AND id = ?").run(projectId, id);
}

export function createWorkflowRun(projectId: string, name: string, graph: MakerWorkflowGraph, workflowId?: string): WorkflowRunRecord {
  const record: WorkflowRunRecord = {
    id: randomUUID(),
    projectId,
    workflowId,
    name,
    status: "running",
    graph,
    nodeResults: [],
    createdAt: new Date().toISOString()
  };
  sqlite.prepare(`
    INSERT INTO workflow_runs (id, project_id, workflow_id, name, status, graph_json, node_results_json, created_at)
    VALUES (@id, @projectId, @workflowId, @name, @status, @graphJson, @nodeResultsJson, @createdAt)
  `).run({ ...record, workflowId: workflowId ?? null, graphJson: JSON.stringify(graph, null, 2), nodeResultsJson: JSON.stringify(record.nodeResults, null, 2) });
  return record;
}

export function finishWorkflowRun(runId: string, status: WorkflowRunStatus, nodeResults: WorkflowNodeRunResult[]): WorkflowRunRecord {
  sqlite.prepare(`
    UPDATE workflow_runs SET status = ?, node_results_json = ?, finished_at = ? WHERE id = ?
  `).run(status, JSON.stringify(nodeResults, null, 2), new Date().toISOString(), runId);
  return getWorkflowRun(runId)!;
}

export function getWorkflowRun(id: string): WorkflowRunRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id);
  return row ? toWorkflowRun(row) : undefined;
}

export function listWorkflowRuns(projectId: string, limit = 40): WorkflowRunRecord[] {
  return sqlite.prepare("SELECT * FROM workflow_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all(projectId, limit).map(toWorkflowRun);
}

export function deleteWorkflowRun(projectId: string, runId: string) {
  sqlite.prepare("DELETE FROM workflow_runs WHERE project_id = ? AND id = ?").run(projectId, runId);
}
