import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";
import { config } from "../lib/config.js";
import { getToolsListSnapshot, saveTools } from "../lib/db.js";
import type { ProjectSummary, RuntimeSummary, ToolSummary } from "../types.js";
import { appVersion } from "../generated/appVersion.js";

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
  env.npm_config_cache = config.makerNpmCacheDir;
  env.NPM_CONFIG_CACHE = config.makerNpmCacheDir;
  return env;
}

function asSchema(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return { type: "object", properties: {} };
}

function normalizeTool(tool: ToolLike): ToolSummary | undefined {
  if (typeof tool.name !== "string" || !tool.name.trim()) return undefined;
  const name = tool.name;
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

export function buildMcpRuntimeLaunchCommand() {
  return {
    command: config.npxCommand,
    args: ["-y", "-p", config.makerPackage, "taptap-maker"],
  };
}

class SdkMcpClient {
  private client?: Client;
  private transport?: StdioClientTransport;
  private stderrBuffer = "";
  private closing = false;
  private launchCommand?: ReturnType<typeof buildMcpRuntimeLaunchCommand>;

  constructor(private readonly project: ProjectSummary) {}

  get processId() {
    return this.transport?.pid ?? undefined;
  }

  get stderr() {
    return this.stderrBuffer;
  }

  private get stderrLogPath() {
    const safeProjectId = this.project.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(config.mcpLogDir, `${safeProjectId}.stderr.log`);
  }

  async connect() {
    if (this.client) return;
    this.closing = false;
    fs.mkdirSync(config.makerNpmCacheDir, { recursive: true });
    fs.mkdirSync(config.mcpLogDir, { recursive: true });
    const client = new Client({ name: appVersion.appId, version: appVersion.packageVersion }, { capabilities: {} });
    const launch = buildMcpRuntimeLaunchCommand();
    this.launchCommand = launch;
    const transport = new StdioClientTransport({
      command: launch.command,
      args: launch.args,
      cwd: this.project.rootPath,
      env: buildMcpEnv(),
      stderr: "pipe"
    });

    transport.stderr?.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      this.stderrBuffer += text;
      fs.appendFile(this.stderrLogPath, text, () => undefined);
    });

    this.client = client;
    this.transport = transport;
    await client.connect(transport, { timeout: 30_000 });
  }

  async listTools(): Promise<{ raw: unknown; tools: ToolSummary[] }> {
    if (!this.client) await this.connect();
    const raw = await this.client!.listTools(undefined, { timeout: 30_000 });
    const rawTools = Array.isArray(raw.tools) ? raw.tools : [];
    return { raw, tools: rawTools.map((tool) => normalizeTool(tool as ToolLike)).filter((tool): tool is ToolSummary => Boolean(tool)) };
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

  launchDetails() {
    return this.launchCommand
      ? `${this.launchCommand.command} ${this.launchCommand.args.join(" ")}`
      : undefined;
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
      const launchDetails = client.launchDetails();
      await client.close();
      this.clients.delete(project.id);
      const summary: RuntimeSummary = {
        projectId: project.id,
        status: "error",
        toolCount: 0,
        startedAt,
        cwd: project.rootPath,
        lastError: [
          message,
          launchDetails ? `launch: ${launchDetails}` : undefined,
          stderr || undefined,
        ].filter(Boolean).join("\n")
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

  async stopAll() {
    const projectIds = Array.from(new Set([...this.clients.keys(), ...this.statuses.keys()]));
    await Promise.all(projectIds.map((projectId) => this.stop(projectId)));
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
