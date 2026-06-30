import { useState } from "react";
import { Command, Loader2, Play, ShieldCheck } from "lucide-react";
import type { ProjectSummary, RuntimeStatus } from "../../../api";
import type { AgentActionKind, AgentActionPreviewRecord, AgentContextSnapshot } from "../api";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import { AgentSection, EmptyState } from "./AgentPanelPrimitives";

type AgentCommandSuggestion = {
  id: string;
  title: string;
  body: string;
  status: string;
  disabled: boolean;
  input: {
    actionKind: AgentActionKind;
    projectId?: string;
    args?: Record<string, unknown>;
  };
};

export function AgentCommandsTab({
  context,
  actionPreviews,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  selectedProject,
  runtimeStatus
}: {
  context?: AgentContextSnapshot;
  actionPreviews: AgentActionPreviewRecord[];
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
}) {
  const [runningId, setRunningId] = useState("");
  const [errorText, setErrorText] = useState("");

  async function createPreview(id: string, input: AgentCommandSuggestion["input"]) {
    setRunningId(id);
    setErrorText("");
    try {
      await onCreateActionPreview(input);
    } catch (caught) {
      setErrorText(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunningId("");
    }
  }

  const commandSuggestions: AgentCommandSuggestion[] = [
    {
      id: "refresh-tools",
      title: "刷新 MCP 工具列表",
      body: "调用现有后端 /tools/refresh，同步当前项目 MCP 工具清单。",
      status: runtimeStatus === "ready" ? "可创建" : "等待 MCP",
      disabled: !selectedProject,
      input: { actionKind: "refresh_tools", projectId: selectedProject?.id, args: { projectId: selectedProject?.id } }
    },
    {
      id: "workspace-status",
      title: "工作区状态快照",
      body: `项目 ${context?.counts.projects ?? 0} · 工具 ${context?.counts.tools ?? 0} · 任务 ${context?.counts.tasks ?? 0} · 资产 ${context?.counts.assets ?? 0} · 日志 ${context?.counts.buildLogs ?? 0}`,
      status: context ? "可创建" : "缺上下文",
      disabled: !context,
      input: { actionKind: "terminal_snapshot", projectId: selectedProject?.id, args: { commandId: "workspace_status", projectId: selectedProject?.id } }
    },
    {
      id: "managed-runtime-paths",
      title: "检查托管运行环境路径",
      body: "记录 Node / npm / npx 解析路径，用于排查普通用户机器没有系统环境时是否仍走内置环境。",
      status: "可创建",
      disabled: false,
      input: { actionKind: "terminal_snapshot", projectId: selectedProject?.id, args: { commandId: "where_node_npm_npx", projectId: selectedProject?.id } }
    },
    {
      id: "npm-cache",
      title: "检查 npm cache 位置",
      body: "读取 npm 当前 cache 配置，确认 MCP 安装/升级是否落在桌面端托管缓存目录。",
      status: "可创建",
      disabled: false,
      input: { actionKind: "terminal_snapshot", projectId: selectedProject?.id, args: { commandId: "npm_cache_config", projectId: selectedProject?.id } }
    },
    {
      id: "diagnostics",
      title: "导出诊断包",
      body: "收集日志、环境、MCP 安装状态和项目配置，生成本地 zip 诊断包。",
      status: "可创建",
      disabled: false,
      input: { actionKind: "create_diagnostic_bundle", projectId: selectedProject?.id, args: { projectId: selectedProject?.id } }
    },
    {
      id: "mcp-status",
      title: "检查 MCP 包状态",
      body: "读取当前 MCP 包、本地缓存、npm registry 版本和更新日志来源。",
      status: "可创建",
      disabled: false,
      input: { actionKind: "mcp_package_status", args: { checkRegistry: true } }
    }
  ];

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)]">
      <AgentSection icon={<Command className="h-4 w-4" />} title="命令提示符">
        <div className="grid gap-2 overflow-y-auto p-3">
          {commandSuggestions.map((item) => (
            <div key={item.id} className="rounded-large border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <strong className="truncate text-xs text-text">{item.title}</strong>
                <span className="shrink-0 rounded-control bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted">{item.status}</span>
              </div>
              <p className="m-0 mt-1 text-xs leading-5 text-text-muted">{item.body}</p>
              <Button type="button" variant="outline" size="sm" className="mt-2 h-7 gap-1 px-2 text-[11px]" disabled={Boolean(runningId) || item.disabled} onClick={() => void createPreview(item.id, item.input)}>
                {runningId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                创建预览
              </Button>
            </div>
          ))}
          {errorText ? (
            <pre className="overflow-auto whitespace-pre-wrap rounded-control border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-[11px] leading-5 text-[#b03939]">
              {errorText}
            </pre>
          ) : null}
        </div>
      </AgentSection>

      <AgentSection icon={<ShieldCheck className="h-4 w-4" />} title="动作审批队列">
        {actionPreviews.length ? (
          <div className="grid gap-2 overflow-y-auto p-3">
            {actionPreviews.map((preview) => (
              <div key={preview.id} className="rounded-large border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <strong className="truncate text-xs text-text">{preview.title}</strong>
                  <span className={cn("shrink-0 rounded-control px-2 py-0.5 text-[11px] font-bold", preview.status === "pending" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted")}>{formatPreviewStatus(preview.status)}</span>
                </div>
                <p className="m-0 mt-1 line-clamp-3 text-xs leading-5 text-text-muted">{preview.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-control bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted">{preview.actionKind}</span>
                  {preview.toolName ? <span className="rounded-control bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand-strong">{preview.toolName}</span> : null}
                  <span className="rounded-control bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted">{preview.riskLevel}</span>
                </div>
                {preview.status === "pending" ? (
                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onDecideActionPreview(preview.id, "rejected")}>
                      拒绝
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onDecideActionPreview(preview.id, "approved")}>
                      审批
                    </Button>
                  </div>
                ) : null}
                {preview.status === "approved" ? (
                  <div className="mt-3 flex justify-end">
                    <Button type="button" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onExecuteActionPreview(preview.id)}>
                      <Play className="h-3 w-3" />
                      执行动作
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : <EmptyState title="暂无待审批动作" body="Agent 生成诊断、终端快照、浏览器检查等动作时，会先进入这里。" />}
      </AgentSection>
    </div>
  );
}

function formatPreviewStatus(status: AgentActionPreviewRecord["status"]) {
  if (status === "pending") return "待审批";
  if (status === "approved") return "已审批";
  if (status === "rejected") return "已拒绝";
  if (status === "executed") return "已执行";
  return "已取消";
}
