import { getProject } from "../lib/db.js";
import { createAgentActionPreview, getAgentActionPreview, updateAgentActionPreviewStatus } from "./sessionRepository.js";
import { createDiagnosticBundle } from "../services/diagnosticBundle.js";
import { getMcpPackageUpdateStatus } from "../services/mcpPackageManager.js";
import { runtimeManager } from "../services/mcpRuntime.js";
import { probeAgentBrowserUrl } from "./browserProbe.js";
import { runAgentTerminalSnapshot, type AgentTerminalSnapshotCommandId } from "./terminalSnapshot.js";
import type { AgentActionPreviewRecord } from "../types.js";

export type AgentActionKind = "refresh_tools" | "create_diagnostic_bundle" | "mcp_package_status" | "terminal_snapshot" | "browser_probe";

export type AgentActionExecutionResult = {
  preview: AgentActionPreviewRecord;
  outputText: string;
  data: Record<string, unknown>;
};

export function createAgentSessionActionPreview(input: {
  sessionId: string;
  projectId?: string;
  actionKind: AgentActionKind;
  args?: Record<string, unknown>;
}) {
  const details = describeAction(input.actionKind, input.args ?? {});
  return createAgentActionPreview({
    sessionId: input.sessionId,
    projectId: input.projectId,
    actionKind: input.actionKind,
    toolName: details.toolName,
    title: details.title,
    summary: details.summary,
    args: input.args,
    affectedPaths: details.affectedPaths,
    riskLevel: details.riskLevel,
    expectedDurationText: details.expectedDurationText,
    raw: { createdBy: "agent-command-panel" }
  });
}

