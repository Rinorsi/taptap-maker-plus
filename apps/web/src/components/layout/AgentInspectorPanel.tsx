import { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Info, Cpu, Terminal, Play, RefreshCw, Activity, 
  Search, Loader2,
  FileJson, PanelRightClose, Copy, Trash2, AlertCircle, AlertTriangle, ListChecks, Download, Wrench,
  Box, Film, Image as ImageIcon, Package, CheckCircle2, Clock, Music
} from "lucide-react";
import { assetPreviewUrl, getAgentContext, getBuildLogs, getDesktopReadiness, openLocalAssetPath, type AgentContextSnapshot, type AssetSummary, type DesktopReadiness, type ProjectBuildLogsSummary, type ProjectLogFileSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import type { AssetReferenceScanResult } from "../../api";
import { RawViewer } from "../developer";
import { Button } from "../ui/Button";
import { CodeEditorPanel } from "../ui/CodeEditorPanel";
import { Input } from "../ui/Input";
import { AppContextMenu } from "../../commands";
import { copyText } from "../../lib/clipboard";
import { cn } from "../../lib/utils";
import { classifyTaskError, getTaskCopyPayload, getTaskPayloadDisplay, getVideoConcurrencyTaskId, isTaskError, isTaskSuccess, isVideoConcurrencyError, taskHasMcpErrorResult } from "../../lib/taskResult";
import { getToolCategoryLabel, getToolDisplay } from "../../features/tools/toolDisplay";

export type InspectorSelection =
  | { type: "project"; item: ProjectSummary }
  | { type: "tool"; item: ToolSummary }
  | { type: "task"; item: TaskRecord }
  | { type: "asset"; item: AssetSummary }
  | {
      type: "assetReferences";
      title: string;
      scannedAt: string;
      results: AssetReferenceScanResult[];
    }
  | undefined;

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  selection: InspectorSelection;
  busy: boolean;
  notice: string;
  minimized: boolean;
  activeTab: "status" | "tools" | "gameLogs" | "logs" | "errors";
  onTabChange: (tab: "status" | "tools" | "gameLogs" | "logs" | "errors") => void;
  onToggleMinimized: () => void;
  onStartRuntime: () => void;
  onRefreshTools: () => void;
  onStatusLite: () => void;
  onSelectSelection: (selection: InspectorSelection) => void;
  onClearTasks: () => void;
  onRefreshTasks: () => void;
  onDeleteTask: (taskId: string) => void;
  onRecoverVideoTask?: (taskId: string) => void;
  recoveringVideoTaskId?: string;
  videoRecoveryCooldowns?: Record<string, number>;
};

type TaskStatusFilter = "all" | "running" | "succeeded" | "failed" | "queued" | "canceled";

const taskStatusFilterOptions: Array<{ value: TaskStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "running", label: "运行中" },
  { value: "succeeded", label: "成功" },
  { value: "failed", label: "失败" },
  { value: "queued", label: "排队" },
  { value: "canceled", label: "取消" },
];

