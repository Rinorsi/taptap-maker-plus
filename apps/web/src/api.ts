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
  configExists?: boolean;
  toolCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastScannedAt?: string;
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

export type AssetPathReplacement = {
  oldPath: string;
  newPath: string;
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
  requested: AssetPathReplacement[];
  updatedFiles: AssetReferenceUpdateFileSummary[];
  skipped: AssetReferenceUpdateSkippedSummary[];
  totalReplacements: number;
};

export type AssetMutationResponse = {
  ok: true;
  assets: AssetSummary[];
  count: number;
  directoryPath?: string;
  deletedPaths?: string[];
  replacements?: AssetPathReplacement[];
  referenceScan?: AssetReferenceScanResult[];
  referenceUpdate?: AssetReferenceUpdateSummary;
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
  fileTypes: { type: "GLB" | "GBM" | "MDL" | "MAT" | "TEX" | "PREVIEW" | "MULTIVIEW" | "PREFAB" | "META" | "MANIFEST" | "RES" | "LUA" | "FLOW"; count: number }[];
  missingParts: string[];
  sourceState: "linked" | "missing" | "draft" | "orphan" | "discarded";
  sourceNotes: string[];
  inResourceTable: boolean;
  isOrganized: boolean;
  canPreview: boolean;
  canRun: boolean;
  isDiscarded: boolean;
  governanceState: "in_use" | "adopted" | "draft" | "source_orphan" | "runtime_orphan" | "discarded" | "broken" | "packaged_unused";
  referencedByScripts: string[];
  referencedByFlows: string[];
  referencedByResources: string[];
  issues: { severity: "warning" | "error" | "info"; message: string; }[];
  suggestedActions: ("organize" | "discard" | "restore" | "delete_package" | "bind_mdl" | "add_to_resource" | "remove_from_resource" | "copy_lua")[];
  files: { relativePath: string; role: string; exists?: boolean; size?: number; updatedAt?: string; }[];
  sourceTaskId?: string;
  createdAt: string;
  updatedAt: string;
};

export type MdlModelInfo = {
  fileId: string;
  vertexBuffers: {
    vertexCount: number;
    vertexSize: number;
    morphRangeStart: number;
    morphRangeCount: number;
    elements: {
      type: string;
      semantic: string;
      index: number;
      offset: number;
      size: number;
      raw: { type: number; semantic: number; index: number };
    }[];
  }[];
  indexBuffers: { indexCount: number; indexSize: number }[];
  geometries: {
    boneMappingCount: number;
    lodLevels: {
      distance: number;
      primitiveType: string;
      vertexBuffer: number;
      indexBuffer: number;
      indexStart: number;
      indexCount: number;
    }[];
  }[];
  morphCount: number;
  boneCount: number;
  bones: { name: string; parentIndex: number }[];
  boundingBox: { min: [number, number, number]; max: [number, number, number] };
  geometryCenters: [number, number, number][];
};

