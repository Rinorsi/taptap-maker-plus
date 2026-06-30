import { useEffect, useMemo, useState } from "react";
import {
  archiveAgentSession,
  createAgentSession,
  createAgentActionPreview,
  decideAgentActionPreview,
  executeAgentActionPreview,
  getAgentCompressedContext,
  getAgentContext,
  getAgentSession,
  listAgentSessions,
  sendAgentMessage,
  updateAgentSession,
  type AgentActionPreviewRecord,
  type AgentActionKind,
  type AgentContextSnapshot,
  type AgentContextSnapshotRecord,
  type AgentMessageRecord,
  type AgentMode,
  type AgentSessionRecord,
  type CompressedAgentContext,
  type PiAgentRuntimeStatus
} from "../api";
import { getDesktopReadiness, type DesktopReadiness } from "../../../api";
import { buildContextRows } from "../utils";
import type { AgentWorkspaceActions, AgentWorkspaceProps, AgentWorkspaceState, AgentWorkspaceViewModel } from "../types";

export function useAgentWorkspace({ project, page }: AgentWorkspaceProps): AgentWorkspaceState & AgentWorkspaceActions & { viewModel: AgentWorkspaceViewModel } {
  const [context, setContext] = useState<AgentContextSnapshot>();
  const [readiness, setReadiness] = useState<DesktopReadiness>();
  const [sessions, setSessions] = useState<AgentSessionRecord[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSessionRecord>();
  const [messages, setMessages] = useState<AgentMessageRecord[]>([]);
  const [contextSnapshots, setContextSnapshots] = useState<AgentContextSnapshotRecord[]>([]);
  const [actionPreviews, setActionPreviews] = useState<AgentActionPreviewRecord[]>([]);
  const [compressedContext, setCompressedContext] = useState<CompressedAgentContext>();
  const [compressedContextSnapshotId, setCompressedContextSnapshotId] = useState<string>();
  const [pi, setPi] = useState<PiAgentRuntimeStatus>();
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshWorkspace();
  }, [project?.id, page.activeTab, page.selection]);

  async function refreshWorkspace(sessionId = activeSession?.id) {
    setLoading(true);
    setError("");
    try {
      const [nextContext, nextReadiness, surface] = await Promise.all([
        getAgentContext(project?.id, page),
        getDesktopReadiness().catch(() => undefined),
        listAgentSessions()
      ]);
      setContext(nextContext);
      setReadiness(nextReadiness);
      setPi(surface.pi);
      setSessions(surface.sessions);
      const nextSession = sessionId
        ? surface.sessions.find((item) => item.id === sessionId) ?? surface.activeSession
        : surface.activeSession;
      if (nextSession) {
        await loadSession(nextSession.id, false);
      } else {
        clearSessionDetail();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function loadSession(sessionId: string, withSpinner = true) {
    if (withSpinner) {
      setLoading(true);
      setError("");
    }
    try {
      const detail = await getAgentSession(sessionId);
      setActiveSession(detail.session);
      setMessages(detail.messages);
      setContextSnapshots(detail.contextSnapshots);
      setActionPreviews(detail.actionPreviews);
      setPi(detail.pi);
      const compressed = await getAgentCompressedContext(sessionId);
      setCompressedContext(compressed.compressedContext);
      setCompressedContextSnapshotId(compressed.sourceSnapshotId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (withSpinner) setLoading(false);
    }
  }

  function clearSessionDetail() {
    setActiveSession(undefined);
    setMessages([]);
    setContextSnapshots([]);
    setActionPreviews([]);
    setCompressedContext(undefined);
    setCompressedContextSnapshotId(undefined);
  }

  async function createSession() {
    setLoading(true);
    setError("");
    try {
      const created = await createAgentSession({
        title: project?.name ? `${project.name} Agent 会话` : "新 Agent 会话",
        projectId: project?.id
      });
      setPi(created.pi);
      await refreshWorkspace(created.session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function changeMode(mode: AgentMode) {
    if (!activeSession) return;
    setError("");
    try {
      const detail = await updateAgentSession(activeSession.id, { mode });
      setActiveSession(detail.session);
      setMessages(detail.messages);
      setContextSnapshots(detail.contextSnapshots);
      setActionPreviews(detail.actionPreviews);
      setPi(detail.pi);
      const compressed = await getAgentCompressedContext(activeSession.id);
      setCompressedContext(compressed.compressedContext);
      setCompressedContextSnapshotId(compressed.sourceSnapshotId);
      setSessions((items) => items.map((item) => item.id === detail.session.id ? detail.session : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function renameSession(sessionId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setError("");
    try {
      const detail = await updateAgentSession(sessionId, { title: nextTitle });
      setActiveSession((current) => current?.id === detail.session.id ? detail.session : current);
      setSessions((items) => items.map((item) => item.id === detail.session.id ? detail.session : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function archiveSession(sessionId = activeSession?.id) {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const result = await archiveAgentSession(sessionId);
      setSessions(result.sessions);
      setPi(result.pi);
      if (activeSession?.id === sessionId && result.activeSession) {
        await loadSession(result.activeSession.id, false);
      } else if (activeSession?.id === sessionId) {
        clearSessionDetail();
      } else {
        setSessions(result.sessions);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!activeSession || !draft.trim()) return;
    const content = draft.trim();
    setDraft("");
    setSending(true);
    setError("");
    try {
      const result = await sendAgentMessage(activeSession.id, { content, projectId: project?.id, page });
      if (result.session) setActiveSession(result.session);
      setMessages(result.messages);
      setPi(result.pi);
      const detail = await getAgentSession(activeSession.id);
      setContextSnapshots(detail.contextSnapshots);
      setActionPreviews(detail.actionPreviews);
      setPi(detail.pi);
      setSessions((items) => items.map((item) => item.id === (result.session?.id ?? activeSession.id) ? (result.session ?? item) : item));
      setContext(await getAgentContext(project?.id, page));
      const compressed = await getAgentCompressedContext(activeSession.id);
      setCompressedContext(compressed.compressedContext);
      setCompressedContextSnapshotId(compressed.sourceSnapshotId);
    } catch (caught) {
      setDraft(content);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSending(false);
    }
  }

  async function decideActionPreview(previewId: string, decision: "approved" | "rejected") {
    if (!activeSession) return;
    setError("");
    try {
      const detail = await decideAgentActionPreview(activeSession.id, previewId, { decision });
      setActiveSession(detail.session);
      setMessages(detail.messages);
      setContextSnapshots(detail.contextSnapshots);
      setActionPreviews(detail.actionPreviews);
      setPi(detail.pi);
      setSessions((items) => items.map((item) => item.id === detail.session.id ? detail.session : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function createActionPreview(input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) {
    if (!activeSession) return;
    setError("");
    try {
      const detail = await createAgentActionPreview(activeSession.id, input);
      applySessionDetail(detail);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function executeActionPreview(previewId: string) {
    if (!activeSession) return;
    setError("");
    try {
      const detail = await executeAgentActionPreview(activeSession.id, previewId);
      applySessionDetail(detail);
      setContext(await getAgentContext(project?.id, page));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function applySessionDetail(detail: {
    session: AgentSessionRecord;
    messages: AgentMessageRecord[];
    contextSnapshots: AgentContextSnapshotRecord[];
    actionPreviews: AgentActionPreviewRecord[];
    pi?: PiAgentRuntimeStatus;
  }) {
    setActiveSession(detail.session);
    setMessages(detail.messages);
    setContextSnapshots(detail.contextSnapshots);
    setActionPreviews(detail.actionPreviews);
    setPi(detail.pi);
    setSessions((items) => items.map((item) => item.id === detail.session.id ? detail.session : item));
  }

  const viewModel = useMemo<AgentWorkspaceViewModel>(() => {
    const selectedProject = context?.project ?? project;
    return {
      selectedProject,
      runtimeStatus: context?.runtime?.status ?? project?.runtime?.status ?? "idle",
      latestSnapshot: contextSnapshots[0],
      pendingPreviews: actionPreviews.filter((preview) => preview.status === "pending"),
      contextRows: buildContextRows(context)
    };
  }, [actionPreviews, context, contextSnapshots, project]);

  return {
    context,
    readiness,
    sessions,
    activeSession,
    messages,
    contextSnapshots,
    actionPreviews,
    compressedContext,
    compressedContextSnapshotId,
    pi,
    draft,
    loading,
    sending,
    error,
    setDraft,
    refreshWorkspace,
    loadSession,
    createSession,
    renameSession,
    archiveSession,
    sendMessage,
    changeMode,
    decideActionPreview,
    createActionPreview,
    executeActionPreview,
    viewModel
  };
}
