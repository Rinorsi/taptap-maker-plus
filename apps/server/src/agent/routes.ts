import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildAgentContext } from "./contextBuilder.js";
import { probeAgentBrowserUrl } from "./browserProbe.js";
import { readAgentGitDiffSnapshot } from "./gitDiffSnapshot.js";
import {
  appendUserAgentMessage,
  createAgentSessionAction,
  decideAgentSessionActionPreview,
  executeAgentSessionAction,
  getAgentControlSurface,
  readAgentSession,
  readCompressedAgentContext,
  removeAgentSession,
  reviseAgentSession,
  startAgentSession
} from "./sessionStore.js";
import { runAgentTerminalSnapshot } from "./terminalSnapshot.js";

const agentContextQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  activeTab: z.enum(["status", "tools", "gameLogs", "logs", "errors"]).optional(),
  selectionType: z.enum(["project", "tool", "task", "asset"]).optional(),
  projectSelectionId: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  assetRelativePath: z.string().min(1).optional()
});

const agentModeSchema = z.enum(["observe", "draft", "execute"]);

const agentSessionCreateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  mode: agentModeSchema.default("observe"),
  projectId: z.string().min(1).optional()
});

const agentSessionUpdateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  mode: agentModeSchema.optional(),
  projectId: z.string().min(1).nullable().optional()
});

const agentMessageCreateSchema = z.object({
  content: z.string().min(1).max(20000),
  projectId: z.string().min(1).optional(),
  page: z.object({
    activeTab: z.enum(["status", "tools", "gameLogs", "logs", "errors"]).optional(),
    selection: z.union([
      z.object({ type: z.literal("project"), projectId: z.string().min(1) }),
      z.object({ type: z.literal("tool"), toolName: z.string().min(1) }),
      z.object({ type: z.literal("task"), taskId: z.string().min(1) }),
      z.object({ type: z.literal("asset"), relativePath: z.string().min(1) })
    ]).optional()
  }).optional()
});

const agentTerminalSnapshotSchema = z.object({
  commandId: z.enum(["workspace_status", "node_version", "npm_version", "git_status", "where_node_npm_npx", "npm_cache_config"]),
  projectId: z.string().min(1).optional()
});

const agentBrowserProbeSchema = z.object({
  url: z.string().url()
});

const agentGitDiffQuerySchema = z.object({
  scope: z.enum(["workspace", "project"]).optional(),
  projectId: z.string().min(1).optional()
});

const agentActionDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional()
});

const agentActionCreateSchema = z.object({
  actionKind: z.enum(["refresh_tools", "create_diagnostic_bundle", "mcp_package_status", "terminal_snapshot", "browser_probe"]),
  projectId: z.string().min(1).optional(),
  args: z.record(z.string(), z.unknown()).optional()
});

function pageStateFromQuery(query: z.infer<typeof agentContextQuerySchema>) {
  const page = {
    activeTab: query.activeTab,
    selection: undefined as ReturnType<typeof buildAgentContext>["page"]["selection"]
  };
  if (query.selectionType === "project" && query.projectSelectionId) {
    page.selection = { type: "project", projectId: query.projectSelectionId };
  }
  if (query.selectionType === "tool" && query.toolName) {
    page.selection = { type: "tool", toolName: query.toolName };
  }
  if (query.selectionType === "task" && query.taskId) {
    page.selection = { type: "task", taskId: query.taskId };
  }
  if (query.selectionType === "asset" && query.assetRelativePath) {
    page.selection = { type: "asset", relativePath: query.assetRelativePath };
  }
  return page;
}

