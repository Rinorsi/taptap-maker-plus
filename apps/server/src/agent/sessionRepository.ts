import { randomUUID } from "node:crypto";
import { parseJson, sqlite } from "../lib/db.js";
import type {
  AgentActionPreviewRecord,
  AgentContextSnapshot,
  AgentContextSnapshotRecord,
  AgentMessageRecord,
  AgentMessageRole,
  AgentMode,
  AgentSessionRecord
} from "../types.js";

const toAgentSession = (row: any): AgentSessionRecord => ({
  id: row.id,
  title: row.title,
  mode: row.mode,
  projectId: row.project_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at ?? undefined
});

const toAgentMessage = (row: any): AgentMessageRecord => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: normalizeAgentMessageContent(row.content),
  createdAt: row.created_at,
  contextSnapshotId: row.context_snapshot_id ?? undefined,
  metadata: parseJson<Record<string, unknown>>(row.metadata_json, {})
});

function normalizeAgentMessageContent(content: string) {
  if (!content.includes("TAPTAP_AGENT_MODEL_")) return content;
  return [
    "Pi Runtime Bridge 尚未接入真实 Agent 后端。",
    "当前页面只会刷新上下文、记录会话和生成动作预览；后续将通过 Pi SDK embedding 优先接入，RPC sidecar 作为 fallback。"
  ].join("\n");
}

const emptyAgentContextSnapshot = (createdAt: string): AgentContextSnapshot => ({
  generatedAt: createdAt,
  page: {},
  projects: [],
  tools: [],
  tasks: [],
  generations: [],
  assets: [],
  workflows: [],
  workflowRuns: [],
  credits: [],
  counts: {
    projects: 0,
    tools: 0,
    tasks: 0,
    generations: 0,
    assets: 0,
    workflows: 0,
    workflowRuns: 0,
    credits: 0,
    buildLogs: 0
  }
});

const toAgentContextSnapshot = (row: any): AgentContextSnapshotRecord => ({
  id: row.id,
  sessionId: row.session_id,
  projectId: row.project_id ?? undefined,
  snapshot: parseJson<AgentContextSnapshot>(row.snapshot_json, emptyAgentContextSnapshot(row.created_at)),
  createdAt: row.created_at
});

const toAgentActionPreview = (row: any): AgentActionPreviewRecord => ({
  id: row.id,
  sessionId: row.session_id,
  projectId: row.project_id ?? undefined,
  status: row.status,
  actionKind: row.action_kind,
  toolName: row.tool_name ?? undefined,
  title: row.title,
  summary: row.summary,
  args: parseJson<Record<string, unknown>>(row.args_json, {}),
  affectedPaths: parseJson<string[]>(row.affected_paths_json, []),
  riskLevel: row.risk_level,
  expectedCostText: row.expected_cost_text ?? undefined,
  expectedDurationText: row.expected_duration_text ?? undefined,
  createdAt: row.created_at,
  decidedAt: row.decided_at ?? undefined,
  decision: row.decision ?? undefined,
  decisionReason: row.decision_reason ?? undefined,
  raw: parseJson<Record<string, unknown>>(row.raw_json, {})
});

export function createAgentSession(input: { title?: string; mode?: AgentMode; projectId?: string }): AgentSessionRecord {
  const now = new Date().toISOString();
  const title = input.title?.trim() || "新助手会话";
  const record: AgentSessionRecord = {
    id: randomUUID(),
    title,
    mode: input.mode ?? "observe",
    projectId: input.projectId,
    createdAt: now,
    updatedAt: now
  };
  sqlite.prepare(`
    INSERT INTO agent_sessions (id, title, mode, project_id, created_at, updated_at, archived_at)
    VALUES (@id, @title, @mode, @projectId, @createdAt, @updatedAt, NULL)
  `).run({ ...record, projectId: record.projectId ?? null });
  return record;
}

