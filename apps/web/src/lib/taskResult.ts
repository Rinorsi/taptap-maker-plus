import type { TaskRecord } from "../api";

type JsonObject = Record<string, unknown>;

export type TaskErrorLabelStyle = "inspector" | "queue";

function parseRawResult(rawResultJson?: string): unknown {
  if (!rawResultJson) return undefined;
  try {
    return JSON.parse(rawResultJson) as unknown;
  } catch {
    return undefined;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasIsErrorFlag(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasIsErrorFlag);
  if (!isJsonObject(value)) return false;
  if (value.isError === true) return true;
  return Object.values(value).some(hasIsErrorFlag);
}

export function getTaskResultText(task: TaskRecord) {
  return `${task.errorMessage ?? ""}\n${task.rawResultJson ?? ""}`;
}

export function taskHasMcpErrorResult(task: TaskRecord) {
  const parsed = parseRawResult(task.rawResultJson);
  if (parsed !== undefined) return hasIsErrorFlag(parsed);
  const rawResultJson = task.rawResultJson ?? "";
  return rawResultJson.includes('"isError": true') || rawResultJson.includes('"isError":true');
}

export function isTaskError(task: TaskRecord) {
  return task.status === "failed" || taskHasMcpErrorResult(task);
}

export function isTaskSuccess(task: TaskRecord) {
  return task.status === "succeeded" && !taskHasMcpErrorResult(task);
}

export function isVideoConcurrencyError(task: TaskRecord) {
  return getTaskResultText(task).includes("并发超限");
}

export function getVideoConcurrencyTaskId(task: TaskRecord) {
  const match = getTaskResultText(task).match(/cgt-[a-zA-Z0-9-]+/);
  return match ? match[0] : undefined;
}

export function classifyTaskError(task: TaskRecord, style: TaskErrorLabelStyle = "inspector") {
  const text = getTaskResultText(task).toLowerCase();
  if (text.includes("timeout") || text.includes("timed out")) return "timeout";
  if (text.includes("schema") || text.includes("validation") || text.includes("invalid")) {
    return style === "queue" ? "schema / validation" : "schema";
  }
  if (text.includes("mcp") || text.includes("runtime") || text.includes("stdio")) {
    return style === "queue" ? "mcp runtime" : "mcp";
  }
  if (text.includes("network") || text.includes("fetch") || text.includes("504")) return "network";
  if (style === "queue") return "tool error";
  if (text.includes("balance") || text.includes("credit")) return "INSUFFICIENT_FUNDS";
  if (text.includes("rate limit") || text.includes("429")) return "RATE_LIMIT";
  return "UNKNOWN";
}

export function getTaskCopyPayload(task: TaskRecord) {
  return task.errorMessage || task.rawResultJson || task.inputJson;
}

export function getTaskPayloadDisplay(task: TaskRecord) {
  return task.rawResultJson || task.inputJson;
}

export function formatTaskQueueDetails(task: TaskRecord) {
  return [
    task.errorMessage ? `errorMessage:\n${task.errorMessage}` : "",
    task.rawResultJson ? `rawResultJson:\n${task.rawResultJson}` : "",
    `inputJson:\n${task.inputJson}`
  ].filter(Boolean).join("\n\n");
}

export function formatRunTaskDetails(task: TaskRecord) {
  return [
    `taskId: ${task.taskId}`,
    `toolName: ${task.toolName}`,
    `status: ${task.status}`,
    `startedAt: ${task.startedAt}`,
    task.finishedAt ? `finishedAt: ${task.finishedAt}` : "",
    task.errorMessage ? `\nerrorMessage:\n${task.errorMessage}` : "",
    task.rawResultJson ? `\nrawResultJson:\n${task.rawResultJson}` : "",
    `\ninputJson:\n${task.inputJson}`
  ].filter(Boolean).join("\n");
}
