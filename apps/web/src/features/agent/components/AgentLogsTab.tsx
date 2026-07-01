import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileClock,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Rows3,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import {
  getBuildLogs,
  type DesktopReadiness,
  type ProjectBuildLogEntry,
  type ProjectBuildLogsSummary,
  type ProjectLogFileSummary,
} from "../../../api";
import type { AgentContextSnapshot, AgentMessageRecord } from "../api";
import { Button } from "../../../components/ui/Button";
import { cn, formatBytes } from "../../../lib/utils";

type LogTab = "runtime" | "watcherOut" | "watcherErr" | "build" | "messages";

type LogSource = {
  id: LogTab;
  label: string;
  body: string;
  state: "只读" | "可用" | "待接入";
  icon: LucideIcon;
};

type LogMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "bad";
};

const logSources: LogSource[] = [
  { id: "runtime", label: "runtime.log", body: "Maker runtime tail lines。", state: "只读", icon: ScrollText },
  { id: "watcherOut", label: "watcher.out", body: "Watcher stdout tail lines。", state: "只读", icon: Rows3 },
  { id: "watcherErr", label: "watcher.err", body: "Watcher stderr tail lines。", state: "只读", icon: AlertTriangle },
  { id: "build", label: "build logs", body: "读取 .maker/logs/build 文本。", state: "只读", icon: FileClock },
  { id: "messages", label: "messages", body: "当前 Agent 会话消息日志。", state: "可用", icon: MessageSquareText },
];

const lifecycleRows = [
  { label: "Collect", body: "从上下文快照或项目日志 API 读取真实日志。", state: "可用", tone: "good" },
  { label: "Inspect", body: "日志 tail、build raw text 和消息记录进入只读 surface。", state: "可用", tone: "good" },
  { label: "Link", body: "后续将错误行跳转到 workspace artifact 或 tool event。", state: "待接入", tone: "neutral" },
  { label: "Stream", body: "实时日志流等待 Pi Runtime Bridge 和 Maker Adapter。", state: "待接入", tone: "warning" },
] as const;