export function listAgentSessions(limit = 40): AgentSessionRecord[] {
  return sqlite.prepare(`
    SELECT * FROM agent_sessions
    WHERE archived_at IS NULL
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(limit).map(toAgentSession);
}

export function getAgentSession(sessionId: string): AgentSessionRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM agent_sessions WHERE id = ? AND archived_at IS NULL").get(sessionId);
  return row ? toAgentSession(row) : undefined;
}

export function updateAgentSession(input: { id: string; title?: string; mode?: AgentMode; projectId?: string | null }): AgentSessionRecord | undefined {
  const existing = getAgentSession(input.id);
  if (!existing) return undefined;
  const next = {
    id: input.id,
    title: input.title?.trim() || existing.title,
    mode: input.mode ?? existing.mode,
    projectId: input.projectId === undefined ? existing.projectId : input.projectId ?? undefined,
    updatedAt: new Date().toISOString()
  };
  sqlite.prepare(`
    UPDATE agent_sessions
    SET title = @title, mode = @mode, project_id = @projectId, updated_at = @updatedAt
    WHERE id = @id
  `).run({ ...next, projectId: next.projectId ?? null });
  return getAgentSession(input.id);
}

export function archiveAgentSession(sessionId: string): AgentSessionRecord | undefined {
  const now = new Date().toISOString();
  sqlite.prepare("UPDATE agent_sessions SET archived_at = ?, updated_at = ? WHERE id = ?").run(now, now, sessionId);
  const row = sqlite.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(sessionId);
  return row ? toAgentSession(row) : undefined;
}

export function addAgentMessage(input: {
  sessionId: string;
  role: AgentMessageRole;
  content: string;
  contextSnapshotId?: string;
  metadata?: Record<string, unknown>;
}): AgentMessageRecord {
  const now = new Date().toISOString();
  const record: AgentMessageRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    createdAt: now,
    contextSnapshotId: input.contextSnapshotId,
    metadata: input.metadata ?? {}
  };
  sqlite.prepare(`
    INSERT INTO agent_messages (id, session_id, role, content, created_at, context_snapshot_id, metadata_json)
    VALUES (@id, @sessionId, @role, @content, @createdAt, @contextSnapshotId, @metadataJson)
  `).run({
    ...record,
    contextSnapshotId: record.contextSnapshotId ?? null,
    metadataJson: JSON.stringify(record.metadata, null, 2)
  });
  sqlite.prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?").run(now, input.sessionId);
  return record;
}

export function listAgentMessages(sessionId: string, limit = 200): AgentMessageRecord[] {
  return sqlite.prepare(`
    SELECT * FROM agent_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(sessionId, limit).map(toAgentMessage);
}

export function saveAgentContextSnapshot(input: { sessionId: string; projectId?: string; snapshot: AgentContextSnapshot }): AgentContextSnapshotRecord {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    sessionId: input.sessionId,
    projectId: input.projectId,
    snapshotJson: JSON.stringify(input.snapshot, null, 2),
    createdAt: now
  };
  sqlite.prepare(`
    INSERT INTO agent_context_snapshots (id, session_id, project_id, snapshot_json, created_at)
    VALUES (@id, @sessionId, @projectId, @snapshotJson, @createdAt)
  `).run({ ...record, projectId: record.projectId ?? null });
  sqlite.prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?").run(now, input.sessionId);
  return getAgentContextSnapshot(record.id)!;
}

export function getAgentContextSnapshot(snapshotId: string): AgentContextSnapshotRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM agent_context_snapshots WHERE id = ?").get(snapshotId);
  return row ? toAgentContextSnapshot(row) : undefined;
}

