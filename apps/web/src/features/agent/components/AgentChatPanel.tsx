import type { AgentActionPreviewRecord, AgentMessageRecord, AgentPageState, AgentSessionRecord } from "../api";
import type { AgentWorkspaceTab } from "../types";
import { AssistantUiChatSurface } from "./AssistantUiChatSurface";

export function AgentChatPanel({
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
  activeRunCount,
  error,
  showWelcome,
  onOpenWorkspaceTab,
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
  error: string;
  showWelcome: boolean;
  onOpenWorkspaceTab: (tab: AgentWorkspaceTab) => void;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-transparent relative">
      <div className="min-h-0 flex-1 overflow-hidden relative">
        <AssistantUiChatSurface
          activeSession={activeSession}
          messages={messages}
          projectId={projectId}
          page={page}
          onSynced={onSynced}
          onSendMessage={onSendMessage}
          activeRunCount={activeRunCount}
          pendingPreviewCount={pendingPreviewCount}
          error={error}
          showWelcome={showWelcome}
          onOpenWorkspaceTab={onOpenWorkspaceTab}
        />
      </div>
    </aside>
  );
}