export function AgentLogsTab({
  context,
  readiness,
  messages,
}: {
  context?: AgentContextSnapshot;
  readiness?: DesktopReadiness;
  messages: AgentMessageRecord[];
}) {
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

  const activeSource = logSources.find((source) => source.id === activeTab) ?? logSources[0];
  const activeFile = getActiveLogFile(logs, activeTab);
  const logValue = useMemo(() => getLogValue(activeTab, logs, messages), [activeTab, logs, messages]);
  const lineCount = logValue ? logValue.split("\n").filter(Boolean).length : 0;
  const warningCount = countWarnings(logs);
  const hasSource = activeTab === "messages" ? messages.length > 0 : activeTab === "build" ? Boolean(logs?.buildLogs.length) : Boolean(activeFile?.exists && activeFile.tailLines.length);
  const headerTitle = logs?.projectName ? `${logs.projectName} Logs` : context?.project?.name ? `${context.project.name} Logs` : "Agent Logs";
  const metrics: LogMetric[] = [
    { label: "Source", value: activeSource.label },
    { label: "Lines", value: String(lineCount), tone: lineCount > 0 ? "good" : "neutral" },
    { label: "Warnings", value: String(warningCount), tone: warningCount > 0 ? "warning" : "neutral" },
    { label: "Build files", value: String(logs?.buildLogs.length ?? 0), tone: logs?.buildLogs.length ? "good" : "neutral" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <ScrollText className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">{headerTitle}</h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={<ShieldCheck className="h-3 w-3" />} label="read-only" />
            <InlineStatus icon={<CircleDashed className="h-3 w-3" />} label={logs?.generatedAt ?? "snapshot pending"} />
            <InlineStatus icon={<FileText className="h-3 w-3" />} label={readiness?.paths.mcpLogDir ?? "log directory unknown"} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一条日志快照待接入"
            aria-label="上一条日志快照待接入"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[11px] text-agent-muted">
            logs
          </span>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="下一条日志快照待接入"
            aria-label="下一条日志快照待接入"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 h-8 gap-1.5 border-agent-border bg-agent-bg px-2 text-[11px] text-agent-muted hover:bg-agent-surface hover:text-agent-text"
            disabled={!context?.project?.id || loading}
            onClick={() => void refresh()}
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-agent-border-soft p-4">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[13px] font-medium text-agent-text">Logs artifact snapshot</p>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                    只读查看 runtime、watcher、build 和会话消息；实时流、跳转和错误定位保持待接入。
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {logSources.slice(0, 4).map((source) => (
                    <SourceChip
                      key={source.id}
                      source={source}
                      selected={activeTab === source.id}
                      onSelect={() => setActiveTab(source.id)}
                    />
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

              <div className="grid min-h-[420px] border-t border-agent-border-soft 2xl:grid-cols-[minmax(0,1fr)_270px]">
                <div className="min-h-0 min-w-0 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[12px] font-medium text-agent-text">{activeSource.label}</p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                        {describeActiveSource(activeTab, activeFile, logs)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[10px] text-agent-subtle">
                      read-only
                    </span>
                  </div>
                  {hasSource ? (
                    <pre className="m-0 h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-control border border-agent-border-soft bg-[#101418] p-4 font-mono text-[12px] leading-6 text-zinc-300">
                      {logValue}
                    </pre>
                  ) : (
                    <EmptyLogSurface loading={loading} activeSource={activeSource} readiness={readiness} />
                  )}
                </div>

                <aside className="border-t border-agent-border-soft bg-agent-bg p-3 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Log sources" subtitle="真实日志来源" />
                  <div className="flex flex-col gap-2">
                    {logSources.map((source) => (
                      <SourceRow
                        key={source.id}
                        source={source}
                        selected={activeTab === source.id}
                        detail={getSourceDetail(source.id, logs, messages)}
                        onSelect={() => setActiveTab(source.id)}
                      />
                    ))}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Lifecycle" subtitle="日志进入 workspace 的状态骨架">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {lifecycleRows.map((row) => (
                    <LifecycleRow key={row.label} row={row} />
                  ))}
                </div>
              </InfoPanel>
              <InfoPanel title="Logs readiness" subtitle="当前能力和待接入边界">
                <div className="flex flex-col gap-2">
                  <ReadinessRow label="Runtime tail" value={logs?.runtime.runtimeLog?.exists ? "可用" : "missing"} ready={Boolean(logs?.runtime.runtimeLog?.exists)} />
                  <ReadinessRow label="Watcher tail" value={logs?.runtime.watcherOut?.exists ? "可用" : "missing"} ready={Boolean(logs?.runtime.watcherOut?.exists)} />
                  <ReadinessRow label="Build raw logs" value={`${logs?.buildLogs.length ?? 0} files`} ready={Boolean(logs?.buildLogs.length)} />
                  <ReadinessRow label="Linked error navigation" value="待接入" ready={false} />
                  <ReadinessRow label="Streaming log events" value="待接入" ready={false} />
                </div>
              </InfoPanel>
            </section>

            {logs?.buildLogs.length ? (
              <section className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
                <PanelTitle title="Build attempts" subtitle="只读构建日志摘要" />
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {logs.buildLogs.slice(0, 6).map((entry) => (
                    <BuildLogRow key={entry.file.relativePath} entry={entry} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function getActiveLogFile(logs: ProjectBuildLogsSummary | undefined, activeTab: LogTab) {
  if (activeTab === "runtime") return logs?.runtime.runtimeLog;
  if (activeTab === "watcherOut") return logs?.runtime.watcherOut;
  if (activeTab === "watcherErr") return logs?.runtime.watcherErr;
  return undefined;
}

function getLogValue(activeTab: LogTab, logs: ProjectBuildLogsSummary | undefined, messages: AgentMessageRecord[]) {
  if (activeTab === "runtime") return logs?.runtime.runtimeLog?.tailLines.join("\n") ?? "";
  if (activeTab === "watcherOut") return logs?.runtime.watcherOut?.tailLines.join("\n") ?? "";
  if (activeTab === "watcherErr") return logs?.runtime.watcherErr?.tailLines.join("\n") ?? "";
  if (activeTab === "build") return logs?.buildLogs.map((entry) => `# ${entry.file.relativePath}\n${entry.rawText}`).join("\n\n") ?? "";
  return messages.map((message) => `[${message.createdAt}] ${message.role}: ${message.content}`).join("\n\n");
}

function getSourceDetail(activeTab: LogTab, logs: ProjectBuildLogsSummary | undefined, messages: AgentMessageRecord[]) {
  const file = getActiveLogFile(logs, activeTab);
  if (file) return file.exists ? `${formatBytes(file.sizeBytes)} · ${file.updatedAt}` : "missing";
  if (activeTab === "build") return `${logs?.buildLogs.length ?? 0} files`;
  return `${messages.length} messages`;
}

function describeActiveSource(activeTab: LogTab, file: ProjectLogFileSummary | undefined, logs: ProjectBuildLogsSummary | undefined) {
  if (file) return file.exists ? `${file.relativePath} · ${formatBytes(file.sizeBytes)} · ${file.updatedAt}` : `${file.relativePath} · missing`;
  if (activeTab === "build") return `${logs?.buildLogs.length ?? 0} build log files`;
  return "当前 Agent 会话消息，不写入项目日志。";
}

function countWarnings(logs: ProjectBuildLogsSummary | undefined) {
  const levelCounts = logs?.runtime.levelCounts ?? {};
  const directCounts = Object.entries(levelCounts)
    .filter(([level]) => /warn|error|fatal/i.test(level))
    .reduce((sum, [, count]) => sum + count, 0);
  const watcherErrLines = logs?.runtime.watcherErr?.tailLines.filter(Boolean).length ?? 0;
  const buildFlags = logs?.buildLogs.reduce((sum, entry) => sum + entry.flags.length, 0) ?? 0;
  return directCounts + watcherErrLines + buildFlags;
}

function SourceChip({
  source,
  selected,
  onSelect,
}: {
  source: LogSource;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = source.icon;
  return (
    <button
      type="button"
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
  source: LogSource;
  selected: boolean;
  detail: string;
  onSelect: () => void;
}) {
  const Icon = source.icon;
  return (
    <button
      type="button"
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

function EmptyLogSurface({
  loading,
  activeSource,
  readiness,
}: {
  loading: boolean;
  activeSource: LogSource;
  readiness?: DesktopReadiness;
}) {
  return (
    <div className="flex h-[360px] items-center justify-center rounded-control border border-dashed border-agent-border bg-agent-bg p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-control border border-agent-border-soft bg-agent-panel text-agent-muted">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScrollText className="h-5 w-5" />}
        </div>
        <p className="m-0 text-[14px] font-medium text-agent-text">
          {loading ? `正在读取 ${activeSource.label}` : `暂无 ${activeSource.label}`}
        </p>
        <p className="m-0 mt-2 text-[12px] leading-6 text-agent-muted">
          日志目录：{readiness?.paths.mcpLogDir ?? "-"}。这里只展示真实日志内容，不生成占位日志。
        </p>
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: LogMetric }) {
  return (
    <div className="min-h-[76px] border-b border-agent-border-soft p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 2xl:border-r 2xl:[&:nth-child(2n)]:border-r 2xl:last:border-r-0">
      <p className="m-0 text-[10px] uppercase tracking-normal text-agent-subtle">{metric.label}</p>
      <p
        className={cn(
          "m-0 mt-2 truncate text-[15px] font-medium",
          metric.tone === "good" ? "text-agent-accent" : metric.tone === "warning" ? "text-agent-warning" : metric.tone === "bad" ? "text-[#b03939]" : "text-agent-text"
        )}
        title={metric.value}
      >
        {metric.value}
      </p>
    </div>
  );
}

function BuildLogRow({ entry }: { entry: ProjectBuildLogEntry }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-agent-border-soft bg-agent-bg px-3 py-2 last:border-b-0">
      {entry.flags.length ? <AlertTriangle className="h-4 w-4 shrink-0 text-agent-warning" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-agent-accent" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{entry.heading ?? entry.file.name}</span>
        <span className="block truncate text-[11px] text-agent-muted">{entry.file.relativePath}</span>
      </span>
      <span className="hidden min-w-0 max-w-[180px] truncate text-[11px] text-agent-subtle sm:block">{entry.file.updatedAt}</span>
      <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-panel px-1.5 py-0.5 text-[10px] text-agent-subtle">
        {entry.flags.length ? `${entry.flags.length} flags` : formatBytes(entry.file.sizeBytes)}
      </span>
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
