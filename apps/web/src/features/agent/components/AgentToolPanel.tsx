import { Activity, Bot, Braces, GitCompare, Globe, ListChecks, PackageOpen, Terminal, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentActionKind, AgentActionPreviewRecord, AgentContextSnapshot, AgentMessageRecord, AgentPageState, CompressedAgentContext, PiAgentRuntimeStatus } from "../api";
import type { DesktopReadiness, ProjectSummary, RuntimeStatus } from "../../../api";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import type { AgentWorkspaceTab } from "../types";
import { AgentArtifactsTab } from "./AgentArtifactsTab";
import { AgentBrowserTab } from "./AgentBrowserTab";
import { AgentContextTab } from "./AgentContextTab";
import { AgentDiffTab } from "./AgentDiffTab";
import { AgentLogsTab } from "./AgentLogsTab";
import { AgentOverviewTab } from "./AgentOverviewTab";
import { AgentTerminalTab } from "./AgentTerminalTab";
import { AgentFilesTab } from "./AgentFilesTab";
import { EmptyState } from "./AgentPanelPrimitives";
import { cn } from "../../../lib/utils";

const toolTabs: Array<{ id: AgentWorkspaceTab; label: string; icon: typeof Activity }> = [
  { id: "context", label: "上下文", icon: Braces },
  { id: "overview", label: "计划", icon: Activity },
  { id: "files", label: "文件", icon: PackageOpen },
  { id: "tools", label: "工具", icon: PackageOpen },
  { id: "diff", label: "Diff", icon: GitCompare },
  { id: "terminal", label: "终端", icon: Terminal },
  { id: "browser", label: "浏览器", icon: Globe },
  { id: "logs", label: "日志", icon: ListChecks }
];

export function AgentToolPanel({
  activeTab,
  onActiveTabChange,
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
  onActiveTabChange: (tab: AgentWorkspaceTab) => void;
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
    <aside className="flex h-full min-h-0 flex-col bg-transparent text-foreground relative z-10">
      {/* Premium Segmented Control Tabs */}
      <div className="flex shrink-0 items-center overflow-x-auto px-4 py-3 scrollbar-none border-b border-white/[0.05] bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/[0.05] shadow-inner">
        {toolTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const label = tab.id === "overview" && pendingPreviews.length > 0 ? `${tab.label} (${pendingPreviews.length})` : tab.label;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onActiveTabChange(tab.id)}
              className={cn(
                "flex shrink-0 whitespace-nowrap h-8 items-center gap-2 px-3.5 text-[12px] font-medium transition-all duration-300 ease-out rounded-lg",
                isActive 
                  ? "bg-white/10 text-zinc-100 shadow-sm ring-1 ring-white/10" 
                  : "bg-transparent text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
              title={tab.label}
            >
              <Icon className={cn("h-3.5 w-3.5 transition-colors", isActive ? "text-cyan-400" : "opacity-70")} />
              <span>{label}</span>
            </button>
          );
        })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden relative bg-transparent">
        {activeTab === "overview" ? (
          <AgentOverviewTab
            context={context}
            readiness={readiness}
            pi={pi}
            selectedProject={selectedProject}
            runtimeStatus={runtimeStatus}
            contextRows={contextRows}
            pendingPreviews={pendingPreviews}
            actionPreviews={actionPreviews}
            onDecideActionPreview={onDecideActionPreview}
            onExecuteActionPreview={onExecuteActionPreview}
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
      </div>
    </aside>
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
    <div className="flex h-full min-h-0 items-center justify-center bg-transparent p-8 text-center text-zinc-300">
      <div className="max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/15 bg-amber-300/10 text-amber-100">
          {icon}
        </div>
        <EmptyState title={title} body={body} />
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-zinc-500">
          <Bot className="h-3.5 w-3.5" />
          无真实后端数据，已保持禁用状态
        </div>
      </div>
    </div>
  );
}
