import { useEffect, useMemo, useState } from "react";
import { Bot, Clock, Database, FileText, FolderOpen, ListChecks, Loader2, RefreshCw, Server, Sparkles, Wrench } from "lucide-react";
import { getAgentContext, getDesktopReadiness, type AgentContextSnapshot, type AgentPageState, type AgentSelectionReference, type DesktopReadiness, type ProjectSummary } from "../../api";
import { RawViewer } from "../../components/developer/RawViewer";
import { Button } from "../../components/ui/Button";
import { formatRuntimeStatus } from "../../lib/runtimeStatus";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  page: AgentPageState;
};

export function AgentContextView({ project, page }: Props) {
  const [context, setContext] = useState<AgentContextSnapshot>();
  const [readiness, setReadiness] = useState<DesktopReadiness>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void refreshContext();
  }, [project?.id, page.activeTab, page.selection]);

  async function refreshContext() {
    setLoading(true);
    setError("");
    try {
      const [nextContext, nextReadiness] = await Promise.all([
        getAgentContext(project?.id, page),
        getDesktopReadiness().catch(() => undefined)
      ]);
      setContext(nextContext);
      setReadiness(nextReadiness);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  const runtimeStatus = context?.runtime?.status ?? project?.runtime?.status ?? "idle";
  const selectedProject = context?.project ?? project;
  const contextRows = useMemo(() => buildContextRows(context), [context]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            <Bot className="h-3.5 w-3.5" />
            Developer Context
          </span>
          <h1 className="m-0 truncate text-xl font-bold text-text">开发者模式 / 助手上下文</h1>
          <p className="m-0 mt-1 max-w-3xl text-sm text-text-muted">
            只读取 Fastify 汇总的桌面、项目、MCP 运行时、工具、任务、资产、工作流和日志摘要，不执行 MCP 工具。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshContext()} disabled={loading} className="h-8 shrink-0 gap-1.5 px-2.5 text-xs">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          刷新
        </Button>
      </div>

      {error ? (
        <div className="rounded-large border border-[#b03939]/25 bg-[#b03939]/5 p-4 text-xs text-[#b03939]">{error}</div>
      ) : null}

      <div className="grid shrink-0 gap-3 md:grid-cols-4">
        <ContextStat icon={<Server className="h-4 w-4" />} label="MCP 状态" value={formatRuntimeStatus(runtimeStatus)} tone={runtimeStatus === "ready" ? "good" : runtimeStatus === "error" ? "bad" : "neutral"} />
        <ContextStat icon={<Wrench className="h-4 w-4" />} label="API" value={readiness ? `${readiness.server.host}:${readiness.server.port}` : "-"} tone={readiness?.ok ? "good" : "neutral"} />
        <ContextStat icon={<Sparkles className="h-4 w-4" />} label="工具" value={String(context?.counts.tools ?? 0)} tone="brand" />
        <ContextStat icon={<ListChecks className="h-4 w-4" />} label="任务" value={String(context?.counts.tasks ?? 0)} tone="neutral" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
        <ContextPanel icon={<FileText className="h-4 w-4" />} title="当前选择">
          <InfoRow label="项目" value={selectedProject?.name ?? "-"} />
          <InfoRow label="项目路径" value={selectedProject?.rootPath ?? "-"} />
          <InfoRow label="右侧面板" value={context?.page.activeTab ?? page.activeTab ?? "-"} />
          <InfoRow label="选择对象" value={describeSelection(context?.page.selection ?? page.selection)} />
          <InfoRow label="生成时间" value={context?.generatedAt ?? "-"} />
        </ContextPanel>

        <ContextPanel icon={<Clock className="h-4 w-4" />} title="运行证据">
          <InfoRow label="processId" value={context?.runtime?.processId ? String(context.runtime.processId) : "-"} />
          <InfoRow label="cwd" value={context?.runtime?.cwd ?? selectedProject?.rootPath ?? "-"} />
          <InfoRow label="tools/list 更新时间" value={context?.toolsListSnapshot?.updatedAt ?? context?.runtime?.toolsListUpdatedAt ?? "-"} />
          <InfoRow label="lastError" value={context?.runtime?.lastError ?? "-"} tone={context?.runtime?.lastError ? "bad" : "neutral"} />
        </ContextPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ContextPanel icon={<Server className="h-4 w-4" />} title="桌面服务">
          <InfoRow label="mode" value={readiness?.mode ?? "-"} />
          <InfoRow label="server" value={readiness ? `${readiness.server.host}:${readiness.server.port}` : "-"} />
          <InfoRow label="TAPTAP_DATA_DIR" value={readiness?.env.TAPTAP_DATA_DIR ?? "-"} />
          <InfoRow label="TAPTAP_MCP_ENV" value={readiness?.env.TAPTAP_MCP_ENV ?? "-"} />
        </ContextPanel>

        <ContextPanel icon={<FolderOpen className="h-4 w-4" />} title="关键目录">
          <InfoRow label="database" value={readiness?.paths.databasePath ?? "-"} />
          <InfoRow label="npm cache" value={readiness?.paths.makerNpmCacheDir ?? "-"} />
          <InfoRow label="MCP logs" value={readiness?.paths.mcpLogDir ?? "-"} />
          <InfoRow label="web dist" value={readiness?.paths.webDistDir ?? "-"} />
        </ContextPanel>

        <ContextPanel icon={<Database className="h-4 w-4" />} title="上下文计数">
          {contextRows.map((row) => <InfoRow key={row.label} label={row.label} value={row.value} />)}
        </ContextPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ContextPanel icon={<Sparkles className="h-4 w-4" />} title="工具摘要">
          {context?.tools.length ? context.tools.slice(0, 12).map((tool) => (
            <InfoRow key={tool.name} label={tool.name} value={`${tool.category} · required ${tool.required.length}`} />
          )) : <EmptyLine text="未读取到工具列表。" />}
        </ContextPanel>

        <ContextPanel icon={<ListChecks className="h-4 w-4" />} title="最近任务">
          {context?.tasks.length ? context.tasks.slice(0, 10).map((task) => (
            <InfoRow key={task.taskId} label={task.toolName} value={`${task.status} · ${task.startedAt}`} tone={task.status === "failed" ? "bad" : "neutral"} />
          )) : <EmptyLine text="暂无任务记录。" />}
        </ContextPanel>

        <ContextPanel icon={<FileText className="h-4 w-4" />} title="构建日志">
          <InfoRow label="日志文件" value={String(context?.counts.buildLogs ?? 0)} />
          <InfoRow label="runtime.log" value={context?.buildLogs?.runtime.runtimeLog?.exists ? context.buildLogs.runtime.runtimeLog.relativePath : "-"} />
          <InfoRow label="watcher.out.log" value={context?.buildLogs?.runtime.watcherOut?.exists ? context.buildLogs.runtime.watcherOut.relativePath : "-"} />
          <InfoRow label="watcher.err.log" value={context?.buildLogs?.runtime.watcherErr?.exists ? context.buildLogs.runtime.watcherErr.relativePath : "-"} />
        </ContextPanel>
      </div>

      <div className="grid min-h-[420px] gap-4 xl:grid-cols-2">
        <RawViewer
          title="agent/context raw"
          value={context ? JSON.stringify(context, null, 2) : ""}
          emptyText="暂无 agent context"
          height="420px"
        />
        <RawViewer
          title="desktop/readiness raw"
          value={readiness ? JSON.stringify(readiness, null, 2) : ""}
          emptyText="暂无 desktop readiness"
          height="420px"
        />
      </div>
    </section>
  );
}

