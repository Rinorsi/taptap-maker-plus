import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileDiff,
  GitCompare,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Rows3,
  Save,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import {
  getAgentGitDiffSnapshot,
  type AgentActionPreviewRecord,
  type AgentContextSnapshot,
  type AgentGitDiffScope,
  type AgentGitDiffSnapshot,
  type AgentMessageRecord,
} from "../api";

const MonacoEditor = lazy(() => import("@monaco-editor/react").then((module) => ({ default: module.Editor })));

type DiffMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
};

const scopeOptions: Array<{ id: AgentGitDiffScope; label: string; body: string }> = [
  { id: "workspace", label: "Workspace", body: "读取当前 MCP 工作区 Git diff。" },
  { id: "project", label: "Project", body: "读取当前项目根目录 Git diff。" },
];

const lifecycleRows = [
  { label: "Snapshot", body: "按需读取 git status、diff --stat 和 git diff。", state: "可用", tone: "good" },
  { label: "Review", body: "当前为只读审查面板，不自动写入。", state: "只读", tone: "neutral" },
  { label: "Patch artifact", body: "后续将 diff 选择区交给 artifact lifecycle。", state: "待接入", tone: "neutral" },
  { label: "Approval", body: "写入、回滚和构建动作仍需要动作预览审批。", state: "待接入", tone: "warning" },
] as const;

export function AgentDiffTab({
  context,
  messages,
  actionPreviews,
}: {
  context?: AgentContextSnapshot;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
}) {
  const [snapshot, setSnapshot] = useState<AgentGitDiffSnapshot>();
  const [scope, setScope] = useState<AgentGitDiffScope>("workspace");
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
      snapshot.diff ? `# git diff\n${snapshot.diff}` : "# git diff\n<empty>",
    ];
    if (snapshot.truncated) parts.push("# note\nDiff was truncated by Agent snapshot limits.");
    if (snapshot.stderr) parts.push(`# stderr\n${snapshot.stderr}`);
    return parts.join("\n\n");
  }, [snapshot]);

  const statusLineCount = snapshot?.status.split("\n").filter(Boolean).length ?? 0;
  const hasChanges = Boolean(snapshot?.status.trim() || snapshot?.diff.trim() || snapshot?.stat.trim());
  const metrics: DiffMetric[] = [
    { label: "Scope", value: snapshot?.scope ?? scope },
    { label: "Status lines", value: String(statusLineCount), tone: statusLineCount > 0 ? "warning" : "good" },
    { label: "Diff", value: snapshot?.truncated ? "Truncated" : snapshot?.diff ? "Available" : "No changes", tone: snapshot?.truncated ? "warning" : snapshot?.diff ? "good" : "neutral" },
    { label: "Duration", value: snapshot ? `${snapshot.durationMs}ms` : "-" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FileDiff className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">
              {context?.project?.name ? `${context.project.name} Diff Review` : "Workspace Diff Review"}
            </h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={<GitCompare className="h-3 w-3" />} label={snapshot?.cwd ?? context?.project?.rootPath ?? "workspace root"} />
            <InlineStatus icon={<CircleDashed className="h-3 w-3" />} label={snapshot?.generatedAt ?? "snapshot pending"} />
            {snapshot?.truncated ? <InlineStatus icon={<AlertTriangle className="h-3 w-3 text-agent-warning" />} label="diff truncated" /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一版待接入"
            aria-label="上一版待接入"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[11px] text-agent-muted">
            snapshot
          </span>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="下一版待接入"
            aria-label="下一版待接入"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 h-8 gap-1.5 border-agent-border bg-agent-bg px-2 text-[11px] text-agent-muted hover:bg-agent-surface hover:text-agent-text"
            disabled={loading}
            onClick={() => void refresh(scope)}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 overflow-auto p-4 lg:p-6">
          <div className="mx-auto flex max-w-[980px] flex-col gap-4">
            <section className="rounded-panel border border-agent-border bg-agent-panel shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-agent-border-soft px-4 py-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-medium text-agent-text">Diff artifact snapshot</p>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                    只读读取真实 Git 状态；写入、回滚和 patch 生成保持待审批。
                  </p>
                </div>
                <div className="flex rounded-control border border-agent-border-soft bg-agent-bg p-0.5">
                  {scopeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "h-7 rounded-control px-2.5 text-[11px] font-medium transition-colors",
                        scope === option.id ? "bg-agent-panel text-agent-text shadow-sm" : "text-agent-muted hover:text-agent-text"
                      )}
                      title={option.body}
                      onClick={() => void refresh(option.id)}
                      disabled={loading}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-0 sm:grid-cols-2 2xl:grid-cols-4">
                {metrics.map((metric) => (
                  <MetricTile key={metric.label} metric={metric} />
                ))}
              </div>

              {error ? (
                <div className="border-t border-agent-border-soft p-4">
                  <div className="rounded-control border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-[12px] leading-5 text-[#b03939]">
                    {error}
                  </div>
                </div>
              ) : null}

              <div className="grid min-h-[420px] border-t border-agent-border-soft 2xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-h-0 min-w-0 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[12px] font-medium text-agent-text">
                        {hasChanges ? "Readable diff" : "No local diff"}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                        Monaco 保持只读，用作可复制审查面板。
                      </p>
                    </div>
                    <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[10px] text-agent-subtle">
                      read-only
                    </span>
                  </div>
                  <div className="h-[360px] overflow-hidden rounded-control border border-agent-border-soft bg-[#101418]">
                    {error ? (
                      <DiffPlaceholder icon={<AlertTriangle className="h-5 w-5" />} title="Diff 读取失败" body="请刷新或切换 scope 后重试。" />
                    ) : (
                      <Suspense fallback={<DiffPlaceholder icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading diff" body="正在加载只读编辑器。" />}>
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
                            padding: { top: 14, bottom: 14 },
                            renderWhitespace: "selection",
                          }}
                          loading={<DiffPlaceholder icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading diff" body="正在加载只读编辑器。" />}
                        />
                      </Suspense>
                    )}
                  </div>
                </div>

                <aside className="border-t border-agent-border-soft bg-agent-bg p-3 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Snapshot details" subtitle="真实 git 输出摘要" />
                  <div className="flex flex-col gap-2">
                    <DetailBlock icon={<Rows3 className="h-4 w-4" />} label="git status" value={snapshot?.status || "<empty>"} />
                    <DetailBlock icon={<GitPullRequest className="h-4 w-4" />} label="git diff --stat" value={snapshot?.stat || "<empty>"} />
                    {snapshot?.stderr ? <DetailBlock icon={<AlertTriangle className="h-4 w-4 text-agent-warning" />} label="stderr" value={snapshot.stderr} /> : null}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Lifecycle" subtitle="Diff 到产物的视觉骨架">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {lifecycleRows.map((row) => (
                    <LifecycleRow key={row.label} row={row} />
                  ))}
                </div>
              </InfoPanel>
              <InfoPanel title="Approval bridge" subtitle="当前动作预览仍是唯一执行入口">
                {latestPreview ? (
                  <div className="rounded-control border border-agent-border-soft bg-agent-bg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-agent-warning" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-agent-text">{latestPreview.title}</span>
                      <span className="shrink-0 rounded-control bg-agent-warning/10 px-1.5 py-0.5 text-[10px] text-agent-warning">
                        {latestPreview.status}
                      </span>
                    </div>
                    <p className="m-0 mt-1 line-clamp-3 text-[11px] leading-5 text-agent-muted">{latestPreview.summary}</p>
                  </div>
                ) : (
                  <div className="rounded-control border border-dashed border-agent-border bg-agent-bg p-4 text-[12px] leading-6 text-agent-muted">
                    当前没有待审批动作。Diff 只读审查可用；应用补丁、回滚和运行命令后续必须经过动作预览。
                  </div>
                )}
              </InfoPanel>
            </section>
          </div>
        </main>

        <aside className="min-h-0 overflow-auto border-t border-agent-border bg-agent-panel p-4">
          <PanelTitle title="Diff readiness" subtitle="可用能力和待接入项" />
          <div className="flex flex-col gap-2">
            <ReadinessRow label="Git status snapshot" value="可用" ready />
            <ReadinessRow label="Git diff snapshot" value="可用" ready />
            <ReadinessRow label="Patch artifact" value="待接入" ready={false} />
            <ReadinessRow label="Apply patch action" value="待审批接入" ready={false} />
            <ReadinessRow label="Linked messages" value={`${messages.length} messages`} ready={messages.length > 0} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: DiffMetric }) {
  return (
    <div className="min-h-[76px] border-b border-agent-border-soft p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 2xl:border-r 2xl:[&:nth-child(2n)]:border-r 2xl:last:border-r-0">
      <p className="m-0 text-[10px] uppercase tracking-normal text-agent-subtle">{metric.label}</p>
      <p
        className={cn(
          "m-0 mt-2 truncate text-[15px] font-medium",
          metric.tone === "good" ? "text-agent-accent" : metric.tone === "warning" ? "text-agent-warning" : "text-agent-text"
        )}
        title={metric.value}
      >
        {metric.value}
      </p>
    </div>
  );
}

