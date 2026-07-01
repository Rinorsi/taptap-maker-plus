import { useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  Braces,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  FileCode2,
  FileText,
  FolderOpen,
  Image,
  Link2,
  PanelTop,
  Search,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AssetSummary, ProjectBuildLogEntry, ProjectSummary, ToolSummary } from "../../../api";
import type { AgentContextSnapshot, AgentPageState } from "../api";
import { cn, formatBytes } from "../../../lib/utils";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { describeSelection } from "../utils";

type FileContextKind = "asset" | "tool" | "log";

type FileContextEntry = {
  id: string;
  kind: FileContextKind;
  title: string;
  subtitle: string;
  state: "只读" | "可用";
  icon: LucideIcon;
  detail: AssetSummary | ToolSummary | { file: ProjectBuildLogEntry["file"]; flags: string[]; tail: string[] };
};

type FileMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning";
};

const lifecycleRows = [
  { label: "Collect", body: "读取当前 Agent 上下文中的资产、工具和构建日志索引。", state: "可用", tone: "good" },
  { label: "Inspect", body: "条目详情进入只读 preview surface，不写入项目文件。", state: "可用", tone: "good" },
  { label: "Attach", body: "后续将条目作为 composer 附件或 @ 引用传给 Agent。", state: "待接入", tone: "neutral" },
  { label: "Edit", body: "打开编辑器、文件 diff 和写入动作仍需 approval。", state: "待接入", tone: "warning" },
] as const;

