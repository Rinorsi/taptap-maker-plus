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

export type AssetDirectoryNode = {
  name: string;
  path: string;
  parentPath: string;
  depth: number;
  assetCount: number;
  totalAssetCount: number;
  children: AssetDirectoryNode[];
};

export type AssetReferenceSourceType = "resources_json" | "lua_script" | "flow_json";

export type AssetReferenceEvidence = {
  sourceType: AssetReferenceSourceType;
  sourcePath: string;
  line: number;
  column: number;
  lineText: string;
};

export type AssetReferenceScanResult = {
  relativePath: string;
  referenceCount: number;
  references: AssetReferenceEvidence[];
};

export type AssetReferenceUpdateFileSummary = {
  sourceType: AssetReferenceSourceType;
  sourcePath: string;
  replacements: number;
  backupPath?: string;
};

export type AssetReferenceUpdateSkippedSummary = {
  oldPath: string;
  newPath: string;
  reason: string;
};

export type AssetReferenceUpdateSummary = {
  requested: { oldPath: string; newPath: string }[];
  updatedFiles: AssetReferenceUpdateFileSummary[];
  skipped: AssetReferenceUpdateSkippedSummary[];
  totalReplacements: number;
};

export type ModelPackageGovernanceState = "in_use" | "adopted" | "packaged_unused" | "draft" | "source_orphan" | "runtime_orphan" | "discarded" | "broken";

export type ModelPackageIssue = {
  severity: "error" | "warning" | "info";
  message: string;
};

export type ModelPackageSourceState = "linked" | "missing" | "draft" | "orphan" | "discarded";

export type ModelPackageAction = "preview" | "adopt" | "discard" | "restore" | "organize" | "bind_mdl" | "add_to_resource" | "remove_from_resource" | "copy_lua" | "delete_package";

export type ModelPackageFile = {
  role: "source_glb" | "source_gbm" | "source_meta" | "preview" | "preview_meta" | "multiview" | "multiview_meta" | "runtime_mdl" | "runtime_meta" | "material" | "material_meta" | "texture" | "texture_meta" | "prefab" | "prefab_meta" | "manifest" | "other";
  relativePath: string;
  exists: boolean;
};

export type ModelPackageFileType = {
  type: "GLB" | "GBM" | "MDL" | "MAT" | "TEX" | "PREVIEW" | "MULTIVIEW" | "PREFAB" | "META" | "MANIFEST" | "RES" | "LUA" | "FLOW";
  count: number;
};

export type ModelPackageSummary = {
  id: string;
  projectId: string;
  displayName: string;
  category: string;
  purpose: string;
  sourceGlb?: string;
  previewImage?: string;
  multiviewImages: string[];
  runtimeMdl?: string;
  materialXmls: string[];
  textureFiles: string[];
  prefabFiles: string[];
  resourceEntries: string[];
  fileTypes: ModelPackageFileType[];
  missingParts: string[];
  sourceState: ModelPackageSourceState;
  sourceNotes: string[];
  inResourceTable: boolean;
  isOrganized: boolean;
  canPreview: boolean;
  canRun: boolean;
  sourceTaskId?: string;

  // New fields for governance
  isDiscarded: boolean;
  referencedByScripts: string[];
  referencedByFlows: string[];
  referencedByResources: string[];
  isReferenced: boolean;
  governanceState: ModelPackageGovernanceState;
  issues: ModelPackageIssue[];
  suggestedActions: ModelPackageAction[];
  files: ModelPackageFile[];

  createdAt: string;
  updatedAt: string;
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

export type CreditRecord = {
  id: string;
  projectId: string;
  taskId?: string;
  toolName: string;
  credits: number;
  assetPath?: string;
  rawResultJson?: string;
  createdAt: string;
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

export type AgentRightPanelTab = "status" | "tools" | "logs" | "errors";

export type AgentSelectionReference =
  | { type: "project"; projectId: string }
  | { type: "tool"; toolName: string }
  | { type: "task"; taskId: string }
  | { type: "asset"; relativePath: string };

export type AgentPageState = {
  activeTab?: AgentRightPanelTab;
  selection?: AgentSelectionReference;
};

export type AgentContextSnapshot = {
  generatedAt: string;
  selectedProjectId?: string;
  page: AgentPageState;
  project?: ProjectSummary;
  projects: ProjectSummary[];
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  toolsListSnapshot?: Pick<ToolsListSnapshot, "projectId" | "updatedAt">;
  tasks: TaskRecord[];
  generations: GenerationRecord[];
  assets: AssetSummary[];
  workflows: WorkflowGraphRecord[];
  workflowRuns: WorkflowRunRecord[];
  credits: CreditRecord[];
  buildLogs?: ProjectBuildLogsSummary;
  counts: {
    projects: number;
    tools: number;
    tasks: number;
    generations: number;
    assets: number;
    workflows: number;
    workflowRuns: number;
    credits: number;
    buildLogs: number;
  };
};
