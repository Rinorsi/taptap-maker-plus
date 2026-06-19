import { useState, useMemo, useEffect } from "react";
import { 
  Info, Cpu, Terminal, MessageSquare, Play, RefreshCw, Activity, 
  Search, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, PlayCircle,
  FileJson, Hash, PanelRightClose, Copy, CircleAlert, Check, Trash2, AlertCircle
} from "lucide-react";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { cn } from "../../lib/utils";

export type InspectorSelection =
  | { type: "project"; item: ProjectSummary }
  | { type: "tool"; item: ToolSummary }
  | { type: "task"; item: TaskRecord }
  | { type: "asset"; item: AssetSummary }
  | undefined;

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  selection: InspectorSelection;
  minimized: boolean;
  activeTab: "status" | "tools" | "logs" | "errors";
  onTabChange: (tab: "status" | "tools" | "logs" | "errors") => void;
  onToggleMinimized: () => void;
  onStartRuntime: () => void;
  onRefreshTools: () => void;
  onStatusLite: () => void;
  onSelectSelection: (selection: InspectorSelection) => void;
  onClearTasks: () => void;
  onRefreshTasks: () => void;
  onDeleteTask: (taskId: string) => void;
  onRecoverVideoTask?: (taskId: string) => void;
};

export function AgentInspectorPanel({ 
  project, 
  tools, 
  tasks, 
  selection, 
  minimized, 
  activeTab, 
  onTabChange, 
  onToggleMinimized, 
  onStartRuntime, 
  onRefreshTools, 
  onStatusLite,
  onSelectSelection,
  onClearTasks,
  onRefreshTasks,
  onDeleteTask,
  onRecoverVideoTask
}: Props) {

  const handleTabClick = (tab: "status" | "tools" | "logs" | "errors") => {
    if (minimized) {
      onTabChange(tab);
      onToggleMinimized();
    } else if (activeTab === tab) {
      onToggleMinimized();
    } else {
      onTabChange(tab);
    }
  };

  return (
    <div className="h-full w-full flex min-h-0 overflow-hidden bg-surface-panel select-none">
      {/* Left Vertical Tab Strip Column */}
      <div className="w-12 shrink-0 border-r border-border bg-surface-muted/40 flex flex-col items-center py-3.5 gap-4">
        <TabIconButton 
          active={activeTab === "status" && !minimized} 
          onClick={() => handleTabClick("status")} 
          icon={<Info className="w-5 h-5" />} 
          label="MCP 状态"
        />
        <TabIconButton 
          active={activeTab === "tools" && !minimized} 
          onClick={() => handleTabClick("tools")} 
          icon={<Cpu className="w-5 h-5" />} 
          label="MCP 工具箱 (MCP Tools)"
        />
        <TabIconButton 
          active={activeTab === "logs" && !minimized} 
          onClick={() => handleTabClick("logs")} 
          icon={<Terminal className="w-5 h-5" />} 
          label="任务日志"
          badgeCount={tasks.filter(t => t.status === "running").length}
        />
        <TabIconButton 
          active={activeTab === "errors" && !minimized} 
          onClick={() => handleTabClick("errors")} 
          icon={<CircleAlert className="w-5 h-5" />} 
          label="错误详情"
          badgeCount={tasks.filter(t => t.status === "failed").length}
        />
      </div>

      {/* Main Panel Content Area (only visible when expanded) */}
      {!minimized && (
        <div className="flex-1 min-w-0 p-3.5 flex flex-col gap-3.5 overflow-hidden h-full">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 flex items-center gap-3 flex-1">
              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wider text-text-subtle font-semibold mb-0.5 leading-none">
                  {activeTab.toUpperCase()} PANEL
                </span>
                <h2 className="text-sm font-bold text-text truncate m-0 leading-tight">
                  {activeTab === "status" && (selection ? titleForSelection(selection) : "MCP 状态 / 上下文")}
                  {activeTab === "tools" && "MCP 工具箱"}
                  {activeTab === "logs" && "任务日志"}
                  {activeTab === "errors" && "错误详情"}
                </h2>
              </div>
              {activeTab === "logs" && (
                <div className="flex items-center gap-1.5 ml-auto mr-1">
                  {tasks.filter(t => t.status === "running").length > 0 && (
                    <span className="text-[9px] font-semibold text-[#0a7f72] bg-[#0a7f72]/15 px-1.5 py-0.5 rounded-pill flex items-center gap-1 animate-pulse mr-2">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>{tasks.filter(t => t.status === "running").length} 正在运行</span>
                    </span>
                  )}
                  <button onClick={onRefreshTasks} className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-text transition-colors" title="刷新日志">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onClearTasks} className="p-1 rounded hover:bg-surface-muted text-text-muted hover:text-red-400 transition-colors" title="清空全部日志">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 rounded-control" onClick={onToggleMinimized} title="收起面板">
              <PanelRightClose className="w-4 h-4" />
            </Button>
          </div>

          {/* Body content based on tab */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === "status" && (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3.5 scrollbar-thin">
                {!selection ? (
                  <DefaultInspector 
                    project={project} 
                    tools={tools} 
                    tasks={tasks} 
                    onStartRuntime={onStartRuntime} 
                    onRefreshTools={onRefreshTools} 
                    onStatusLite={onStatusLite} 
                  />
                ) : selection.type === "project" ? (
                  <ProjectInspector project={selection.item} />
                ) : selection.type === "tool" ? (
                  <ToolInspector tool={selection.item} />
                ) : selection.type === "task" ? (
                  <TaskInspector task={selection.item} />
                ) : (
                  <AssetInspector asset={selection.item} projectId={project?.id} />
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <ToolsTab tools={tools} onSelectTool={(t) => onSelectSelection({ type: "tool", item: t })} />
            )}

            {activeTab === "logs" && (
              <ConsoleTab 
                tasks={tasks} 
                projects={project ? [project] : []} 
                onSelectTask={(t) => onSelectSelection({ type: "task", item: t })} 
                onDeleteTask={onDeleteTask}
              />
            )}

            {activeTab === "errors" && (
              <ErrorsTab 
                tasks={tasks.filter((task) => task.status === "failed" || task.rawResultJson?.includes('"isError": true') || task.rawResultJson?.includes('"isError":true'))} 
                onSelectTask={(t) => onSelectSelection({ type: "task", item: t })} 
                onClearTasks={onClearTasks}
                onRecoverVideoTask={onRecoverVideoTask}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabIconButton({ active, onClick, icon, label, badgeCount }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badgeCount?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-8.5 h-8.5 rounded-control flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-surface-raised hover:text-text",
        active ? "bg-brand/10 text-brand-strong shadow-[inset_0_0_0_1px_rgba(0,217,197,0.2)]" : "text-text-muted hover:scale-105"
      )}
      title={label}
      type="button"
    >
      {icon}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#0a7f72] text-white font-sans text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-surface-panel animate-pulse">
          {badgeCount}
        </span>
      )}
    </button>
  );
}

function titleForSelection(selection: NonNullable<InspectorSelection>) {
  if (selection.type === "project") return selection.item.name;
  if (selection.type === "tool") return selection.item.name;
  if (selection.type === "task") return selection.item.toolName;
  return selection.item.fileName;
}

function DefaultInspector({ project, tools, tasks, onStartRuntime, onRefreshTools, onStatusLite }: Pick<Props, "project" | "tools" | "tasks" | "onStartRuntime" | "onRefreshTools" | "onStatusLite">) {
  const runtime = project?.runtime;
  const recent = tasks[0];
  return (
    <div className="flex flex-col gap-2.5">
      <InfoRow label="当前项目" value={project?.name ?? "-"} />
      <InfoRow label="项目路径" value={project?.rootPath ?? "-"} />
      <InfoRow label="MCP runtime" value={runtime?.status ?? "idle"} />
      <InfoRow label="工具数量" value={String(tools.length)} />
      <InfoRow label="最近任务" value={recent ? `${recent.toolName} / ${recent.status}` : "-"} />
      
      <div className="grid gap-2 mt-3.5">
        <Button onClick={onStartRuntime} disabled={!project} className="w-full gap-2 text-xs h-9 shadow-sm">
          <Play className="w-4 h-4 fill-current" />
          启动 MCP
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onRefreshTools} disabled={!project} className="gap-1.5 text-xs h-8 shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> 刷新工具
          </Button>
          <Button variant="outline" onClick={onStatusLite} disabled={!project} className="gap-1.5 text-xs h-8 shadow-sm">
            <Activity className="w-3.5 h-3.5" /> 状态检查
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProjectInspector({ project }: { project: ProjectSummary }) {
  return (
    <div className="flex flex-col gap-2.5">
      <InfoRow label="项目路径" value={project.rootPath} />
      <InfoRow label="project_id" value={project.makerProjectId} />
      <InfoRow label="配置文件" value={project.configPath} />
      <InfoRow label="MCP runtime" value={project.runtime?.status ?? "idle"} />
      <InfoRow label="cwd" value={project.runtime?.cwd ?? project.rootPath} />
      {project.runtime?.lastError && (
        <pre className="mt-1 p-3 bg-[#b03939]/10 text-[#b03939] border border-[#b03939]/20 rounded-panel text-[11px] font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto scrollbar-thin">
          {project.runtime.lastError}
        </pre>
      )}
    </div>
  );
}

function ToolInspector({ tool }: { tool: ToolSummary }) {
  return (
    <div className="flex flex-col gap-2.5 h-full">
      <InfoRow label="工具名" value={tool.name} />
      <InfoRow label="类别" value={tool.category} />
      <InfoRow label="必填字段" value={tool.required.length ? tool.required.join(", ") : "-"} />
      {tool.description && <p className="text-xs text-text-muted m-0 mt-1 leading-relaxed bg-surface-raised p-3 border border-border-soft rounded-panel">{tool.description}</p>}
      <div className="mt-2 flex-1 flex flex-col min-h-0">
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-subtle mb-2 uppercase tracking-wide">
          <FileJson className="w-3.5 h-3.5" />
          Input Schema
        </span>
        <pre className="flex-1 p-3 bg-surface-muted/60 border border-border-soft rounded-panel text-[11px] font-mono text-text-muted whitespace-pre-wrap break-all overflow-y-auto scrollbar-thin">
          {JSON.stringify(tool.inputSchema, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function TaskInspector({ task }: { task: TaskRecord }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(task.rawResultJson || task.inputJson || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const statusDisplay = task.status === "failed" ? "失败" : 
                        task.status === "succeeded" ? "成功" : 
                        task.status === "running" ? "运行中" : 
                        task.status === "queued" ? "排队中" : task.status;

  return (
    <div className="flex flex-col gap-2.5 h-full">
      <InfoRow label="状态" value={statusDisplay} />
      <InfoRow label="任务 ID" value={task.taskId} />
      <InfoRow label="工具" value={task.toolName} />
      <InfoRow label="开始时间" value={task.startedAt} />
      <InfoRow label="结束时间" value={task.finishedAt ?? "-"} />
      {task.errorMessage && (
        <pre className="mt-2 p-3 bg-[#b03939]/10 text-[#b03939] border border-[#b03939]/20 rounded-panel text-[11px] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto scrollbar-thin">
          {task.errorMessage}
        </pre>
      )}
      <div className="mt-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-subtle uppercase tracking-wide">
            <Hash className="w-3.5 h-3.5" />
            请求/返回数据 (Payload)
          </span>
          <button 
            onClick={handleCopy}
            className="text-text-muted hover:text-text transition-colors flex items-center justify-center p-1"
            title="一键复制数据"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <pre className="flex-1 p-3 bg-surface-muted/60 border border-border-soft rounded-panel text-[11px] font-mono text-text-muted whitespace-pre-wrap break-all overflow-y-auto scrollbar-thin">
          {task.rawResultJson || task.inputJson}
        </pre>
      </div>
    </div>
  );
}

function AssetInspector({ asset, projectId }: { asset: AssetSummary; projectId?: string }) {
  const canPreview = projectId && asset.assetType === "image";
  return (
    <div className="flex flex-col gap-2.5">
      {canPreview && (
        <div className="mb-2 border border-border bg-surface-raised rounded-panel overflow-hidden shadow-sm">
          <img className="w-full aspect-square object-contain bg-surface-muted" src={assetPreviewUrl(projectId, asset.relativePath)} alt={asset.fileName} />
        </div>
      )}
      <InfoRow label="文件" value={asset.fileName} />
      <InfoRow label="类型" value={asset.assetType} />
      <InfoRow label="路径" value={asset.relativePath} />
      <InfoRow label="大小" value={`${Math.round(asset.sizeBytes / 1024)} KB`} />
      <InfoRow label="更新时间" value={asset.updatedAt} />
      <div className="mt-2 rounded-panel border border-border-soft bg-surface-raised p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-subtle">来源</span>
          <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[9px] font-bold text-brand-strong">{asset.provenance?.length ?? 0}</span>
        </div>
        {!asset.provenance?.length ? (
          <p className="m-0 text-[11px] leading-relaxed text-text-muted">暂无来源索引。可在资产库点击来源重建。</p>
        ) : (
          <div className="grid gap-2">
            {asset.provenance.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-card border border-border-soft bg-surface-panel p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <strong className="truncate text-[11px] text-text">{item.toolName ?? item.sourceType}</strong>
                  <span className="shrink-0 rounded-pill bg-surface-muted px-1.5 py-0.5 text-[8px] font-bold text-text-subtle">{item.matchedBy}</span>
                </div>
                <div className="truncate text-[10px] text-text-subtle">{item.sourceType}: {item.sourceId}</div>
                {item.prompt ? <p className="m-0 mt-1 line-clamp-3 text-[10px] leading-relaxed text-text-muted">{item.prompt}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 bg-surface-raised border border-border-soft rounded-card hover:border-border transition-colors">
      <span className="text-xs font-semibold text-text-subtle shrink-0">{label}</span>
      <strong className="text-[12px] font-semibold text-text truncate text-right">{value}</strong>
    </div>
  );
}

// Sub Tab component: MCP Tools
function ToolsTab({ tools, onSelectTool }: { tools: ToolSummary[]; onSelectTool: (tool: ToolSummary) => void }) {
  const [query, setQuery] = useState("");
  const filteredTools = useMemo(() => {
    return tools.filter(t => t.name.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()));
  }, [tools, query]);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      <div className="relative shrink-0">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索 MCP 工具..."
          className="pl-9 h-8.5 text-xs bg-surface-muted/20"
        />
      </div>
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
        {filteredTools.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-muted">未找到工具</div>
        ) : (
          filteredTools.map(t => (
            <button
              key={t.name}
              onClick={() => onSelectTool(t)}
              className="flex flex-col text-left p-3 bg-surface-raised border border-border-soft rounded-card hover:border-brand/40 transition-all hover:bg-surface-panel cursor-pointer shadow-sm w-full"
              type="button"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <strong className="text-[11px] font-bold text-text truncate leading-none">{t.name}</strong>
                <span className="text-[8px] uppercase tracking-wider text-brand-strong bg-brand/10 px-1.5 py-0.5 rounded font-extrabold shrink-0 leading-none">{t.category}</span>
              </div>
              {t.description && <p className="text-[10px] text-text-muted mt-2 line-clamp-2 leading-relaxed">{t.description}</p>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// Sub Tab component: Console Task logs
function ConsoleTab({ tasks, projects, onSelectTask, onDeleteTask }: { tasks: TaskRecord[]; projects: ProjectSummary[]; onSelectTask: (task: TaskRecord) => void; onDeleteTask: (taskId: string) => void; }) {
  const [selectedTask, setSelectedTask] = useState<TaskRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (activeTask?.rawResultJson || activeTask?.errorMessage) {
      navigator.clipboard.writeText(activeTask.errorMessage || activeTask.rawResultJson || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Sync selected task with latest tasks list
  const activeTask = useMemo(() => {
    if (!selectedTask) return tasks[0] || null;
    return tasks.find(t => t.taskId === selectedTask.taskId) || tasks[0] || null;
  }, [tasks, selectedTask]);

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Upper part: Task List */}
      <div className="flex-[0.8] flex flex-col min-h-0 overflow-y-auto pr-1 gap-2 scrollbar-thin">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-muted">暂无任务</div>
          ) : (
            tasks.slice(0, 50).map(t => {
              const isSelected = activeTask?.taskId === t.taskId;
              const isRunning = t.status === "running";
              const hasErrorInResult = t.rawResultJson?.includes('"isError": true') || t.rawResultJson?.includes('"isError":true');
              const isFailed = t.status === "failed" || hasErrorInResult;
              const isSuccess = t.status === "succeeded" && !hasErrorInResult;

              return (
                <div key={t.taskId} className="group relative flex w-full">
                  <button
                    onClick={() => {
                      setSelectedTask(t);
                      onSelectTask(t);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2 rounded border text-left transition-colors cursor-pointer w-full text-xs",
                      isSelected 
                        ? "border-brand bg-brand/5 font-semibold text-brand-strong"
                        : isFailed ? "border-[#b03939]/20 bg-[#b03939]/5 hover:bg-[#b03939]/10" :
                          isSuccess ? "border-[#246b2f]/10 bg-[#246b2f]/5 hover:bg-[#246b2f]/10" :
                          isRunning ? "border-brand/30 bg-brand/5 hover:bg-brand/10" :
                          "border-border-soft bg-surface-raised hover:bg-surface-muted"
                    )}
                    type="button"
                  >
                    <div className="min-w-0 flex-1 pr-2 flex flex-col gap-0.5">
                      <strong className="block truncate text-xs">{t.toolName}</strong>
                      <span className="block text-[9px] text-text-subtle truncate">{t.inputSummary}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0",
                      isFailed ? "text-[#b03939]" : 
                      isSuccess ? "text-[#246b2f]" : 
                      isRunning ? "text-[#0a7f72]" : 
                      "text-text-subtle"
                    )}>
                      {hasErrorInResult ? "失败 (MCP 报错)" : 
                       isFailed ? "失败" : 
                       isSuccess ? "成功" : 
                       isRunning ? "运行中" : 
                       t.status === "queued" ? "排队中" : t.status}
                    </span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(t.taskId); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded transition-all bg-surface-panel/80 backdrop-blur"
                    title="删除记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

      {/* Lower part: Terminal Logs Console */}
      <div className="flex-1 flex flex-col min-h-0 border border-border bg-[#0a0f1d] rounded-panel overflow-hidden shadow-sm">
        <div className="px-3 py-2 border-b border-border bg-[#111827] flex items-center justify-between shrink-0 select-none">
          <span className="text-[11px] font-bold text-gray-300 font-sans flex items-center gap-1.5 shrink-0">
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">控制台输出</span>
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {activeTask && (
              <span className="text-[9px] font-mono text-gray-400 truncate max-w-[120px]" title={activeTask.toolName}>{activeTask.toolName}</span>
            )}
            <button 
              onClick={handleCopy}
              className="text-gray-400 hover:text-white transition-colors flex items-center justify-center p-1"
              title="一键复制控制台输出"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex-1 p-3 overflow-auto scrollbar-thin text-[10px] font-mono leading-relaxed text-gray-300">
          {activeTask ? (
            <div className="flex flex-col gap-2">
              <div>
                <span className="text-gray-500 font-semibold">$ mcp-call {activeTask.toolName} --args</span>
                <pre className="mt-1 text-gray-400 whitespace-pre-wrap break-all pl-2 border-l border-gray-800">
                  {activeTask.inputJson}
                </pre>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-900">
                <span className="text-gray-500 font-semibold">&gt; output_raw_result:</span>
                {activeTask.errorMessage ? (
                  <pre className="mt-1 text-red-400 whitespace-pre-wrap break-all font-bold">
                    Error: {activeTask.errorMessage}
                  </pre>
                ) : (
                  <pre className="mt-1 text-green-400 whitespace-pre-wrap break-all">
                    {activeTask.rawResultJson || "{} (暂无返回数据)"}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 italic select-none">
              等待任务日志输出...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorsTab({ tasks, onSelectTask, onClearTasks, onRecoverVideoTask }: { tasks: TaskRecord[]; onSelectTask: (task: TaskRecord) => void; onClearTasks: () => void; onRecoverVideoTask?: (taskId: string) => void }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
      {tasks.length > 0 && (
        <div className="flex justify-end shrink-0 px-1 pt-1">
          <button onClick={onClearTasks} className="text-[10px] flex items-center gap-1 text-text-muted hover:text-[#b03939] transition-colors" title="清空所有记录">
            <Trash2 className="w-3.5 h-3.5" />
            清空
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
        {tasks.length === 0 ? (
          <div className="rounded-panel border border-dashed border-border p-5 text-center text-xs text-text-muted">当前没有失败任务。</div>
        ) : tasks.map((task) => {
          const isConcurrencyError = task.rawResultJson?.includes("并发超限") || task.errorMessage?.includes("并发超限");
          const oldTaskIdMatch = task.rawResultJson?.match(/cgt-[a-zA-Z0-9-]+/) || task.errorMessage?.match(/cgt-[a-zA-Z0-9-]+/);
          const oldTaskId = oldTaskIdMatch ? oldTaskIdMatch[0] : null;
          
          return (
            <button key={task.taskId} type="button" onClick={() => onSelectTask(task)} className="rounded-card border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-left hover:bg-[#b03939]/10">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="truncate text-xs text-[#b03939]">{task.toolName}</strong>
                <span className="rounded-pill bg-[#b03939]/10 px-2 py-0.5 text-[9px] font-bold text-[#b03939]">
                  {isConcurrencyError ? "VideoConcurrencyLimitError" : classifyError(task)}
                </span>
              </div>
              <p className="m-0 line-clamp-3 text-[11px] leading-relaxed text-text-muted">{task.errorMessage || task.rawResultJson || task.inputSummary}</p>
              
              {isConcurrencyError && oldTaskId && (
                <div className="mt-3 p-3 bg-surface-app border border-brand/20 rounded-lg flex flex-col gap-2.5 shadow-inner" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 text-brand">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">云端并发冲突锁定 (1/1)</span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-relaxed">
                    检测到旧任务 <code className="bg-surface-raised px-1 py-0.5 rounded text-text font-mono select-all">{oldTaskId}</code> 尚未释放。
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-[11px] h-8 bg-brand/10 border-brand/30 text-brand hover:bg-brand hover:text-[#04202a] transition-all font-bold mt-1 shadow-sm" 
                    onClick={() => onRecoverVideoTask?.(oldTaskId)}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    安全恢复并刷新状态
                  </Button>
                </div>
              )}
              
              <div className="mt-2 flex justify-end">
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] font-semibold text-text-subtle hover:bg-surface-muted hover:text-text"
                  onClick={(event) => { event.stopPropagation(); void navigator.clipboard.writeText(task.errorMessage || task.rawResultJson || task.inputJson); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      void navigator.clipboard.writeText(task.errorMessage || task.rawResultJson || task.inputJson);
                    }
                  }}
                >
                  <Copy className="h-3 w-3" />
                  复制 raw/error
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function classifyError(task: TaskRecord) {
  const text = `${task.errorMessage ?? ""}\n${task.rawResultJson ?? ""}`.toLowerCase();
  if (text.includes("timeout") || text.includes("timed out")) return "timeout";
  if (text.includes("schema") || text.includes("validation") || text.includes("invalid")) return "schema";
  if (text.includes("mcp") || text.includes("runtime") || text.includes("stdio")) return "mcp";
  if (text.includes("network") || text.includes("fetch") || text.includes("504")) return "network";
  return "tool";
}
