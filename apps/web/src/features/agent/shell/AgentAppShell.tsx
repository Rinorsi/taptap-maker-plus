import { useState } from "react";
import type { AgentPageState, ProjectSummary } from "../../../api";
import { useAgentWorkspace } from "../hooks/useAgentWorkspace";
import { AgentShellLayout } from "./AgentShellLayout";

export function AgentAppShell({
  project,
  page,
  theme,
}: {
  project?: ProjectSummary;
  page: AgentPageState;
  theme: "light" | "dark";
  onExit: () => void;
}) {
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false);
  const agent = useAgentWorkspace({ project, page });
  const { viewModel } = agent;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-agent-bg text-agent-text">
      <AgentShellLayout
        sessionRailCollapsed={sessionRailCollapsed}
        theme={theme}
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
        sending={agent.sending}
        error={agent.error}
        onToggleSessionRail={() => setSessionRailCollapsed((value) => !value)}
        onNewSession={() => void agent.createSession()}
        onSendMessage={(content) => agent.sendMessage(content)}
        onSelectSession={(sessionId) => void agent.loadSession(sessionId)}
        onRenameSession={(sessionId, title) => void agent.renameSession(sessionId, title)}
        onArchiveSession={(sessionId) => void agent.archiveSession(sessionId)}
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
