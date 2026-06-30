import type { AgentContextSnapshot, AgentMessageRecord } from "../types.js";

export type CompressedAgentContext = {
  generatedAt: string;
  selectedProjectId?: string;
  project?: {
    id: string;
    name: string;
    rootPath: string;
    runtime?: AgentContextSnapshot["runtime"];
  };
  page: AgentContextSnapshot["page"];
  counts: AgentContextSnapshot["counts"];
  runtime?: AgentContextSnapshot["runtime"];
  recentMessages: Array<{
    role: AgentMessageRecord["role"];
    createdAt: string;
    content: string;
  }>;
  tools: Array<{
    name: string;
    category: string;
    required: string[];
    description?: string;
  }>;
  tasks: Array<{
    taskId: string;
    toolName: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    errorMessage?: string;
  }>;
  assets: Array<{
    relativePath: string;
    assetType: string;
    status: string;
    sizeBytes: number;
  }>;
  logs: {
    runtimeTail: string[];
    watcherOutTail: string[];
    watcherErrTail: string[];
    buildLogFiles: Array<{
      relativePath: string;
      updatedAt: string;
      flags: string[];
    }>;
  };
};

const RECENT_MESSAGE_LIMIT = 8;
const MESSAGE_CONTENT_LIMIT = 1200;
const TOOL_LIMIT = 30;
const TASK_LIMIT = 20;
const ASSET_LIMIT = 30;

export function compressAgentContext(context: AgentContextSnapshot, messages: AgentMessageRecord[] = []): CompressedAgentContext {
  return {
    generatedAt: context.generatedAt,
    selectedProjectId: context.selectedProjectId,
    project: context.project
      ? {
          id: context.project.id,
          name: context.project.name,
          rootPath: context.project.rootPath,
          runtime: context.project.runtime
        }
      : undefined,
    page: context.page,
    counts: context.counts,
    runtime: context.runtime,
    recentMessages: messages.slice(-RECENT_MESSAGE_LIMIT).map((message) => ({
      role: message.role,
      createdAt: message.createdAt,
      content: message.content.slice(0, MESSAGE_CONTENT_LIMIT)
    })),
    tools: context.tools.slice(0, TOOL_LIMIT).map((tool) => ({
      name: tool.name,
      category: tool.category,
      required: tool.required,
      description: tool.description
    })),
    tasks: context.tasks.slice(0, TASK_LIMIT).map((task) => ({
      taskId: task.taskId,
      toolName: task.toolName,
      status: task.status,
      startedAt: task.startedAt,
      finishedAt: task.finishedAt,
      errorMessage: task.errorMessage
    })),
    assets: context.assets.slice(0, ASSET_LIMIT).map((asset) => ({
      relativePath: asset.relativePath,
      assetType: asset.assetType,
      status: asset.status,
      sizeBytes: asset.sizeBytes
    })),
    logs: {
      runtimeTail: context.buildLogs?.runtime.runtimeLog?.tailLines ?? [],
      watcherOutTail: context.buildLogs?.runtime.watcherOut?.tailLines ?? [],
      watcherErrTail: context.buildLogs?.runtime.watcherErr?.tailLines ?? [],
      buildLogFiles: context.buildLogs?.buildLogs.map((entry) => ({
        relativePath: entry.file.relativePath,
        updatedAt: entry.file.updatedAt,
        flags: entry.flags
      })) ?? []
    }
  };
}

export function serializeCompressedAgentContext(context: CompressedAgentContext) {
  return JSON.stringify(context, null, 2);
}
