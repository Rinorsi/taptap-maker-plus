import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Copy, Loader2, Search, Terminal } from "lucide-react";
import type { TaskRecord } from "../../api";
import { RawViewer } from "../../components/developer";
import { Input } from "../../components/ui/Input";
import { copyText } from "../../lib/clipboard";
import { formatRunTaskDetails } from "../../lib/taskResult";
import { cn } from "../../lib/utils";

type Props = { tasks: TaskRecord[]; onSelectTask: (task: TaskRecord) => void };

const statusOptions = ["all", "running", "succeeded", "failed", "queued", "canceled"];

export function RunsView({ tasks, onSelectTask }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.taskId ?? "");
  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status !== "all" && task.status !== status) return false;
      if (!needle) return true;
      return task.toolName.toLowerCase().includes(needle) || task.inputSummary.toLowerCase().includes(needle) || task.taskId.toLowerCase().includes(needle);
    });
  }, [query, status, tasks]);
  const selectedTask = filteredTasks.find((task) => task.taskId === selectedTaskId) ?? filteredTasks[0];

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            <Terminal className="h-3.5 w-3.5" />
            Runs
          </span>
          <h1 className="m-0 text-xl font-bold text-text">运行记录</h1>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索工具、任务 ID、输入摘要" />
        </div>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto rounded-large border border-border bg-surface-panel p-1">
        {statusOptions.map((option) => (
          <button key={option} type="button" onClick={() => setStatus(option)} className={cn("rounded-control px-3 py-1.5 text-xs font-semibold capitalize", status === option ? "bg-brand/10 text-brand-strong" : "text-text-muted hover:bg-surface-muted hover:text-text")}>
            {option}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)] gap-4 overflow-hidden max-[980px]:grid-cols-1">
        <div className="min-h-0 overflow-y-auto rounded-large border border-border bg-surface-panel p-2 shadow-sm">
          {filteredTasks.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">没有匹配的任务。</div>
          ) : filteredTasks.map((task) => (
            <button
              key={task.taskId}
              type="button"
              onClick={() => { setSelectedTaskId(task.taskId); onSelectTask(task); }}
              className={cn(
                "mb-1 flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left",
                selectedTask?.taskId === task.taskId ? "border-brand/50 bg-brand/10" : "border-transparent hover:border-border-soft hover:bg-surface-muted"
              )}
            >
              <StatusIcon status={task.status} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs text-text">{task.toolName}</strong>
                <span className="block truncate text-[10px] text-text-subtle">{task.inputSummary}</span>
              </span>
              <span className="rounded-pill bg-surface-muted px-2 py-0.5 text-[9px] font-bold uppercase text-text-subtle">{task.status}</span>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3">
            <div className="min-w-0">
              <h2 className="m-0 truncate text-sm font-bold text-text">{selectedTask?.toolName ?? "未选择任务"}</h2>
              <p className="mt-1 truncate text-[11px] text-text-subtle">{selectedTask?.taskId ?? "-"}</p>
            </div>
            <button
              type="button"
              disabled={!selectedTask}
              onClick={() => selectedTask && void copyText(formatRunTaskDetails(selectedTask), { successMessage: "任务 raw/error 已复制" })}
              className="inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              复制 raw/error
            </button>
          </div>
          <RawViewer
            title="任务详情"
            language="log"
            value={selectedTask ? formatRunTaskDetails(selectedTask) : ""}
            emptyText="暂无任务详情"
            height="100%"
            copyLabel="复制 raw/error"
            copySuccessMessage="任务详情已复制"
            className="flex-1 rounded-none border-0"
          />
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: TaskRecord["status"] }) {
  if (status === "running") return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-strong" />;
  if (status === "succeeded") return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#246b2f]" />;
  if (status === "failed") return <CircleAlert className="h-4 w-4 shrink-0 text-[#b03939]" />;
  return <Terminal className="h-4 w-4 shrink-0 text-text-subtle" />;
}
