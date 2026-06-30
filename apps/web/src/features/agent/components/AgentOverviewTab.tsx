import { ClipboardList, Play } from "lucide-react";
import type { DesktopReadiness, ProjectSummary, RuntimeStatus } from "../../../api";
import type { AgentActionPreviewRecord, AgentContextSnapshot, PiAgentRuntimeStatus } from "../api";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

export function AgentOverviewTab({
  actionPreviews,
  onDecideActionPreview,
  onExecuteActionPreview
}: {
  context?: AgentContextSnapshot;
  readiness?: DesktopReadiness;
  pi?: PiAgentRuntimeStatus;
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  contextRows: Array<{ label: string; value: string }>;
  pendingPreviews: AgentActionPreviewRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview: (previewId: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-agent-bg text-agent-text">
      <div className="flex-1 overflow-y-auto p-4 bg-agent-bg">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-agent-subtle">最近动作</h3>
        
        {actionPreviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {actionPreviews.map((preview) => (
              <div key={preview.id} className="flex flex-col overflow-hidden rounded-panel border border-agent-border bg-agent-panel shadow-sm">
                <div className="flex items-center justify-between p-2.5 border-b border-agent-border-soft bg-agent-bg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Play className="h-3.5 w-3.5 shrink-0 text-agent-accent" />
                    <strong className="truncate text-xs font-medium text-agent-text">{preview.title}</strong>
                    <span className="shrink-0 rounded bg-agent-panel px-1.5 py-0.5 text-[10px] text-agent-muted font-mono">
                      {preview.toolName ?? preview.actionKind}
                    </span>
                  </div>
                  <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm", 
                    preview.status === "pending" ? "bg-[rgba(245,158,11,0.1)] text-[#f59e0b]" : "bg-agent-panel text-agent-muted"
                  )}>
                    {formatPreviewStatus(preview.status)}
                  </span>
                </div>
                
                <div className="p-3 text-[11px] text-agent-muted font-mono leading-relaxed bg-agent-bg whitespace-pre-wrap break-all border-b border-agent-border-soft max-h-[200px] overflow-y-auto scrollbar-thin">
                   {preview.summary}
                </div>
                
                {preview.status === "pending" ? (
                  <div className="flex justify-end gap-2 p-2 bg-agent-panel">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-[11px] hover:bg-agent-surface text-agent-text" onClick={() => onDecideActionPreview(preview.id, "rejected")}>
                      拒绝
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-3 text-[11px] bg-agent-accent text-white hover:brightness-110" onClick={() => onDecideActionPreview(preview.id, "approved")}>
                      批准
                    </Button>
                  </div>
                ) : preview.status === "approved" ? (
                  <div className="flex justify-end gap-2 p-2 bg-agent-panel">
                    <Button type="button" size="sm" className="h-7 px-3 gap-1.5 text-[11px] bg-agent-accent text-white hover:brightness-110" onClick={() => onExecuteActionPreview(preview.id)}>
                      <Play className="h-3 w-3" />
                      执行
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
             <ClipboardList className="h-8 w-8 text-agent-subtle mb-3" />
             <p className="text-xs font-medium text-agent-muted">暂无动作</p>
             <p className="text-[11px] text-agent-subtle mt-1 max-w-[240px]">后续真实工具调用、文件变更、命令执行结果会作为事件显示在这里。</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatPreviewStatus(status: AgentActionPreviewRecord["status"]) {
  if (status === "pending") return "待审批";
  if (status === "approved") return "已批准";
  if (status === "rejected") return "已拒绝";
  if (status === "executed") return "已执行";
  return "已取消";
}