export function AgentFilesTab({
  context,
  selectedProject,
  page,
}: {
  context?: AgentContextSnapshot;
  selectedProject?: ProjectSummary;
  page: AgentPageState;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const entries = useMemo(() => buildEntries(context), [context]);
  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const source = needle
      ? entries.filter((entry) => `${entry.title} ${entry.subtitle} ${entry.kind}`.toLowerCase().includes(needle))
      : entries;
    return source.slice(0, 120);
  }, [entries, query]);
  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0];
  const projectName = selectedProject?.name ?? context?.project?.name;
  const rootPath = selectedProject?.rootPath ?? context?.project?.rootPath;
  const assetCount = context?.counts.assets ?? 0;
  const toolCount = context?.counts.tools ?? 0;
  const logCount = context?.counts.buildLogs ?? 0;
  const metrics: FileMetric[] = [
    { label: "Assets", value: String(assetCount), tone: assetCount > 0 ? "good" : "neutral" },
    { label: "Tools", value: String(toolCount), tone: toolCount > 0 ? "good" : "neutral" },
    { label: "Build logs", value: String(logCount), tone: logCount > 0 ? "warning" : "neutral" },
    { label: "Visible", value: String(filteredEntries.length), tone: filteredEntries.length > 0 ? "good" : "neutral" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode2 className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">
              {projectName ? `${projectName} File Context` : "File Context"}
            </h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={<ShieldCheck className="h-3 w-3" />} label="read-only" />
            <InlineStatus icon={<CircleDashed className="h-3 w-3" />} label={context?.generatedAt ?? "snapshot pending"} />
            <InlineStatus icon={<FolderOpen className="h-3 w-3" />} label={rootPath ?? "project root unknown"} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一条上下文待接入"
            aria-label="上一条上下文待接入"
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
            title="下一条上下文待接入"
            aria-label="下一条上下文待接入"
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
                  <p className="m-0 truncate text-[13px] font-medium text-agent-text">File context artifact</p>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                    只读展示 Agent 当前可见资产、工具 schema 和构建日志入口；真实打开、编辑和附件引用保持待接入。
                  </p>
                </div>
                <label className="flex h-9 min-w-[220px] max-w-full items-center gap-2 rounded-control border border-agent-border-soft bg-agent-bg px-3 text-[12px] text-agent-muted transition-colors focus-within:border-agent-accent/45 focus-within:bg-agent-panel">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[12px] text-agent-text outline-none placeholder:text-agent-subtle"
                    placeholder="筛选资产、工具、日志"
                    aria-label="筛选文件上下文"
                  />
                </label>
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
                      <p className="m-0 truncate text-[12px] font-medium text-agent-text">
                        {selectedEntry?.title ?? "No file context"}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                        {selectedEntry?.subtitle ?? "选择项目并刷新上下文后显示真实条目。"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[10px] text-agent-subtle">
                      read-only
                    </span>
                  </div>
                  {selectedEntry ? (
                    <PreviewSurface entry={selectedEntry} />
                  ) : (
                    <EmptyFileSurface />
                  )}
                </div>

                <aside className="border-t border-agent-border-soft bg-agent-bg p-3 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Context entries" subtitle="真实可见条目" />
                  <div className="flex max-h-[520px] flex-col gap-2 overflow-auto pr-1">
                    {filteredEntries.length ? (
                      filteredEntries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          selected={selectedEntry?.id === entry.id}
                          onSelect={() => setSelectedId(entry.id)}
                        />
                      ))
                    ) : (
                      <div className="rounded-control border border-dashed border-agent-border bg-agent-panel p-4 text-[12px] leading-6 text-agent-muted">
                        没有匹配条目。当前不会伪造文件上下文。
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Current selection" subtitle="页面选择和项目边界">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  <InfoRow label="Project" value={projectName ?? "-"} />
                  <InfoRow label="MCP" value={formatRuntimeStatus(context?.runtime?.status ?? selectedProject?.runtime?.status ?? "idle")} />
                  <InfoRow label="Panel" value={context?.page.activeTab ?? page.activeTab ?? "-"} />
                  <InfoRow label="Selection" value={describeSelection(context?.page.selection ?? page.selection)} />
                </div>
              </InfoPanel>
              <InfoPanel title="File readiness" subtitle="当前能力和待接入边界">
                <div className="flex flex-col gap-2">
                  <ReadinessRow label="Asset index" value={`${assetCount} assets`} ready={assetCount > 0} />
                  <ReadinessRow label="Tool schema index" value={`${toolCount} tools`} ready={toolCount > 0} />
                  <ReadinessRow label="Build log index" value={`${logCount} logs`} ready={logCount > 0} />
                  <ReadinessRow label="Open file preview" value="待接入" ready={false} />
                  <ReadinessRow label="Attach to composer" value="待接入" ready={false} />
                </div>
              </InfoPanel>
            </section>

            <section className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
              <PanelTitle title="Lifecycle" subtitle="文件上下文进入 Agent 工作流的骨架" />
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

function buildEntries(context?: AgentContextSnapshot): FileContextEntry[] {
  return [
    ...(context?.assets ?? []).map((asset) => ({
      id: `asset:${asset.id}`,
      kind: "asset" as const,
      title: asset.relativePath,
      subtitle: `${asset.assetType} · ${formatBytes(asset.sizeBytes)} · ${asset.status}`,
      state: "只读" as const,
      icon: asset.assetType === "image" ? Image : FileText,
      detail: asset,
    })),
    ...(context?.tools ?? []).map((tool) => ({
      id: `tool:${tool.name}`,
      kind: "tool" as const,
      title: tool.name,
      subtitle: `${tool.category} · ${tool.required.length} required`,
      state: "只读" as const,
      icon: Wrench,
      detail: tool,
    })),
    ...(context?.buildLogs?.buildLogs ?? []).map((log) => ({
      id: `log:${log.file.relativePath}`,
      kind: "log" as const,
      title: log.file.relativePath,
      subtitle: `${formatBytes(log.file.sizeBytes)} · ${log.file.updatedAt}`,
      state: "只读" as const,
      icon: Braces,
      detail: { file: log.file, flags: log.flags, tail: log.file.tailLines },
    })),
  ];
}

function PreviewSurface({ entry }: { entry: FileContextEntry }) {
  const Icon = entry.icon;
  return (
    <div className="rounded-control border border-agent-border-soft bg-agent-bg">
      <div className="flex min-h-14 items-center gap-3 border-b border-agent-border-soft px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-agent-panel text-agent-muted">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-agent-text">{entry.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-agent-subtle">{entry.subtitle}</span>
        </span>
        <KindPill kind={entry.kind} />
      </div>
      <pre className="m-0 h-[360px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[11px] leading-5 text-agent-muted">
        {JSON.stringify(entry.detail, null, 2)}
      </pre>
    </div>
  );
}

function EntryRow({
  entry,
  selected,
  onSelect,
}: {
  entry: FileContextEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = entry.icon;
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
        <span className="block truncate text-[12px] font-medium text-agent-text">{entry.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-agent-muted">{entry.subtitle}</span>
      </span>
      <span className="shrink-0 rounded-control bg-agent-bg px-1.5 py-0.5 text-[10px] text-agent-subtle">{entry.state}</span>
    </button>
  );
}

function EmptyFileSurface() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-control border border-dashed border-agent-border bg-agent-bg p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-control border border-agent-border-soft bg-agent-panel text-agent-muted">
          <Archive className="h-5 w-5" />
        </div>
        <p className="m-0 text-[14px] font-medium text-agent-text">暂无文件上下文</p>
        <p className="m-0 mt-2 text-[12px] leading-6 text-agent-muted">
          选择项目并刷新 Agent 上下文后，这里会展示真实资产、工具和日志入口。
        </p>
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: FileMetric }) {
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

function KindPill({ kind }: { kind: FileContextKind }) {
  const Icon = kind === "asset" ? PanelTop : kind === "tool" ? Wrench : Link2;
  const label = kind === "asset" ? "asset" : kind === "tool" ? "tool schema" : "log";
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-control border border-agent-border-soft bg-agent-panel px-2 py-1 text-[10px] text-agent-subtle">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
