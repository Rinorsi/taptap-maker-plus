import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import { getAgentGitDiffSnapshot, type AgentActionPreviewRecord, type AgentContextSnapshot, type AgentGitDiffSnapshot, type AgentMessageRecord } from "../api";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then((module) => ({ default: module.Editor })));

export function AgentDiffTab({
  context,
  messages,
  actionPreviews
}: {
  context?: AgentContextSnapshot;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
}) {
  const [snapshot, setSnapshot] = useState<AgentGitDiffSnapshot>();
  const [scope, setScope] = useState<"workspace" | "project">("workspace");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestPreview = actionPreviews[0];

  useEffect(() => {
    void refresh(scope);
  }, [context?.project?.id]);

  async function refresh(nextScope = scope) {
    setLoading(true);
    setError("");
    try {
      setScope(nextScope);
      setSnapshot(await getAgentGitDiffSnapshot({ scope: nextScope, projectId: context?.project?.id }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  const editorText = useMemo(() => {
    if (!snapshot) return "";
    const parts = [
      snapshot.status ? `# git status\n${snapshot.status}` : "# git status\n<empty>",
      snapshot.stat ? `# git diff --stat\n${snapshot.stat}` : "# git diff --stat\n<empty>",
      snapshot.diff ? `# git diff\n${snapshot.diff}` : "# git diff\n<empty>"
    ];
    if (snapshot.truncated) parts.push("# note\nDiff was truncated by Agent snapshot limits.");
    if (snapshot.stderr) parts.push(`# stderr\n${snapshot.stderr}`);
    return parts.join("\n\n");
  }, [snapshot]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#1e1e1e] text-zinc-300">
      
      {/* Sidebar: Diff Source */}
      <div className="flex flex-col w-[300px] shrink-0 border-r border-[#2b2b2b] bg-[#18181b]">
        <div className="flex h-10 shrink-0 items-center justify-between px-3 border-b border-[#2b2b2b]">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5" />
            Diff Source
          </h3>
          <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-white/10" disabled={loading} onClick={() => void refresh(scope)}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex rounded-sm bg-black/20 p-0.5 border border-white/5 mb-3">
            {[
              ["workspace", "Workspace"],
              ["project", "Project"]
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn("h-7 flex-1 rounded-[2px] text-[11px] font-medium transition-colors", scope === id ? "bg-[#333333] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300")}
                onClick={() => void refresh(id as "workspace" | "project")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/20 p-3 shadow-sm text-[11px]">
            <div className="flex justify-between items-center"><span className="text-zinc-500">Project</span><span className="text-zinc-200">{context?.project?.name ?? "-"}</span></div>
            <div className="flex justify-between items-center"><span className="text-zinc-500">CWD</span><span className="text-zinc-200 truncate ml-2">{snapshot?.cwd ?? "-"}</span></div>
            <div className="flex justify-between items-center"><span className="text-zinc-500">Status Lines</span><span className="text-zinc-200">{String(snapshot?.status.split("\n").filter(Boolean).length ?? 0)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Diff</span>
              <span className={cn("px-1.5 py-0.5 rounded-sm font-medium", snapshot?.truncated ? "bg-red-500/20 text-red-400" : snapshot?.diff ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-zinc-400")}>
                {snapshot?.truncated ? "Truncated" : snapshot?.diff ? "Full" : "No changes"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Area: Code Diff */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[#1e1e1e]">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <span className="text-red-400 text-sm mb-2">{error}</span>
            <Button type="button" size="sm" variant="outline" className="text-zinc-400 border-white/10" onClick={() => void refresh(scope)}>Retry</Button>
          </div>
        ) : (
          <Suspense fallback={
            <div className="flex flex-col h-full items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">Loading Editor...</span>
            </div>
          }>
            <MonacoEditor
              language="diff"
              theme="vs-dark"
              value={editorText}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                lineHeight: 1.6,
                padding: { top: 16, bottom: 16 },
                renderWhitespace: "selection"
              }}
              loading={
                <div className="flex flex-col h-full items-center justify-center gap-2 text-zinc-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              }
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