export function AgentInspectorPanel({ 
  project, 
  tools, 
  tasks, 
  selection, 
  busy,
  notice,
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
  onRecoverVideoTask,
  recoveringVideoTaskId,
  videoRecoveryCooldowns = {}
}: Props) {
  const [selectedTool, setSelectedTool] = useState<ToolSummary | undefined>(selection?.type === "tool" ? selection.item : undefined);
  const [selectedStatusSelection, setSelectedStatusSelection] = useState<Extract<InspectorSelection, { type: "project" | "asset" }> | undefined>(
    selection?.type === "project" || selection?.type === "asset" ? selection : undefined
  );
  const [selectedReferenceReport, setSelectedReferenceReport] = useState<Extract<InspectorSelection, { type: "assetReferences" }> | undefined>(
    selection?.type === "assetReferences" ? selection : undefined
  );
  const [selectedLogTask, setSelectedLogTask] = useState<TaskRecord | undefined>(selection?.type === "task" ? selection.item : undefined);
  const [selectedErrorTask, setSelectedErrorTask] = useState<TaskRecord | undefined>(
    selection?.type === "task" && isTaskError(selection.item) ? selection.item : undefined
  );

  useEffect(() => {
    if (!selection) {
      setSelectedStatusSelection(undefined);
      setSelectedReferenceReport(undefined);
      setSelectedLogTask(undefined);
      setSelectedErrorTask(undefined);
      return;
    }

    if (selection.type === "tool") {
      setSelectedTool(selection.item);
      return;
    }

    if (selection.type === "project" || selection.type === "asset") {
      setSelectedStatusSelection(selection);
      setSelectedReferenceReport(undefined);
      return;
    }

    if (selection.type === "assetReferences") {
      setSelectedReferenceReport(selection);
      setSelectedStatusSelection(undefined);
      return;
    }

    if (selection.type === "task") {
      if (isTaskError(selection.item)) {
        setSelectedErrorTask(selection.item);
      } else {
        setSelectedLogTask(selection.item);
      }
    }
  }, [selection]);

  const currentStatusSelection = useMemo(() => {
    if (!selectedStatusSelection) return undefined;
    if (selectedStatusSelection.type === "project") {
      return project?.id === selectedStatusSelection.item.id
        ? { type: "project" as const, item: project }
        : selectedStatusSelection;
    }
    return selectedStatusSelection;
  }, [project, selectedStatusSelection]);

  const currentLogTask = useMemo(() => {
    if (!selectedLogTask) return undefined;
    return tasks.find((task) => task.taskId === selectedLogTask.taskId) ?? selectedLogTask;
  }, [selectedLogTask, tasks]);

  const currentErrorTask = useMemo(() => {
    if (!selectedErrorTask) return undefined;
    return tasks.find((task) => task.taskId === selectedErrorTask.taskId) ?? selectedErrorTask;
  }, [selectedErrorTask, tasks]);

  const headerDetail = useMemo(() => {
    if (activeTab === "status" && currentStatusSelection) {
      return {
        label: currentStatusSelection.type === "asset" ? currentStatusSelection.item.fileName : currentStatusSelection.item.name,
        title: "返回 MCP 状态",
        onBack: () => {
          setSelectedStatusSelection(undefined);
          onSelectSelection(undefined);
        }
      };
    }
    if (activeTab === "status" && selectedReferenceReport) {
      return {
        label: selectedReferenceReport.title,
        title: "返回 MCP 状态",
        onBack: () => {
          setSelectedReferenceReport(undefined);
          onSelectSelection(undefined);
        }
      };
    }
    if (activeTab === "tools" && selectedTool) {
      return {
        label: selectedTool.name,
        title: "返回工具列表",
        onBack: () => setSelectedTool(undefined)
      };
    }
    if (activeTab === "logs" && currentLogTask) {
      return {
        label: currentLogTask.toolName,
        title: "返回任务日志",
        onBack: () => {
          setSelectedLogTask(undefined);
        }
      };
    }
    if (activeTab === "errors" && currentErrorTask) {
      return {
        label: currentErrorTask.toolName,
        title: "返回错误列表",
        onBack: () => {
          setSelectedErrorTask(undefined);
        }
      };
    }
    return undefined;
  }, [activeTab, currentErrorTask, currentLogTask, currentStatusSelection, onSelectSelection, selectedReferenceReport, selectedTool]);

  const handleTabClick = (tab: "status" | "tools" | "gameLogs" | "logs" | "errors") => {
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
          icon={<Activity className="w-5 h-5" />}
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
          icon={<ListChecks className="w-5 h-5" />}
          label="任务记录"
          badgeCount={tasks.filter(t => t.status === "running").length}
        />
        <TabIconButton 
          active={activeTab === "errors" && !minimized} 
          onClick={() => handleTabClick("errors")} 
          icon={<AlertTriangle className="w-5 h-5" />}
          label="错误详情"
          badgeCount={tasks.filter(t => t.status === "failed").length}
        />
        <TabIconButton 
          active={activeTab === "gameLogs" && !minimized}
          onClick={() => handleTabClick("gameLogs")}
          icon={<Terminal className="w-5 h-5" />}
          label="游戏运行日志"
        />
      </div>

      {/* Main Panel Content Area (only visible when expanded) */}
      {!minimized && (
        <div className="flex-1 min-w-0 p-3.5 flex flex-col gap-3.5 overflow-hidden h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0 flex items-start gap-2 flex-1">
              {headerDetail ? (
                <Button variant="ghost" size="icon" onClick={headerDetail.onBack} className="h-7 w-7 shrink-0 rounded-control mt-0.5" title={headerDetail.title}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="min-w-0 flex flex-col gap-1.5 mt-0.5">
                <div>
                  <span className="block text-[10px] uppercase tracking-wider text-text-subtle font-semibold mb-0.5 leading-none">
                    {activeTab.toUpperCase()} PANEL
                  </span>
                  <h2 className="text-sm font-bold text-text truncate m-0 leading-tight">
                    {activeTab === "status" && "MCP 状态 / 上下文"}
                    {activeTab === "tools" && "MCP 工具箱"}
                    {activeTab === "gameLogs" && "游戏运行日志"}
                    {activeTab === "logs" && "任务记录"}
                    {activeTab === "errors" && "错误详情"}
                  </h2>
                </div>
                {headerDetail && !((activeTab === "tools" && selectedTool) || (activeTab === "logs" && currentLogTask)) ? (
                  <span className="max-w-[180px] truncate rounded-pill bg-surface-muted px-2 py-0.5 text-[10px] text-text-subtle" title={headerDetail.label}>
                    {headerDetail.label}
                  </span>
                ) : null}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0 rounded-control mt-1" onClick={onToggleMinimized} title="收起面板">
              <PanelRightClose className="w-4 h-4" />
            </Button>
          </div>

          {/* Body content based on tab */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === "status" && (
              <div className="flex-1 overflow-y-auto pr-1 flex min-w-0 flex-col gap-3.5 scrollbar-thin">
                {selectedReferenceReport ? (
                  <AssetReferenceReportView report={selectedReferenceReport} />
                ) : currentStatusSelection?.type === "asset" ? (
                  <AssetInspector asset={currentStatusSelection.item} projectId={project?.id} />
                ) : currentStatusSelection?.type === "project" ? (
                  <ProjectInspector project={currentStatusSelection.item} />
                ) : (
                  <DefaultInspector
                    project={project}
                    tools={tools}
                    tasks={tasks} 
                    busy={busy}
                    notice={notice}
                    onStartRuntime={onStartRuntime} 
                    onRefreshTools={onRefreshTools}
                    onStatusLite={onStatusLite}
                  />
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <ToolsTab tools={tools} selectedTool={selectedTool} onSelectTool={setSelectedTool} />
            )}

            {activeTab === "gameLogs" && (
              <GameRuntimeLogsTab
                project={project}
              />
            )}

            {activeTab === "logs" && (
              <ConsoleTab
                tasks={tasks}
                selectedTask={currentLogTask}
                onSelectTask={(task) => setSelectedLogTask(task)}
                onDeleteTask={onDeleteTask}
                onRefreshTasks={onRefreshTasks}
                onRecoverVideoTask={onRecoverVideoTask}
                recoveringVideoTaskId={recoveringVideoTaskId}
                videoRecoveryCooldowns={videoRecoveryCooldowns}
              />
            )}

            {activeTab === "errors" && (
              <ErrorsTab 
                tasks={tasks.filter(isTaskError)} 
                selectedTask={currentErrorTask}
                onSelectTask={(task) => setSelectedErrorTask(task)} 
                onClearTasks={onClearTasks}
                onRecoverVideoTask={onRecoverVideoTask}
                recoveringVideoTaskId={recoveringVideoTaskId}
                videoRecoveryCooldowns={videoRecoveryCooldowns}
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

function DefaultInspector({ project, tools, tasks, busy, notice, onStartRuntime, onRefreshTools, onStatusLite }: Pick<Props, "project" | "tools" | "tasks" | "busy" | "notice" | "onStartRuntime" | "onRefreshTools" | "onStatusLite">) {
  const runtime = project?.runtime;
  const [desktopReadiness, setDesktopReadiness] = useState<DesktopReadiness>();
  const [agentContext, setAgentContext] = useState<AgentContextSnapshot>();
  const [developerError, setDeveloperError] = useState("");
  const recent = tasks[0];
  const runtimeStatus = runtime?.status ?? "idle";
  const ready = runtimeStatus === "ready";
  const starting = runtimeStatus === "starting";
  const localApiUrl = desktopReadiness
    ? `http://${desktopReadiness.server.host}:${desktopReadiness.server.port}`
    : "等待本地 API";
  const viteProxyTarget = desktopReadiness?.mode === "development"
    ? "固定 /api -> 127.0.0.1:8787"
    : "生产内置服务";
  const currentAction = busy
    ? notice || "正在执行..."
    : starting
      ? "MCP 正在启动，等待 runtime 返回 PID"
      : notice || "空闲";
  const diagnosticsRaw = useMemo(
    () =>
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          desktopReadiness,
          agentContext,
          runtime,
          counts: {
            tools: tools.length,
            tasks: tasks.length,
          },
          notice,
        },
        null,
        2,
      ),
    [agentContext, desktopReadiness, notice, runtime, tasks.length, tools.length],
  );
  const agentContextRaw = useMemo(() => agentContext ? JSON.stringify(agentContext, null, 2) : "", [agentContext]);
  const hasAgentContextRaw = agentContextRaw.trim() !== "" && agentContextRaw.trim() !== "{}";

  useEffect(() => {
    let cancelled = false;
    async function loadDeveloperSnapshot() {
      try {
        const [readinessResult, contextResult] = await Promise.allSettled([
          getDesktopReadiness(),
          getAgentContext(project?.id, { activeTab: "status" }),
        ]);
        if (cancelled) return;
        setDesktopReadiness(readinessResult.status === "fulfilled" ? readinessResult.value : undefined);
        setAgentContext(contextResult.status === "fulfilled" ? contextResult.value : undefined);
        const errors = [
          readinessResult.status === "rejected" ? `desktop/readiness: ${readinessResult.reason instanceof Error ? readinessResult.reason.message : String(readinessResult.reason)}` : "",
          contextResult.status === "rejected" ? `agent/context: ${contextResult.reason instanceof Error ? contextResult.reason.message : String(contextResult.reason)}` : "",
        ].filter(Boolean);
        setDeveloperError(errors.join("；"));
      } catch (error) {
        if (!cancelled) setDeveloperError(error instanceof Error ? error.message : String(error));
      }
    }
    void loadDeveloperSnapshot();
    return () => {
      cancelled = true;
    };
  }, [project?.id, runtime?.status, runtime?.processId, tools.length, tasks.length]);

  function exportDiagnostics() {
    const blob = new Blob([diagnosticsRaw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `taptap-maker-plus-diagnostics-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className={cn("rounded-panel border p-3", ready ? "border-brand/25 bg-brand/5" : runtimeStatus === "error" ? "border-[#b03939]/25 bg-[#b03939]/5" : "border-border-soft bg-surface-raised")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <strong className="block truncate text-sm text-text">{project?.name ?? "未选择项目"}</strong>
            <span className="mt-0.5 block truncate text-[10px] text-text-subtle">{project?.rootPath ?? "请先选择一个 Maker 项目"}</span>
          </div>
          <span className={cn("shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-bold uppercase", ready ? "bg-brand/15 text-brand-strong" : runtimeStatus === "error" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted")}>
            {runtimeStatus}
          </span>
        </div>
      </div>

      <div className="rounded-panel border border-border-soft bg-surface-raised divide-y divide-border-soft overflow-hidden">
        <InfoRow label="当前动作" value={currentAction} />
        <InfoRow label="工具箱状态" value={`${tools.length} 个可用`} />
      </div>

      {runtime?.lastError ? (
        <CodeEditorPanel title="MCP runtime 错误" language="stderr" value={runtime.lastError} maxHeight="180px" />
      ) : null}
      {developerError ? (
        <p className="m-0 rounded-panel border border-[#b03939]/20 bg-[#b03939]/5 p-2 text-[11px] text-[#b03939]">
          {developerError}
        </p>
      ) : null}
      
      <div className="grid gap-2 mt-2">
        <Button onClick={onStartRuntime} disabled={!project || starting || busy} className="w-full gap-2 text-xs h-9 shadow-sm">
          {starting || busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          {starting ? "MCP 启动中..." : busy ? "正在执行..." : ready ? "重启 MCP" : "启动 MCP"}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onRefreshTools} disabled={!project || busy} className="gap-1.5 text-xs h-8 shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> 刷新工具
          </Button>
          <Button variant="outline" onClick={onStatusLite} disabled={!project || busy} className="gap-1.5 text-xs h-8 shadow-sm">
            <Activity className="w-3.5 h-3.5" /> 状态检查
          </Button>
        </div>
      </div>

      <details className="mt-2 shrink-0 rounded-panel border border-border-soft bg-surface-raised overflow-hidden">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-text-muted hover:text-text bg-surface-muted/30">
          高级诊断选项卡 (Developer)
        </summary>
        <div className="p-3 grid gap-1.5 border-t border-border-soft text-[10px] min-w-0">
          <InfoRowCompact label="本地 API" value={localApiUrl} />
          <InfoRowCompact label="Vite 代理" value={viteProxyTarget} />
          <InfoRowCompact label="MCP cwd" value={runtime?.cwd ?? project?.rootPath ?? "-"} />
          <InfoRowCompact label="进程 PID" value={runtime?.processId ? String(runtime.processId) : "-"} />
          <InfoRowCompact label="tools/list" value={agentContext?.toolsListSnapshot?.updatedAt ?? runtime?.toolsListUpdatedAt ?? "-"} />
          <InfoRowCompact label="桌面模式" value={desktopReadiness?.mode ?? "-"} />
          <InfoRowCompact label="SQLite" value={desktopReadiness?.paths.databasePath ?? "-"} />
          <InfoRowCompact label="MCP 日志目录" value={desktopReadiness?.paths.mcpLogDir ?? "-"} />
          <InfoRowCompact label="npm cache" value={desktopReadiness?.paths.makerNpmCacheDir ?? "-"} />
          <InfoRowCompact label="启动接口" value={project ? `/api/projects/${project.id}/mcp/start` : "-"} />
          <InfoRowCompact label="最近任务" value={recent ? `${recent.toolName} / ${recent.status}` : "-"} />

          <div className="grid grid-cols-2 gap-2 mt-3 mb-1 min-w-0">
            <Button variant="outline" onClick={() => void copyText(diagnosticsRaw, { successMessage: "诊断 JSON 已复制" })} className="gap-1.5 text-xs h-8 shadow-sm min-w-0 overflow-hidden">
              <Copy className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">复制诊断</span>
            </Button>
            <Button variant="outline" onClick={exportDiagnostics} className="gap-1.5 text-xs h-8 shadow-sm min-w-0 overflow-hidden">
              <Download className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">导出诊断包</span>
            </Button>
          </div>
        </div>

        {hasAgentContextRaw ? (
          <details className="border-t border-border-soft shrink-0 group">
            <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-text-muted hover:text-text bg-surface-muted/20">
              raw agent context
            </summary>
            <div className="h-[520px]">
              <RawViewer
                title="raw agent context"
                value={agentContextRaw}
                height="100%"
                emptyText="暂无 agent context"
                className="rounded-none border-0 h-full"
              />
            </div>
          </details>
        ) : null}
      </details>

    </div>
  );
}

function RuntimeLogSnapshot({
  projectId,
  buildLogs,
  rawValue,
  loading = false,
  errorMessage = "",
}: {
  projectId?: string;
  buildLogs?: ProjectBuildLogsSummary;
  rawValue: string;
  loading?: boolean;
  errorMessage?: string;
}) {
  if (loading) {
    return (
      <section className="p-3 text-[11px] text-text-muted">
        正在读取 runtime / build 日志摘要...
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="border border-[#b03939]/20 bg-[#b03939]/5 p-3 text-[11px] text-[#b03939]">
        {errorMessage}
      </section>
    );
  }

  if (!buildLogs) return null;

  const runtime = buildLogs.runtime;
  const latestBuildLog = buildLogs.buildLogs[0];
  const levelSummary = formatLevelCounts(runtime.levelCounts);
  const runtimeTailLines = runtime.runtimeLog?.tailLines ?? [];
  const runtimeLogJson = formatRuntimeLogTailJson(runtimeTailLines, runtime.stateParseError);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto pr-1 scrollbar-thin">
      <div className="flex flex-col pb-3 pt-1 border-b border-border-soft px-1 shrink-0">
        <span className="block truncate font-mono text-xs text-text-muted">
          生成时间: {formatDateTime(buildLogs.generatedAt)}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-border-soft border-b border-border-soft shrink-0">
        <RuntimeLogFileRow projectId={projectId} label="state.json" file={runtime.stateFile} />
        <RuntimeLogFileRow projectId={projectId} label="runtime.log" file={runtime.runtimeLog} />
        <RuntimeLogFileRow projectId={projectId} label="watcher.out.log" file={runtime.watcherOut} />
        <RuntimeLogFileRow projectId={projectId} label="watcher.err.log" file={runtime.watcherErr} />
        <InfoRowCompact label="runtime level" value={levelSummary || "-"} />
        <InfoRowCompact label="build logs" value={`${buildLogs.buildLogs.length} 个`} />
      </div>

      {latestBuildLog ? (
        <div className="shrink-0 border-b border-border-soft px-3 py-2">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <button
              type="button"
              disabled={!projectId || !latestBuildLog.file.exists}
              onClick={() => projectId ? void openLocalAssetPath(projectId, latestBuildLog.file.relativePath, "file") : undefined}
              className="min-w-0 truncate text-left font-mono text-[10px] font-bold text-text transition-colors enabled:hover:text-brand-strong disabled:cursor-default"
              title={projectId ? `打开 ${latestBuildLog.file.relativePath}` : latestBuildLog.file.relativePath}
            >
              {latestBuildLog.file.relativePath}
            </button>
            <span className="max-w-[120px] shrink-0 truncate rounded-pill bg-surface-muted px-1.5 py-0.5 text-right text-[9px] font-bold text-text-subtle" title={formatDateTime(latestBuildLog.file.updatedAt)}>
              {formatDateTime(latestBuildLog.file.updatedAt)}
            </span>
          </div>
          {latestBuildLog.flags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {latestBuildLog.flags.map((flag) => (
                <span key={flag} className="rounded-pill bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-strong">
                  {flag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="m-0 mt-2 line-clamp-2 text-[10px] leading-relaxed text-text-muted">
            {latestBuildLog.heading || latestBuildLog.file.tailLines.at(-1) || "暂无 build 日志内容"}
          </p>
        </div>
      ) : (
        <p className="m-0 shrink-0 border-b border-border-soft p-3 text-[11px] text-text-muted">
          当前项目没有发现 build 日志。
        </p>
      )}

      {runtimeLogJson ? (
        <RawViewer
          title="runtime.log tailLines"
          language="json"
          value={runtimeLogJson}
          height="100%"
          copyLabel="复制 tail"
          copySuccessMessage="runtime.log tail 已复制"
          className="min-h-[360px] flex-1 rounded-none border-0"
        />
      ) : null}

      <div className="shrink-0 border-t border-border-soft p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copyText(rawValue, { successMessage: "Runtime 日志摘要已复制" })}
          className="w-full gap-1.5 text-xs"
        >
          <Copy className="h-3.5 w-3.5" />
          复制 runtime 摘要
        </Button>
      </div>
    </div>
  );
}

function RuntimeLogFileRow({
  projectId,
  label,
  file,
}: {
  projectId?: string;
  label: string;
  file?: ProjectLogFileSummary;
}) {
  const canOpen = Boolean(projectId && file?.relativePath && file.exists);
  const title = file ? file.relativePath : "-";

  async function handleOpen() {
    if (!projectId || !file?.relativePath || !file.exists) return;
    await openLocalAssetPath(projectId, file.relativePath, "file");
  }

  return (
    <div
      className="flex items-center justify-between gap-3 px-3 py-2.5 bg-transparent hover:bg-surface-app/50 transition-colors"
      onDoubleClick={() => void handleOpen()}
      title={canOpen ? `${title} (双击打开)` : title}
    >
      <span className="text-xs font-semibold text-text-subtle shrink-0">{label}</span>
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => void handleOpen()}
        className="flex min-w-0 items-center gap-1.5 rounded text-left font-mono font-semibold text-text-muted transition-colors enabled:hover:text-text disabled:cursor-default disabled:opacity-70"
        title={canOpen ? `打开 ${file?.relativePath}` : title}
      >
        <FileJson className="h-3.5 w-3.5 shrink-0 text-brand-strong" />
        <span className="min-w-0 truncate text-[11px]">{file?.relativePath ?? "-"}</span>
      </button>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatRuntimeLogTailJson(lines: string[], stateParseError?: string) {
  const entries: unknown[] = [];
  if (stateParseError) entries.push({ stateParseError });
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      entries.push({ raw: line });
    }
  }
  return entries.length ? JSON.stringify(entries, null, 2) : "";
}

function formatLevelCounts(levelCounts: Record<string, number>) {
  return Object.entries(levelCounts)
    .map(([level, count]) => `${level}:${count}`)
    .join(", ");
}

function InfoRowCompact({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="grid min-w-0 grid-cols-[80px_minmax(0,1fr)] items-center gap-3 px-3 py-2 bg-transparent hover:bg-surface-app/50 transition-colors cursor-pointer"
      onDoubleClick={() => void copyText(value, { successMessage: "已复制" })}
      title={`${value} (双击复制)`}
    >
      <span className="text-xs font-semibold text-text-subtle shrink-0">{label}</span>
      <strong className="text-[12px] font-semibold text-text-muted min-w-0 truncate text-right">{value}</strong>
    </div>
  );
}

function ToolInspector({ tool }: { tool: ToolSummary }) {
  const display = getToolDisplay(tool);
  const [descriptionMode, setDescriptionMode] = useState<"translated" | "original">("translated");
  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto pr-1 scrollbar-thin">
      <div className="flex flex-col gap-1 pb-4 pt-2 border-b border-border-soft px-1">
        <strong className="block truncate text-base text-text">{display.title}</strong>
        <span className="block truncate font-mono text-[11px] text-text-subtle">{tool.name}</span>
        <p className="m-0 mt-3 text-[12px] leading-relaxed text-text-muted">{display.summary}</p>
      </div>
      <div className="flex flex-col divide-y divide-border-soft border-b border-border-soft">
        <InfoRow label="类别" value={getToolCategoryLabel(tool.category)} />
        <InfoRow label="必填字段" value={tool.required.length ? tool.required.join(", ") : "-"} />
      </div>
      {tool.description && (
        <section className="flex flex-col gap-3 py-4 border-b border-border-soft px-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-subtle">工具描述</span>
            <div className="flex shrink-0 rounded-control border border-border-soft bg-surface-muted p-0.5">
              <button
                type="button"
                onClick={() => setDescriptionMode("translated")}
                className={cn("rounded-[4px] px-2 py-1 text-[10px] font-bold transition-colors", descriptionMode === "translated" ? "bg-surface-panel text-text shadow-sm" : "text-text-subtle hover:text-text")}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setDescriptionMode("original")}
                className={cn("rounded-[4px] px-2 py-1 text-[10px] font-bold transition-colors", descriptionMode === "original" ? "bg-surface-panel text-text shadow-sm" : "text-text-subtle hover:text-text")}
              >
                原始
              </button>
            </div>
          </div>
          <MarkdownDescription value={descriptionMode === "translated" ? display.translatedDescription : tool.description} />
        </section>
      )}
      <div className="mt-3 flex shrink-0 flex-col px-1 pb-4">
        <span className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-subtle">
          <FileJson className="h-4 w-4" />
          输入 Schema
        </span>
        <CodeEditorPanel
          title="输入 Schema"
          language="json"
          value={JSON.stringify(tool.inputSchema, null, 2)}
          maxHeight="520px"
          className="shrink-0"
        />
      </div>
    </div>
  );
}

function MarkdownDescription({ value }: { value: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);
  return (
    <div className="grid gap-2 text-[11px] leading-relaxed text-text-muted">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeEditorPanel
              key={index}
              title="示例代码"
              language={block.language || "text"}
              value={block.value}
              maxHeight="280px"
              copyLabel="复制"
            />
          );
        }
        return block.lines.map((line, lineIndex) => renderMarkdownLine(line, `${index}-${lineIndex}`));
      })}
    </div>
  );
}

type MarkdownBlock = { type: "text"; lines: string[] } | { type: "code"; value: string; language?: string };

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let textLines: string[] = [];
  let codeLines: string[] | undefined;
  let codeLanguage = "";

  function flushText() {
    if (textLines.length === 0) return;
    blocks.push({ type: "text", lines: textLines });
    textLines = [];
  }

  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (codeLines) {
        blocks.push({ type: "code", value: codeLines.join("\n"), language: codeLanguage });
        codeLines = undefined;
        codeLanguage = "";
      } else {
        flushText();
        codeLines = [];
        codeLanguage = trimmed.slice(3).trim();
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
    } else {
      textLines.push(line);
    }
  }

  if (codeLines) blocks.push({ type: "code", value: codeLines.join("\n"), language: codeLanguage });
  flushText();
  return blocks;
}

function renderMarkdownLine(line: string, key: string) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={key} className="h-2" />;
  const heading = trimmed.match(/^\*\*(.+?)\*\*:?$/);
  if (heading) {
    return <strong key={key} className="mt-2 block text-[11px] text-text">{heading[1]}</strong>;
  }
  if (/^\|[-\s|]+\|$/.test(trimmed)) return null;
  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
    const cells = trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
    return (
      <div key={key} className="grid gap-1 rounded-control border border-border-soft bg-surface-muted/40 p-2">
        {cells.map((cell) => <span key={cell} className="truncate">{formatInlineMarkdown(cell)}</span>)}
      </div>
    );
  }
  if (trimmed.startsWith("- ")) {
    return (
      <div key={key} className="flex gap-2">
        <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-text-subtle" />
        <span>{formatInlineMarkdown(trimmed.slice(2))}</span>
      </div>
    );
  }
  return <p key={key} className="m-0">{formatInlineMarkdown(trimmed)}</p>;
}

function formatInlineMarkdown(value: string) {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[10px] text-text">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-bold text-text">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function TaskInspector({
  task,
  onRecoverVideoTask,
  recoveringVideoTaskId,
  videoRecoveryCooldowns = {}
}: {
  task: TaskRecord;
  onRecoverVideoTask?: (taskId: string) => void;
  recoveringVideoTaskId?: string;
  videoRecoveryCooldowns?: Record<string, number>;
}) {
  const recoveryTaskId = getVideoConcurrencyTaskId(task);
  const recoveryState = recoveryTaskId ? getRecoveryState(recoveryTaskId, recoveringVideoTaskId, videoRecoveryCooldowns) : undefined;
  
  const statusDisplay = task.status === "failed" ? "失败" : 
                        task.status === "succeeded" ? "成功" : 
                        task.status === "running" ? "运行中" : 
                        task.status === "queued" ? "排队中" : task.status;

  return (
    <div className="flex flex-col gap-2.5 h-full">
      <div className="rounded-panel border border-border-soft bg-surface-raised divide-y divide-border-soft overflow-hidden">
        <InfoRow label="状态" value={statusDisplay} />
        <InfoRow label="任务 ID" value={task.taskId} />
        <InfoRow label="工具" value={task.toolName} />
        <InfoRow label="开始时间" value={task.startedAt} />
        <InfoRow label="结束时间" value={task.finishedAt ?? "-"} />
      </div>
      {task.errorMessage && (
        <RawViewer
          title="错误详情"
          language="log"
          value={task.errorMessage}
          height="160px"
          copyLabel="复制错误"
          copySuccessMessage="错误详情已复制"
          className="mt-2 border-[#b03939]/20"
        />
      )}
      {recoveryTaskId && recoveryState && (
        <RecoveryAction
          taskId={recoveryTaskId}
          state={recoveryState}
          onRecoverVideoTask={onRecoverVideoTask}
        />
      )}
      <RawViewer
        title="请求/返回数据 (Payload)"
        language="json"
        value={getTaskPayloadDisplay(task)}
        height="520px"
        copyLabel="复制 raw"
        copySuccessMessage="raw result 已复制"
        className="mt-2 flex-1"
      />
    </div>
  );
}

function AssetInspector({ asset, projectId }: { asset: AssetSummary; projectId?: string }) {
  const canPreview = projectId && asset.assetType === "image";
  const [previewFailed, setPreviewFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      {canPreview && (
        <div className="mb-2 border border-border bg-surface-raised rounded-panel overflow-hidden shadow-sm">
          {previewFailed ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-surface-muted p-4 text-center">
              <FileJson className="h-8 w-8 text-text-subtle" />
              <span className="text-[11px] font-bold text-text">预览加载失败</span>
              <span className="max-w-full truncate text-[10px] text-text-subtle" title={asset.relativePath}>{asset.relativePath}</span>
            </div>
          ) : (
            <img
              className="w-full aspect-square object-contain bg-surface-muted"
              src={assetPreviewUrl(projectId, asset.relativePath)}
              alt={asset.fileName}
              onError={() => setPreviewFailed(true)}
            />
          )}
        </div>
      )}
      <div className="rounded-panel border border-border-soft bg-surface-raised divide-y divide-border-soft overflow-hidden mt-2">
        <InfoRow label="文件" value={asset.fileName} />
        <InfoRow label="类型" value={asset.assetType} />
        <InfoRow label="路径" value={asset.relativePath} />
        <InfoRow label="大小" value={`${Math.round(asset.sizeBytes / 1024)} KB`} />
        <InfoRow label="更新时间" value={asset.updatedAt} />
      </div>
      <div className="mt-2 rounded-panel border border-border-soft bg-surface-raised p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-text-subtle">来源</span>
          <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[9px] font-bold text-brand-strong">{asset.provenance?.length ?? 0}</span>
        </div>
        {!asset.provenance?.length ? (
          <p className="m-0 text-[11px] leading-relaxed text-text-muted">暂无来源记录。</p>
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

function AssetReferenceReportView({
  report,
}: {
  report: Extract<InspectorSelection, { type: "assetReferences" }>;
}) {
  const referencedAssets = report.results.filter((result) => result.referenceCount > 0);
  const totalReferences = report.results.reduce((sum, result) => sum + result.referenceCount, 0);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="rounded-panel border border-border-soft bg-surface-raised p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="m-0 truncate text-sm font-bold text-text">{report.title}</h3>
            <p className="m-0 mt-1 text-[10px] text-text-subtle">{report.scannedAt}</p>
          </div>
          <span className="shrink-0 rounded-pill bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-strong">
            {totalReferences} 处引用
          </span>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-card border border-border-soft bg-surface-panel text-center">
          <ReferenceMetric label="扫描资产" value={report.results.length} />
          <ReferenceMetric label="被引用" value={referencedAssets.length} />
          <ReferenceMetric label="引用总数" value={totalReferences} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {report.results.length === 0 ? (
          <p className="m-0 rounded-panel border border-border-soft bg-surface-raised p-3 text-xs text-text-muted">
            没有可展示的扫描结果。
          </p>
        ) : (
          <div className="grid gap-2.5">
            {report.results.map((result) => (
              <div key={result.relativePath} className="rounded-panel border border-border-soft bg-surface-raised p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block truncate text-[12px] text-text" title={result.relativePath}>
                      {result.relativePath}
                    </strong>
                    <span className="mt-0.5 block text-[10px] text-text-subtle">
                      {result.referenceCount > 0 ? `${result.referenceCount} 处引用` : "未发现引用"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-control border border-border-soft bg-surface-panel px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-brand"
                    onClick={() => void copyText(result.relativePath, { successMessage: "资产路径已复制" })}
                  >
                    复制路径
                  </button>
                </div>
                {result.references.length > 0 ? (
                  <div className="grid gap-2">
                    {result.references.map((reference, index) => (
                      <div
                        key={`${reference.sourcePath}:${reference.line}:${reference.column}:${index}`}
                        className="rounded-card border border-border-soft bg-surface-panel p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate font-mono text-[10px] text-text" title={`${reference.sourcePath}:${reference.line}:${reference.column}`}>
                            {reference.sourcePath}:{reference.line}:{reference.column}
                          </span>
                          <span className="shrink-0 rounded-pill bg-surface-muted px-1.5 py-0.5 text-[8px] font-bold uppercase text-text-subtle">
                            {reference.sourceType}
                          </span>
                        </div>
                        <pre className="m-0 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-app p-2 text-[10px] leading-relaxed text-text-muted scrollbar-thin">
                          {reference.lineText.trim() || "(空行)"}
                        </pre>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 rounded-card border border-border-soft bg-surface-panel p-2 text-[11px] text-text-muted">
                    当前扫描范围内没有发现引用。
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-r border-border-soft px-2 py-2 last:border-r-0">
      <span className="block text-[15px] font-black text-text">{value}</span>
      <span className="block text-[9px] font-bold text-text-subtle">{label}</span>
    </div>
  );
}

function ProjectInspector({ project }: { project: ProjectSummary }) {
  const runtime = project.runtime;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-panel border border-border-soft bg-surface-raised divide-y divide-border-soft overflow-hidden">
        <InfoRow label="项目" value={project.name} />
        <InfoRow label="路径" value={project.rootPath} />
        <InfoRow label="配置文件" value={project.configPath} />
        <InfoRow label="makerProjectId" value={project.makerProjectId} />
        <InfoRow label="MCP 状态" value={runtime?.status ?? "idle"} />
        <InfoRow label="工具数量" value={runtime?.toolCount !== undefined ? `${runtime.toolCount} 个` : "-"} />
        <InfoRow label="MCP cwd" value={runtime?.cwd ?? project.rootPath} />
      </div>
      {runtime?.lastError ? (
        <CodeEditorPanel title="MCP runtime 错误" language="stderr" value={runtime.lastError} maxHeight="220px" />
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="grid min-w-0 grid-cols-[100px_minmax(0,1fr)] items-center gap-3 px-3 py-2 bg-transparent hover:bg-surface-app/50 transition-colors cursor-pointer"
      onDoubleClick={() => void copyText(value, { successMessage: "已复制" })}
      title={`${value} (双击复制)`}
    >
      <span className="text-xs font-semibold text-text-subtle shrink-0">{label}</span>
      <strong className="text-[12px] font-semibold text-text min-w-0 truncate text-right">{value}</strong>
    </div>
  );
}

// Sub Tab component: MCP Tools
function getToolCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("image") || cat.includes("图片")) return <ImageIcon className="h-4 w-4" />;
  if (cat.includes("3d") || cat.includes("model")) return <Box className="h-4 w-4" />;
  if (cat.includes("video") || cat.includes("视频") || cat.includes("film")) return <Film className="h-4 w-4" />;
  if (cat.includes("audio") || cat.includes("music") || cat.includes("音频") || cat.includes("音乐")) return <Music className="h-4 w-4" />;
  if (cat.includes("status") || cat.includes("状态") || cat.includes("health")) return <Activity className="h-4 w-4" />;
  if (cat.includes("build") || cat.includes("构建")) return <Package className="h-4 w-4" />;
  return <Wrench className="h-4 w-4" />;
}

function getCategoryWeight(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("status") || cat.includes("状态") || cat.includes("health")) return 1;
  if (cat.includes("build") || cat.includes("构建")) return 2;
  if (cat.includes("image") || cat.includes("图片")) return 3;
  if (cat.includes("video") || cat.includes("视频") || cat.includes("film")) return 4;
  if (cat.includes("audio") || cat.includes("music") || cat.includes("音频") || cat.includes("音乐")) return 5;
  return 99;
}

function ToolsTab({ tools, selectedTool, onSelectTool }: { tools: ToolSummary[]; selectedTool?: ToolSummary; onSelectTool: (tool?: ToolSummary) => void }) {
  const [query, setQuery] = useState("");
  const filteredTools = useMemo(() => {
    const needle = query.toLowerCase();
    const filtered = tools.filter((tool) => {
      const display = getToolDisplay(tool);
      return tool.name.toLowerCase().includes(needle)
        || tool.category.toLowerCase().includes(needle)
        || display.title.toLowerCase().includes(needle)
        || display.summary.toLowerCase().includes(needle);
    });
    return filtered.sort((a, b) => {
      const weightA = getCategoryWeight(a.category);
      const weightB = getCategoryWeight(b.category);
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });
  }, [tools, query]);

  if (selectedTool) {
    return (
      <div className="flex-1 min-h-0">
        <ToolInspector tool={selectedTool} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      <div className="relative w-full max-w-[220px] shrink-0">
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
          filteredTools.map((tool) => {
            const display = getToolDisplay(tool);
            return (
              <AppContextMenu key={tool.name} context={{ objectType: "mcpTool", toolName: tool.name }}>
                <button
                  onClick={() => onSelectTool(tool)}
                  className="group flex w-full cursor-pointer items-start gap-3 border-b border-border-soft px-2 py-2.5 text-left transition-colors hover:bg-surface-raised"
                  type="button"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-muted text-text-muted transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                    {getToolCategoryIcon(tool.category)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex w-full items-center justify-between gap-2">
                      <strong className="truncate text-[13px] font-bold leading-none text-text">{display.title}</strong>
                      <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[9px] font-extrabold leading-none tracking-wider text-brand-strong">
                        {getToolCategoryLabel(tool.category)}
                      </span>
                    </div>
                    <span className="mt-1.5 truncate font-mono text-[10px] text-text-subtle/80">{tool.name}</span>
                    <p className="m-0 mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-muted">{display.summary}</p>
                  </div>
                </button>
              </AppContextMenu>
            );
          })
        )}
      </div>
    </div>
  );
}

// Sub Tab component: Console Task logs
function GameRuntimeLogsTab({
  project,
}: {
  project?: ProjectSummary;
}) {
  const [buildLogs, setBuildLogs] = useState<ProjectBuildLogsSummary>();
  const [buildLogsLoading, setBuildLogsLoading] = useState(false);
  const [buildLogsError, setBuildLogsError] = useState("");
  const runtimeLogSummaryRaw = useMemo(
    () => (buildLogs ? JSON.stringify(buildLogs.runtime, null, 2) : ""),
    [buildLogs],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBuildLogs() {
      if (!project?.id) {
        setBuildLogs(undefined);
        setBuildLogsError("");
        setBuildLogsLoading(false);
        return;
      }

      setBuildLogsLoading(true);
      setBuildLogsError("");
      try {
        const result = await getBuildLogs(project.id);
        if (!cancelled) setBuildLogs(result);
      } catch (error) {
        if (!cancelled) {
          setBuildLogs(undefined);
          setBuildLogsError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setBuildLogsLoading(false);
      }
    }

    void loadBuildLogs();
    return () => {
      cancelled = true;
    };
  }, [project?.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <RuntimeLogSnapshot
        projectId={project?.id}
        buildLogs={buildLogs}
        rawValue={runtimeLogSummaryRaw}
        loading={buildLogsLoading}
        errorMessage={buildLogsError}
      />
    </div>
  );
}

function ConsoleTab({
  tasks,
  selectedTask,
  onSelectTask,
  onDeleteTask,
  onRefreshTasks,
  onRecoverVideoTask,
  recoveringVideoTaskId,
  videoRecoveryCooldowns = {}
}: {
  tasks: TaskRecord[];
  selectedTask?: TaskRecord;
  onSelectTask: (task: TaskRecord) => void;
  onDeleteTask: (taskId: string) => void;
  onRefreshTasks: () => void;
  onRecoverVideoTask?: (taskId: string) => void;
  recoveringVideoTaskId?: string;
  videoRecoveryCooldowns?: Record<string, number>;
}) {
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const filteredTasks = useMemo(
    () => tasks.filter((task) => statusFilter === "all" || task.status === statusFilter),
    [statusFilter, tasks],
  );
  const activeTask = selectedTask
    ? tasks.find((task) => task.taskId === selectedTask.taskId) ?? selectedTask
    : undefined;

  if (activeTask) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
        <TaskInspector
          task={activeTask}
          onRecoverVideoTask={onRecoverVideoTask}
          recoveringVideoTaskId={recoveringVideoTaskId}
          videoRecoveryCooldowns={videoRecoveryCooldowns}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
      <div className="flex shrink-0 gap-1 overflow-x-auto rounded-control border border-border-soft bg-surface-muted p-1 scrollbar-thin">
        {taskStatusFilterOptions.map((option) => {
          const count = option.value === "all" ? tasks.length : tasks.filter((task) => task.status === option.value).length;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-[4px] px-2 py-1 text-[10px] font-bold transition-colors",
                statusFilter === option.value
                  ? "bg-surface-panel text-brand-strong shadow-sm"
                  : "text-text-subtle hover:bg-surface-panel/70 hover:text-text"
              )}
              title={`${option.label} ${count}`}
            >
              <span>{option.label}</span>
              <span className="rounded bg-surface-raised px-1 font-mono text-[9px] text-text-subtle">{count}</span>
            </button>
          );
        })}
        <button onClick={onRefreshTasks} className="ml-auto shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-surface-panel hover:text-text" title="刷新任务记录">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1 scrollbar-thin">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-text-muted">
              {tasks.length === 0 ? "暂无任务" : "没有匹配当前状态的任务"}
            </div>
          ) : (
            filteredTasks.slice(0, 50).map(t => {
              const isRunning = t.status === "running";
              const hasErrorInResult = taskHasMcpErrorResult(t);
              const isFailed = isTaskError(t);
              const isSuccess = isTaskSuccess(t);

              return (
                <AppContextMenu key={t.taskId} context={{ objectType: "task", taskId: t.taskId }}>
                <div className="group relative flex w-full">
                  <button
                    onClick={() => onSelectTask(t)}
                    className="group/btn flex w-full cursor-pointer items-start gap-3 border-b border-border-soft px-2 py-3 text-left transition-colors hover:bg-surface-raised"
                    type="button"
                  >
                    <div className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors",
                      isFailed ? "bg-[#b03939]/10 text-[#b03939] group-hover/btn:bg-[#b03939]/20" :
                      isSuccess ? "bg-[#246b2f]/10 text-[#246b2f] group-hover/btn:bg-[#246b2f]/20" :
                      isRunning ? "bg-brand/10 text-brand group-hover/btn:bg-brand/20" :
                      "bg-surface-muted text-text-muted group-hover/btn:text-text"
                    )}>
                       {isFailed ? <AlertTriangle className="h-4 w-4" /> : isSuccess ? <CheckCircle2 className="h-4 w-4" /> : isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex w-full items-center justify-between gap-2">
                        <strong className="truncate text-[13px] font-bold leading-none text-text">{t.toolName}</strong>
                        <span className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold leading-none tracking-wider",
                          isFailed ? "bg-[#b03939]/10 text-[#b03939]" : 
                          isSuccess ? "bg-[#246b2f]/10 text-[#246b2f]" : 
                          isRunning ? "bg-brand/10 text-brand-strong" : 
                          "bg-surface-muted text-text-subtle"
                        )}>
                          {hasErrorInResult ? "失败 (MCP 报错)" : 
                           isFailed ? "失败" : 
                           isSuccess ? "成功" : 
                           isRunning ? "运行中" : 
                           t.status === "queued" ? "排队中" : t.status}
                        </span>
                      </div>
                      <span className="mt-1.5 truncate font-mono text-[10px] text-text-subtle">{t.inputSummary}</span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteTask(t.taskId); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded transition-all bg-surface-panel/80 backdrop-blur"
                    title="删除记录"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                </AppContextMenu>
              );
            })
          )}
      </div>
    </div>
  );
}

function ErrorsTab({
  tasks,
  selectedTask,
  onSelectTask,
  onClearTasks,
  onRecoverVideoTask,
  recoveringVideoTaskId,
  videoRecoveryCooldowns = {}
}: {
  tasks: TaskRecord[];
  selectedTask?: TaskRecord;
  onSelectTask: (task: TaskRecord) => void;
  onClearTasks: () => void;
  onRecoverVideoTask?: (taskId: string) => void;
  recoveringVideoTaskId?: string;
  videoRecoveryCooldowns?: Record<string, number>;
}) {
  const activeTask = selectedTask
    ? tasks.find((task) => task.taskId === selectedTask.taskId) ?? selectedTask
    : undefined;

  if (activeTask) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
        <TaskInspector
          task={activeTask}
          onRecoverVideoTask={onRecoverVideoTask}
          recoveringVideoTaskId={recoveringVideoTaskId}
          videoRecoveryCooldowns={videoRecoveryCooldowns}
        />
      </div>
    );
  }

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
          const isConcurrencyError = isVideoConcurrencyError(task);
          const oldTaskId = getVideoConcurrencyTaskId(task);
          const recoveryState = oldTaskId ? getRecoveryState(oldTaskId, recoveringVideoTaskId, videoRecoveryCooldowns) : undefined;
          
          return (
            <AppContextMenu key={task.taskId} context={{ objectType: "task", taskId: task.taskId }}>
            <button type="button" onClick={() => onSelectTask(task)} className="rounded-card border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-left hover:bg-[#b03939]/10">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="truncate text-xs text-[#b03939]">{task.toolName}</strong>
                <span className="rounded-pill bg-[#b03939]/10 px-2 py-0.5 text-[9px] font-bold text-[#b03939]">
                  {isConcurrencyError ? "VideoConcurrencyLimitError" : classifyTaskError(task)}
                </span>
              </div>
              <p className="m-0 line-clamp-3 text-[11px] leading-relaxed text-text-muted">{task.errorMessage || task.rawResultJson || task.inputSummary}</p>
              
              {isConcurrencyError && oldTaskId && recoveryState && (
                <div className="mt-3 p-3 bg-surface-app border border-brand/20 rounded-lg flex flex-col gap-2.5 shadow-inner" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 text-brand">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold">云端并发冲突锁定 (1/1)</span>
                  </div>
                  <span className="text-[10px] text-text-muted leading-relaxed">
                    检测到旧任务 <code className="bg-surface-raised px-1 py-0.5 rounded text-text font-mono select-all">{oldTaskId}</code> 尚未释放。
                  </span>
                  <RecoveryButton taskId={oldTaskId} state={recoveryState} onRecoverVideoTask={onRecoverVideoTask} />
                </div>
              )}
              
              <div className="mt-2 flex justify-end">
                <span
                  role="button"
                  tabIndex={0}
                  className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[10px] font-semibold text-text-subtle hover:bg-surface-muted hover:text-text"
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyText(getTaskCopyPayload(task), { successMessage: "raw/error 已复制" });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      void copyText(getTaskCopyPayload(task), { successMessage: "raw/error 已复制" });
                    }
                  }}
                >
                  <Copy className="h-3 w-3" />
                  复制 raw/error
                </span>
              </div>
            </button>
            </AppContextMenu>
          );
        })}
      </div>
    </div>
  );
}

type RecoveryState = {
  loading: boolean;
  cooldownSeconds: number;
  disabled: boolean;
};

function getRecoveryState(taskId: string, recoveringVideoTaskId?: string, videoRecoveryCooldowns: Record<string, number> = {}): RecoveryState {
  const cooldownSeconds = Math.max(0, Math.ceil(((videoRecoveryCooldowns[taskId] ?? 0) - Date.now()) / 1000));
  const loading = recoveringVideoTaskId === taskId;
  return {
    loading,
    cooldownSeconds,
    disabled: loading || cooldownSeconds > 0 || !!recoveringVideoTaskId
  };
}

function RecoveryAction({ taskId, state, onRecoverVideoTask }: { taskId: string; state: RecoveryState; onRecoverVideoTask?: (taskId: string) => void }) {
  return (
    <div className="rounded-panel border border-brand/20 bg-brand/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-brand">
        <AlertCircle className="w-3.5 h-3.5" />
        <span className="text-[11px] font-bold">视频并发任务锁定</span>
      </div>
      <p className="m-0 mb-2 text-[10px] leading-relaxed text-text-muted">
        云端提示旧任务 <code className="rounded bg-surface-raised px-1 py-0.5 font-mono text-text select-all">{taskId}</code> 还在占用并发名额。
      </p>
      <RecoveryButton taskId={taskId} state={state} onRecoverVideoTask={onRecoverVideoTask} />
    </div>
  );
}

function RecoveryButton({ taskId, state, onRecoverVideoTask }: { taskId: string; state: RecoveryState; onRecoverVideoTask?: (taskId: string) => void }) {
  const label = state.loading
    ? "正在查询任务状态..."
    : state.cooldownSeconds > 0
      ? `等待 ${state.cooldownSeconds} 秒后可重试`
      : "安全恢复并刷新状态";

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full text-[11px] h-8 bg-brand/10 border-brand/30 text-brand hover:bg-brand hover:text-[#04202a] transition-all font-bold mt-1 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      onClick={() => onRecoverVideoTask?.(taskId)}
      disabled={state.disabled || !onRecoverVideoTask}
    >
      <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", state.loading && "animate-spin")} />
      {label}
    </Button>
  );
}
