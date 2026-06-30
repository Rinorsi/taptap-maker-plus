import { PanelRightOpen } from "lucide-react";
import type { AgentActionPreviewRecord, AgentMessageRecord, AgentMode, AgentPageState, AgentSessionRecord } from "../api";
import { cn } from "../../../lib/utils";
import { formatShortTime } from "../utils";
import { AssistantUiChatSurface } from "./AssistantUiChatSurface";

export function AgentChatPanel({
  projectName,
  projectId,
  page,
  activeSession,
  messages,
  actionPreviews,
  loading,
  onArchive,
  onModeChange,
  onDecideActionPreview,
  onExecuteActionPreview,
  onSynced,
  onOpenWorkspace,
  workspaceOpen
}: {
  projectName?: string;
  projectId?: string;
  page: AgentPageState;
  activeSession?: AgentSessionRecord;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  loading: boolean;
  onArchive: () => void;
  onModeChange: (mode: AgentMode) => void;
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview: (previewId: string) => void;
  onSynced: () => void;
  onOpenWorkspace: () => void;
  workspaceOpen: boolean;
}) {
  const pendingPreviewCount = actionPreviews.filter((preview) => preview.status === "pending").length;
  
  return (
    <aside className="flex h-full min-h-0 flex-col bg-transparent relative">
      <div className="pointer-events-none absolute right-4 top-4 z-20 flex items-center gap-2">
        {pendingPreviewCount > 0 ? (
          <span className="rounded-pill border border-agent-warning/30 bg-agent-warning/10 px-2.5 py-1 text-[11px] font-medium text-agent-warning">
            {pendingPreviewCount} 个动作待确认
          </span>
        ) : null}
        <button
          type="button"
          onClick={onOpenWorkspace}
          disabled={workspaceOpen}
          className="pointer-events-auto inline-flex h-8 items-center gap-1.5 rounded-control border border-agent-border bg-agent-panel px-2.5 text-[11px] font-medium text-agent-muted shadow-sm transition-colors hover:bg-agent-surface hover:text-agent-text disabled:opacity-45"
          title={workspaceOpen ? "工作区已打开" : "打开工作区"}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          工作区
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden relative">
        {activeSession ? (
          <AssistantUiChatSurface
            activeSession={activeSession}
            messages={messages}
            projectId={projectId}
            page={page}
            onSynced={onSynced}
          />
        ) : messages.length ? (
          <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.filter((m, i, arr) => {
              if (m.role !== "assistant") return true;
              const prev = arr[i - 1];
              return !(prev?.role === "assistant" && prev.content === m.content);
            }).map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-semibold mb-2">有什么可以帮您的？</h1>
            <p className="max-w-md text-sm text-agent-muted">
              请先从左侧新建会话。文件、终端、浏览器、Diff 等能力需要在右侧工作区手动打开；未接入能力会明确标记为待接入。
            </p>
          </div>
        )}
      </div>
      {!activeSession ? (
        <div className="shrink-0 border-t border-agent-border bg-agent-panel p-3 text-center">
          <button type="button" onClick={onArchive} disabled={!activeSession || loading} className="text-xs font-semibold text-agent-muted hover:text-agent-warning disabled:opacity-40">
            归档当前会话
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function MessageBubble({ message }: { message: AgentMessageRecord }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  return (
    <article className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-card px-4 py-3 shadow-sm text-[13px] transition-colors",
        isUser 
          ? "border border-agent-border-soft bg-agent-surface text-agent-text rounded-tr-sm" 
          : isSystem 
            ? "border border-agent-border-soft bg-transparent text-agent-subtle rounded-tl-sm" 
            : "border border-agent-border bg-agent-panel text-agent-text rounded-tl-sm"
      )}>
        <div className="mb-2 flex items-center justify-between gap-4 text-[10px] font-medium opacity-60 uppercase tracking-widest">
          <span>{isUser ? "用户" : isSystem ? "系统" : "助手"}</span>
          <span>{formatShortTime(message.createdAt)}</span>
        </div>
        <p className="m-0 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
      </div>
    </article>
  );
}
