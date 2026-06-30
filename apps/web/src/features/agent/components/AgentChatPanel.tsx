import { Loader2 } from "lucide-react";
import type { AgentActionPreviewRecord, AgentMessageRecord, AgentPageState, AgentSessionRecord } from "../api";
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
  onDecideActionPreview,
  onExecuteActionPreview,
  onSynced,
  pendingPreviewCount,
  activeRunCount
}: {
  projectName?: string;
  projectId?: string;
  page: AgentPageState;
  activeSession?: AgentSessionRecord;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  loading: boolean;
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview: (previewId: string) => void;
  onSynced: () => void;
  pendingPreviewCount: number;
  activeRunCount: number;
}) {
  const runStatusBar = pendingPreviewCount > 0 || activeRunCount > 0 ? (
    <AgentRunStatusBar pendingPreviewCount={pendingPreviewCount} activeRunCount={activeRunCount} />
  ) : null;
  
  return (
    <aside className="flex h-full min-h-0 flex-col bg-transparent relative">
      <div className="min-h-0 flex-1 overflow-hidden relative">
        {activeSession ? (
          <AssistantUiChatSurface
            activeSession={activeSession}
            messages={messages}
            projectId={projectId}
            page={page}
            onSynced={onSynced}
            runStatusBar={runStatusBar}
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
    </aside>
  );
}

function AgentRunStatusBar({
  pendingPreviewCount,
  activeRunCount,
}: {
  pendingPreviewCount: number;
  activeRunCount: number;
}) {
  const segments: string[] = [];
  if (activeRunCount > 0) segments.push(`正在进行 ${activeRunCount} 个任务`);
  if (pendingPreviewCount > 0) segments.push(`${pendingPreviewCount} 个动作待处理`);

  return (
    <div className="flex min-h-8 items-center gap-2 rounded-control border border-agent-border bg-agent-panel px-3 text-[12px] text-agent-muted shadow-sm">
      {activeRunCount > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-agent-accent" /> : null}
      <span className="truncate">{segments.join(" · ")}</span>
    </div>
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
