import type { AgentContextSnapshot, AgentSelectionReference } from "../../api";

export function buildContextRows(context?: AgentContextSnapshot) {
  return [
    { label: "项目", value: String(context?.counts.projects ?? 0) },
    { label: "工具", value: String(context?.counts.tools ?? 0) },
    { label: "任务", value: String(context?.counts.tasks ?? 0) },
    { label: "生成记录", value: String(context?.counts.generations ?? 0) },
    { label: "资产", value: String(context?.counts.assets ?? 0) },
    { label: "工作流", value: String(context?.counts.workflows ?? 0) },
    { label: "工作流运行", value: String(context?.counts.workflowRuns ?? 0) },
    { label: "Credits", value: String(context?.counts.credits ?? 0) }
  ];
}

export function describeSelection(selection?: AgentSelectionReference) {
  if (!selection) return "-";
  if (selection.type === "project") return `project: ${selection.projectId}`;
  if (selection.type === "tool") return `tool: ${selection.toolName}`;
  if (selection.type === "task") return `task: ${selection.taskId}`;
  return `asset: ${selection.relativePath}`;
}

export function formatShortTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