export type MdlToGltfResult = {
  ok: true;
  gltfRelativePath: string;
  binRelativePath: string;
  info: MdlModelInfo;
  stats: { meshes: number; primitives: number; vertices: number; triangles: number; skippedGeometries: number };
  assetsIndexed: number;
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

export type AgentRightPanelTab = "status" | "tools" | "gameLogs" | "logs" | "errors";

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

export type DesktopReadinessPaths = {
  dataDir?: string;
  databasePath?: string;
  workspaceRoot?: string;
  webDistDir?: string;
  makerNpmCacheDir?: string;
  mcpLogDir?: string;
  makerProjectsRoot?: string;
};

export type DesktopReadinessEnv = {
  TAPTAP_DATA_DIR?: string;
  TAPTAP_WORKSPACE_ROOT?: string;
  TAPTAP_WEB_DIST_DIR?: string;
  TAPTAP_MAKER_PROJECTS_ROOT?: string;
  TAPTAP_DESKTOP_PARENT_PID?: string;
  TAPTAP_MAKER_NPM_CACHE_DIR?: string;
  TAPTAP_MCP_LOG_DIR?: string;
  TAPTAP_SERVER_PORT?: string;
  TAPTAP_SERVER_HOST?: string;
  TAPTAP_DESKTOP_INSTANCE_TOKEN?: string;
  TAPTAP_MCP_ENV?: string;
  TAPTAP_MAKER_PACKAGE?: string;
};

export type DesktopReadiness = {
  ok: boolean;
  appId?: string;
  productName?: string;
  version?: string;
  packageVersion?: string;
  channel?: string;
  mode: string;
  server: {
    host: string;
    port: number;
  };
  paths: DesktopReadinessPaths;
  env: DesktopReadinessEnv;
};

export type MakerProjectsRootSettings = {
  rootPath: string;
  defaultRootPath: string;
  storedRootPath?: string;
  envRootPath?: string;
  confirmed: boolean;
  exists: boolean;
  source: "app_settings" | "env" | "default";
};

export type MakerProjectsRootSettingsResponse = {
  settings: MakerProjectsRootSettings;
  selectedProjectId?: string;
  projects?: ProjectSummary[];
};

export type McpPackageUpdateStatus = {
  packageName: string;
  packageSpec: string;
  installedSpec: string;
  currentVersion?: string;
  latestVersion?: string;
  updateAvailable: boolean;
  lastCheckedAt?: string;
  lastInstalledAt?: string;
  localInstalled: boolean;
  packageConfigured: boolean;
  cachePath: string;
  cacheExists: boolean;
  cacheSizeBytes: number;
  cacheEntryCount: number;
  releaseNotes: string;
  releaseNotesPath: string;
  releaseNotesSource: "cloud" | "local" | "fallback";
  releaseNotesError?: string;
  availableVersions: string[];
  registryError?: string;
};

export type McpPackageInstallResult = {
  status: McpPackageUpdateStatus;
  installOutput: string;
};

export type McpPackageUninstallStep = {
  id: "stop_runtime" | "clear_settings" | "clear_cache" | "preserve_projects" | "ai_client_config";
  label: string;
  status: "done" | "skipped";
  detail: string;
};

export type McpPackageUninstallResult = {
  ok: true;
  stoppedRuntime: true;
  clearedSettingKeys: string[];
  clearedCachePath: string;
  removedCache: boolean;
  steps: McpPackageUninstallStep[];
  aiClientConfigCleanup: {
    supported: false;
    message: string;
  };
  status: McpPackageUpdateStatus;
};

export type MakerCliResult = {
  ok: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  json?: unknown;
};

export type OnboardingProjectResult = {
  cli: MakerCliResult;
  project: ProjectSummary;
  targetDir?: string;
  doctorPassed?: boolean;
  warning?: string;
  assetsIndexed?: number;
  assets?: AssetSummary[];
  projects: ProjectSummary[];
  selectedProjectId?: string;
};

export type MakerCloudProject = {
  id: string;
  name: string;
  userId?: string;
  user_id?: string;
  createdAt?: string;
  lastAccessedAt?: string | null;
  lastConversationAt?: string | null;
  pinnedAt?: string | null;
  stage?: string;
  gameType?: string;
};

export type OnboardingCloudProjectPreview = {
  appId: string;
  projectName: string;
  targetDir: string;
};

export type ProjectHealthSummary = {
  projectId: string;
  rootPath: string;
  configPath: string;
  rootExists: boolean;
  configExists: boolean;
  configProjectId?: string;
  makerProjectId: string;
  projectIdMatches: boolean;
  configParseError?: string;
  runtime?: RuntimeSummary;
  toolsListUpdatedAt?: string;
  makerPackage: string;
  makerEnv: string;
};

export type FrontendDiagnosticEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  source: "console" | "window" | "promise" | "fetch" | "devtools";
  message: string;
  detail?: string;
};

export type FrontendDiagnosticsResponse = {
  logPath: string;
  entries: FrontendDiagnosticEntry[];
};

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

export type DeveloperDiagnosticsSnapshot = {
  readiness?: DesktopReadiness;
  resourceReadiness?: DesktopResourceReadiness;
  frontendLogCount: number;
  recentFrontendErrors: FrontendDiagnosticEntry[];
};

