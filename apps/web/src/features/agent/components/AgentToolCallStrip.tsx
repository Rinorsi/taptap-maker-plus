import { CheckCircle2, Clock3, Play, ShieldAlert, XCircle } from "lucide-react";
import type { AgentActionPreviewRecord } from "../api";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

export function AgentToolCallStrip({
  previews,
  onDecideActionPreview,
  onExecuteActionPreview,
  onOpenTools
}: {
  previews: AgentActionPreviewRecord[];
  onDecideActionPreview: (previewId: string, decision: "approved" | "rejected") => void;
  onExecuteActionPreview: (previewId: string) => void;
  onOpenTools: () => void;
}) {
  const visiblePreviews = previews.slice(0, 3);
  if (!visiblePreviews.length) return null;

  return (
    <div className="shrink-0 border-b border-border-soft bg-surface-panel px-4 py-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-brand" />
          <strong className="truncate text-xs text-text">工具调用</strong>
          <span className="shrink-0 rounded-control bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">{previews.length} 个记录</span>
        </div>
        <button type="button" onClick={onOpenTools} className="shrink-0 text-[11px] font-semibold text-brand-strong hover:underline">
          查看全部
        </button>
      </div>
      <div className="grid gap-2">
        {visiblePreviews.map((preview) => (
          <article key={preview.id} className="rounded-card border border-border bg-surface px-3 py-2 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {statusIcon(preview.status)}
                  <strong className="truncate text-xs text-text">{preview.title}</strong>
                  <span className={cn(
                    "shrink-0 rounded-control px-2 py-0.5 text-[10px] font-bold",
                    preview.status === "pending" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted"
                  )}>
                    {formatPreviewStatus(preview.status)}
                  </span>
                </div>
                <p className="m-0 mt-1 line-clamp-2 text-[11px] leading-5 text-text-muted">{preview.summary}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="rounded-control bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-subtle">{preview.actionKind}</span>
                  <span className="rounded-control bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-subtle">{preview.riskLevel}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {preview.status === "pending" ? (
                  <>
                    <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onDecideActionPreview(preview.id, "rejected")}>
                      拒绝
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onDecideActionPreview(preview.id, "approved")}>
                      审批
                    </Button>
                  </>
                ) : null}
                {preview.status === "approved" ? (
                  <Button type="button" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onExecuteActionPreview(preview.id)}>
                    <Play className="h-3 w-3" />
                    执行
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function statusIcon(status: AgentActionPreviewRecord["status"]) {
  if (status === "pending") return <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#b03939]" />;
  if (status === "approved" || status === "executed") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-brand-strong" />;
  return <XCircle className="h-3.5 w-3.5 shrink-0 text-text-subtle" />;
}

function formatPreviewStatus(status: AgentActionPreviewRecord["status"]) {
  if (status === "pending") return "待审批";
  if (status === "approved") return "已审批";
  if (status === "rejected") return "已拒绝";
  if (status === "executed") return "已执行";
  return "已取消";
}
