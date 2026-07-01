import {
  CheckCircle2,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import type { AgentActionPreviewRecord, PiAgentRuntimeStatus } from "../api";
import type { ProjectSummary, RuntimeStatus } from "../../../api";
import type { AgentWorkspaceTab } from "../types";
import { cn } from "../../../lib/utils";

type WorkspaceBlueprintProps = {
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
  pendingPreviews: AgentActionPreviewRecord[];
  onOpenTab: (tab: AgentWorkspaceTab) => void;
  onDecideActionPreview?: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview?: (previewId: string) => void;
  compact?: boolean;
};

export function AgentWorkspaceBlueprint({
  selectedProject,
  runtimeStatus,
  pi,
  pendingPreviews,
  onDecideActionPreview,
  onExecuteActionPreview,
  compact = false,
}: WorkspaceBlueprintProps) {
  const piConnected = Boolean(pi?.connected);
  const hasPending = pendingPreviews.length > 0;
  const projectName = selectedProject?.name ?? "Agent Workspace";

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-agent-bg text-agent-text", compact ? "p-4" : "p-6")}>
      <div className="flex h-full w-full max-w-[860px] mx-auto flex-col rounded-panel border border-agent-border-soft bg-agent-panel shadow-sm overflow-hidden relative">
        
        {/* Minimal Header */}
        <div className="absolute top-0 left-0 right-0 flex h-12 items-center justify-between px-4 opacity-70">
           <span className="text-[12px] font-medium text-agent-muted">{projectName}</span>
           <div className="flex items-center gap-3 text-[11px] text-agent-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", runtimeStatus === "ready" ? "bg-agent-accent" : "bg-agent-subtle")} />
                MCP {runtimeStatus}
              </span>
              <span className="inline-flex items-center gap-1.5">
                {piConnected ? <CheckCircle2 className="h-3 w-3 text-agent-accent" /> : <CircleDashed className="h-3 w-3" />}
                Pi {piConnected ? "connected" : "standby"}
              </span>
           </div>
        </div>

        {/* Clean Empty State */}
        <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
           <div className="flex h-12 w-12 items-center justify-center rounded-full bg-agent-surface/50 text-agent-subtle mb-4 ring-1 ring-agent-border-soft">
              <Sparkles className="h-5 w-5 opacity-60" />
           </div>
           <h3 className="text-[14px] font-medium text-agent-text tracking-wide">Ready</h3>
           <p className="mt-1.5 max-w-[280px] text-[12px] text-agent-muted leading-relaxed">
             Awaiting your commands. Send a message to start generation, or open a workspace tool from the top-right menu.
           </p>

           {/* Pending Action Previews List */}
           {hasPending ? (
             <div className="mt-8 w-full max-w-[400px] overflow-hidden rounded-[10px] border border-agent-warning/25 bg-agent-warning/5 text-left shadow-sm">
                {pendingPreviews.slice(0, 3).map((preview) => (
                  <PendingRow
                    key={preview.id}
                    preview={preview}
                    onDecideActionPreview={onDecideActionPreview}
                    onExecuteActionPreview={onExecuteActionPreview}
                  />
                ))}
             </div>
           ) : null}
        </div>
      </div>
    </div>
  );
}

function PendingRow({
  preview,
  onDecideActionPreview,
  onExecuteActionPreview,
}: {
  preview: AgentActionPreviewRecord;
  onDecideActionPreview?: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview?: (previewId: string) => void;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-agent-warning/10 px-3 py-2.5 last:border-b-0 transition-colors hover:bg-agent-warning/10">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-agent-warning" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{preview.title}</span>
        <span className="block truncate text-[11px] text-agent-muted">{preview.summary}</span>
      </span>
      {preview.status === "pending" && onDecideActionPreview ? (
        <div className="flex shrink-0 gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => onDecideActionPreview(preview.id, "rejected")}
            className="h-7 rounded-control border border-agent-border bg-agent-surface px-2.5 text-[11px] font-medium text-agent-muted hover:bg-agent-panel hover:text-agent-text transition-colors"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onDecideActionPreview(preview.id, "approved")}
            className="h-7 rounded-control bg-agent-accent px-2.5 text-[11px] font-medium text-white hover:brightness-110 shadow-sm transition-all"
          >
            Approve
          </button>
        </div>
      ) : null}
      {preview.status === "approved" && onExecuteActionPreview ? (
        <button
          type="button"
          onClick={() => onExecuteActionPreview(preview.id)}
          className="h-7 shrink-0 rounded-control bg-agent-accent px-2.5 ml-2 text-[11px] font-medium text-white hover:brightness-110 shadow-sm transition-all"
        >
          Execute
        </button>
      ) : null}
    </div>
  );
}