export type StatusLiteResponse = {
  projectId: string;
  task: TaskRecord;
  generation?: GenerationRecord;
  text: string;
  result: unknown;
  assetsIndexed: number;
};

export type AppSettingsPreferencesResponse = {
  preferences: Record<string, unknown>;
  updatedAt?: string;
};

export type ResetInitialStateResponse = {
  ok: true;
  resetAt: string;
  projects: ProjectSummary[];
  selectedProjectId?: string;
  preserved: {
    makerProjectDirectories: true;
    npmCache: true;
    aiClientConfig: true;
  };
};

export type AppReleaseAssetSummary = {
  id: number;
  name: string;
  size: number;
  browserDownloadUrl: string;
  contentType?: string;
  sha256?: string;
  downloadUrls: string[];
  downloadSources: AppReleaseDownloadSourceSummary[];
};

export type AppReleaseDownloadSourceSummary = {
  label: string;
  url: string;
};

export type AppReleaseSummary = {
  id: number;
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt?: string;
  prerelease: boolean;
  draft: boolean;
  assets: AppReleaseAssetSummary[];
};

export type AppAnnouncementSeverity = "info" | "warning" | "critical";

export type AppAnnouncementSummary = {
  id: string;
  title: string;
  summary: string;
  severity: AppAnnouncementSeverity;
  publishedAt: string;
  markdown: string;
  sourceUrl?: string;
};

export type AppUpdateStatus = {
  currentVersion: string;
  currentDisplayVersion: string;
  latestVersion?: string;
  latestRelease?: AppReleaseSummary;
  announcement?: AppAnnouncementSummary;
  announcements: AppAnnouncementSummary[];
  releases: AppReleaseSummary[];
  updateAvailable: boolean;
  checkedAt: string;
  repositoryUrl: string;
  announcementError?: string;
  error?: string;
};

export type AppUpdateDownloadResult = {
  ok: true;
  release: AppReleaseSummary;
  asset: AppReleaseAssetSummary;
  installerPath: string;
  downloadedAt: string;
};

export type AppUpdateDownloadStatus = {
  id: string;
  status: "queued" | "downloading" | "downloaded" | "opening" | "opened" | "error";
  release: AppReleaseSummary;
  asset: AppReleaseAssetSummary;
  installerPath: string;
  downloadedBytes: number;
  totalBytes?: number;
  sourceIndex?: number;
  sourceLabel?: string;
  sourceUrl?: string;
  verifiedSha256?: string;
  sourceFailures: AppUpdateDownloadSourceFailure[];
  startedAt: string;
  updatedAt: string;
  downloadedAt?: string;
  openedAt?: string;
  error?: string;
};

export type AppUpdateDownloadSourceFailure = {
  label: string;
  url: string;
  error: string;
};

export type OpenExternalUrlResult = {
  ok: true;
  url: string;
};

function readDesktopApiBase() {
  if (typeof window === "undefined") return "";
  const queryValue = new URLSearchParams(window.location.search).get("apiBase");
  if (queryValue?.startsWith("http://127.0.0.1:") || queryValue?.startsWith("http://localhost:")) {
    window.sessionStorage.setItem("taptap.apiBase", queryValue);
    return queryValue;
  }
  return window.sessionStorage.getItem("taptap.apiBase") ?? "";
}

let apiBase = readDesktopApiBase();

function apiUrl(path: string) {
  if (!apiBase || !path.startsWith("/api/")) return path;
  return `${apiBase}${path}`;
}

export function apiResourceUrl(path?: string) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return apiUrl(path);
}

function clearDesktopApiBase() {
  apiBase = "";
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem("taptap.apiBase");
  }
}

async function discoverDesktopApiBase() {
  if (typeof window === "undefined") return "";
  for (let port = 8787; port <= 8827; port += 1) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const response = await fetch(`${base}/api/desktop/readiness`, { cache: "no-store" });
      if (!response.ok) continue;
      const data = await response.json() as { appId?: unknown };
      if (data.appId !== "taptap-maker-plus") continue;
      apiBase = base;
      window.sessionStorage.setItem("taptap.apiBase", base);
      return base;
    } catch {
      // Try the next local port.
    }
  }
  return "";
}

