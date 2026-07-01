import { Activity, Bot, Braces, CheckCircle2, CircleAlert, CircleDashed, FileText, GitCompare, Globe, ListChecks, PackageOpen, PanelTop, Plus, Terminal, Wrench, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AgentActionKind, AgentActionPreviewRecord, AgentContextSnapshot, AgentMessageRecord, AgentPageState, CompressedAgentContext, PiAgentRuntimeStatus } from "../api";
import type { DesktopReadiness, ProjectSummary, RuntimeStatus } from "../../../api";
import type { AgentWorkspaceTab } from "../types";
import { AgentArtifactsTab } from "./AgentArtifactsTab";
import { AgentBrowserTab } from "./AgentBrowserTab";
import { AgentContextTab } from "./AgentContextTab";
import { AgentDiffTab } from "./AgentDiffTab";
import { AgentFilesTab } from "./AgentFilesTab";
import { AgentLogsTab } from "./AgentLogsTab";
import { EmptyState } from "./AgentPanelPrimitives";
import { AgentTerminalTab } from "./AgentTerminalTab";
import { AgentWorkspaceBlueprint } from "./AgentWorkspaceBlueprint";
import { cn } from "../../../lib/utils";

type WorkspaceToolTab = {
  id: AgentWorkspaceTab;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
  state?: "ready" | "stub";
};

const toolTabs: WorkspaceToolTab[] = [
  { id: "overview", label: "审查", description: "显示待处理动作和最近 Agent 决策。", icon: Activity, shortcut: "Ctrl+Shift+G", state: "ready" },
  { id: "artifacts", label: "产物", description: "Open Canvas 式 artifact 预览、保存状态和版本骨架。", icon: PanelTop, state: "ready" },
  { id: "terminal", label: "终端", description: "只展示白名单命令快照，不是交互终端。", icon: Terminal, state: "ready" },
  { id: "browser", label: "浏览器", description: "按 URL 触发探测，不默认打开浏览器。", icon: Globe, shortcut: "Ctrl+T", state: "ready" },
  { id: "files", label: "文件", description: "浏览 Agent 可见的项目文件入口。", icon: FileText, shortcut: "Ctrl+P", state: "ready" },
  { id: "context", label: "上下文", description: "查看当前项目、页面选择和压缩上下文。", icon: Braces, state: "ready" },
  { id: "diff", label: "Diff", description: "按需读取 Git diff 和工作区变更。", icon: GitCompare, state: "ready" },
  { id: "logs", label: "日志", description: "读取 MCP/runtime 日志尾部。", icon: ListChecks, state: "ready" },
  { id: "tools", label: "工具", description: "等待 Pi Runtime Bridge 和 TapTap Maker Adapter 接入。", icon: PackageOpen, state: "stub" }
];

const launcherTabs: AgentWorkspaceTab[] = ["overview", "terminal", "browser", "files"];

