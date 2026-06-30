import { Bot } from "lucide-react";
import type { AgentActionPreviewRecord, AgentMessageRecord, AgentMode, AgentPageState, AgentSessionRecord } from "../api";
import { cn } from "../../../lib/utils";
import { formatShortTime, modeDescriptions, modeLabels } from "../utils";
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
  onSynced
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
}) {
  const pendingPreviewCount = actionPreviews.filter((preview) => preview.status === "pending").length;
  
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
          />
        ) : messages.length ? (
          <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-6 text-center">
            <h1 className="text-2xl font-semibold mb-2">有什么可以帮您的？</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              您可以让我检查代码、运行命令、浏览网页，或者从左侧新建一个会话开始探索。
            </p>
          </div>
        )}
      </div>
      {!activeSession ? (
        <div className="shrink-0 border-t border-border bg-background p-3 text-center">
          <button type="button" onClick={onArchive} disabled={!activeSession || loading} className="text-xs font-semibold text-muted-foreground hover:text-destructive disabled:opacity-40">
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
        "max-w-[85%] rounded-3xl px-5 py-3.5 shadow-lg text-[13px] backdrop-blur-xl transition-all duration-300",
        isUser 
          ? "border border-cyan-500/20 bg-gradient-to-br from-cyan-900/60 to-indigo-900/40 text-cyan-50 shadow-cyan-900/10 rounded-tr-sm" 
          : isSystem 
            ? "border border-white/5 bg-white/5 text-zinc-400 rounded-tl-sm" 
            : "border border-white/10 bg-white/5 text-zinc-200 rounded-tl-sm"
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