async function apiFetch(path: string, init?: RequestInit) {
  try {
    return await fetch(apiUrl(path), init);
  } catch (error) {
    clearDesktopApiBase();
    if (path.startsWith("/api/") && await discoverDesktopApiBase()) {
      try {
        return await fetch(apiUrl(path), init);
      } catch (retryError) {
        throw new Error(`本地服务已发现但请求失败，无法访问 ${path}。${retryError instanceof Error ? ` 原始错误：${retryError.message}` : ""}`);
      }
    }
    if (path.startsWith("/api/")) {
      throw new Error(`本地服务未连接，无法访问 ${path}。请确认桌面端本地服务已启动。${error instanceof Error ? ` 原始错误：${error.message}` : ""}`);
    }
    throw error;
  }
}

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
};

export function assetPreviewUrl(projectId: string, relativePath: string) {
  return apiUrl(`/api/projects/${encodeURIComponent(projectId)}/assets/preview?relativePath=${encodeURIComponent(relativePath)}`);
}

export async function scanProjects(): Promise<{
  projects: ProjectSummary[];
  selectedProjectId?: string;
  onboardingRequired?: boolean;
  settings?: MakerProjectsRootSettings;
}> {
  return json(await apiFetch("/api/projects/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
}

export async function listProjects(): Promise<{ projects: ProjectSummary[]; selectedProjectId?: string }> {
  return json(await apiFetch("/api/projects"));
}

export async function selectProject(projectId: string) {
  return json<{ selectedProjectId: string; project: ProjectSummary }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/select`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export type RemoveProjectResponse = {
  ok: true;
  removedProjectId: string;
  deletedLocalFolder: boolean;
  deletedPath?: string;
  projects: ProjectSummary[];
  selectedProjectId?: string;
};

export async function removeProjectRecord(projectId: string): Promise<RemoveProjectResponse> {
  return json<RemoveProjectResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/record`, { method: "DELETE" })
  );
}

export async function deleteProjectLocalFolder(projectId: string): Promise<RemoveProjectResponse> {
  return json<RemoveProjectResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/local-folder`, { method: "DELETE" })
  );
}

export async function startRuntime(projectId: string) {
  return json<{ runtime: RuntimeSummary; tools: ToolSummary[]; toolsListSnapshot?: ToolsListSnapshot }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function stopRuntime(projectId: string) {
  return json<{ runtime?: RuntimeSummary }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export async function getRuntimeStatus(projectId: string) {
  return json<{ project: ProjectSummary; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/status`)
  );
}

export async function getProjectHealth(projectId: string) {
  return json<{ health: ProjectHealthSummary }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/health`)
  );
}

export async function getStatusLite(projectId: string, args: Record<string, unknown> = {}): Promise<StatusLiteResponse> {
  return json<StatusLiteResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/mcp/status-lite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolArgs: args })
    })
  );
}

export async function listTools(projectId: string): Promise<{ tools: ToolSummary[]; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/tools`));
}

export async function refreshTools(projectId: string) {
  return json<{ tools: ToolSummary[]; runtime?: RuntimeSummary; toolsListSnapshot?: ToolsListSnapshot }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/tools/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
}

export type ListAssetsOptions = {
  limit?: number;
  offset?: number;
  assetType?: string;
  rootPrefix?: string;
  q?: string;
};

function assetListQuery(options?: ListAssetsOptions) {
  if (!options) return "";
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.assetType) params.set("assetType", options.assetType);
  if (options.rootPrefix) params.set("rootPrefix", options.rootPrefix);
  if (options.q) params.set("q", options.q);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listAssets(projectId: string, options?: ListAssetsOptions): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets${assetListQuery(options)}`));
  return data.assets;
}

export async function getAssetTree(projectId: string, rootPath = "assets"): Promise<AssetDirectoryNode> {
  const query = new URLSearchParams({ rootPath });
  const data = await json<{ tree: AssetDirectoryNode }>(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/tree?${query.toString()}`));
  return data.tree;
}

export async function scanAssets(projectId: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
  return data.assets;
}

