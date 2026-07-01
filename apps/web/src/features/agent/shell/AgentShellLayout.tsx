import { Group, Panel, Separator } from "react-resizable-panels";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { motion, animate } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
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
  openWorkspaceTabs,
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
  onSendMessage,
  onSelectSession,
  onRenameSession,
  onActiveTabChange,
  onCloseWorkspaceTab,
  onArchiveSession,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  onSynced,
}: {
  sessionRailCollapsed: boolean;
  activeTab: AgentWorkspaceTab;
  openWorkspaceTabs: AgentWorkspaceTab[];
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
  onSendMessage: (content: string) => Promise<void>;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onActiveTabChange: (tab: AgentWorkspaceTab) => void;
  onCloseWorkspaceTab: (tab: AgentWorkspaceTab) => void;
  onArchiveSession: (sessionId?: string) => void;
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  onSynced: () => void;
}) {
  const [persistedTab, setPersistedTab] = useState<AgentWorkspaceTab>(activeTab === "closed" ? "launcher" : activeTab);
  const workspacePanelRef = useRef<PanelImperativeHandle>(null);
  const lastSizeRef = useRef(62);

  useEffect(() => {
    let controls: any;
    if (activeTab !== "closed") {
      setPersistedTab(activeTab);
      const panel = workspacePanelRef.current;
      if (panel && panel.isCollapsed()) {
        controls = animate(0, lastSizeRef.current || 62, {
          type: "spring",
          stiffness: 350,
          damping: 30,
          onUpdate: (latest) => panel.resize(latest),
        });
      }
    } else {
      const panel = workspacePanelRef.current;
      if (panel && !panel.isCollapsed()) {
        const currentSize = panel.getSize().asPercentage;
        lastSizeRef.current = currentSize > 10 ? currentSize : 62;
        controls = animate(currentSize, 0, {
          type: "spring",
          stiffness: 350,
          damping: 30,
          onUpdate: (latest) => {
            if (latest < 0.1) panel.collapse();
            else panel.resize(latest);
          },
        });
      }
    }
    return () => controls?.stop();
  }, [activeTab]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-agent-bg text-agent-text">
      <motion.aside
        initial={false}
        animate={{ width: sessionRailCollapsed ? 76 : 260 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="hidden min-h-0 shrink-0 flex-col border-r border-agent-border bg-agent-panel lg:flex"
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
            onRenameSession={onRenameSession}
            onArchiveSession={onArchiveSession}
          />
        </div>
      </motion.aside>

      <div className="relative min-h-0 min-w-0 flex-1">
        <WorkspaceToggleButton
          activeTab={activeTab}
          onClick={() => onActiveTabChange(activeTab === "closed" ? "launcher" : activeTab === "launcher" ? "closed" : "launcher")}
        />
        <Group
          id="agent-shell-workspace"
          orientation="horizontal"
          className="min-h-0 min-w-0 flex-1"
        >
          <Panel id="chat" minSize={30} defaultSize={38} className="min-w-0">
          <div className="flex h-full min-h-0 flex-col bg-agent-bg">
            <AgentChatPanel
              projectName={selectedProject?.name}
              projectId={selectedProject?.id}
              page={page}
              activeSession={activeSession}
              messages={messages}
              actionPreviews={actionPreviews}
              loading={loading}
              onDecideActionPreview={onDecideActionPreview}
              onExecuteActionPreview={onExecuteActionPreview}
              onSynced={onSynced}
              onSendMessage={onSendMessage}
              pendingPreviewCount={pendingPreviewCount}
              activeRunCount={0}
            />
          </div>
          </Panel>
          <Separator
            className={cn(
              "w-1 bg-agent-border-soft transition-all duration-500 hover:bg-agent-accent/30 data-[resize-handle-active]:bg-agent-accent/50",
              activeTab === "closed" && "opacity-0 pointer-events-none"
            )}
          />
          <Panel 
            id="workspace" 
            panelRef={workspacePanelRef}
            collapsible
            minSize={30}
            defaultSize={62} 
            className="min-w-0"
          >
            <div className={cn("relative z-10 flex h-full min-h-0 flex-col border-l border-agent-border-soft bg-agent-panel shadow-panel transition-opacity duration-500", activeTab === "closed" ? "opacity-0" : "opacity-100")}>
              <div className="min-w-[480px] h-full flex flex-col min-h-0 flex-1 overflow-hidden">
                <AgentToolPanel
                  activeTab={persistedTab}
                  openTabs={openWorkspaceTabs}
                  onActiveTabChange={onActiveTabChange}
                  onCloseTab={onCloseWorkspaceTab}
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
        </Group>
      </div>
    </div>
  );
}

import { LayoutGrid } from "lucide-react";

function WorkspaceToggleButton({
  activeTab,
  onClick,
}: {
  activeTab: AgentWorkspaceTab;
  onClick: () => void;
}) {
  const isClosed = activeTab === "closed";
  const isLauncher = activeTab === "launcher";
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border bg-agent-panel text-agent-muted shadow-sm transition-colors hover:bg-agent-surface hover:text-agent-text"
      title={isClosed ? "展开生成工作台" : isLauncher ? "收起工作台" : "切换回生成工作台"}
      aria-label={isClosed ? "展开生成工作台" : isLauncher ? "收起工作台" : "切换回生成工作台"}
    >
      {isClosed ? <PanelRightOpen className="h-3.5 w-3.5" /> : isLauncher ? <PanelRightClose className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
    </button>
  );
}