export function AgentToolPanel({
  activeTab,
  openTabs,
  onActiveTabChange,
  onCloseTab,
  context,
  compressedContext,
  compressedContextSnapshotId,
  readiness,
  pi,
  actionPreviews,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  contextRows,
  pendingPreviews,
  selectedProject,
  runtimeStatus,
  messages,
  page
}: {
  activeTab: AgentWorkspaceTab;
  openTabs: AgentWorkspaceTab[];
  onActiveTabChange: (tab: AgentWorkspaceTab) => void;
  onCloseTab: (tab: AgentWorkspaceTab) => void;
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  readiness?: DesktopReadiness;
  pi?: PiAgentRuntimeStatus;
  actionPreviews: AgentActionPreviewRecord[];
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  contextRows: Array<{ label: string; value: string }>;
  pendingPreviews: AgentActionPreviewRecord[];
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  messages: AgentMessageRecord[];
  page: AgentPageState;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleTabs = openTabs
    .map((id) => toolTabs.find((tab) => tab.id === id))
    .filter((tab): tab is WorkspaceToolTab => Boolean(tab));
  const activeToolTab = toolTabs.find((tab) => tab.id === activeTab);

  return (
    <aside className="relative z-10 flex h-full min-h-0 flex-col bg-agent-panel text-agent-text">
      {activeTab === "launcher" ? (
        <WorkspaceLauncher
          pendingPreviews={pendingPreviews.length}
          pendingPreviewRecords={pendingPreviews}
          selectedProject={selectedProject}
          runtimeStatus={runtimeStatus}
          pi={pi}
          onOpenTab={onActiveTabChange}
          onDecideActionPreview={onDecideActionPreview}
          onExecuteActionPreview={onExecuteActionPreview}
        />
      ) : (
        <>
          <div className="relative z-20 shrink-0 border-b border-agent-border-soft bg-agent-bg">
            <div className="flex h-[36px] items-center justify-between px-3">
              <div className="flex items-center gap-2">
                {activeToolTab?.icon && <activeToolTab.icon className="h-3.5 w-3.5 text-agent-muted" />}
                <h2 className="truncate text-[12px] font-medium text-agent-text">{activeToolTab?.label ?? "Workspace"}</h2>
                {activeToolTab?.id === "overview" && pendingPreviews.length > 0 && (
                  <span className="rounded-full bg-agent-warning/20 px-1.5 py-0.5 text-[10px] text-agent-warning font-medium">
                    {pendingPreviews.length}
                  </span>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-control text-agent-muted transition-colors hover:bg-agent-panel hover:text-agent-text hover:shadow-sm border border-transparent hover:border-agent-border-soft"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <WorkspaceTabMenu
                      pendingPreviews={pendingPreviews.length}
                      onOpenTab={(tab) => {
                        onActiveTabChange(tab);
                        setMenuOpen(false);
                      }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
          <WorkspaceContent
            activeTab={activeTab}
            context={context}
            compressedContext={compressedContext}
            compressedContextSnapshotId={compressedContextSnapshotId}
            readiness={readiness}
            pi={pi}
            actionPreviews={actionPreviews}
            onDecideActionPreview={onDecideActionPreview}
            onCreateActionPreview={onCreateActionPreview}
            onExecuteActionPreview={onExecuteActionPreview}
            contextRows={contextRows}
            pendingPreviews={pendingPreviews}
            selectedProject={selectedProject}
            runtimeStatus={runtimeStatus}
            messages={messages}
            page={page}
          />
        </>
      )}
    </aside>
  );
}

function WorkspaceLauncher({
  pendingPreviews,
  pendingPreviewRecords,
  selectedProject,
  runtimeStatus,
  pi,
  onOpenTab,
  onDecideActionPreview,
  onExecuteActionPreview,
}: {
  pendingPreviews: number;
  pendingPreviewRecords: AgentActionPreviewRecord[];
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
  onOpenTab: (tab: AgentWorkspaceTab) => void;
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview: (previewId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-medium text-agent-text">
            {selectedProject?.name ? `${selectedProject.name} Workspace` : "Agent Workspace"}
          </h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-agent-subtle">
            <ArtifactLikeStatus runtimeStatus={runtimeStatus} pi={pi} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenTab("overview")}
          className="inline-flex h-8 items-center gap-1.5 rounded-control border border-agent-border bg-agent-bg px-2.5 text-[12px] text-agent-muted transition-colors hover:bg-agent-surface hover:text-agent-text"
        >
          <Activity className="h-3.5 w-3.5" />
          审查
        </button>
      </div>
      <AgentWorkspaceBlueprint
        selectedProject={selectedProject}
        runtimeStatus={runtimeStatus}
        pi={pi}
        pendingPreviews={pendingPreviewRecords}
        onOpenTab={onOpenTab}
        onDecideActionPreview={onDecideActionPreview}
        onExecuteActionPreview={onExecuteActionPreview}
      />
    </div>
  );
}

function ArtifactLikeStatus({
  runtimeStatus,
  pi,
}: {
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
}) {
  const piConnected = Boolean(pi?.connected);
  return (
    <>
      <span className="inline-flex items-center gap-1">
        {runtimeStatus === "ready" ? <CheckCircle2 className="h-3 w-3 text-agent-accent" /> : <CircleAlert className="h-3 w-3 text-agent-subtle" />}
        MCP {runtimeStatus}
      </span>
      <span>·</span>
      <span className="inline-flex items-center gap-1">
        {piConnected ? <CheckCircle2 className="h-3 w-3 text-agent-accent" /> : <CircleDashed className="h-3 w-3" />}
        Pi {piConnected ? "connected" : "待接入"}
      </span>
    </>
  );
}

function WorkspaceStatePill({
  tab,
  pendingPreviews,
}: {
  tab?: WorkspaceToolTab;
  pendingPreviews: number;
}) {
  if (tab?.state === "stub") {
    return <span className="rounded-control border border-agent-border-soft bg-agent-surface px-1.5 py-0.5 text-[10px] text-agent-subtle">待接入</span>;
  }
  if (tab?.id === "overview" && pendingPreviews > 0) {
    return <span className="rounded-control border border-agent-warning/25 bg-agent-warning/10 px-1.5 py-0.5 text-[10px] text-agent-warning">Needs input</span>;
  }
  return <span className="rounded-control border border-agent-border-soft bg-agent-bg px-1.5 py-0.5 text-[10px] text-agent-muted">可用</span>;
}

function WorkspaceTabButton({
  tab,
  selected,
  pendingPreviews,
  onSelect,
  onClose,
}: {
  tab: WorkspaceToolTab;
  selected: boolean;
  pendingPreviews: number;
  onSelect: () => void;
  onClose: () => void;
}) {
  const Icon = tab.icon;
  return (
    <div
      className={cn(
        "group/tab relative inline-flex h-8 min-w-[88px] max-w-[140px] shrink items-center gap-1.5 rounded-control px-2 text-[12px] font-medium transition-colors border border-transparent",
        selected
          ? "bg-agent-surface text-agent-text shadow-sm"
          : "text-agent-muted hover:bg-agent-surface hover:text-agent-text"
      )}
      title={tab.description}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left truncate">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="truncate">{tab.label}</span>
        {tab.id === "overview" && pendingPreviews > 0 ? (
          <span className="rounded-pill bg-agent-warning/15 px-1.5 text-[10px] text-agent-warning">
            {pendingPreviews}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-control text-agent-subtle transition-all",
          selected ? "opacity-100 hover:bg-agent-panel hover:text-agent-text" : "opacity-0 group-hover/tab:opacity-100 hover:bg-agent-panel hover:text-agent-text"
        )}
        title="关闭标签"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function WorkspaceTabMenu({
  pendingPreviews,
  onOpenTab,
}: {
  pendingPreviews: number;
  onOpenTab: (tab: AgentWorkspaceTab) => void;
}) {
  return (
    <div className="absolute right-0 top-9 z-40 w-[300px] max-w-[calc(100vw-24px)] rounded-panel border border-agent-border bg-agent-panel p-1.5 shadow-popover">
      <div className="flex flex-col gap-0.5">
        {toolTabs.map((tab) => {
          const Icon = tab.icon;
          const label = tab.id === "overview" && pendingPreviews > 0 ? `${tab.label} (${pendingPreviews})` : tab.label;
          const openTab = () => onOpenTab(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              data-workspace-tab={tab.id}
              aria-label={`打开工作区：${tab.label}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openTab();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openTab();
              }}
              className="flex h-9 items-center gap-2.5 rounded-control px-2.5 text-left text-agent-muted transition-colors hover:bg-agent-surface hover:text-agent-text"
              title={tab.description}
            >
              <Icon className="h-[14px] w-[14px] shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{label}</span>
              {tab.shortcut ? <span className="shrink-0 text-[11px] text-agent-subtle font-mono">{tab.shortcut}</span> : null}
              {tab.state === "stub" ? <span className="shrink-0 rounded bg-agent-surface/50 px-1.5 py-0.5 text-[10px] text-agent-subtle">待接入</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceContent({
  activeTab,
  context,
  compressedContext,
  compressedContextSnapshotId,
  readiness,
  pi,
  actionPreviews,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  contextRows,
  pendingPreviews,
  selectedProject,
  runtimeStatus,
  messages,
  page,
}: {
  activeTab: AgentWorkspaceTab;
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  readiness?: DesktopReadiness;
  pi?: PiAgentRuntimeStatus;
  actionPreviews: AgentActionPreviewRecord[];
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  contextRows: Array<{ label: string; value: string }>;
  pendingPreviews: AgentActionPreviewRecord[];
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  messages: AgentMessageRecord[];
  page: AgentPageState;
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-agent-bg">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -5 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="absolute inset-0 flex flex-col"
        >
          {activeTab === "overview" ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <AgentWorkspaceBlueprint
                selectedProject={selectedProject}
                runtimeStatus={runtimeStatus}
                pi={pi}
                pendingPreviews={pendingPreviews}
                onOpenTab={() => undefined}
                onDecideActionPreview={onDecideActionPreview}
                onExecuteActionPreview={onExecuteActionPreview}
                compact
              />
            </div>
          ) : null}
          {activeTab === "artifacts" ? (
            <AgentArtifactsTab
              selectedProject={selectedProject}
              runtimeStatus={runtimeStatus}
              pi={pi}
              pendingPreviews={pendingPreviews}
            />
          ) : null}
          {activeTab === "terminal" ? <AgentTerminalTab context={context} readiness={readiness} runtimeStatus={runtimeStatus} pi={pi} /> : null}
          {activeTab === "diff" ? <AgentDiffTab context={context} messages={messages} actionPreviews={actionPreviews} /> : null}
          {activeTab === "browser" ? <AgentBrowserTab selectedProject={selectedProject} context={context} onCreateActionPreview={onCreateActionPreview} /> : null}
          {activeTab === "logs" ? <AgentLogsTab context={context} readiness={readiness} messages={messages} /> : null}
          {activeTab === "context" ? (
            <AgentContextTab
              context={context}
              compressedContext={compressedContext}
              compressedContextSnapshotId={compressedContextSnapshotId}
              selectedProject={selectedProject}
              page={page}
              contextRows={contextRows}
            />
          ) : null}
          {activeTab === "files" ? <AgentFilesTab context={context} selectedProject={selectedProject} page={page} /> : null}
          {activeTab === "tools" ? (
            <UnconnectedWorkspace
              icon={<Wrench className="h-9 w-9" />}
              title="工具目录待接入"
              body="当前只接入了动作预览、终端快照、浏览器检查、Diff 和上下文读取。完整工具目录需要后续接 Pi Runtime Bridge 事件流和 TapTap Maker Adapter。"
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function UnconnectedWorkspace({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-agent-bg p-8 text-center text-agent-text">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-panel border border-agent-border bg-agent-panel text-agent-muted">
          {icon}
        </div>
        <EmptyState title={title} body={body} />
        <div className="mt-4 inline-flex items-center gap-2 rounded-control border border-agent-border bg-agent-panel px-3 py-2 text-[11px] text-agent-muted">
          <Bot className="h-3.5 w-3.5" />
          无真实后端数据，已保持禁用状态
        </div>
      </div>
    </div>
  );
}
