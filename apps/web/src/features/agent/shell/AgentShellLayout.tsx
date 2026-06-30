import { Group, Panel, Separator } from "react-resizable-panels";
import type { AgentWorkspaceTab } from "../types";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { AgentSessionSidebar } from "../components/AgentSessionSidebar";
import type {
  AgentActionKind,
  AgentActionPreviewRecord,
  AgentContextSnapshot,
  AgentMessageRecord,
  AgentPageState,
  AgentSessionRecord,
  CompressedAgentContext,
  PiAgentRuntimeStatus,
} from "../api";
import type { DesktopReadiness, ProjectSummary, RuntimeStatus } from "../../../api";
import { cn } from "../../../lib/utils";
import { AgentToolPanel } from "../components/AgentToolPanel";

export function AgentShellLayout({
  sessionRailCollapsed,
  activeTab,
  pendingPreviewCount,
  sessions,
  activeSession,
  loading,
  messages,
  actionPreviews,
  context,
  compressedContext,
  compressedContextSnapshotId,
  readiness,
  pi,
  contextRows,
  pendingPreviews,
  selectedProject,
  runtimeStatus,
  page,
  onToggleSessionRail,
  onNewSession,
  onSelectSession,
  onActiveTabChange,
  onArchiveSession,
  onModeChange,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  onSynced,
}: {
  sessionRailCollapsed: boolean;
  activeTab: AgentWorkspaceTab;
  pendingPreviewCount: number;
  sessions: AgentSessionRecord[];
  activeSession?: AgentSessionRecord;
  loading: boolean;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  readiness?: DesktopReadiness;
  pi?: PiAgentRuntimeStatus;
  contextRows: Array<{ label: string; value: string }>;
  pendingPreviews: AgentActionPreviewRecord[];
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  page: AgentPageState;
  onToggleSessionRail: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onActiveTabChange: (tab: AgentWorkspaceTab) => void;
  onArchiveSession: () => void;
  onModeChange: (mode: AgentSessionRecord["mode"]) => void;
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  onSynced: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-agent-bg text-agent-text">
      <aside
        className={cn(
          "hidden min-h-0 shrink-0 flex-col border-r border-agent-border bg-agent-panel lg:flex",
          sessionRailCollapsed ? "w-[76px]" : "w-[260px]",
        )}
      >
        <div className="min-h-0 flex-1">
          <AgentSessionSidebar
            collapsed={sessionRailCollapsed}
            sessions={sessions}
            projects={context?.projects || []}
            activeSessionId={activeSession?.id}
            loading={loading}
            onToggleCollapsed={onToggleSessionRail}
            onNewSession={onNewSession}
            onSelectSession={onSelectSession}
          />
        </div>
      </aside>

      <Group
        id="agent-shell-workspace"
        orientation="horizontal"
        className="min-h-0 min-w-0 flex-1"
        defaultLayout={{ chat: 38, workspace: 62 }}
      >
        <Panel id="chat" minSize="340px" defaultSize="38%" className="min-w-0">
          <div className="flex h-full min-h-0 flex-col bg-agent-bg">
            <AgentChatPanel
              projectName={selectedProject?.name}
              projectId={selectedProject?.id}
              page={page}
              activeSession={activeSession}
              messages={messages}
              actionPreviews={actionPreviews}
              loading={loading}
              onArchive={onArchiveSession}
              onModeChange={onModeChange}
              onDecideActionPreview={onDecideActionPreview}
              onExecuteActionPreview={onExecuteActionPreview}
              onSynced={onSynced}
              onOpenWorkspace={() => onActiveTabChange("launcher")}
              workspaceOpen={activeTab !== "closed"}
            />
          </div>
        </Panel>
        {activeTab !== "closed" && (
          <Separator
            className="w-1 bg-agent-border-soft transition-colors hover:bg-agent-accent/30 data-[resize-handle-active]:bg-agent-accent/50"
          />
        )}
        {activeTab !== "closed" && (
          <Panel id="workspace" minSize="560px" defaultSize={activeTab === "launcher" ? "46%" : "62%"} className="min-w-0">
            <div className="relative z-10 flex h-full min-h-0 flex-col border-l border-agent-border-soft bg-agent-panel shadow-panel">
              <div className="min-h-0 flex-1 overflow-hidden">
                <AgentToolPanel
                  activeTab={activeTab}
                  onActiveTabChange={onActiveTabChange}
                  context={context}
                  compressedContext={compressedContext}
                  compressedContextSnapshotId={compressedContextSnapshotId}
                  readiness={readiness}
                  pi={pi}
                  actionPreviews={actionPreviews}
                  contextRows={contextRows}
                  pendingPreviews={pendingPreviews}
                  selectedProject={selectedProject}
                  runtimeStatus={runtimeStatus}
                  messages={messages}
                  page={page}
                  onDecideActionPreview={onDecideActionPreview}
                  onCreateActionPreview={onCreateActionPreview}
                  onExecuteActionPreview={onExecuteActionPreview}
                />
              </div>
            </div>
          </Panel>
        )}
      </Group>
    </div>
  );
}
