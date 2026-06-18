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
};

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

export type ToolSummary = {
  name: string;
  description?: string;
  category: "status" | "build" | "image" | "video" | "music" | "model3d" | "other";
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
  assetType: "image" | "video" | "audio" | "model3d" | "other";
  sizeBytes: number;
  mtimeMs: number;
  status: "available" | "missing";
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

export type GenerationRecord = {
  id: string;
  projectId: string;
  toolName: string;
  status: "running" | "succeeded" | "failed";
  inputJson: string;
  rawResultJson?: string;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
};

export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export type TaskRecord = {
  taskId: string;
  projectId: string;
  toolName: string;
  status: TaskStatus;
  inputSummary: string;
  inputJson: string;
  rawResultJson?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
};

export type ToolsListSnapshot = {
  projectId: string;
  rawResultJson: string;
  updatedAt: string;
};

export type ToolCallResponse = {
  task: TaskRecord;
  generation?: GenerationRecord;
  result?: unknown;
  assetsIndexed: number;
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