function InlineStatus({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-agent-subtle">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function DetailBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-control border border-agent-border-soft bg-agent-panel p-3">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-agent-text">
        <span className="text-agent-muted">{icon}</span>
        <span>{label}</span>
      </div>
      <pre className="m-0 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-control bg-agent-bg p-2 font-mono text-[11px] leading-5 text-agent-muted">
        {value}
      </pre>
    </div>
  );
}

function DiffPlaceholder({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center bg-[#101418] p-6 text-center text-zinc-400">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-control border border-white/10 bg-white/5">
          {icon}
        </div>
        <p className="m-0 text-[13px] font-medium text-zinc-200">{title}</p>
        <p className="m-0 mt-1 text-[11px] leading-5 text-zinc-500">{body}</p>
      </div>
    </div>
  );
}

function InfoPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
      <PanelTitle title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

function LifecycleRow({ row }: { row: (typeof lifecycleRows)[number] }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-agent-border-soft bg-agent-bg px-3 py-2 last:border-b-0">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          row.tone === "good" ? "bg-agent-accent" : row.tone === "warning" ? "bg-agent-warning" : "bg-agent-subtle"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{row.label}</span>
        <span className="block truncate text-[11px] text-agent-muted">{row.body}</span>
      </span>
      <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-panel px-1.5 py-0.5 text-[10px] text-agent-subtle">
        {row.state}
      </span>
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-control border border-agent-border-soft bg-agent-bg px-3 py-2">
      {ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-agent-accent" /> : <CircleDashed className="h-4 w-4 shrink-0 text-agent-subtle" />}
      <span className="min-w-0 flex-1 truncate text-[12px] text-agent-muted">{label}</span>
      <span className="shrink-0 truncate text-[11px] text-agent-text">{value}</span>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="m-0 truncate text-[13px] font-medium text-agent-text">{title}</h3>
      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">{subtitle}</p>
    </div>
  );
}
