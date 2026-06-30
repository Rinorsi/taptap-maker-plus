import { apiFetch, json } from "../../api";
import type {
  AgentActionKind,
  AgentBrowserProbeResult,
  AgentControlSurfaceResponse,
  AgentContextSnapshot,
  AgentGitDiffScope,
  AgentGitDiffSnapshot,
  AgentMode,
  AgentPageState,
  AgentSessionRecord,
  AgentTerminalSnapshot,
  AgentTerminalSnapshotCommandId,
  CompressedAgentContext,
  PiAgentRuntimeStatus,
  AgentMessageRecord
} from "./contracts";

export type {
  AgentActionKind,
  AgentActionPreviewRecord,
  AgentBrowserProbeResult,
  AgentContextSnapshot,
  AgentContextSnapshotRecord,
  AgentMessageRecord,
  AgentGitDiffSnapshot,
  AgentGitDiffScope,
  AgentMode,
  AgentPageState,
  AgentRightPanelTab,
  AgentSelectionReference,
  AgentSessionRecord,
  AgentTerminalSnapshot,
  AgentTerminalSnapshotCommandId,
  CompressedAgentContext,
  PiAgentRuntimeStatus
} from "./contracts";

type AgentSessionDetailResponse = Omit<AgentControlSurfaceResponse, "sessions" | "activeSession"> & { session: AgentSessionRecord };

export async function getAgentContext(projectId?: string, page?: AgentPageState): Promise<AgentContextSnapshot> {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (page?.activeTab) params.set("activeTab", page.activeTab);
  if (page?.selection) {
    params.set("selectionType", page.selection.type);
    if (page.selection.type === "project") params.set("projectSelectionId", page.selection.projectId);
    if (page.selection.type === "tool") params.set("toolName", page.selection.toolName);
    if (page.selection.type === "task") params.set("taskId", page.selection.taskId);
    if (page.selection.type === "asset") params.set("assetRelativePath", page.selection.relativePath);
  }
  const query = params.toString();
  const data = await json<{ context: AgentContextSnapshot }>(await apiFetch(`/api/agent/context${query ? `?${query}` : ""}`));
  return data.context;
}

export async function listAgentSessions(): Promise<AgentControlSurfaceResponse> {
  return json<AgentControlSurfaceResponse>(await apiFetch("/api/agent/sessions"));
}

export async function createAgentSession(input: { title?: string; mode?: AgentMode; projectId?: string }): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch("/api/agent/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function getAgentSession(sessionId: string): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`)
  );
}

export async function updateAgentSession(sessionId: string, input: { title?: string; mode?: AgentMode; projectId?: string | null }): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function archiveAgentSession(sessionId: string): Promise<{ ok: true } & AgentControlSurfaceResponse> {
  return json<{ ok: true } & AgentControlSurfaceResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" })
  );
}

export async function sendAgentMessage(
  sessionId: string,
  input: { content: string; projectId?: string; page?: AgentPageState }
): Promise<{ userMessage: AgentMessageRecord; assistantMessage: AgentMessageRecord; contextSnapshotId: string; session?: AgentSessionRecord; messages: AgentMessageRecord[]; pi?: PiAgentRuntimeStatus }> {
  return json<{ userMessage: AgentMessageRecord; assistantMessage: AgentMessageRecord; contextSnapshotId: string; session?: AgentSessionRecord; messages: AgentMessageRecord[]; pi?: PiAgentRuntimeStatus }>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function getAgentCompressedContext(sessionId: string): Promise<{ compressedContext: CompressedAgentContext; sourceSnapshotId?: string }> {
  return json<{ compressedContext: CompressedAgentContext; sourceSnapshotId?: string }>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/compressed-context`)
  );
}

export async function decideAgentActionPreview(
  sessionId: string,
  previewId: string,
  input: { decision: "approved" | "rejected"; reason?: string }
): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/action-previews/${encodeURIComponent(previewId)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function createAgentActionPreview(
  sessionId: string,
  input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }
): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/action-previews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function executeAgentActionPreview(
  sessionId: string,
  previewId: string
): Promise<AgentSessionDetailResponse> {
  return json<AgentSessionDetailResponse>(
    await apiFetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/action-previews/${encodeURIComponent(previewId)}/execute`, {
      method: "POST"
    })
  );
}

export async function probeAgentBrowserUrl(url: string): Promise<AgentBrowserProbeResult> {
  const data = await json<{ probe: AgentBrowserProbeResult }>(
    await apiFetch("/api/agent/browser/probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    })
  );
  return data.probe;
}

export async function runAgentTerminalSnapshot(input: { commandId: AgentTerminalSnapshotCommandId; projectId?: string }): Promise<AgentTerminalSnapshot> {
  const data = await json<{ snapshot: AgentTerminalSnapshot }>(
    await apiFetch("/api/agent/terminal-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
  return data.snapshot;
}

export async function getAgentGitDiffSnapshot(input: { scope?: AgentGitDiffScope; projectId?: string } = {}): Promise<AgentGitDiffSnapshot> {
  const params = new URLSearchParams();
  if (input.scope) params.set("scope", input.scope);
  if (input.projectId) params.set("projectId", input.projectId);
  const query = params.toString();
  const data = await json<{ snapshot: AgentGitDiffSnapshot }>(
    await apiFetch(`/api/agent/git-diff${query ? `?${query}` : ""}`)
  );
  return data.snapshot;
}
