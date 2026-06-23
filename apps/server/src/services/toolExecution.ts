import {
  addCreditRecord,
  createGeneration,
  createTask,
  finishGeneration,
  finishTask,
  listTasks,
  updateTaskStatus
} from "../lib/db.js";
import type { GenerationRecord, ProjectSummary, TaskRecord, ToolCallResponse, ToolSummary } from "../types.js";
import { scanProjectAssets } from "./assetScanner.js";
import { runtimeManager } from "./mcpRuntime.js";

export type ExecutedToolCallResponse = ToolCallResponse & {
  generation?: GenerationRecord;
  result?: unknown;
  text: string;
};

export type ToolExecutionError = Error & {
  task?: TaskRecord;
  generation?: GenerationRecord;
};

export function extractMcpText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return JSON.stringify(result, null, 2);

  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return JSON.stringify(result, null, 2);

  const text = content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const next = item as { type?: unknown; text?: unknown };
      return next.type === "text" && typeof next.text === "string" ? next.text : "";
    })
    .filter(Boolean)
    .join("\n");

  return text || JSON.stringify(result, null, 2);
}

export function extractCredits(result: unknown): number | undefined {
  for (const object of resultObjects(result)) {
    if (typeof object.credits === "number") return object.credits;
  }
  return undefined;
}

export function extractAssetPath(result: unknown): string | undefined {
  for (const object of resultObjects(result)) {
    if (typeof object.localPath === "string") return object.localPath;
    if (typeof object.videoUrl === "string") return object.videoUrl;
    if (typeof object.imageUrl === "string") return object.imageUrl;
    if (typeof object.audioUrl === "string") return object.audioUrl;
    if (typeof object.modelUrl === "string") return object.modelUrl;
    if (typeof object.assetPath === "string") return object.assetPath;
  }
  return undefined;
}

function resultObjects(result: unknown): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = [];
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const res = result as Record<string, unknown>;
    objects.push(res);
    if (res.structuredContent && typeof res.structuredContent === "object" && !Array.isArray(res.structuredContent)) {
      objects.push(res.structuredContent as Record<string, unknown>);
    }
  }

  const text = extractMcpText(result);
  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Raw MCP text is often plain text; only JSON objects add structured credit/path evidence.
    }
  }

  return objects;
}

function parseTaskResult(task: TaskRecord): unknown {
  if (!task.rawResultJson) return undefined;
  try {
    return JSON.parse(task.rawResultJson);
  } catch {
    return undefined;
  }
}

export function syncCreditRecordsFromTasks(projectId?: string) {
  const tasks = listTasks(projectId, 1000);
  for (const task of tasks) {
    if (task.status !== "succeeded") continue;
    const result = parseTaskResult(task);
    const credits = extractCredits(result);
    if (credits === undefined) continue;
    addCreditRecord({
      projectId: task.projectId,
      taskId: task.taskId,
      toolName: task.toolName,
      credits,
      assetPath: extractAssetPath(result),
      rawResultJson: task.rawResultJson
    });
  }
}

function isGenerationTool(tool: ToolSummary) {
  return tool.name === "generate_image"
    || tool.name === "batch_generate_images"
    || tool.name === "edit_image"
    || tool.name === "create_video_task"
    || tool.name === "text_to_music"
    || tool.name === "create_3d_model_task";
}

export async function executeToolCall(project: ProjectSummary, tool: ToolSummary, args: Record<string, unknown>): Promise<ExecutedToolCallResponse> {
  const task = createTask(project.id, tool.name, args, "queued");
  updateTaskStatus(task.taskId, "running");
  const generation = isGenerationTool(tool) ? createGeneration(project.id, tool.name, args) : undefined;
  try {
    const result = await runtimeManager.callTool(project, tool.name, args);
    const typedResult = result as { isError?: boolean };
    if (typedResult?.isError) {
      throw new Error(extractMcpText(result) || "MCP Tool returned an error");
    }
    const finishedTask = finishTask(task.taskId, "succeeded", result);
    const finishedGeneration = generation ? finishGeneration(generation.id, "succeeded", result) : undefined;

    const credits = extractCredits(result);
    if (credits !== undefined) {
      addCreditRecord({
        projectId: project.id,
        taskId: task.taskId,
        toolName: tool.name,
        credits,
        assetPath: extractAssetPath(result),
        rawResultJson: JSON.stringify(result)
      });
    }

    const assets = await scanProjectAssets(project);
    return { task: finishedTask, generation: finishedGeneration, result, text: extractMcpText(result), assetsIndexed: assets.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedTask = finishTask(task.taskId, "failed", undefined, message);
    const failedGeneration = generation ? finishGeneration(generation.id, "failed", undefined, message) : undefined;
    throw Object.assign(new Error(message), { task: failedTask, generation: failedGeneration }) as ToolExecutionError;
  }
}
