import { useState } from "react";
import type { AgentPageState, ProjectSummary } from "../../../api";
import type { AgentWorkspaceTab } from "../types";
import { useAgentWorkspace } from "../hooks/useAgentWorkspace";
import { AgentShellHeader } from "./AgentShellHeader";
import { AgentShellLayout } from "./AgentShellLayout";

export function AgentAppShell({
  project,
  page,
  onExit,
}: {
  project?: ProjectSummary;
  page: AgentPageState;
  onExit: () => void;
}) {
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentWorkspaceTab>("overview");
  const agent = useAgentWorkspace({ project, page });
  const { viewModel } = agent;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-agent-bg text-agent-text">
      <AgentShellHeader
        project={viewModel.selectedProject}
        activeSession={agent.activeSession}
        runtimeStatus={viewModel.runtimeStatus}
        pi={agent.pi}
        loading={agent.loading}
        onExit={onExit}
        onRefresh={() => void agent.refreshWorkspace()}
        onModeChange={(mode) => void agent.changeMode(mode)}
      />
      <AgentShellLayout
        sessionRailCollapsed={sessionRailCollapsed}
        activeTab={activeTab}
        pendingPreviewCount={viewModel.pendingPreviews.length}
        sessions={agent.sessions}
        activeSession={agent.activeSession}
        loading={agent.loading}
        messages={agent.messages}
        actionPreviews={agent.actionPreviews}
        context={agent.context}
        compressedContext={agent.compressedContext}
        compressedContextSnapshotId={agent.compressedContextSnapshotId}
        readiness={agent.readiness}
        pi={agent.pi}
        contextRows={viewModel.contextRows}
        pendingPreviews={viewModel.pendingPreviews}
        selectedProject={viewModel.selectedProject}
        runtimeStatus={viewModel.runtimeStatus}
        page={page}
        onToggleSessionRail={() => setSessionRailCollapsed((value) => !value)}
        onNewSession={() => void agent.createSession()}
        onSelectSession={(sessionId) => void agent.loadSession(sessionId)}
        onActiveTabChange={setActiveTab}
        onArchiveSession={() => void agent.archiveSession()}
        onModeChange={(mode) => void agent.changeMode(mode)}
        onDecideActionPreview={(previewId, decision) => void agent.decideActionPreview(previewId, decision)}
        onCreateActionPreview={(input) => void agent.createActionPreview(input)}
        onExecuteActionPreview={(previewId) => void agent.executeActionPreview(previewId)}
        onSynced={() => {
          if (agent.activeSession) void agent.loadSession(agent.activeSession.id, false);
        }}
      />
    </section>
  );
}
