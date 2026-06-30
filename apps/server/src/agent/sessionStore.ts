import {
  addAgentMessage,
  archiveAgentSession,
  createAgentSession,
  decideAgentActionPreview,
  getAgentSession,
  listAgentActionPreviews,
  listAgentContextSnapshots,
  listAgentMessages,
  listAgentSessions,
  saveAgentContextSnapshot,
  updateAgentSession
} from "./sessionRepository.js";
import { createAgentSessionActionPreview, executeAgentSessionActionPreview, type AgentActionKind } from "./actionExecutor.js";
import { buildAgentContext, type BuildAgentContextInput } from "./contextBuilder.js";
import { compressAgentContext } from "./contextCompressor.js";
import { getPiAgentRuntimeStatus } from "./piRuntimeBridge.js";
import type { AgentMessageRecord, AgentMode, AgentPageState } from "../types.js";

const DEFAULT_ASSISTANT_REPLY = [
  "已收到。Pi Runtime Bridge 还未接入真实 Agent 后端，本阶段只会整理上下文并生成可审查的动作预览。",
  "工作区上下文已经刷新；涉及文件变更、命令执行或外部探测时，会先进入动作预览。"
].join("\n");

export function getAgentControlSurface() {
  const sessions = listAgentSessions();
  return {
    sessions,
    activeSession: sessions[0],
    messages: sessions[0] ? listAgentMessages(sessions[0].id) : [],
    contextSnapshots: sessions[0] ? listAgentContextSnapshots(sessions[0].id) : [],
    actionPreviews: sessions[0] ? listAgentActionPreviews(sessions[0].id) : [],
    pi: getPiAgentRuntimeStatus()
  };
}

export function startAgentSession(input: { title?: string; mode?: AgentMode; projectId?: string }) {
  const session = createAgentSession(input);
  addAgentMessage({
    sessionId: session.id,
    role: "system",
    content: "Agent 控制面已创建。当前阶段为 Phase 6 Stage 1：只读上下文、会话记录和动作预览，不自动执行。",
    metadata: { phase: "phase-6-stage-1" }
  });
  return {
    session,
    messages: listAgentMessages(session.id),
    contextSnapshots: listAgentContextSnapshots(session.id),
    actionPreviews: listAgentActionPreviews(session.id),
    pi: getPiAgentRuntimeStatus()
  };
}

export function readAgentSession(sessionId: string) {
  const session = getAgentSession(sessionId);
  if (!session) return undefined;
  return {
    session,
    messages: listAgentMessages(session.id),
    contextSnapshots: listAgentContextSnapshots(session.id),
    actionPreviews: listAgentActionPreviews(session.id),
    pi: getPiAgentRuntimeStatus()
  };
}

export function readCompressedAgentContext(sessionId: string) {
  const session = getAgentSession(sessionId);
  if (!session) return undefined;
  const snapshots = listAgentContextSnapshots(session.id);
  const context = snapshots[0]?.snapshot ?? buildAgentContext({ projectId: session.projectId });
  return {
    compressedContext: compressAgentContext(context, listAgentMessages(session.id)),
    sourceSnapshotId: snapshots[0]?.id
  };
}

export function reviseAgentSession(input: { id: string; title?: string; mode?: AgentMode; projectId?: string | null }) {
  const session = updateAgentSession(input);
  if (!session) return undefined;
  return readAgentSession(session.id);
}

export function removeAgentSession(sessionId: string) {
  return archiveAgentSession(sessionId);
}

export function decideAgentSessionActionPreview(input: {
  sessionId: string;
  previewId: string;
  decision: "approved" | "rejected";
  reason?: string;
}) {
  const preview = decideAgentActionPreview({
    id: input.previewId,
    decision: input.decision,
    reason: input.reason
  });
  if (!preview || preview.sessionId !== input.sessionId) return undefined;
  addAgentMessage({
    sessionId: input.sessionId,
    role: "system",
    content: input.decision === "approved"
      ? `动作预览已审批：${preview.title}。当前阶段只记录审批结果，不自动执行。`
      : `动作预览已拒绝：${preview.title}。`,
    metadata: {
      actionPreviewId: preview.id,
      decision: input.decision,
      reason: input.reason
    }
  });
  return readAgentSession(input.sessionId);
}

export function createAgentSessionAction(input: {
  sessionId: string;
  actionKind: AgentActionKind;
  projectId?: string;
  args?: Record<string, unknown>;
}) {
  const session = getAgentSession(input.sessionId);
  if (!session) return undefined;
  const preview = createAgentSessionActionPreview({
    sessionId: session.id,
    projectId: input.projectId ?? session.projectId,
    actionKind: input.actionKind,
    args: input.args
  });
  addAgentMessage({
    sessionId: session.id,
    role: "system",
    content: `已创建动作预览：${preview.title}。请先审批，审批后再手动执行。`,
    metadata: {
      actionPreviewId: preview.id,
      actionKind: preview.actionKind,
      requiresApprovalBeforeExecution: true
    }
  });
  return readAgentSession(session.id);
}

export async function executeAgentSessionAction(input: {
  sessionId: string;
  previewId: string;
}) {
  const result = await executeAgentSessionActionPreview(input);
  if (!result) return undefined;
  addAgentMessage({
    sessionId: input.sessionId,
    role: "system",
    content: `动作已执行：${result.preview.title}\n\n${result.outputText}`,
    metadata: {
      actionPreviewId: result.preview.id,
      actionKind: result.preview.actionKind,
      executed: true,
      result: result.data
    }
  });
  return readAgentSession(input.sessionId);
}

export async function appendUserAgentMessage(input: {
  sessionId: string;
  content: string;
  projectId?: string;
  page?: AgentPageState;
  contextInput?: BuildAgentContextInput;
}): Promise<{ userMessage: AgentMessageRecord; assistantMessage: AgentMessageRecord; contextSnapshotId: string } | undefined> {
  const session = getAgentSession(input.sessionId);
  if (!session) return undefined;

  const snapshot = buildAgentContext({
    projectId: input.contextInput?.projectId ?? input.projectId ?? session.projectId,
    page: input.contextInput?.page ?? input.page ?? {}
  });
  const contextRecord = saveAgentContextSnapshot({
    sessionId: session.id,
    projectId: snapshot.project?.id ?? input.projectId ?? session.projectId,
    snapshot
  });
  const userMessage = addAgentMessage({
    sessionId: session.id,
    role: "user",
    content: input.content,
    contextSnapshotId: contextRecord.id,
    metadata: {
      mode: session.mode,
      projectId: snapshot.project?.id ?? input.projectId ?? session.projectId,
      counts: snapshot.counts
    }
  });
  const piStatus = getPiAgentRuntimeStatus();
  const assistantMessage = addAgentMessage({
    sessionId: session.id,
    role: "assistant",
    content: DEFAULT_ASSISTANT_REPLY,
    contextSnapshotId: contextRecord.id,
    metadata: {
      runtime: "pi-not-connected",
      requiresApprovalBeforeExecution: true,
      pi: piStatus
    }
  });
  return { userMessage, assistantMessage, contextSnapshotId: contextRecord.id };
}
