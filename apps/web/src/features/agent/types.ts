import type {
  AgentActionPreviewRecord,
  AgentActionKind,
  AgentContextSnapshot,
  AgentContextSnapshotRecord,
  AgentMessageRecord,
  AgentMode,
  AgentPageState,
  AgentSessionRecord,
  CompressedAgentContext,
  PiAgentRuntimeStatus,
} from "./api";
import type {
  DesktopReadiness,
  ProjectSummary,
  RuntimeStatus
} from "../../api";

export type AgentWorkspaceTab =
  | "closed"
  | "launcher"
  | "overview"
  | "files"
  | "context"
  | "diff"
  | "terminal"
  | "browser"
  | "logs"
  | "artifacts"
  | "commands"
  | "tools"
  | "skills"
  | "subagents";

export type AgentWorkspaceState = {
  context?: AgentContextSnapshot;
  readiness?: DesktopReadiness;
  sessions: AgentSessionRecord[];
  activeSession?: AgentSessionRecord;
  messages: AgentMessageRecord[];
  contextSnapshots: AgentContextSnapshotRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  pi?: PiAgentRuntimeStatus;
  draft: string;
  loading: boolean;
  sending: boolean;
  error: string;
};

export type AgentWorkspaceActions = {
  setDraft: (value: string) => void;
  refreshWorkspace: (sessionId?: string) => Promise<void>;
  loadSession: (sessionId: string, withSpinner?: boolean) => Promise<void>;
  createSession: () => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  archiveSession: (sessionId?: string) => Promise<void>;
  sendMessage: () => Promise<void>;
  changeMode: (mode: AgentMode) => Promise<void>;
  decideActionPreview: (previewId: string, decision: "approved" | "rejected") => Promise<void>;
  createActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => Promise<void>;
  executeActionPreview: (previewId: string) => Promise<void>;
};

export type AgentWorkspaceViewModel = {
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  latestSnapshot?: AgentContextSnapshotRecord;
  pendingPreviews: AgentActionPreviewRecord[];
  contextRows: Array<{ label: string; value: string }>;
};

export type AgentWorkspaceProps = {
  project?: ProjectSummary;
  page: AgentPageState;
};
