import { ClipboardList, Play, ShieldCheck, Monitor } from "lucide-react";
import type { DesktopReadiness, ProjectSummary, RuntimeStatus } from "../../../api";
import type { AgentActionPreviewRecord, AgentContextSnapshot, PiAgentRuntimeStatus } from "../api";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { AgentInfoRow, AgentMetric, AgentSection, EmptyState } from "./AgentPanelPrimitives";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

export function AgentOverviewTab({
  context,
  pi,
  selectedProject,
  runtimeStatus,
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#18181b] text-zinc-300">
      
      {/* 1. Context Chips (Pills) */}
      <div className="flex shrink-0 items-center gap-2 p-3 border-b border-[#2b2b2b] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] border border-white/5">
          <Monitor className="h-3 w-3 text-zinc-500" />
          <span className="text-zinc-400">Project:</span>
          <span className="text-zinc-200">{selectedProject?.name ?? "None"}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] border border-white/5">
           <ShieldCheck className={cn("h-3 w-3", runtimeStatus === "ready" ? "text-emerald-500" : "text-zinc-500")} />
           <span className="text-zinc-400">MCP:</span>
           <span className="text-zinc-200">{formatRuntimeStatus(runtimeStatus)}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-[11px] border border-white/5">
           <div className={cn("h-2 w-2 rounded-full", pi?.connected ? "bg-emerald-500" : "bg-zinc-600")} />
           <span className="text-zinc-400">Pi:</span>
           <span className="text-zinc-200">{pi?.connected ? "Connected" : "Not Connected"}</span>
        </div>
      </div>

      {/* 2. Approvals Feed */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Action Feed</h3>
        
        {actionPreviews.length > 0 ? (
          <div className="flex flex-col gap-3">
            {actionPreviews.map((preview) => (
              <div key={preview.id} className="flex flex-col overflow-hidden rounded-md border border-white/10 bg-black/20 shadow-sm">
                <div className="flex items-center justify-between p-2.5 border-b border-white/5 bg-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Play className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <strong className="truncate text-xs font-medium text-zinc-200">{preview.title}</strong>
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400 font-mono">
                      {preview.toolName ?? preview.actionKind}
                    </span>
                  </div>
                  <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-sm", 
                    preview.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-zinc-500"
                  )}>
                    {formatPreviewStatus(preview.status)}
                  </span>
                </div>
                
                <div className="p-3 text-[11px] text-zinc-400 font-mono leading-relaxed bg-black/40 whitespace-pre-wrap break-all border-b border-white/5 max-h-[200px] overflow-y-auto scrollbar-thin">
                   {preview.summary}
                </div>
                
                {preview.status === "pending" ? (
                  <div className="flex justify-end gap-2 p-2 bg-[#18181b]">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-3 text-[11px] hover:bg-white/10 text-zinc-300" onClick={() => onDecideActionPreview(preview.id, "rejected")}>
                      Reject
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-3 text-[11px] bg-blue-600 hover:bg-blue-500 text-white" onClick={() => onDecideActionPreview(preview.id, "approved")}>
                      Approve
                    </Button>
                  </div>
                ) : preview.status === "approved" ? (
                  <div className="flex justify-end gap-2 p-2 bg-[#18181b]">
                    <Button type="button" size="sm" className="h-7 px-3 gap-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => onExecuteActionPreview(preview.id)}>
                      <Play className="h-3 w-3" />
                      Execute
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
             <ClipboardList className="h-8 w-8 text-zinc-800 mb-3" />
             <p className="text-xs font-medium text-zinc-400">无活跃动作</p>
             <p className="text-[11px] text-zinc-600 mt-1 max-w-[200px]">Agent 的关键操作和命令行调用将在这里显示以供审查。</p>
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
