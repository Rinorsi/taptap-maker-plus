export type RuntimeStatus = "idle" | "starting" | "ready" | "disconnected" | "error";

export type RuntimeSummary = {
  projectId: string;
  status: RuntimeStatus;
  processId?: number;
  toolCount: number;
  startedAt?: string;
  cwd?: string;
  toolsListUpdatedAt?: string;
  lastError?: string;
};

export type ProjectSummary = {
  id: string;
  name: string;
  rootPath: string;
  makerProjectId: string;
  configPath: string;
  createdAt?: string;
  updatedAt?: string;
  runtime?: RuntimeSummary;
  selected?: boolean;
  iconUrl?: string;
};

export type ToolSummary = {
  name: string;
  description?: string;
  category: string;
  required: string[];
  inputSchema: Record<string, unknown>;
};

export type AssetSummary = {
  id: string;
  projectId: string;
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  assetType: string;
  sizeBytes: number;
  mtimeMs: number;
  status: string;
  updatedAt: string;
  provenance?: AssetProvenanceSummary[];
};

export type AssetProvenanceSourceType = "task" | "generation" | "workflow_run";

export type AssetProvenanceSummary = {
  id: string;
  projectId: string;
  assetId: string;
  assetRelativePath: string;
  sourceType: AssetProvenanceSourceType;
  sourceId: string;
  toolName?: string;
  workflowRunId?: string;
  workflowNodeId?: string;
  inputSummary?: string;
  prompt?: string;
  matchedBy: "relative_path" | "absolute_path";
  sourceCreatedAt?: string;
  createdAt: string;
};

export type TaskRecord = {
  taskId: string;
  projectId: string;
  toolName: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  inputSummary: string;
  inputJson: string;
  rawResultJson?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
};

export type GenerationRecord = {
  id: string;
  projectId: string;
  toolName: string;
  status: string;
  inputJson: string;
  rawResultJson?: string;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};

export type ToolsListSnapshot = {
  projectId: string;
  rawResultJson: string;
  updatedAt: string;
};

export type MakerWorkflowGraph = {
  nodes: unknown[];
  edges: unknown[];
  source: "tools-list";
  version: 1;
};

export type WorkflowGraphRecord = {
  id: string;
  projectId: string;
  name: string;
  graph: MakerWorkflowGraph;
  nodeCount: number;
  edgeCount: number;
  toolCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowNodeRunStatus = "running" | "succeeded" | "failed" | "skipped";

export type WorkflowRunStatus = "running" | "succeeded" | "failed" | "partial";

export type WorkflowNodeRunResult = {
  nodeId: string;
  toolName?: string;
  status: WorkflowNodeRunStatus;
  inputJson?: string;
  taskId?: string;
  rawResultJson?: string;
  errorMessage?: string;
  missingRequired?: string[];
  startedAt?: string;
  finishedAt?: string;
};

export type WorkflowRunRecord = {
  id: string;
  projectId: string;
  workflowId?: string;
  name: string;
  status: WorkflowRunStatus;
  graph: MakerWorkflowGraph;
  nodeResults: WorkflowNodeRunResult[];
  createdAt: string;
  finishedAt?: string;
};

export type ProjectLogFileSummary = {
  name: string;
  relativePath: string;
  sizeBytes: number;
  updatedAt: string;
  exists: boolean;
  tailLines: string[];
  error?: string;
};

export type ProjectLogKeyValue = {
  key: string;
  value: string;
  section?: string;
};

export type ProjectBuildLogEntry = {
  file: ProjectLogFileSummary;
  heading?: string;
  keyValues: ProjectLogKeyValue[];
  rawText: string;
  flags: string[];
};

export type ProjectRuntimeLogSummary = {
  stateFile?: ProjectLogFileSummary;
  state?: Record<string, unknown>;
  stateParseError?: string;
  runtimeLog?: ProjectLogFileSummary;
  watcherOut?: ProjectLogFileSummary;
  watcherErr?: ProjectLogFileSummary;
  levelCounts: Record<string, number>;
};

export type ProjectBuildLogsSummary = {
  projectId: string;
  projectName: string;
  projectRoot: string;
  generatedAt: string;
  runtime: ProjectRuntimeLogSummary;
  buildLogs: ProjectBuildLogEntry[];
};

export type StatusLiteResponse = {
  projectId: string;
  task: TaskRecord;
  generation?: GenerationRecord;
  text: string;
  result: unknown;
  assetsIndexed: number;
};

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
};

export function assetPreviewUrl(projectId: string, relativePath: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/assets/preview?relativePath=${encodeURIComponent(relativePath)}`;
}

export async function scanProjects(): Promise<{ projects: ProjectSummary[]; selectedProjectId?: string }> {
  return json(await fetch("/api/projects/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
}

export async function listProjects(): Promise<{ projects: ProjectSummary[]; selectedProjectId?: string }> {
  return json(await fetch("/api/projects"));
}

export async function selectProject(projectId: string) {
  return json<{ selectedProjectId: string; project: ProjectSummary }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function startRuntime(projectId: string) {
  return json<{ runtime: RuntimeSummary; tools: ToolSummary[]; toolsListSnapshot?: ToolsListSnapshot }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function stopRuntime(projectId: string) {
  return json<{ runtime?: RuntimeSummary }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function getRuntimeStatus(projectId: string) {
  return json<{ project: ProjectSummary; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/status`)
  );
}