export async function rebuildAssetProvenance(projectId: string): Promise<AssetSummary[]> {
  const data = await json<{ ok: true; provenanceCount: number; assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/provenance/rebuild`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
  );
  return data.assets;
}

export async function scanAssetReferences(projectId: string, relativePaths: string[], signal?: AbortSignal): Promise<AssetReferenceScanResult[]> {
  const data = await json<{ ok: true; results: AssetReferenceScanResult[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/references/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths }),
      signal,
    })
  );
  return data.results;
}

export async function listModelPackages(projectId: string): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages`));
}

export async function organizeModelPackage(projectId: string, packageId: string): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/${encodeURIComponent(packageId)}/organize`, {
    method: "POST"
  }));
}

export async function bindModelPackage(projectId: string, packageId: string, mdlPath: string): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/${encodeURIComponent(packageId)}/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mdlPath })
  }));
}

export async function discardModelPackage(projectId: string, packageId: string): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/${encodeURIComponent(packageId)}/discard`, {
    method: "POST"
  }));
}

export async function restoreModelPackage(projectId: string, packageId: string): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/${encodeURIComponent(packageId)}/restore`, {
    method: "POST"
  }));
}

export async function updateModelPackageResource(projectId: string, packageId: string, action: "add" | "remove"): Promise<{ packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/${encodeURIComponent(packageId)}/resource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  }));
}

export async function batchModelPackageAction(
  projectId: string,
  packageIds: string[],
  action: "organize" | "discard" | "restore" | "add_to_resource" | "remove_from_resource"
): Promise<{ ok: boolean; results: { id: string; ok: boolean; error?: string }[]; packages: ModelPackageSummary[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-packages/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageIds, action })
  }));
}

export async function convertMdlToGltf(projectId: string, relativePath: string): Promise<MdlToGltfResult> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-convert/mdl-to-gltf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relativePath })
  }));
}

export async function inspectMdl(projectId: string, relativePath: string): Promise<{ ok: true; info: MdlModelInfo }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/model-convert/mdl-info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relativePath })
  }));
}

export async function listGenerations(projectId: string): Promise<{ generations: GenerationRecord[] }> {
  return json(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/generations`));
}

export async function deleteAssets(projectId: string, relativePaths: string[]): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths })
    })
  );
  return data.assets;
}

export async function moveAssetsWithResult(
  projectId: string,
  relativePaths: string[],
  targetFolder: string,
  updateReferences = false
): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths, targetFolder, updateReferences })
    })
  );
}

export async function moveAssets(projectId: string, relativePaths: string[], targetFolder: string): Promise<AssetSummary[]> {
  const data = await moveAssetsWithResult(projectId, relativePaths, targetFolder);
  return data.assets;
}

export async function copyAssets(projectId: string, relativePaths: string[], targetFolder: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePaths, targetFolder })
    })
  );
  return data.assets;
}

export async function openLocalAssetPath(projectId: string, relativePath: string, mode: "file" | "directory" = "file"): Promise<void> {
  await json<{ ok: true }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/open-local`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath, mode })
    })
  );
}

export async function renameAssetWithResult(
  projectId: string,
  relativePath: string,
  newName: string,
  updateReferences = false
): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath, newName, updateReferences })
    })
  );
}

export async function renameAsset(projectId: string, relativePath: string, newName: string): Promise<AssetSummary[]> {
  const data = await renameAssetWithResult(projectId, relativePath, newName);
  return data.assets;
}

export async function createAssetFolder(projectId: string, parentFolder: string, name: string): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/folders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentFolder, name })
    })
  );
}

export async function renameAssetFolder(
  projectId: string,
  directoryPath: string,
  newName: string,
  updateReferences = false
): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/folders/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, newName, updateReferences })
    })
  );
}

export async function moveAssetFolder(
  projectId: string,
  directoryPath: string,
  targetFolder: string,
  updateReferences = false
): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/folders/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, targetFolder, updateReferences })
    })
  );
}

export async function deleteAssetFolder(projectId: string, directoryPath: string): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/folders/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath })
    })
  );
}

export async function copyAssetFolder(projectId: string, directoryPath: string, targetFolder: string): Promise<AssetMutationResponse> {
  return json<AssetMutationResponse>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/folders/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath, targetFolder })
    })
  );
}

export async function importAsset(projectId: string, fileName: string, targetFolder: string, dataUrl: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, targetFolder, dataUrl })
    })
  );
  return data.assets;
}

export async function importLocalAssetPaths(projectId: string, sourcePaths: string[], targetFolder: string): Promise<AssetSummary[]> {
  const data = await json<{ assets: AssetSummary[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/assets/import-local-paths`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourcePaths, targetFolder })
    })
  );
  return data.assets;
}

