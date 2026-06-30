import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentMode, AgentSessionRecord, PiAgentRuntimeStatus } from "../api";
import type { ProjectSummary, RuntimeStatus } from "../../../api";
import { Button } from "../../../components/ui/Button";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { cn } from "../../../lib/utils";
import { modeDescriptions, modeLabels } from "../utils";

const shellModeLabels: Record<AgentMode, string> = {
  observe: "观察",
  draft: "建议动作",
  execute: "等待确认",
};

export function AgentShellHeader({
  project,
  activeSession,
  runtimeStatus,
  pi,
  loading,
  onExit,
  onRefresh,
  onModeChange,
}: {
  project?: ProjectSummary;
  activeSession?: AgentSessionRecord;
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
  loading: boolean;
  onExit: () => void;
  onRefresh: () => void;
  onModeChange: (mode: AgentMode) => void;
}) {
  return (
    <header className="flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-agent-border bg-agent-panel px-4 text-agent-text">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-control px-2 text-agent-muted hover:bg-agent-surface hover:text-agent-text"
          onClick={onExit}
          title="返回主工作台"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="h-6 w-px bg-agent-border" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm font-semibold text-agent-text">
              {activeSession?.title ?? "Agent 工作台"}
            </strong>
          </div>
          <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
            {project ? `${project.name} · ${project.rootPath}` : "未选择项目"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {activeSession ? (
          <span
            className="hidden h-8 items-center gap-1.5 rounded-control border border-agent-border-soft bg-agent-bg px-2.5 text-[11px] font-medium text-agent-muted md:inline-flex"
            title={modeDescriptions[activeSession.mode]}
          >
            模式
            <strong className="font-semibold text-agent-text">{modeLabels[activeSession.mode] ?? shellModeLabels[activeSession.mode]}</strong>
          </span>
        ) : null}
        <StatusPill
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          label={`MCP ${formatRuntimeStatus(runtimeStatus)}`}
          tone={runtimeStatus === "ready" ? "good" : "muted"}
        />
        <StatusPill
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label={pi?.connected ? "Pi Runtime 已连接" : "Pi Runtime 待接入"}
          tone={pi?.connected ? "good" : "muted"}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-control text-agent-muted hover:bg-agent-surface hover:text-agent-text"
          onClick={onRefresh}
          disabled={loading}
          title="刷新 Agent 上下文"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: "good" | "muted";
}) {
  return (
    <span
      className={cn(
        "hidden h-8 items-center gap-1.5 rounded-control border px-2.5 text-[11px] font-medium lg:inline-flex",
        tone === "good"
          ? "border-agent-accent/20 bg-agent-accent/10 text-agent-accent"
          : "border-agent-border-soft bg-agent-bg text-agent-muted",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
