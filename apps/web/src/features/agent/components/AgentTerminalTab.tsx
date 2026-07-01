import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Code2,
  History,
  Loader2,
  Play,
  RefreshCw,
  Rows3,
  ShieldCheck,
  SquareTerminal,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { DesktopReadiness, RuntimeStatus } from "../../../api";
import {
  runAgentTerminalSnapshot,
  type AgentContextSnapshot,
  type AgentTerminalSnapshot,
  type AgentTerminalSnapshotCommandId,
  type PiAgentRuntimeStatus,
} from "../api";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

type TerminalCommandRow = {
  commandId: AgentTerminalSnapshotCommandId;
  label: string;
  body: string;
  state: "只读" | "可用";
  icon: LucideIcon;
};

type TerminalMetric = {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "bad";
};

const commandRows: TerminalCommandRow[] = [
  { commandId: "workspace_status", label: "Workspace status", body: "读取 MCP 工作区 Git 状态。", state: "只读", icon: Rows3 },
  { commandId: "git_status", label: "Project Git", body: "读取当前项目根目录 Git 状态。", state: "只读", icon: History },
  { commandId: "node_version", label: "Node version", body: "读取受管 Node 版本。", state: "只读", icon: Code2 },
  { commandId: "npm_version", label: "npm version", body: "读取受管 npm 版本。", state: "只读", icon: Code2 },
  { commandId: "where_node_npm_npx", label: "Command paths", body: "定位 node、npm、npx 的真实路径。", state: "只读", icon: SquareTerminal },
  { commandId: "npm_cache_config", label: "npm cache", body: "读取 npm cache 配置。", state: "只读", icon: Terminal },
];

const lifecycleRows = [
  { label: "Request", body: "点击命令后由服务端运行白名单命令。", state: "可用", tone: "good" },
  { label: "Snapshot", body: "stdout、stderr、退出码和耗时会进入只读 surface。", state: "可用", tone: "good" },
  { label: "Approval", body: "任意自定义命令和写入动作必须走动作预览审批。", state: "待接入", tone: "warning" },
  { label: "Stream", body: "交互式终端和实时日志流等待 Pi Runtime Bridge。", state: "待接入", tone: "neutral" },
] as const;

