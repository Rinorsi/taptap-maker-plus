import { Activity, Bot, Braces, FileText, GitCompare, Globe, ListChecks, PackageOpen, Terminal, Wrench } from "lucide-react";
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

const toolTabs: Array<{ id: AgentWorkspaceTab; label: string; description: string; icon: typeof Activity; state?: "ready" | "stub" }> = [
  { id: "overview", label: "任务与审批", description: "显示待确认动作和最近 Agent 决策。", icon: Activity, state: "ready" },
  { id: "context", label: "上下文", description: "查看当前项目、页面选择和压缩上下文。", icon: Braces, state: "ready" },
  { id: "files", label: "文件引用", description: "浏览 Agent 可见的项目文件入口。", icon: FileText, state: "ready" },
  { id: "diff", label: "Diff", description: "按需读取 Git diff 和工作区变更。", icon: GitCompare, state: "ready" },
  { id: "terminal", label: "终端快照", description: "只展示白名单命令快照，不是交互终端。", icon: Terminal, state: "ready" },
  { id: "browser", label: "浏览器检查", description: "按 URL 触发探测，不默认打开浏览器。", icon: Globe, state: "ready" },
  { id: "logs", label: "日志", description: "读取 MCP/runtime 日志尾部。", icon: ListChecks, state: "ready" },
  { id: "tools", label: "工具目录", description: "等待 Pi Runtime Bridge 和 TapTap Maker Adapter 接入。", icon: PackageOpen, state: "stub" }
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
  const activeToolTab = toolTabs.find((tab) => tab.id === activeTab);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-agent-panel text-agent-text relative z-10">
      {activeTab === "launcher" ? (
        <div className="flex-1 overflow-y-auto bg-agent-bg p-5">
          <div className="mb-5">
            <div className="min-w-0">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-agent-accent">Agent workspace</p>
              <h2 className="m-0 mt-1 text-lg font-semibold text-agent-text">单一多功能画布</h2>
              <p className="m-0 mt-2 max-w-2xl text-xs leading-5 text-agent-muted">
                右侧只保留一个聚焦 surface。任务、Diff、终端、浏览器、文件和日志通过当前画布切换进入，不在画布内部常驻左右分栏。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {toolTabs.map((tab) => {
              const Icon = tab.icon;
              const label = tab.id === "overview" && pendingPreviews.length > 0 ? `${tab.label} (${pendingPreviews.length})` : tab.label;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onActiveTabChange(tab.id)}
                  className="flex min-h-[108px] min-w-0 items-start gap-4 rounded-panel border border-agent-border bg-agent-panel p-4 text-left text-agent-muted shadow-sm transition-colors hover:border-agent-accent hover:bg-agent-surface hover:text-agent-text"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-agent-surface text-agent-text">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-semibold text-agent-text">{label}</span>
                      {tab.state === "stub" ? (
                        <span className="shrink-0 rounded-pill border border-agent-border-soft px-1.5 py-0.5 text-[10px] font-medium text-agent-subtle">
                          待接入
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[11px] leading-4 text-agent-muted">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-agent-border bg-agent-panel">
            <div className="flex gap-1 overflow-x-auto px-3 py-2 pr-12">
              {toolTabs.map((tab) => {
                const Icon = tab.icon;
                const selected = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onActiveTabChange(tab.id)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-[11px] font-medium transition-colors",
                      selected
                        ? "bg-agent-surface text-agent-text"
                        : "text-agent-muted hover:bg-agent-surface hover:text-agent-text"
                    )}
                    title={selected ? activeToolTab?.description : tab.description}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                    {tab.state === "stub" ? <span className="text-[10px] text-agent-subtle">待接入</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden relative bg-agent-bg">
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
        </>
      )}
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