export async function getStatusLite(projectId: string, args: Record<string, unknown> = {}): Promise<StatusLiteResponse> {
  return json<StatusLiteResponse>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/status-lite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolArgs: args })
    })
  );
}

export async function listTools(projectId: string): Promise<{ tools: ToolSummary[]; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }> {
  return json(await fetch(`/api/projects/${encodeURIComponent(projectId)}/tools`));
}

export async function refreshTools(projectId: string) {
  return json<{ tools: ToolSummary[]; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/tools/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function listAssets(projectId: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`));
  return data.assets;
}

export async function scanAssets(projectId: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
  return data.assets;
}

export async function rebuildAssetProvenance(projectId: string): Promise<AssetSummary[]> {
  const data = await json<{ ok: true; provenanceCount: number; assets: AssetSummary[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/provenance/rebuild`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
  return data.assets;
}

export async function deleteAssets(projectId: string, relativePaths: string[]): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths })
    })
  );
  return data.assets;
}

export async function moveAssets(projectId: string, relativePaths: string[], targetFolder: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths, targetFolder })
    })
  );
  return data.assets;
}

export async function renameAsset(projectId: string, relativePath: string, newName: string): Promise<AssetSummary[]> {
  const res = await fetch(`/api/projects/${projectId}/assets/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relativePath, newName })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to rename asset");
  }
  const data = await res.json();
  return data.assets;
}

export async function importAsset(projectId: string, fileName: string, targetFolder: string, dataUrl: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, targetFolder, dataUrl })
    })
  );
  return data.assets;
}

export async function listTasks(projectId?: string): Promise<TaskRecord[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await json<{ tasks: TaskRecord[] }>(await fetch(`/api/tasks${query}`));
  return data.tasks;
}

export async function clearTasks(projectId?: string): Promise<TaskRecord[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await json<{ tasks: TaskRecord[] }>(await fetch(`/api/tasks${query}`, { method: "DELETE" }));
  return data.tasks;
}

export async function callTool(projectId: string, toolName: string, toolArgs: Record<string, unknown>) {
  return json<{ task: TaskRecord; generation?: GenerationRecord; result?: unknown; text?: string; assetsIndexed: number }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/tools/${encodeURIComponent(toolName)}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolArgs })
    })
  );
}

export async function listWorkflows(projectId: string): Promise<WorkflowGraphRecord[]> {
  const data = await json<{ workflows: WorkflowGraphRecord[] }>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflows`));
  return data.workflows;
}

export async function listWorkflowRuns(projectId: string): Promise<WorkflowRunRecord[]> {
  const data = await json<{ runs: WorkflowRunRecord[] }>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`));
  return data.runs;
}

export async function runWorkflow(projectId: string, graph: MakerWorkflowGraph, nodeIds: string[], name?: string, workflowId?: string) {
  return json<{ run: WorkflowRunRecord; runs: WorkflowRunRecord[]; tasks: TaskRecord[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph, nodeIds, name, workflowId })
    })
  );
}

export async function deleteWorkflowRun(projectId: string, runId: string) {
  return json<{ ok: true; runs: WorkflowRunRecord[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs/${encodeURIComponent(runId)}`, { method: "DELETE" })
  );
}

export async function getBuildLogs(projectId: string): Promise<ProjectBuildLogsSummary> {
  const data = await json<{ logs: ProjectBuildLogsSummary }>(await fetch(`/api/projects/${encodeURIComponent(projectId)}/build/logs`));
  return data.logs;
}

export async function saveWorkflow(projectId: string, name: string, graph: MakerWorkflowGraph, id?: string) {
  return json<{ workflow: WorkflowGraphRecord; workflows: WorkflowGraphRecord[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, graph })
    })
  );
}

export async function deleteWorkflow(projectId: string, workflowId: string) {
  return json<{ ok: true; workflows: WorkflowGraphRecord[] }>(
    await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`, { method: "DELETE" })
  );
}

// --- Flows (Multimodal Canvas) ---
export async function listFlows(projectId: string): Promise<{ name: string, mtimeMs: number }[]> {
  const res = await fetch(`/api/projects/${projectId}/flows`);
  if (!res.ok) throw new Error(`Failed to list flows: ${res.statusText}`);
  return (await res.json()).flows;
}

export async function getFlow(projectId: string, name: string): Promise<any> {
  const res = await fetch(`/api/projects/${projectId}/flows/${name}`);
  if (!res.ok) throw new Error(`Failed to get flow: ${res.statusText}`);
  return (await res.json()).data;
}

export async function saveFlow(projectId: string, name: string, data: any): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/flows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error(`Failed to save flow: ${res.statusText}`);
}

export async function autoSaveFlow(projectId: string, data: any): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/flows/auto-save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Failed to auto save flow: ${res.statusText}`);
}

export async function deleteFlow(projectId: string, name: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/flows/${name}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete flow: ${res.statusText}`);
}