export async function listTasks(projectId?: string): Promise<TaskRecord[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await json<{ tasks: TaskRecord[] }>(await apiFetch(`/api/tasks${query}`));
  return data.tasks;
}

export async function clearTasks(projectId?: string): Promise<TaskRecord[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await json<{ tasks: TaskRecord[] }>(await apiFetch(`/api/tasks${query}`, { method: "DELETE" }));
  return data.tasks;
}

export async function callTool(projectId: string, toolName: string, toolArgs: Record<string, unknown>) {
  return json<{ task: TaskRecord; generation?: GenerationRecord; result?: unknown; text?: string; assetsIndexed: number }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/tools/${encodeURIComponent(toolName)}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolArgs })
    })
  );
}

export async function listWorkflows(projectId: string): Promise<WorkflowGraphRecord[]> {
  const data = await json<{ workflows: WorkflowGraphRecord[] }>(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflows`));
  return data.workflows;
}

export async function listWorkflowRuns(projectId: string): Promise<WorkflowRunRecord[]> {
  const data = await json<{ runs: WorkflowRunRecord[] }>(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`));
  return data.runs;
}

export async function runWorkflow(projectId: string, graph: MakerWorkflowGraph, nodeIds: string[], name?: string, workflowId?: string) {
  return json<{ run: WorkflowRunRecord; runs: WorkflowRunRecord[]; tasks: TaskRecord[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph, nodeIds, name, workflowId })
    })
  );
}

export async function deleteWorkflowRun(projectId: string, runId: string) {
  return json<{ ok: true; runs: WorkflowRunRecord[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-runs/${encodeURIComponent(runId)}`, { method: "DELETE" })
  );
}

export async function getBuildLogs(projectId: string): Promise<ProjectBuildLogsSummary> {
  const data = await json<{ logs: ProjectBuildLogsSummary }>(await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/build/logs`));
  return data.logs;
}

export async function getAgentContext(projectId?: string, page?: AgentPageState): Promise<AgentContextSnapshot> {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (page?.activeTab) params.set("activeTab", page.activeTab);
  if (page?.selection) {
    params.set("selectionType", page.selection.type);
    if (page.selection.type === "project") params.set("projectSelectionId", page.selection.projectId);
    if (page.selection.type === "tool") params.set("toolName", page.selection.toolName);
    if (page.selection.type === "task") params.set("taskId", page.selection.taskId);
    if (page.selection.type === "asset") params.set("assetRelativePath", page.selection.relativePath);
  }
  const query = params.toString();
  const data = await json<{ context: AgentContextSnapshot }>(await apiFetch(`/api/agent/context${query ? `?${query}` : ""}`));
  return data.context;
}

export async function getDesktopReadiness(): Promise<DesktopReadiness> {
  return json<DesktopReadiness>(await apiFetch("/api/desktop/readiness"));
}

export async function getSettingsPreferences(): Promise<AppSettingsPreferencesResponse> {
  return json<AppSettingsPreferencesResponse>(await apiFetch("/api/settings/preferences"));
}

export async function saveSettingsPreferences(preferences: Record<string, unknown>): Promise<AppSettingsPreferencesResponse> {
  return json<AppSettingsPreferencesResponse>(
    await apiFetch("/api/settings/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    }),
  );
}

export async function getMakerProjectsRootSettings(): Promise<MakerProjectsRootSettingsResponse> {
  return json<MakerProjectsRootSettingsResponse>(await apiFetch("/api/settings/maker-projects-root"));
}

export async function saveMakerProjectsRootSettings(rootPath: string): Promise<MakerProjectsRootSettingsResponse> {
  return json<MakerProjectsRootSettingsResponse>(
    await apiFetch("/api/settings/maker-projects-root", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootPath }),
    }),
  );
}

