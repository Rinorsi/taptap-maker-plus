import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ChevronRight, RefreshCw, CheckCircle2, XCircle, Loader2, PlayCircle, Copy } from "lucide-react";
import type { ProjectSummary, TaskRecord } from "../../api";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

type Props = {
  tasks: TaskRecord[];
  projects: ProjectSummary[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClear: () => void;
  onSelectTask: (task: TaskRecord) => void;
  onRefresh: () => void;
};

function projectName(projects: ProjectSummary[], projectId: string) {
  return projects.find((project) => project.id === projectId)?.name ?? projectId;
}

function duration(task: TaskRecord) {
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  const start = new Date(task.startedAt).getTime();
  if (!Number.isFinite(start)) return "-";
  return `${Math.max(0, Math.round((end - start) / 1000))}s`;
}

const statusIcons = {
  "running": <Loader2 className="w-4 h-4 text-[#0a7f72] animate-spin" />,
  "succeeded": <CheckCircle2 className="w-4 h-4 text-[#246b2f]" />,
  "failed": <XCircle className="w-4 h-4 text-[#b03939]" />,
  "idle": <PlayCircle className="w-4 h-4 text-text-subtle" />,
  "queued": <PlayCircle className="w-4 h-4 text-text-subtle" />,
  "canceled": <XCircle className="w-4 h-4 text-text-subtle" />,
} as Record<string, React.ReactNode>;

export function TaskQueue({ tasks, projects, collapsed, onToggleCollapsed, onClear, onSelectTask, onRefresh }: Props) {
  const [expandedTaskId, setExpandedTaskId] = useState("");
  const visibleTasks = tasks.slice(0, 12);

  // Status counts
  const runningCount = tasks.filter(t => t.status === "running").length;
  const failedCount = tasks.filter(t => t.status === "failed").length;
  const successCount = tasks.filter(t => t.status === "succeeded").length;

  const groups = groupByErrorType(visibleTasks);

  return (
    <section className="flex flex-col gap-3 p-3 h-full overflow-hidden" aria-label="任务队列">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 cursor-pointer" onClick={onToggleCollapsed} title={collapsed ? "展开任务队列" : "折叠任务队列"}>
            <span className="block text-[10px] uppercase tracking-wider text-text-subtle font-semibold mb-0.5 leading-none">Task Queue</span>
            <h2 className="text-sm font-bold text-text m-0 truncate leading-tight">生成 / 写入 / 构建 / 同步</h2>
          </div>
          
          {/* Status Counts Badge Row */}
          <div className="flex items-center gap-2 text-[10px] shrink-0 font-bold">
            {runningCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0a7f72]/10 text-[#0a7f72] animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{runningCount} 运行中</span>
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#b03939]/10 text-[#b03939]">
                <XCircle className="w-3.5 h-3.5" />
                <span>{failedCount} 失败</span>
              </span>
            )}
            {successCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#246b2f]/10 text-[#246b2f]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{successCount} 成功</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 gap-1.5 px-2.5 rounded-control text-xs">
            清空
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggleCollapsed} className="w-7 h-7 rounded-control" title={collapsed ? "展开任务队列" : "折叠任务队列"}>
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={onRefresh} className="h-7 gap-1.5 px-2.5 rounded-control shadow-sm text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </Button>
        </div>
      </div>
      
      {/* Task List - only render when expanded */}
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            <AnimatePresence initial={false}>
              {visibleTasks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="col-span-full p-6 text-center border border-dashed border-border-soft text-text-muted rounded-panel text-xs"
                >
                  暂无 MCP 调用任务
                </motion.div>
              ) : null}
              
              {Object.entries(groups).flatMap(([groupName, groupTasks]) => [
                <div key={`${groupName}-heading`} className="col-span-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#b03939]">
                  <span className="h-px flex-1 bg-[#b03939]/20" />
                  <span>{groupName}</span>
                  <span className="rounded-pill bg-[#b03939]/10 px-2 py-0.5">{groupTasks.length}</span>
                  <span className="h-px flex-1 bg-[#b03939]/20" />
                </div>,
                ...groupTasks.map((task) => {
                const expanded = expandedTaskId === task.taskId;
                const isRunning = task.status === "running";
                const isFailed = task.status === "failed";
                const isSuccess = task.status === "succeeded";
                
                return (
                  <motion.article 
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    key={task.taskId} 
                    className={cn(
                      "flex flex-col text-left p-2.5 rounded-card border bg-surface-raised cursor-pointer transition-colors shadow-sm",
                      isFailed ? "border-[#b03939]/30 hover:border-[#b03939]/50" : 
                      isSuccess ? "border-[#246b2f]/30 hover:border-[#246b2f]/50" :
                      isRunning ? "border-brand/40 shadow-[0_0_0_1px_rgba(0,217,197,0.1)] hover:border-brand" : 
                      "border-border-soft hover:border-border"
                    )}
                    onClick={() => onSelectTask(task)}
                  >
                    <div className="flex items-start gap-2">
                      <button 
                        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-control hover:bg-surface-muted transition-colors text-text-subtle mt-0.5" 
                        type="button" 
                        onClick={(event) => { event.stopPropagation(); setExpandedTaskId(expanded ? "" : task.taskId); }}
                      >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      
                      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs font-semibold text-text truncate leading-tight">{task.toolName}</strong>
                          <div className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-text-muted">
                            {statusIcons[task.status] || statusIcons.idle}
                            <span className="tabular-nums">{duration(task)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 text-[10px] text-text-subtle">
                          <span className="truncate max-w-[120px]">{projectName(projects, task.projectId)}</span>
                          <span className="truncate capitalize">{task.status}</span>
                        </div>
                        
                        <small className="text-[10px] text-text-subtle truncate max-w-[90%]">{task.inputSummary}</small>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 flex items-center justify-end">
                            <button type="button" className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] font-semibold text-text-subtle hover:bg-surface-muted hover:text-text" onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(task.errorMessage || task.rawResultJson || task.inputJson); }}>
                              <Copy className="h-3 w-3" />
                              复制 raw/error
                            </button>
                          </div>
                          <pre className="mt-1 p-2 bg-surface-muted rounded-control text-[10px] font-mono text-text-muted whitespace-pre-wrap break-words max-h-[140px] overflow-y-auto scrollbar-thin">
                            {formatTaskDetails(task)}
                          </pre>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })
              ])}
            </AnimatePresence>
          </div>
        </div>
      )}
    </section>
  );
}

function groupByErrorType(tasks: TaskRecord[]) {
  const groups: Record<string, TaskRecord[]> = {};
  for (const task of tasks) {
    const name = task.status === "failed" ? classifyError(task) : task.status;
    groups[name] = groups[name] ?? [];
    groups[name].push(task);
  }
  return groups;
}

function classifyError(task: TaskRecord) {
  const text = `${task.errorMessage ?? ""}\n${task.rawResultJson ?? ""}`.toLowerCase();
  if (text.includes("timeout") || text.includes("timed out")) return "timeout";
  if (text.includes("schema") || text.includes("validation") || text.includes("invalid")) return "schema / validation";
  if (text.includes("mcp") || text.includes("runtime") || text.includes("stdio")) return "mcp runtime";
  if (text.includes("network") || text.includes("fetch") || text.includes("504")) return "network";
  return "tool error";
}

function formatTaskDetails(task: TaskRecord) {
  return [
    task.errorMessage ? `errorMessage:\n${task.errorMessage}` : "",
    task.rawResultJson ? `rawResultJson:\n${task.rawResultJson}` : "",
    `inputJson:\n${task.inputJson}`
  ].filter(Boolean).join("\n\n");
}
