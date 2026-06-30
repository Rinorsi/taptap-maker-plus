import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { getBuildLogs, type DesktopReadiness, type ProjectBuildLogsSummary } from "../../../api";
import type { AgentContextSnapshot, AgentMessageRecord } from "../api";
import { RawViewer } from "../../../components/developer/RawViewer";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

type LogTab = "runtime" | "watcherOut" | "watcherErr" | "build" | "messages";

export function AgentLogsTab({ context, readiness, messages }: { context?: AgentContextSnapshot; readiness?: DesktopReadiness; messages: AgentMessageRecord[] }) {
  const [logs, setLogs] = useState<ProjectBuildLogsSummary | undefined>(context?.buildLogs);
  const [activeTab, setActiveTab] = useState<LogTab>("runtime");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLogs(context?.buildLogs);
  }, [context?.buildLogs]);

  async function refresh() {
    if (!context?.project?.id) return;
    setLoading(true);
    setError("");
    try {
      setLogs(await getBuildLogs(context.project.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  const logValue = useMemo(() => {
    if (activeTab === "runtime") return logs?.runtime.runtimeLog?.tailLines.join("\n") ?? "";
    if (activeTab === "watcherOut") return logs?.runtime.watcherOut?.tailLines.join("\n") ?? "";
    if (activeTab === "watcherErr") return logs?.runtime.watcherErr?.tailLines.join("\n") ?? "";
    if (activeTab === "build") return logs?.buildLogs.map((entry) => `# ${entry.file.relativePath}\n${entry.rawText}`).join("\n\n") ?? "";
    return messages.map((message) => `[${message.createdAt}] ${message.role}: ${message.content}`).join("\n\n");
  }, [activeTab, logs, messages]);

  const tabs: Array<{ id: LogTab; label: string }> = [
    { id: "runtime", label: "runtime.log" },
    { id: "watcherOut", label: "watcher.out" },
    { id: "watcherErr", label: "watcher.err" },
    { id: "build", label: "build logs" },
    { id: "messages", label: "messages" }
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-3 rounded-large border border-border bg-surface-panel px-3 py-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn("h-7 rounded-control px-2.5 text-[11px] font-bold", activeTab === tab.id ? "bg-brand text-white" : "text-text-muted hover:bg-surface-muted")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 px-2 text-[11px]" disabled={!context?.project?.id || loading} onClick={() => void refresh()}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          刷新
        </Button>
      </div>
      {error ? <div className="rounded-control border border-[#b03939]/25 bg-[#b03939]/5 px-3 py-2 text-xs text-[#b03939]">{error}</div> : null}
      <div className="min-h-0 flex-1">
        <RawViewer title={activeTab === "messages" ? "agent messages.log" : activeTab} value={logValue} language="log" emptyText={`日志目录：${readiness?.paths.mcpLogDir ?? "-"}`} height="100%" compactGutter />
      </div>
    </div>
  );
}