export function registerAgentRoutes(app: FastifyInstance) {
  app.get<{ Querystring: unknown }>("/api/agent/context", async (request, reply) => {
    const parsed = agentContextQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return { context: buildAgentContext({ projectId: parsed.data.projectId, page: pageStateFromQuery(parsed.data) }) };
  });

  app.get("/api/agent/sessions", async () => getAgentControlSurface());

  app.post<{ Body: unknown }>("/api/agent/sessions", async (request, reply) => {
    const parsed = agentSessionCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    return startAgentSession(parsed.data);
  });

  app.get<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId", async (request, reply) => {
    const result = readAgentSession(request.params.sessionId);
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return result;
  });

  app.patch<{ Params: { sessionId: string }; Body: unknown }>("/api/agent/sessions/:sessionId", async (request, reply) => {
    const parsed = agentSessionUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = reviseAgentSession({ id: request.params.sessionId, ...parsed.data });
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return result;
  });

  app.delete<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId", async (request, reply) => {
    const session = removeAgentSession(request.params.sessionId);
    if (!session) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return { ok: true, session, ...getAgentControlSurface() };
  });

  app.get<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId/messages", async (request, reply) => {
    const result = readAgentSession(request.params.sessionId);
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return { messages: result.messages };
  });

  app.post<{ Params: { sessionId: string }; Body: unknown }>("/api/agent/sessions/:sessionId/messages", async (request, reply) => {
    const parsed = agentMessageCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await appendUserAgentMessage({
      sessionId: request.params.sessionId,
      content: parsed.data.content,
      projectId: parsed.data.projectId,
      page: parsed.data.page
    });
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    const session = readAgentSession(request.params.sessionId);
    return { ...result, session: session?.session, messages: session?.messages ?? [], pi: session?.pi };
  });

  app.get<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId/context-snapshots", async (request, reply) => {
    const result = readAgentSession(request.params.sessionId);
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return { contextSnapshots: result.contextSnapshots };
  });

  app.get<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId/action-previews", async (request, reply) => {
    const result = readAgentSession(request.params.sessionId);
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return { actionPreviews: result.actionPreviews };
  });

  app.post<{ Params: { sessionId: string }; Body: unknown }>("/api/agent/sessions/:sessionId/action-previews", async (request, reply) => {
    const parsed = agentActionCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = createAgentSessionAction({
      sessionId: request.params.sessionId,
      actionKind: parsed.data.actionKind,
      projectId: parsed.data.projectId,
      args: parsed.data.args
    });
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return result;
  });

  app.post<{ Params: { sessionId: string; previewId: string }; Body: unknown }>("/api/agent/sessions/:sessionId/action-previews/:previewId/decision", async (request, reply) => {
    const parsed = agentActionDecisionSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = decideAgentSessionActionPreview({
      sessionId: request.params.sessionId,
      previewId: request.params.previewId,
      decision: parsed.data.decision,
      reason: parsed.data.reason
    });
    if (!result) return reply.code(404).send({ error: `Agent action preview not found: ${request.params.previewId}` });
    return result;
  });

  app.post<{ Params: { sessionId: string; previewId: string } }>("/api/agent/sessions/:sessionId/action-previews/:previewId/execute", async (request, reply) => {
    try {
      const result = await executeAgentSessionAction({
        sessionId: request.params.sessionId,
        previewId: request.params.previewId
      });
      if (!result) return reply.code(404).send({ error: `Agent action preview not found: ${request.params.previewId}` });
      return result;
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Params: { sessionId: string } }>("/api/agent/sessions/:sessionId/compressed-context", async (request, reply) => {
    const result = readCompressedAgentContext(request.params.sessionId);
    if (!result) return reply.code(404).send({ error: `Agent session not found: ${request.params.sessionId}` });
    return result;
  });

  app.post<{ Body: unknown }>("/api/agent/terminal-snapshot", async (request, reply) => {
    const parsed = agentTerminalSnapshotSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return { snapshot: await runAgentTerminalSnapshot(parsed.data) };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Body: unknown }>("/api/agent/browser/probe", async (request, reply) => {
    const parsed = agentBrowserProbeSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return { probe: await probeAgentBrowserUrl(parsed.data.url) };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: unknown }>("/api/agent/git-diff", async (request, reply) => {
    const parsed = agentGitDiffQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      return { snapshot: await readAgentGitDiffSnapshot(parsed.data) };
    } catch (error) {
      return reply.code(500).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
