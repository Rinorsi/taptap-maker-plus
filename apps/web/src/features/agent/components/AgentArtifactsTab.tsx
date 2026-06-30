import { PackageOpen, FileBox } from "lucide-react";
import type { ProjectSummary } from "../../../api";
import type { AgentContextSnapshot } from "../api";
import { cn } from "../../../lib/utils";

export function AgentArtifactsTab({ context, selectedProject }: { context?: AgentContextSnapshot; selectedProject?: ProjectSummary }) {
  const artifacts = [
    ...(context?.tasks ?? []).map((task) => ({
      id: task.taskId,
      title: task.toolName,
      subtitle: `${task.status} · ${task.startedAt}`,
      tone: task.status === "failed" ? "bad" : task.status === "succeeded" ? "good" : "neutral" as const
    }))
  ];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#18181b] text-zinc-300">
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
          <PackageOpen className="h-3.5 w-3.5" />
          Artifacts & Tasks
        </h3>
        
        {artifacts.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {artifacts.map((artifact) => (
              <div key={artifact.id} className={cn(
                "flex flex-col rounded-md border p-3 bg-black/20 shadow-sm",
                artifact.tone === "bad" ? "border-red-900/30" : artifact.tone === "good" ? "border-emerald-900/30" : "border-white/10"
              )}>
                <div className="flex items-center gap-2">
                  <FileBox className={cn("h-4 w-4 shrink-0", 
                    artifact.tone === "bad" ? "text-red-500" : artifact.tone === "good" ? "text-emerald-500" : "text-zinc-400"
                  )} />
                  <strong className="block truncate text-xs font-medium text-zinc-200">{artifact.title}</strong>
                </div>
                <span className="mt-1.5 block truncate text-[11px] text-zinc-500 font-mono">{artifact.subtitle}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <PackageOpen className="h-8 w-8 text-zinc-800 mb-3" />
            <h4 className="text-sm font-medium text-zinc-400">暂无产物</h4>
            <p className="text-[11px] text-zinc-600 mt-1">{selectedProject?.name ?? "当前项目"} 暂无可展示任务或资产。</p>
          </div>
        )}
      </div>
    </div>
  );
}
