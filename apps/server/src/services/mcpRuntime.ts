import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "../lib/config.js";
import { getToolsListSnapshot, saveTools } from "../lib/db.js";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../types.js";

type ToolLike = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
};

function buildMcpEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.TAPTAP_MCP_ENV = config.makerEnv;
  return env;
}

function asSchema(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return { type: "object", properties: {} };
}

function normalizeTool(tool: ToolLike): ToolSummary {
  const name = typeof tool.name === "string" ? tool.name : String(tool.name ?? "unknown_tool");
  const inputSchema = asSchema(tool.inputSchema);
  const required = Array.isArray(inputSchema.required) ? inputSchema.required.map(String) : [];
  return {
    name,
    description: typeof tool.description === "string" ? tool.description : undefined,
    category: categorizeTool(name),
    required,
    inputSchema
  };
}

export function categorizeTool(name: string): ToolSummary["category"] {
  if (name === "maker_status_lite") return "status";
  if (name === "maker_build_current_directory" || name.includes("build")) return "build";
  if (name.includes("image")) return "image";
  if (name.includes("video")) return "video";
  if (name.includes("music") || name.includes("audio")) return "music";
  if (name.includes("3d_model") || name.includes("model")) return "model3d";
  return "other";
}

class SdkMcpClient {
  private client?: Client;
  private transport?: StdioClientTransport;
  private stderrBuffer = "";
  private closing = false;

  constructor(private readonly project: ProjectSummary) {}

  get processId() {
    return this.transport?.pid ?? undefined;
  }

  get stderr() {
    return this.stderrBuffer;
  }

  async connect() {
    if (this.client) return;
    this.closing = false;
    const client = new Client({ name: "taptap-maker-plus", version: "0.1.0" }, { capabilities: {} });
    const transport = new StdioClientTransport({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd", "-y", "-p", config.makerPackage, "taptap-maker"],
      cwd: this.project.rootPath,
      env: buildMcpEnv(),
      stderr: "pipe"
    });

    transport.stderr?.on("data", (chunk: Buffer | string) => {
      this.stderrBuffer += chunk.toString();
    });

    this.client = client;
    this.transport = transport;
    await client.connect(transport, { timeout: 30_000 });
  }

  async listTools(): Promise<{ raw: unknown; tools: ToolSummary[] }> {
    if (!this.client) await this.connect();
    const raw = await this.client!.listTools(undefined, { timeout: 30_000 });
    const rawTools = Array.isArray(raw.tools) ? raw.tools : [];
    return { raw, tools: rawTools.map((tool) => normalizeTool(tool as ToolLike)) };
  }

  async callTool(name: string, args: unknown) {
    if (!this.client) await this.connect();
    const argumentsObject = args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
    return this.client!.callTool({ name, arguments: argumentsObject }, undefined, {
      timeout: 60 * 60 * 1000,
      resetTimeoutOnProgress: true,
      maxTotalTimeout: 2 * 60 * 60 * 1000
    });
  }

  async close() {
    this.closing = true;
    await this.client?.close().catch(() => undefined);
    this.client = undefined;
    this.transport = undefined;
  }

  isClosing() {
    return this.closing;
  }
}

class McpRuntimeManager {
  private clients = new Map<string, SdkMcpClient>();
  private statuses = new Map<string, RuntimeSummary>();

  getSummary(projectId: string): RuntimeSummary | undefined {
    const current = this.statuses.get(projectId);
    if (!current) return undefined;
    const snapshot = getToolsListSnapshot(projectId);
    return snapshot ? { ...current, toolsListUpdatedAt: snapshot.updatedAt } : current;
  }

  listSummaries(): RuntimeSummary[] {
    return Array.from(this.statuses.values());
  }

  async start(project: ProjectSummary): Promise<RuntimeSummary> {
    const existing = this.statuses.get(project.id);
    if (existing?.status === "ready") return this.getSummary(project.id)!;

    await this.clients.get(project.id)?.close();
    this.clients.delete(project.id);

    const startedAt = new Date().toISOString();
    this.statuses.set(project.id, { projectId: project.id, status: "starting", toolCount: 0, startedAt, cwd: project.rootPath });

    const client = new SdkMcpClient(project);
    this.clients.set(project.id, client);

    try {
      await client.connect();
      const { raw, tools } = await client.listTools();
      saveTools(project.id, tools, raw);
      const summary: RuntimeSummary = {
        projectId: project.id,
        status: "ready",
        processId: client.processId,
        toolCount: tools.length,
        startedAt,
        cwd: project.rootPath,
        toolsListUpdatedAt: new Date().toISOString()
      };
      this.statuses.set(project.id, summary);
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stderr = client.stderr.trim();
      await client.close();
      this.clients.delete(project.id);
      const summary: RuntimeSummary = {
        projectId: project.id,
        status: "error",
        toolCount: 0,
        startedAt,
        cwd: project.rootPath,
        lastError: stderr ? `${message}\n${stderr}` : message
      };
      this.statuses.set(project.id, summary);
      return summary;
    }
  }

  async stop(projectId: string) {
    await this.clients.get(projectId)?.close();
    this.clients.delete(projectId);
    const current = this.statuses.get(projectId);
    this.statuses.set(projectId, {
      projectId,
      status: "disconnected",
      toolCount: current?.toolCount ?? 0,
      cwd: current?.cwd,
      toolsListUpdatedAt: current?.toolsListUpdatedAt
    });
  }

  async refreshTools(project: ProjectSummary): Promise<ToolSummary[]> {
    let client = this.clients.get(project.id);
    if (!client || this.statuses.get(project.id)?.status !== "ready") {
      await this.start(project);
      client = this.clients.get(project.id);
    }
    if (!client) throw new Error(`MCP runtime unavailable for ${project.name}`);
    const { raw, tools } = await client.listTools();
    saveTools(project.id, tools, raw);
    const current = this.statuses.get(project.id);
    this.statuses.set(project.id, {
      projectId: project.id,
      status: "ready",
      processId: client.processId,
      toolCount: tools.length,
      startedAt: current?.startedAt ?? new Date().toISOString(),
      cwd: project.rootPath,
      toolsListUpdatedAt: new Date().toISOString()
    });
    return tools;
  }

  async callTool(project: ProjectSummary, toolName: string, args: unknown) {
    let client = this.clients.get(project.id);
    if (!client || this.statuses.get(project.id)?.status !== "ready") {
      const summary = await this.start(project);
      if (summary.status !== "ready") throw new Error(summary.lastError ?? `MCP runtime unavailable for ${project.name}`);
      client = this.clients.get(project.id);
    }
    if (!client) throw new Error(`MCP runtime unavailable for ${project.name}`);
    return client.callTool(toolName, args);
  }
}

export const runtimeManager = new McpRuntimeManager();