export async function executeAgentSessionActionPreview(input: {
  sessionId: string;
  previewId: string;
}): Promise<AgentActionExecutionResult | undefined> {
  const preview = getAgentActionPreview(input.previewId);
  if (!preview || preview.sessionId !== input.sessionId) return undefined;
  if (preview.status !== "approved") {
    throw new Error(`Agent action must be approved before execution: ${preview.status}`);
  }
  const startedAt = new Date().toISOString();
  try {
    const result = await executeApprovedAction(preview);
    const updated = updateAgentActionPreviewStatus({
      id: preview.id,
      status: "executed",
      raw: { executedAt: new Date().toISOString(), startedAt, result: result.data }
    });
    return { preview: updated ?? preview, outputText: result.outputText, data: result.data };
  } catch (error) {
    updateAgentActionPreviewStatus({
      id: preview.id,
      status: "approved",
      raw: {
        lastExecutionFailedAt: new Date().toISOString(),
        lastExecutionError: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}

function describeAction(actionKind: AgentActionKind, args: Record<string, unknown>) {
  if (actionKind === "refresh_tools") {
    return {
      title: "刷新 MCP 工具列表",
      summary: "调用现有 runtimeManager.refreshTools，同步当前项目的 MCP 工具清单。",
      toolName: "tools.refresh",
      affectedPaths: [],
      riskLevel: "low" as const,
      expectedDurationText: "数秒到一分钟，取决于 MCP runtime 状态"
    };
  }
  if (actionKind === "create_diagnostic_bundle") {
    return {
      title: "导出诊断包",
      summary: "收集桌面端资源状态、MCP 包状态、日志和项目配置，生成本地 zip 诊断包。",
      toolName: "developer.diagnostics",
      affectedPaths: [],
      riskLevel: "low" as const,
      expectedDurationText: "数秒"
    };
  }
  if (actionKind === "mcp_package_status") {
    return {
      title: "检查 MCP 包状态",
      summary: "读取 MCP 包、本地缓存、registry 版本和更新日志状态。",
      toolName: "mcp.package.status",
      affectedPaths: [],
      riskLevel: "low" as const,
      expectedDurationText: "数秒到半分钟"
    };
  }
  if (actionKind === "terminal_snapshot") {
    return {
      title: `运行终端快照：${String(args.commandId ?? "")}`,
      summary: "执行白名单诊断命令并记录输出，不开放任意 shell 输入。",
      toolName: "agent.terminal_snapshot",
      affectedPaths: [],
      riskLevel: "low" as const,
      expectedDurationText: "数秒"
    };
  }
  return {
    title: "检查浏览器 URL",
    summary: "通过后端 fetch 探测 URL 状态、最终地址、content-type 和页面标题。",
    toolName: "agent.browser_probe",
    affectedPaths: [],
    riskLevel: "low" as const,
    expectedDurationText: "数秒"
  };
}

async function executeApprovedAction(preview: AgentActionPreviewRecord): Promise<{ outputText: string; data: Record<string, unknown> }> {
  if (preview.actionKind === "refresh_tools") {
    const projectId = readStringArg(preview, "projectId") ?? preview.projectId;
    if (!projectId) throw new Error("刷新 MCP 工具列表需要 projectId。");
    const project = getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const tools = await runtimeManager.refreshTools(project);
    return {
      outputText: `已刷新 MCP 工具：${tools.length} 个。`,
      data: { toolCount: tools.length, projectId }
    };
  }
  if (preview.actionKind === "create_diagnostic_bundle") {
    const result = await createDiagnosticBundle(readStringArg(preview, "projectId") ?? preview.projectId);
    return {
      outputText: `诊断包已生成：${result.fileName}\n路径：${result.zipPath}`,
      data: result as unknown as Record<string, unknown>
    };
  }
  if (preview.actionKind === "mcp_package_status") {
    const status = await getMcpPackageUpdateStatus({ checkRegistry: readBooleanArg(preview, "checkRegistry") ?? true });
    return {
      outputText: [
        `包：${status.packageSpec}`,
        `本地版本：${status.currentVersion ?? "-"}`,
        `最新版本：${status.latestVersion ?? "-"}`,
        `本地缓存：${status.cacheExists ? status.cachePath : "不存在"}`,
        status.registryError ? `registry 错误：${status.registryError}` : ""
      ].filter(Boolean).join("\n"),
      data: status as unknown as Record<string, unknown>
    };
  }
  if (preview.actionKind === "terminal_snapshot") {
    const commandId = readTerminalCommandId(preview);
    const snapshot = await runAgentTerminalSnapshot({ commandId, projectId: readStringArg(preview, "projectId") ?? preview.projectId });
    const commandText = `${snapshot.displayCommand ?? snapshot.command} ${(snapshot.displayArgs ?? snapshot.args).join(" ")}`.trim();
    return {
      outputText: [
        `$ ${commandText}`,
        `cwd: ${snapshot.cwd}`,
        `exit: ${snapshot.exitCode ?? "-"} · ${snapshot.durationMs}ms`,
        snapshot.stdout || "<stdout empty>",
        snapshot.stderr ? `[stderr]\n${snapshot.stderr}` : ""
      ].filter(Boolean).join("\n"),
      data: snapshot as unknown as Record<string, unknown>
    };
  }
  if (preview.actionKind === "browser_probe") {
    const url = readStringArg(preview, "url");
    if (!url) throw new Error("浏览器探测需要 url。");
    const probe = await probeAgentBrowserUrl(url);
    return {
      outputText: [
        `URL：${probe.finalUrl ?? probe.requestedUrl}`,
        `状态：${probe.status ? `${probe.status} ${probe.statusText ?? ""}` : probe.ok ? "OK" : "失败"}`,
        `标题：${probe.title ?? "-"}`,
        `类型：${probe.contentType ?? "-"}`,
        probe.error ? `错误：${probe.error}` : ""
      ].filter(Boolean).join("\n"),
      data: probe as unknown as Record<string, unknown>
    };
  }
  throw new Error(`Unsupported agent action kind: ${preview.actionKind}`);
}

function readStringArg(preview: AgentActionPreviewRecord, key: string) {
  const value = preview.args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBooleanArg(preview: AgentActionPreviewRecord, key: string) {
  const value = preview.args[key];
  return typeof value === "boolean" ? value : undefined;
}

function readTerminalCommandId(preview: AgentActionPreviewRecord): AgentTerminalSnapshotCommandId {
  const value = readStringArg(preview, "commandId");
  if (value === "workspace_status" || value === "node_version" || value === "npm_version" || value === "git_status" || value === "where_node_npm_npx" || value === "npm_cache_config") return value;
  throw new Error(`Unsupported terminal snapshot commandId: ${String(value)}`);
}
