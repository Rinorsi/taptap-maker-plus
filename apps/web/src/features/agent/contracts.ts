import type {
  AssetSummary,
  CreditRecord,
  GenerationRecord,
  ProjectBuildLogsSummary,
  ProjectSummary,
  RuntimeSummary,
  TaskRecord,
  ToolSummary,
  ToolsListSnapshot,
  WorkflowGraphRecord,
  WorkflowRunRecord
} from "../../api";

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

export type AgentMode = "observe" | "draft" | "execute";

export type AgentMessageRole = "user" | "assistant" | "system";

export type CompressedAgentContext = {
  generatedAt: string;
  selectedProjectId?: string;
  project?: {
    id: string;
    name: string;
    rootPath: string;
    runtime?: RuntimeSummary;
  };
  page: AgentPageState;
  counts: AgentContextSnapshot["counts"];
  runtime?: RuntimeSummary;
  recentMessages: Array<{
    role: AgentMessageRole;
    createdAt: string;
    content: string;
  }>;
  tools: Array<{
    name: string;
    category: string;
    required: string[];
    description?: string;
  }>;
  tasks: Array<{
    taskId: string;
    toolName: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  assets: Array<{
    relativePath: string;
    assetType: string;
    status: string;
    sizeBytes: number;
  }>;
  logs: {
    runtimeTail: string[];
    watcherOutTail: string[];
    watcherErrTail: string[];
    buildLogFiles: Array<{
      relativePath: string;
      updatedAt: string;
      flags: string[];
    }>;
  };
};

export type AgentSessionRecord = {
  id: string;
  title: string;
  mode: AgentMode;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type AgentMessageRecord = {
  id: string;
  sessionId: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
  contextSnapshotId?: string;
  metadata: Record<string, unknown>;
};

export type AgentContextSnapshotRecord = {
  id: string;
  sessionId: string;
  projectId?: string;
  snapshot: AgentContextSnapshot;
  createdAt: string;
};

export type AgentActionPreviewRecord = {
  id: string;
  sessionId: string;
  projectId?: string;
  status: "pending" | "approved" | "rejected" | "executed" | "canceled";
  actionKind: string;
  toolName?: string;
  title: string;
  summary: string;
  args: Record<string, unknown>;
  affectedPaths: string[];
  riskLevel: "low" | "medium" | "high";
  expectedCostText?: string;
  expectedDurationText?: string;
  createdAt: string;
  decidedAt?: string;
  decision?: "approved" | "rejected";
  decisionReason?: string;
  raw: Record<string, unknown>;
};

export type AgentActionKind = "refresh_tools" | "create_diagnostic_bundle" | "mcp_package_status" | "terminal_snapshot" | "browser_probe";

export type PiAgentRuntimeStatus = {
  connected: boolean;
  integrationMode: "not_connected" | "sdk" | "rpc";
  packageName: "@earendil-works/pi-coding-agent";
  sdkPreferred: boolean;
  rpcFallbackAvailable: boolean;
  lastError?: string;
};

export type AgentControlSurfaceResponse = {
  sessions: AgentSessionRecord[];
  activeSession?: AgentSessionRecord;
  messages: AgentMessageRecord[];
  contextSnapshots: AgentContextSnapshotRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  pi?: PiAgentRuntimeStatus;
};

export type AgentTerminalSnapshotCommandId = "workspace_status" | "node_version" | "npm_version" | "git_status" | "where_node_npm_npx" | "npm_cache_config";

export type AgentTerminalSnapshot = {
  commandId: AgentTerminalSnapshotCommandId;
  label: string;
  cwd: string;
  command: string;
  args: string[];
  displayCommand?: string;
  displayArgs?: string[];
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  generatedAt: string;
};

export type AgentBrowserProbeResult = {
  requestedUrl: string;
  finalUrl?: string;
  ok: boolean;
  status?: number;
  statusText?: string;
  contentType?: string;
  title?: string;
  error?: string;
  durationMs: number;
  checkedAt: string;
};

export type AgentGitDiffScope = "workspace" | "project";

export type AgentGitDiffSnapshot = {
  scope: AgentGitDiffScope;
  cwd: string;
  generatedAt: string;
  status: string;
  stat: string;
  diff: string;
  truncated: boolean;
  exitCode?: number;
  stderr: string;
  durationMs: number;
};