function buildContextRows(context?: AgentContextSnapshot) {
  return [
    { label: "项目", value: String(context?.counts.projects ?? 0) },
    { label: "工具", value: String(context?.counts.tools ?? 0) },
    { label: "任务", value: String(context?.counts.tasks ?? 0) },
    { label: "生成记录", value: String(context?.counts.generations ?? 0) },
    { label: "资产", value: String(context?.counts.assets ?? 0) },
    { label: "工作流", value: String(context?.counts.workflows ?? 0) },
    { label: "工作流运行", value: String(context?.counts.workflowRuns ?? 0) },
    { label: "Credits", value: String(context?.counts.credits ?? 0) }
  ];
}

function describeSelection(selection?: AgentSelectionReference) {
  if (!selection) return "-";
  if (selection.type === "project") return `project: ${selection.projectId}`;
  if (selection.type === "tool") return `tool: ${selection.toolName}`;
  if (selection.type === "task") return `task: ${selection.taskId}`;
  return `asset: ${selection.relativePath}`;
}

function ContextPanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-soft px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-control bg-brand/10 text-brand-strong">{icon}</div>
        <h2 className="m-0 text-sm font-bold text-text">{title}</h2>
      </div>
      <div className="grid gap-1 p-2">{children}</div>
    </section>
  );
}

function ContextStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "good" | "bad" | "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-large border border-border bg-surface-panel p-4 shadow-sm">
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
        tone === "brand" ? "bg-brand/10 text-brand-strong" : tone === "good" ? "bg-[#246b2f]/10 text-[#246b2f]" : tone === "bad" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted"
      )}>{icon}</div>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle">{label}</span>
        <strong className="block truncate text-sm text-text">{value}</strong>
      </div>
    </div>
  );
}

function InfoRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "bad" | "neutral" }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-control px-3 py-2 hover:bg-surface-muted">
      <span className="shrink-0 text-xs font-semibold text-text-subtle">{label}</span>
      <strong className={cn("min-w-0 truncate text-right text-xs font-semibold", tone === "bad" ? "text-[#b03939]" : "text-text")} title={value}>{value}</strong>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="m-0 px-3 py-2 text-xs text-text-muted">{text}</p>;
}
