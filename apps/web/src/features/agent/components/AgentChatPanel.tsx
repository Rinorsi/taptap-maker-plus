import { Loader2, User, Bot, Monitor } from "lucide-react";
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
  onSendMessage,
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
  onSendMessage: (content: string) => Promise<void>;
  pendingPreviewCount: number;
  activeRunCount: number;
}) {
  const runStatusBar = pendingPreviewCount > 0 || activeRunCount > 0 ? (
    <AgentRunStatusBar pendingPreviewCount={pendingPreviewCount} activeRunCount={activeRunCount} />
  ) : null;
  
  return (
    <aside className="flex h-full min-h-0 flex-col bg-transparent relative">
      <div className="min-h-0 flex-1 overflow-hidden relative">
        <AssistantUiChatSurface
          activeSession={activeSession}
          messages={messages}
          projectId={projectId}
          page={page}
          onSynced={onSynced}
          runStatusBar={runStatusBar}
          onSendMessage={onSendMessage}
        />
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
  const Icon = isSystem ? Monitor : Bot;

  if (isUser) {
    return (
      <article className="fade-in slide-in-from-bottom-1 animate-in group mx-auto grid w-full max-w-[48rem] grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-4 mb-6 duration-150 [&:where(>*)]:col-start-2">
        <div className="relative col-start-2 min-w-0">
          <div className="peer rounded-2xl rounded-tr-sm bg-agent-surface text-agent-text px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words min-w-0 shadow-sm empty:hidden text-left">
            {message.content}
          </div>
          <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2 peer-empty:hidden">
            <div className="flex flex-col items-end opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-[10px] font-medium opacity-60 uppercase tracking-widest text-agent-subtle whitespace-nowrap">
                {formatShortTime(message.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group mx-auto flex w-full max-w-[48rem] gap-4 px-4 mb-6">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-control border",
        isSystem ? "bg-transparent text-agent-subtle border-dashed border-agent-border-soft" :
        "bg-agent-accent/10 text-agent-accent border-agent-accent/20"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="mb-2 flex items-center gap-3 text-[10px] font-medium opacity-60 uppercase tracking-widest text-agent-subtle">
          <span>{isSystem ? "系统" : "助手"}</span>
          <span>{formatShortTime(message.createdAt)}</span>
        </div>
        <div className={cn(
          "text-[14px] leading-relaxed whitespace-pre-wrap break-words",
          isSystem ? "text-agent-subtle italic" : "text-agent-text"
        )}>
          {message.content}
        </div>
      </div>
    </article>
  );
}