export function listAgentContextSnapshots(sessionId: string, limit = 20): AgentContextSnapshotRecord[] {
  return sqlite.prepare(`
    SELECT * FROM agent_context_snapshots
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(sessionId, limit).map(toAgentContextSnapshot);
}

export function listAgentActionPreviews(sessionId: string, status?: AgentActionPreviewRecord["status"], limit = 80): AgentActionPreviewRecord[] {
  const sql = status
    ? "SELECT * FROM agent_action_previews WHERE session_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?"
    : "SELECT * FROM agent_action_previews WHERE session_id = ? ORDER BY created_at DESC LIMIT ?";
  const rows = status
    ? sqlite.prepare(sql).all(sessionId, status, limit)
    : sqlite.prepare(sql).all(sessionId, limit);
  return rows.map(toAgentActionPreview);
}

export function createAgentActionPreview(input: {
  sessionId: string;
  projectId?: string;
  actionKind: string;
  toolName?: string;
  title: string;
  summary: string;
  args?: Record<string, unknown>;
  affectedPaths?: string[];
  riskLevel?: AgentActionPreviewRecord["riskLevel"];
  expectedCostText?: string;
  expectedDurationText?: string;
  raw?: Record<string, unknown>;
}): AgentActionPreviewRecord {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    sessionId: input.sessionId,
    projectId: input.projectId,
    status: "pending",
    actionKind: input.actionKind,
    toolName: input.toolName,
    title: input.title,
    summary: input.summary,
    argsJson: JSON.stringify(input.args ?? {}, null, 2),
    affectedPathsJson: JSON.stringify(input.affectedPaths ?? [], null, 2),
    riskLevel: input.riskLevel ?? "medium",
    expectedCostText: input.expectedCostText,
    expectedDurationText: input.expectedDurationText,
    createdAt: now,
    rawJson: JSON.stringify(input.raw ?? {}, null, 2)
  };
  sqlite.prepare(`
    INSERT INTO agent_action_previews (
      id, session_id, project_id, status, action_kind, tool_name, title, summary,
      args_json, affected_paths_json, risk_level, expected_cost_text, expected_duration_text,
      created_at, raw_json
    )
    VALUES (
      @id, @sessionId, @projectId, @status, @actionKind, @toolName, @title, @summary,
      @argsJson, @affectedPathsJson, @riskLevel, @expectedCostText, @expectedDurationText,
      @createdAt, @rawJson
    )
  `).run({
    ...record,
    projectId: record.projectId ?? null,
    toolName: record.toolName ?? null,
    expectedCostText: record.expectedCostText ?? null,
    expectedDurationText: record.expectedDurationText ?? null
  });
  sqlite.prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?").run(now, input.sessionId);
  return getAgentActionPreview(record.id)!;
}

export function getAgentActionPreview(previewId: string): AgentActionPreviewRecord | undefined {
  const row = sqlite.prepare("SELECT * FROM agent_action_previews WHERE id = ?").get(previewId);
  return row ? toAgentActionPreview(row) : undefined;
}

export function decideAgentActionPreview(input: {
  id: string;
  decision: "approved" | "rejected";
  reason?: string;
}): AgentActionPreviewRecord | undefined {
  const now = new Date().toISOString();
  sqlite.prepare(`
    UPDATE agent_action_previews
    SET status = ?, decision = ?, decision_reason = ?, decided_at = ?
    WHERE id = ?
  `).run(input.decision, input.decision, input.reason ?? null, now, input.id);
  const preview = getAgentActionPreview(input.id);
  if (preview) sqlite.prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?").run(now, preview.sessionId);
  return preview;
}

export function updateAgentActionPreviewStatus(input: {
  id: string;
  status: AgentActionPreviewRecord["status"];
  raw?: Record<string, unknown>;
}): AgentActionPreviewRecord | undefined {
  const now = new Date().toISOString();
  const current = getAgentActionPreview(input.id);
  if (!current) return undefined;
  const raw = input.raw ? { ...current.raw, ...input.raw } : current.raw;
  sqlite.prepare(`
    UPDATE agent_action_previews
    SET status = ?, raw_json = ?
    WHERE id = ?
  `).run(input.status, JSON.stringify(raw, null, 2), input.id);
  sqlite.prepare("UPDATE agent_sessions SET updated_at = ? WHERE id = ?").run(now, current.sessionId);
  return getAgentActionPreview(input.id);
}
