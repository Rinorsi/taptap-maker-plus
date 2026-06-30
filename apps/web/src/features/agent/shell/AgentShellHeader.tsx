import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import type { AgentMode, AgentSessionRecord, PiAgentRuntimeStatus } from "../api";
import type { ProjectSummary, RuntimeStatus } from "../../../api";
import { Button } from "../../../components/ui/Button";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { cn } from "../../../lib/utils";

const shellModeLabels: Record<AgentMode, string> = {
  observe: "观察",
  draft: "建议动作",
  execute: "等待确认",
};

const shellModeDescriptions: Record<AgentMode, string> = {
  observe: "只读取上下文",
  draft: "生成草案和动作预览",
  execute: "只执行已审批动作",
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
    <header className="flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#111318] px-4 text-zinc-200">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-md px-2 text-zinc-300 hover:bg-white/10 hover:text-white"
          onClick={onExit}
          title="返回主工作台"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="h-6 w-px bg-white/10" />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-sm font-semibold text-zinc-100">
              {activeSession?.title ?? "Agent 工作台"}
            </strong>
          </div>
          <p className="m-0 mt-0.5 truncate text-[11px] text-zinc-500">
            {project ? `${project.name} · ${project.rootPath}` : "未选择项目"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
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
        <div className="hidden items-center rounded-md border border-white/10 bg-black/20 p-0.5 md:flex">
          {(["observe", "draft", "execute"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              disabled={!activeSession}
              className={cn(
                "h-7 rounded px-2.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                activeSession?.mode === mode
                  ? "bg-cyan-400/15 text-cyan-100 shadow-sm"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200",
              )}
              title={shellModeDescriptions[mode]}
            >
              {shellModeLabels[mode]}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
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
        "hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium lg:inline-flex",
        tone === "good"
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-zinc-400",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