export async function confirmMakerProjectsRootSettings(): Promise<MakerProjectsRootSettingsResponse> {
  return json<MakerProjectsRootSettingsResponse>(
    await apiFetch("/api/settings/maker-projects-root/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}

export async function getMcpPackageStatus(check = false): Promise<{ status: McpPackageUpdateStatus }> {
  return json<{ status: McpPackageUpdateStatus }>(await apiFetch(`/api/mcp/package${check ? "?check=true" : ""}`));
}

export async function installMcpPackage(packageSpec: string): Promise<McpPackageInstallResult> {
  return json<McpPackageInstallResult>(
    await apiFetch("/api/mcp/package/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageSpec }),
    }),
  );
}

export async function uninstallMcpPackage(): Promise<McpPackageUninstallResult> {
  return json<McpPackageUninstallResult>(
    await apiFetch("/api/mcp/package/uninstall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}

export async function loginMakerOnboarding(): Promise<{ cli: MakerCliResult }> {
  return json<{ cli: MakerCliResult }>(
    await apiFetch("/api/onboarding/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
}

export async function setMakerTokenOnboarding(token: string): Promise<{ cli: MakerCliResult }> {
  return json<{ cli: MakerCliResult }>(
    await apiFetch("/api/onboarding/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
}

export async function getMakerTokenOnboarding(): Promise<{ token: string }> {
  return json<{ token: string }>(await apiFetch("/api/onboarding/token"));
}

export async function listMakerCloudProjects(): Promise<{ cli: MakerCliResult; projects: MakerCloudProject[] }> {
  return json<{ cli: MakerCliResult; projects: MakerCloudProject[] }>(
    await apiFetch("/api/onboarding/cloud-projects"),
  );
}

export async function scanOnboardingProjects(rootDir?: string): Promise<{ projects: ProjectSummary[]; selectedProjectId?: string }> {
  return json<{ projects: ProjectSummary[]; selectedProjectId?: string }>(
    await apiFetch("/api/onboarding/projects/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rootDir }),
    }),
  );
}

export async function initOnboardingProject(targetDir: string): Promise<OnboardingProjectResult> {
  return json<OnboardingProjectResult>(
    await apiFetch("/api/onboarding/projects/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDir }),
    }),
  );
}

export async function initCloudOnboardingProject(appId: string, targetDir?: string): Promise<OnboardingProjectResult> {
  return json<OnboardingProjectResult>(
    await apiFetch("/api/onboarding/projects/init-cloud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, targetDir }),
    }),
  );
}

export async function previewCloudOnboardingProject(appId: string, projectName: string, targetDir?: string): Promise<OnboardingCloudProjectPreview> {
  return json<OnboardingCloudProjectPreview>(
    await apiFetch("/api/onboarding/projects/init-cloud/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId, projectName, targetDir }),
    }),
  );
}

export async function bindExistingOnboardingProject(targetDir: string): Promise<OnboardingProjectResult> {
  return json<OnboardingProjectResult>(
    await apiFetch("/api/onboarding/projects/bind-existing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDir }),
    }),
  );
}

export async function listFrontendDiagnostics() {
  return json<FrontendDiagnosticsResponse>(
    await apiFetch("/api/developer/frontend-diagnostics"),
  );
}

export async function appendFrontendDiagnostics(entries: FrontendDiagnosticEntry[]) {
  const res = await apiFetch("/api/developer/frontend-diagnostics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) {
    throw new Error(`Failed to append frontend diagnostics: ${res.statusText}`);
  }
}

export async function clearFrontendDiagnostics(retention: "all" | "14d" | "30d" | "100mb" = "all") {
  const query = retention === "all" ? "" : `?retention=${encodeURIComponent(retention)}`;
  const res = await apiFetch(`/api/developer/frontend-diagnostics${query}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to clear frontend diagnostics: ${res.statusText}`);
  }
}

export async function getDesktopResourceReadiness(): Promise<{ readiness: DesktopResourceReadiness }> {
  return json<{ readiness: DesktopResourceReadiness }>(
    await apiFetch("/api/developer/desktop-resources"),
  );
}

export async function createDiagnosticBundle(projectId?: string): Promise<DiagnosticBundleResult> {
  return json<DiagnosticBundleResult>(
    await apiFetch("/api/developer/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }),
  );
}

export function diagnosticBundleDownloadUrl(downloadUrl: string) {
  return apiUrl(downloadUrl);
}

export async function resetDesktopInitialState(confirmText: "重置软件"): Promise<ResetInitialStateResponse> {
  return json<ResetInitialStateResponse>(
    await apiFetch("/api/developer/reset-initial-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmText }),
    }),
  );
}

export async function checkAppUpdate(forceRefresh = false): Promise<{ status: AppUpdateStatus }> {
  return json<{ status: AppUpdateStatus }>(await apiFetch(`/api/app/update${forceRefresh ? "?force=1" : ""}`));
}

export async function listAppReleases(forceRefresh = false): Promise<{ releases: AppReleaseSummary[] }> {
  return json<{ releases: AppReleaseSummary[] }>(await apiFetch(`/api/app/releases${forceRefresh ? "?force=1" : ""}`));
}

export async function downloadAppUpdate(
  releaseId: number,
  assetId?: number,
  release?: AppReleaseSummary,
  preferredSourceUrl?: string,
): Promise<AppUpdateDownloadStatus> {
  return json<AppUpdateDownloadStatus>(
    await apiFetch("/api/app/update/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ releaseId, assetId, release, preferredSourceUrl }),
    }),
  );
}

export async function getAppUpdateDownloadStatus(downloadId: string): Promise<AppUpdateDownloadStatus> {
  return json<AppUpdateDownloadStatus>(
    await apiFetch(`/api/app/update/downloads/${encodeURIComponent(downloadId)}`),
  );
}

export async function openExternalUrl(url: string): Promise<OpenExternalUrlResult> {
  return json<OpenExternalUrlResult>(
    await apiFetch("/api/app/open-external", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

export async function saveWorkflow(projectId: string, name: string, graph: MakerWorkflowGraph, id?: string) {
  return json<{ workflow: WorkflowGraphRecord; workflows: WorkflowGraphRecord[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflows`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, graph })
    })
  );
}

export async function deleteWorkflow(projectId: string, workflowId: string) {
  return json<{ ok: true; workflows: WorkflowGraphRecord[] }>(
    await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/workflows/${encodeURIComponent(workflowId)}`, { method: "DELETE" })
  );
}

// --- Flows (Multimodal Canvas) ---
export type CanvasFlowSummary = { id: string; name: string; mtimeMs: number };

export async function listFlows(projectId: string): Promise<CanvasFlowSummary[]> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows`);
  if (!res.ok) throw new Error(`Failed to list flows: ${res.statusText}`);
  const flows = (await res.json()).flows as Array<{ id?: string; name: string; mtimeMs: number }>;
  return flows.map((flow) => ({ id: flow.id ?? flow.name, name: flow.name, mtimeMs: flow.mtimeMs }));
}

export async function getFlow(projectId: string, name: string): Promise<any> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Failed to get flow: ${res.statusText}`);
  return (await res.json()).data;
}

export async function saveFlow(projectId: string, name: string, data: any): Promise<{ id: string; name: string; mtimeMs?: number }> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
  });
  if (!res.ok) throw new Error(`Failed to save flow: ${res.statusText}`);
  return res.json();
}

export async function autoSaveFlow(projectId: string, data: any): Promise<void> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows/auto-save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`Failed to auto save flow: ${res.statusText}`);
}

export async function deleteFlow(projectId: string, name: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete flow: ${res.statusText}`);
}

export async function renameFlow(projectId: string, name: string, nextName: string): Promise<void> {
  const res = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}/flows/${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nextName }),
  });
  if (!res.ok) throw new Error(`Failed to rename flow: ${res.statusText}`);
}

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

export async function listCredits(projectId?: string): Promise<CreditRecord[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const data = await json<{ credits: CreditRecord[] }>(await apiFetch(`/api/credits${query}`));
  return data.credits;
}