export function AgentTerminalTab({
  context,
  readiness,
  runtimeStatus,
  pi,
}: {
  context?: AgentContextSnapshot;
  readiness?: DesktopReadiness;
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
}) {
  const [snapshot, setSnapshot] = useState<AgentTerminalSnapshot>();
  const [history, setHistory] = useState<AgentTerminalSnapshot[]>([]);
  const [runningCommand, setRunningCommand] = useState<AgentTerminalSnapshotCommandId>();
  const [error, setError] = useState("");

  async function run(commandId: AgentTerminalSnapshotCommandId) {
    setRunningCommand(commandId);
    setError("");
    try {
      const nextSnapshot = await runAgentTerminalSnapshot({ commandId, projectId: context?.project?.id });
      setSnapshot(nextSnapshot);
      setHistory((items) => [nextSnapshot, ...items].slice(0, 6));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunningCommand(undefined);
    }
  }

  const outputText = useMemo(() => {
    if (!snapshot) return "";
    const parts = [
      `$ ${formatTerminalCommand(snapshot)}`,
      `cwd: ${snapshot.cwd}`,
      `exit: ${snapshot.exitCode ?? "-"}`,
      "",
      snapshot.stdout || "<stdout empty>",
    ];
    if (snapshot.stderr) parts.push("", "[stderr]", snapshot.stderr);
    return parts.join("\n");
  }, [snapshot]);

  const selectedCommand = commandRows.find((row) => row.commandId === snapshot?.commandId);
  const piConnected = Boolean(pi?.connected);
  const exitTone = snapshot?.exitCode === undefined ? "neutral" : snapshot.exitCode === 0 ? "good" : "bad";
  const metrics: TerminalMetric[] = [
    { label: "Command", value: snapshot ? snapshot.label : runningCommand ? commandRows.find((row) => row.commandId === runningCommand)?.label ?? runningCommand : "Select a snapshot" },
    { label: "Exit", value: snapshot?.exitCode === undefined ? "-" : String(snapshot.exitCode), tone: exitTone },
    { label: "Duration", value: snapshot ? `${snapshot.durationMs}ms` : runningCommand ? "running" : "-" },
    { label: "Runtime", value: runtimeStatus, tone: runtimeStatus === "ready" ? "good" : "warning" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Terminal className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">
              {context?.project?.name ? `${context.project.name} Terminal Snapshot` : "Terminal Snapshot"}
            </h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={<ShieldCheck className="h-3 w-3" />} label="whitelist only" />
            <InlineStatus icon={<CircleDashed className="h-3 w-3" />} label={snapshot?.generatedAt ?? "snapshot pending"} />
            <InlineStatus icon={piConnected ? <CheckCircle2 className="h-3 w-3 text-agent-accent" /> : <CircleDashed className="h-3 w-3" />} label={piConnected ? "Pi connected" : "Pi 待接入"} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一条快照待接入"
            aria-label="上一条快照待接入"
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
            title="下一条快照待接入"
            aria-label="下一条快照待接入"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 h-8 gap-1.5 border-agent-border bg-agent-bg px-2 text-[11px] text-agent-muted hover:bg-agent-surface hover:text-agent-text"
            disabled={Boolean(runningCommand) || !snapshot}
            onClick={() => snapshot && void run(snapshot.commandId)}
          >
            {runningCommand === snapshot?.commandId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
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
                  <p className="m-0 truncate text-[13px] font-medium text-agent-text">Terminal artifact snapshot</p>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                    只运行服务端白名单命令；交互式终端、自定义命令和写入动作保持待审批。
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  {commandRows.slice(0, 3).map((row) => (
                    <CommandChip
                      key={row.commandId}
                      row={row}
                      selected={snapshot?.commandId === row.commandId}
                      running={runningCommand === row.commandId}
                      disabled={Boolean(runningCommand)}
                      onRun={() => void run(row.commandId)}
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
                      <p className="m-0 truncate text-[12px] font-medium text-agent-text">
                        {snapshot ? selectedCommand?.label ?? snapshot.label : "No terminal snapshot"}
                      </p>
                      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                        {snapshot ? formatTerminalCommand(snapshot) : "选择一个只读命令后显示真实输出。"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[10px] text-agent-subtle">
                      read-only
                    </span>
                  </div>
                  {snapshot ? (
                    <pre className="m-0 h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-control border border-agent-border-soft bg-[#101418] p-4 font-mono text-[12px] leading-6 text-zinc-300">
                      {outputText}
                    </pre>
                  ) : (
                    <EmptyTerminalSurface runningCommand={runningCommand} />
                  )}
                </div>

                <aside className="border-t border-agent-border-soft bg-agent-bg p-3 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Snapshot commands" subtitle="真实白名单能力" />
                  <div className="flex flex-col gap-2">
                    {commandRows.map((row) => (
                      <CommandRow
                        key={row.commandId}
                        row={row}
                        selected={snapshot?.commandId === row.commandId}
                        running={runningCommand === row.commandId}
                        disabled={Boolean(runningCommand)}
                        onRun={() => void run(row.commandId)}
                      />
                    ))}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Lifecycle" subtitle="命令快照到产物区的状态骨架">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {lifecycleRows.map((row) => (
                    <LifecycleRow key={row.label} row={row} />
                  ))}
                </div>
              </InfoPanel>
              <InfoPanel title="Terminal readiness" subtitle="当前能力和待接入边界">
                <div className="flex flex-col gap-2">
                  <ReadinessRow label="Whitelist command snapshots" value="可用" ready />
                  <ReadinessRow label="Managed runtime env" value={readiness ? `${readiness.server.host}:${readiness.server.port}` : "unknown"} ready={Boolean(readiness)} />
                  <ReadinessRow label="Interactive terminal" value="待接入" ready={false} />
                  <ReadinessRow label="Streaming logs" value="待接入" ready={false} />
                  <ReadinessRow label="Custom command approval" value="待审批接入" ready={false} />
                </div>
              </InfoPanel>
            </section>

            {history.length > 0 ? (
              <section className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
                <PanelTitle title="Snapshot history" subtitle="本页临时历史，不写入后端会话" />
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {history.map((item) => (
                    <HistoryRow key={`${item.commandId}-${item.generatedAt}`} snapshot={item} />
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

function formatTerminalCommand(snapshot: AgentTerminalSnapshot) {
  return `${snapshot.displayCommand ?? snapshot.command} ${(snapshot.displayArgs ?? snapshot.args).join(" ")}`.trim();
}

function CommandChip({
  row,
  selected,
  running,
  disabled,
  onRun,
}: {
  row: TerminalCommandRow;
  selected: boolean;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-[11px] transition-colors",
        selected ? "border-agent-accent/30 bg-agent-accent/10 text-agent-accent" : "border-agent-border-soft bg-agent-bg text-agent-muted hover:bg-agent-surface hover:text-agent-text",
        disabled && "cursor-default opacity-70"
      )}
    >
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {row.label}
    </button>
  );
}

function CommandRow({
  row,
  selected,
  running,
  disabled,
  onRun,
}: {
  row: TerminalCommandRow;
  selected: boolean;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  const Icon = row.icon;
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className={cn(
        "group flex min-h-12 items-center gap-3 rounded-control border p-3 text-left transition-colors",
        selected ? "border-agent-accent/25 bg-agent-accent/10" : "border-agent-border-soft bg-agent-panel hover:bg-agent-surface",
        disabled && "cursor-default opacity-70"
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-agent-bg text-agent-muted group-hover:text-agent-text">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{row.label}</span>
        <span className="mt-0.5 block line-clamp-2 text-[11px] leading-5 text-agent-muted">{row.body}</span>
      </span>
      <span className="shrink-0 rounded-control bg-agent-bg px-1.5 py-0.5 text-[10px] text-agent-subtle">{row.state}</span>
    </button>
  );
}

function EmptyTerminalSurface({ runningCommand }: { runningCommand?: AgentTerminalSnapshotCommandId }) {
  const label = runningCommand ? commandRows.find((row) => row.commandId === runningCommand)?.label ?? runningCommand : "";
  return (
    <div className="flex h-[360px] items-center justify-center rounded-control border border-dashed border-agent-border bg-agent-bg p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-control border border-agent-border-soft bg-agent-panel text-agent-muted">
          {runningCommand ? <Loader2 className="h-5 w-5 animate-spin" /> : <Terminal className="h-5 w-5" />}
        </div>
        <p className="m-0 text-[14px] font-medium text-agent-text">
          {runningCommand ? `正在读取 ${label}` : "等待终端快照"}
        </p>
        <p className="m-0 mt-2 text-[12px] leading-6 text-agent-muted">
          这里不会提供自由命令输入；当前只展示真实白名单命令的只读输出。
        </p>
      </div>
    </div>
  );
}

function MetricTile({ metric }: { metric: TerminalMetric }) {
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

function HistoryRow({ snapshot }: { snapshot: AgentTerminalSnapshot }) {
  const exitOk = snapshot.exitCode === 0;
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-agent-border-soft bg-agent-bg px-3 py-2 last:border-b-0">
      {exitOk ? <CheckCircle2 className="h-4 w-4 shrink-0 text-agent-accent" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-[#b03939]" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{snapshot.label}</span>
        <span className="block truncate font-mono text-[11px] text-agent-muted">{formatTerminalCommand(snapshot)}</span>
      </span>
      <span className="hidden min-w-0 max-w-[220px] truncate text-[11px] text-agent-subtle sm:block">{snapshot.generatedAt}</span>
      <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-panel px-1.5 py-0.5 text-[10px] text-agent-subtle">
        exit {snapshot.exitCode ?? "-"}
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
