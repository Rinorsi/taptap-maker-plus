import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
  useLocalRuntime
} from "@assistant-ui/react";
import { useMemo } from "react";
import type { AgentMessageRecord, AgentPageState, AgentSessionRecord } from "../api";
import type { AgentWorkspaceTab } from "../types";
import { Thread } from "../assistant-ui/Thread";

export function AssistantUiChatSurface({
  activeSession,
  messages,
  projectId,
  page,
  onSynced,
  onSendMessage,
  activeRunCount,
  pendingPreviewCount,
  error,
  showWelcome,
  onOpenWorkspaceTab,
}: {
  activeSession?: AgentSessionRecord;
  messages: AgentMessageRecord[];
  projectId?: string;
  page: AgentPageState;
  onSynced: () => void;
  onSendMessage: (content: string) => Promise<void>;
  activeRunCount: number;
  pendingPreviewCount: number;
  error: string;
  showWelcome: boolean;
  onOpenWorkspaceTab: (tab: AgentWorkspaceTab) => void;
}) {
  const initialMessages = useMemo(() => toAssistantUiMessages(messages), [messages]);
  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run(options) {
      const latestUserText = readLatestUserText(options.messages);
      if (!latestUserText) {
        yield { content: [{ type: "text", text: "没有读取到用户输入。" }] };
        return;
      }
      
      try {
        await onSendMessage(latestUserText);
      } catch (e) {
        yield { content: [{ type: "text", text: `发送失败: ${e instanceof Error ? e.message : String(e)}` }] };
        return;
      }
      
      await onSynced();
      // the actual response will be populated when onSynced updates the messages state
      // but we need to yield something to finish the run, assistant-ui handles external state updates gracefully
    }
  }), [onSendMessage, onSynced]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages,
    unstable_enableMessageQueue: true
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        activeRunCount={activeRunCount}
        pendingPreviewCount={pendingPreviewCount}
        error={error}
        showWelcome={showWelcome}
        onOpenWorkspaceTab={onOpenWorkspaceTab}
      />
    </AssistantRuntimeProvider>
  );
}

function toAssistantUiMessages(messages: AgentMessageRecord[]): ThreadMessageLike[] {
  const result: ThreadMessageLike[] = [];
  const filtered = messages.filter((message) => message.role !== "system");
  for (let i = 0; i < filtered.length; i++) {
    const message = filtered[i];
    const prevMessage = result[result.length - 1];
    const prevContent = prevMessage?.content;
    const prevText = Array.isArray(prevContent) && prevContent.length > 0 && typeof prevContent[0] === "object" && "type" in prevContent[0] && prevContent[0].type === "text" ? prevContent[0].text : null;
    if (
      message.role === "assistant" &&
      prevMessage?.role === "assistant" &&
      prevText === message.content
    ) {
      continue;
    }
    result.push({
      role: message.role,
      content: [{ type: "text", text: message.content }]
    });
  }
  return result;
}

function readLatestUserText(messages: readonly ThreadMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user") continue;
    return message.content
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("\n")
      .trim();
  }
  return "";
}
