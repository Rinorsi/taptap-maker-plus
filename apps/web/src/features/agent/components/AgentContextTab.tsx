import { useMemo, useState, type ReactNode } from "react";
import {
  Braces,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Database,
  FileJson,
  FolderOpen,
  Link2,
  ListChecks,
  MessageSquareText,
  PanelTop,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ProjectSummary } from "../../../api";
import type { AgentContextSnapshot, AgentPageState, CompressedAgentContext } from "../api";
import { cn } from "../../../lib/utils";
import { describeSelection } from "../utils";

type ContextSourceId = "compressed" | "snapshot" | "page" | "counts" | "logs";

type ContextSource = {
  id: ContextSourceId;
  label: string;
  body: string;
  state: "只读" | "可用" | "待接入";
  icon: LucideIcon;
};

type ContextMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
};

const contextSources: ContextSource[] = [
  { id: "compressed", label: "Compressed context", body: "发送给 Agent 的压缩上下文 JSON。", state: "只读", icon: FileJson },
  { id: "snapshot", label: "Live snapshot", body: "当前页面、项目、资产、工具和运行状态快照。", state: "只读", icon: Database },
  { id: "page", label: "Page selection", body: "当前主工作台面板和选择引用。", state: "可用", icon: PanelTop },
  { id: "counts", label: "Context counts", body: "项目、工具、任务、资产、workflow 等计数。", state: "可用", icon: ListChecks },
  { id: "logs", label: "Log tails", body: "压缩上下文中的 runtime/watch/build 日志摘要。", state: "只读", icon: Braces },
];

const lifecycleRows = [
  { label: "Capture", body: "从当前项目、页面选择和本地运行态采集上下文。", state: "可用", tone: "good" },
  { label: "Compress", body: "压缩上下文用于 Agent prompt，不直接伪造 runtime event。", state: "可用", tone: "good" },
  { label: "Attach", body: "后续可把局部上下文作为 composer attachment 或 @ 引用。", state: "待接入", tone: "neutral" },
  { label: "Trace", body: "上下文版本、diff 和 token budget 追踪等待 Pi Runtime Bridge。", state: "待接入", tone: "warning" },
] as const;

