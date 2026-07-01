import { useState } from "react";
import type { AgentPageState, ProjectSummary } from "../../../api";
import type { AgentWorkspaceTab } from "../types";
import { useAgentWorkspace } from "../hooks/useAgentWorkspace";
import { AgentShellLayout } from "./AgentShellLayout";

export function AgentAppShell({
  project,
  page,
}: {
  project?: ProjectSummary;
  page: AgentPageState;
  onExit: () => void;
}) {
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentWorkspaceTab>("launcher");
  const [openWorkspaceTabs, setOpenWorkspaceTabs] = useState<AgentWorkspaceTab[]>([]);
  const agent = useAgentWorkspace({ project, page });
  const { viewModel } = agent;

  function openWorkspaceTab(tab: AgentWorkspaceTab) {
    if (tab === "closed" || tab === "launcher") {
      setActiveTab(tab);
      return;
    }
    setOpenWorkspaceTabs((current) => current.includes(tab) ? current : [...current, tab]);
    setActiveTab(tab);
  }

  function closeWorkspaceTab(tab: AgentWorkspaceTab) {
    setOpenWorkspaceTabs((current) => {
      const next = current.filter((item) => item !== tab);
      if (activeTab === tab) {
        const closingIndex = current.indexOf(tab);
        setActiveTab(next[closingIndex] ?? next[closingIndex - 1] ?? "launcher");
      }
      return next;
    });
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-agent-bg text-agent-text">
      <AgentShellLayout
        sessionRailCollapsed={sessionRailCollapsed}
        activeTab={activeTab}
        openWorkspaceTabs={openWorkspaceTabs}
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
        onActiveTabChange={openWorkspaceTab}
        onCloseWorkspaceTab={closeWorkspaceTab}
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
