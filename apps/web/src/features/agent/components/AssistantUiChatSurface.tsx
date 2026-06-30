import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  type ThreadMessage,
  type ThreadMessageLike,
  useLocalRuntime
} from "@assistant-ui/react";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { AgentMessageRecord, AgentPageState, AgentSessionRecord } from "../api";
import { sendAgentMessage } from "../api";
import { Thread } from "../assistant-ui/Thread";

export function AssistantUiChatSurface({
  activeSession,
  messages,
  projectId,
  page,
  onSynced,
  runStatusBar
}: {
  activeSession: AgentSessionRecord;
  messages: AgentMessageRecord[];
  projectId?: string;
  page: AgentPageState;
  onSynced: () => void;
  runStatusBar?: ReactNode;
}) {
  const initialMessages = useMemo(() => toAssistantUiMessages(messages), [messages]);
  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run(options) {
      const latestUserText = readLatestUserText(options.messages);
      if (!latestUserText) {
        yield { content: [{ type: "text", text: "没有读取到用户输入。" }] };
        return;
      }
      const result = await sendAgentMessage(activeSession.id, {
        content: latestUserText,
        projectId,
        page
      });
      await onSynced();
      yield { content: [{ type: "text", text: result.assistantMessage.content || "Agent 未返回内容。" }] };
    }
  }), [activeSession.id, onSynced, page, projectId]);
  const runtime = useLocalRuntime(adapter, {
    initialMessages,
    unstable_enableMessageQueue: true
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread runStatusBar={runStatusBar} />
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