export function AgentContextTab({
  context,
  compressedContext,
  compressedContextSnapshotId,
  selectedProject,
  page,
  contextRows,
}: {
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  selectedProject?: ProjectSummary;
  page: AgentPageState;
  contextRows: Array<{ label: string; value: string }>;
}) {
  const [activeSource, setActiveSource] = useState<ContextSourceId>("compressed");
  const projectName = selectedProject?.name ?? context?.project?.name;
  const rootPath = selectedProject?.rootPath ?? context?.project?.rootPath;
  const displayValue = useMemo(
    () => buildSourceValue(activeSource, context, compressedContext, compressedContextSnapshotId, page, contextRows),
    [activeSource, compressedContext, compressedContextSnapshotId, context, contextRows, page]
  );
  const source = contextSources.find((item) => item.id === activeSource) ?? contextSources[0];
  const metrics: ContextMetric[] = [
    { label: "Projects", value: String(context?.counts.projects ?? 0), tone: context?.counts.projects ? "good" : "neutral" },
    { label: "Assets", value: String(context?.counts.assets ?? 0), tone: context?.counts.assets ? "good" : "neutral" },
    { label: "Tools", value: String(context?.counts.tools ?? 0), tone: context?.counts.tools ? "good" : "neutral" },
    { label: "Snapshot", value: compressedContextSnapshotId ? "compressed" : context ? "live" : "pending", tone: compressedContextSnapshotId || context ? "good" : "warning" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">
              {projectName ? `${projectName} Context` : "Agent Context"}
            </h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={<ShieldCheck className="h-3 w-3" />} label="read-only" />
            <InlineStatus icon={<CircleDashed className="h-3 w-3" />} label={context?.generatedAt ?? compressedContext?.generatedAt ?? "snapshot pending"} />
            <InlineStatus icon={<FolderOpen className="h-3 w-3" />} label={rootPath ?? "project root unknown"} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一版上下文待接入"
            aria-label="上一版上下文待接入"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[11px] text-agent-muted">
            context
          </span>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="下一版上下文待接入"
            aria-label="下一版上下文待接入"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 overflow-auto p-4 lg:p-6">
          <div className="mx-auto flex max-w-[980px] flex-col gap-4">
            <section className="rounded-panel border border-agent-border bg-agent-panel shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-agent-border-soft p-4">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-medium text-agent-text">Context artifact snapshot</p>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                    只读展示 Agent 当前可见上下文；版本 diff、token budget 和 event trace 保持待接入。
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {contextSources.slice(0, 4).map((item) => (
                    <SourceChip
                      key={item.id}
                      source={item}
                      selected={activeSource === item.id}
                      onSelect={() => setActiveSource(item.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-0 sm:grid-cols-2 2xl:grid-cols-4">
                {metrics.map((metric) => (
                  <MetricTile key={metric.label} metric={metric} />
                ))}
              </div>

              <div className="grid min-h-[440px] min-w-0 grid-cols-1 overflow-hidden border-t border-agent-border-soft 2xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-h-0 min-w-0 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[12px] font-medium text-agent-text">{source.label}</p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">{source.body}</p>
                    </div>
                    <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[10px] text-agent-subtle">
                      read-only
                    </span>
                  </div>
                  <pre className="m-0 h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-control border border-agent-border-soft bg-[#101418] p-4 font-mono text-[11px] leading-5 text-zinc-300">
                    {displayValue}
                  </pre>
                </div>

                <aside className="border-t border-agent-border-soft bg-agent-bg p-3 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Context sources" subtitle="真实上下文来源" />
                  <div className="flex flex-col gap-2">
                    {contextSources.map((item) => (
                      <SourceRow
                        key={item.id}
                        source={item}
                        selected={activeSource === item.id}
                        detail={getSourceDetail(item.id, context, compressedContext, contextRows)}
                        onSelect={() => setActiveSource(item.id)}
                      />
                    ))}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Current selection" subtitle="页面选择和项目边界">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  <InfoRow label="Project" value={projectName ?? "-"} />
                  <InfoRow label="Page tab" value={context?.page.activeTab ?? page.activeTab ?? "-"} />
                  <InfoRow label="Selection" value={describeSelection(context?.page.selection ?? page.selection)} />
                  <InfoRow label="Snapshot" value={compressedContextSnapshotId ?? "实时上下文"} />
                </div>
              </InfoPanel>
              <InfoPanel title="Context readiness" subtitle="当前能力和待接入边界">
                <div className="flex flex-col gap-2">
                  <ReadinessRow label="Live context snapshot" value={context ? "可用" : "pending"} ready={Boolean(context)} />
                  <ReadinessRow label="Compressed prompt context" value={compressedContext ? "可用" : "pending"} ready={Boolean(compressedContext)} />
                  <ReadinessRow label="Selection reference" value={describeSelection(context?.page.selection ?? page.selection)} ready={Boolean(context?.page.selection ?? page.selection)} />
                  <ReadinessRow label="Context diff" value="待接入" ready={false} />
                  <ReadinessRow label="Token budget trace" value="待接入" ready={false} />
                </div>
              </InfoPanel>
            </section>

            <section className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
              <PanelTitle title="Lifecycle" subtitle="上下文进入 Agent prompt 的骨架" />
              <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                {lifecycleRows.map((row) => (
                  <LifecycleRow key={row.label} row={row} />
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function buildSourceValue(
  activeSource: ContextSourceId,
  context: AgentContextSnapshot | undefined,
  compressedContext: CompressedAgentContext | undefined,
  compressedContextSnapshotId: string | undefined,
  page: AgentPageState,
  contextRows: Array<{ label: string; value: string }>
) {
  if (activeSource === "compressed") {
    return compressedContext
      ? JSON.stringify({ sourceSnapshotId: compressedContextSnapshotId, compressedContext }, null, 2)
      : "暂无压缩上下文。发送消息或刷新上下文后，这里会显示真实 compressed context。";
  }
  if (activeSource === "snapshot") {
    return context ? JSON.stringify(context, null, 2) : "暂无实时上下文快照。";
  }
  if (activeSource === "page") {
    return JSON.stringify({
      page: context?.page ?? page,
      selectedProjectId: context?.selectedProjectId,
      project: context?.project,
      selectionText: describeSelection(context?.page.selection ?? page.selection),
    }, null, 2);
  }
  if (activeSource === "counts") {
    return JSON.stringify({
      rows: contextRows,
      counts: context?.counts,
    }, null, 2);
  }
  return JSON.stringify({
    runtimeTail: compressedContext?.logs.runtimeTail ?? context?.buildLogs?.runtime.runtimeLog?.tailLines ?? [],
    watcherOutTail: compressedContext?.logs.watcherOutTail ?? context?.buildLogs?.runtime.watcherOut?.tailLines ?? [],
    watcherErrTail: compressedContext?.logs.watcherErrTail ?? context?.buildLogs?.runtime.watcherErr?.tailLines ?? [],
    buildLogFiles: compressedContext?.logs.buildLogFiles ?? context?.buildLogs?.buildLogs.map((entry) => ({
      relativePath: entry.file.relativePath,
      updatedAt: entry.file.updatedAt,
      flags: entry.flags,
    })) ?? [],
  }, null, 2);
}

function getSourceDetail(
  id: ContextSourceId,
  context: AgentContextSnapshot | undefined,
  compressedContext: CompressedAgentContext | undefined,
  contextRows: Array<{ label: string; value: string }>
) {
  if (id === "compressed") return compressedContext ? `${compressedContext.tools.length} tools · ${compressedContext.assets.length} assets` : "pending";
  if (id === "snapshot") return context ? `${context.tools.length} tools · ${context.assets.length} assets` : "pending";
  if (id === "page") return context?.page.activeTab ?? "current page";
  if (id === "counts") return `${contextRows.length} rows`;
  return `${compressedContext?.logs.buildLogFiles.length ?? context?.buildLogs?.buildLogs.length ?? 0} build logs`;
}

function SourceChip({
  source,
  selected,
  onSelect,
}: {
  source: ContextSource;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = source.icon;
  return (
    <button
      type="button"
      data-context-source={source.id}
      onClick={onSelect}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[11px] transition-colors",
        selected ? "border-agent-accent/30 bg-agent-accent/10 text-agent-accent" : "border-agent-border-soft bg-agent-bg text-agent-muted hover:bg-agent-surface hover:text-agent-text"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {source.label}
    </button>
  );
}

function SourceRow({
  source,
  selected,
  detail,
  onSelect,
}: {
  source: ContextSource;
  selected: boolean;
  detail: string;
  onSelect: () => void;
}) {
  const Icon = source.icon;
  return (
    <button
      type="button"
      data-context-source={source.id}
      onClick={onSelect}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-control border p-3 text-left transition-colors",
        selected ? "border-agent-accent/25 bg-agent-accent/10" : "border-agent-border-soft bg-agent-panel hover:bg-agent-surface"
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-agent-bg text-agent-muted group-hover:text-agent-text">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{source.label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-agent-muted">{detail || source.body}</span>
      </span>
      <span className="shrink-0 rounded-control bg-agent-bg px-1.5 py-0.5 text-[10px] text-agent-subtle">{source.state}</span>
    </button>
  );
}

function MetricTile({ metric }: { metric: ContextMetric }) {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-agent-border-soft bg-agent-bg px-3 py-2 last:border-b-0">
      <span className="shrink-0 text-[11px] font-medium text-agent-subtle">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-mono text-[11px] text-agent-text" title={value}>
        {value}
      </span>
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

function InfoPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
      <PanelTitle title={title} subtitle={subtitle} />
      {children}
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
