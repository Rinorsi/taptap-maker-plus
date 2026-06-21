import { useEffect, useMemo, useState, useRef } from "react";
import {
  callTool,
  deleteAssets, renameAsset,
  getRuntimeStatus,
  getStatusLite,
  importAsset,
  listAssets,
  listProjects,
  listTasks,
  listTools,
  moveAssets,
  refreshTools,
  scanAssets,
  scanProjects,
  selectProject,
  startRuntime,
  clearTasks,
  type AssetSummary,
  type ProjectSummary,
  type RuntimeSummary,
  type TaskRecord,
  type ToolSummary
} from "../api";
import { type WorkbenchModule } from "./routes";
import { TopBar } from "../components/layout/TopBar";
import { ProjectSidebar } from "../components/layout/ProjectSidebar";
import { WorkbenchViewport } from "../components/layout/WorkbenchViewport";
import { AgentInspectorPanel, type InspectorSelection } from "../components/layout/AgentInspectorPanel";

export function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("taptap.theme") === "dark" ? "dark" : "light"));
  const [activeModule, setActiveModule] = useState<WorkbenchModule>(() => {
    const hasProject = localStorage.getItem("taptap.selectedProjectId");
    return "home";
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => localStorage.getItem("taptap.selectedProjectId") ?? "");
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runtime, setRuntime] = useState<RuntimeSummary | undefined>();
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<InspectorSelection>();
  const [notice, setNotice] = useState("准备就绪");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem("taptap.sidebarWidth") ?? 240));
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(() => Number(localStorage.getItem("taptap.inspectorWidth") ?? 280));
  const [rightPanelTab, setRightPanelTab] = useState<"status" | "tools" | "logs" | "errors">("status");
  const [recoveringVideoTaskId, setRecoveringVideoTaskId] = useState<string>();
  const [videoRecoveryCooldowns, setVideoRecoveryCooldowns] = useState<Record<string, number>>({});
  const failedTasks = useMemo(() => tasks.filter((task) => task.status === "failed"), [tasks]);

  const previousFailedTasksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentFailedIds = new Set(failedTasks.map(t => t.taskId));
    let hasNewFailed = false;
    for (const id of currentFailedIds) {
      if (!previousFailedTasksRef.current.has(id)) {
        hasNewFailed = true;
        break;
      }
    }
    previousFailedTasksRef.current = currentFailedIds;

    if (hasNewFailed) {
      setInspectorMinimized(false);
      setRightPanelTab("errors");
    }
  }, [failedTasks]);

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedProjectId), [projects, selectedProjectId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("taptap.theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("taptap.sidebarWidth", String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem("taptap.inspectorWidth", String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    localStorage.setItem("taptap.selectedProjectId", selectedProjectId);
    void refreshProject(selectedProjectId);
  }, [selectedProjectId]);

  async function bootstrap() {
    setBusy(true);
    try {
      const [stored, scanned] = await Promise.all([listProjects(), scanProjects()]);
      const nextProjects = scanned.projects.length ? scanned.projects : stored.projects;
      setProjects(nextProjects);
      const nextSelected = stored.selectedProjectId || "";
      if (nextSelected) {
        setSelectedProjectId(nextSelected);
      } else {
        setActiveModule("home");
      }
      setNotice(`发现 ${nextProjects.length} 个项目`);
      const allTasks = await listTasks().catch(() => []);
      setTasks(allTasks);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function refreshProject(projectId: string) {
    const [status, toolData, assetList, taskList] = await Promise.all([
      getRuntimeStatus(projectId).catch(() => undefined),
      listTools(projectId).catch(() => undefined),
      listAssets(projectId).catch(() => []),
      listTasks(projectId).catch(() => [])
    ]);
    if (status?.project) {
      setProjects((current) => current.map((project) => project.id === projectId ? status.project : project));
      setRuntime(status.runtime ?? status.project.runtime);
    }
    if (toolData) {
      setTools(toolData.tools);
      setRuntime(toolData.runtime ?? status?.runtime);
    }
    setAssets(assetList);
    setTasks(taskList);
  }

  // Auto-refresh tasks every 10 seconds if any task is running
  useEffect(() => {
    if (!selectedProjectId) return;
    const hasRunning = tasks.some(t => t.status === "running" || t.status === "queued");
    if (!hasRunning) return;
    const interval = setInterval(() => {
      listTasks(selectedProjectId).then(setTasks).catch(() => undefined);
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedProjectId, tasks]);

  useEffect(() => {
    const hasActiveCooldown = Object.values(videoRecoveryCooldowns).some((until) => until > Date.now());
    if (!hasActiveCooldown) return;
    const interval = setInterval(() => {
      setVideoRecoveryCooldowns((current) => ({ ...current }));
    }, 1000);
    return () => clearInterval(interval);
  }, [videoRecoveryCooldowns]);

  async function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSelection(undefined);
    setActiveModule("assets");
    await selectProject(projectId).catch((error) => setNotice(error instanceof Error ? error.message : String(error)));
  }

  async function handleScanProjects() {
    setBusy(true);
    try {
      const response = await scanProjects();
      setProjects(response.projects);
      if (!selectedProjectId && response.projects[0]) setSelectedProjectId(response.projects[0].id);
      setNotice(`扫描完成：${response.projects.length} 个项目`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartRuntime() {
    if (!selectedProject) return;
    setBusy(true);
    setNotice("启动 MCP runtime...");
    try {
      const response = await startRuntime(selectedProject.id);
      setRuntime(response.runtime);
      setTools(response.tools);
      setProjects((current) => current.map((project) => project.id === selectedProject.id ? { ...project, runtime: response.runtime } : project));
      setNotice(response.runtime.status === "ready" ? "MCP runtime ready" : response.runtime.lastError ?? response.runtime.status);
      await refreshProject(selectedProject.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshTools() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const response = await refreshTools(selectedProject.id);
      setTools(response.tools);
      setRuntime(response.runtime);
      setNotice(`刷新 tools/list：${response.tools.length} 个工具`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleScanAssets() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const nextAssets = await scanAssets(selectedProject.id);
      setAssets(nextAssets);
      setNotice(`资产索引完成：${nextAssets.length} 个文件`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAssets(relativePaths: string[]) {
    if (!selectedProject || !relativePaths.length) return;
    setBusy(true);
    try {
      const nextAssets = await deleteAssets(selectedProject.id, relativePaths);
      setAssets(nextAssets);
      setSelection(undefined);
      setNotice(`已删除 ${relativePaths.length} 个资产`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveAssets(relativePaths: string[], targetFolder: string) {
    if (!selectedProject || !relativePaths.length) return;
    setBusy(true);
    try {
      const nextAssets = await moveAssets(selectedProject.id, relativePaths, targetFolder);
      setAssets(nextAssets);
      setSelection(undefined);
      setNotice(`已移动 ${relativePaths.length} 个资产到 ${targetFolder}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenameAsset(relativePath: string, newName: string) {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const nextAssets = await renameAsset(selectedProject.id, relativePath, newName);
      setAssets(nextAssets);
      setSelection(undefined);
      setNotice(`已重命名文件为 ${newName}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleImportAssets(files: File[], targetFolder: string) {
    if (!selectedProject || !files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        await importAsset(selectedProject.id, file.name, targetFolder, dataUrl);
      }
      const nextAssets = await listAssets(selectedProject.id);
      setAssets(nextAssets);
      setNotice(`已导入 ${files.length} 张图片到 ${targetFolder}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusLite() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const result = await getStatusLite(selectedProject.id, {});
      setStatusText(result.text);
      setNotice("maker_status_lite 调用完成");
      await refreshProject(selectedProject.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      await refreshProject(selectedProject.id).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectSelection(sel: InspectorSelection) {
    setSelection(sel);
    setRightPanelTab("status");
    setInspectorMinimized(false);
  }

  async function handleCallTool(toolName: string, args: Record<string, unknown>) {
    if (!selectedProject) return undefined;
    setBusy(true);
    setNotice(`调用 ${toolName}...`);
    setRightPanelTab("logs");
    setInspectorMinimized(false);

    const tempTask: TaskRecord = {
      taskId: "temp-" + Date.now(),
      projectId: selectedProject.id,
      toolName: toolName,
      inputJson: JSON.stringify(args, null, 2),
      status: "running",
      startedAt: new Date().toISOString(),
      inputSummary: "生成中..."
    };
    setTasks(current => [tempTask, ...current]);

    try {
      const result = await callTool(selectedProject.id, toolName, args);
      setNotice(`${toolName} 完成，资产索引 ${result.assetsIndexed}`);
      await refreshProject(selectedProject.id);
      if (result.task) handleSelectSelection({ type: "task", item: result.task });
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      await refreshProject(selectedProject.id).catch(() => undefined);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function handleRecoverVideoTask(oldTaskId: string) {
    if (!selectedProject) return;
    const cooldownUntil = videoRecoveryCooldowns[oldTaskId] ?? 0;
    const cooldownRemaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (recoveringVideoTaskId) {
      setNotice(`正在查询 ${recoveringVideoTaskId}，请等待当前恢复动作完成`);
      return;
    }
    if (cooldownRemaining > 0) {
      setNotice(`刚刚查询过 ${oldTaskId}，请 ${cooldownRemaining} 秒后再试`);
      return;
    }
    setBusy(true);
    setRecoveringVideoTaskId(oldTaskId);
    setVideoRecoveryCooldowns((current) => ({ ...current, [oldTaskId]: Date.now() + 120_000 }));
    setRightPanelTab("errors");
    setInspectorMinimized(false);
    setNotice(`正在查询视频任务 ${oldTaskId}，请不要重复点击`);
    try {
      await callTool(selectedProject.id, "query_video_task", { task_id: oldTaskId });
      setNotice(`视频任务状态查询完成：${oldTaskId}`);
      await refreshProject(selectedProject.id);
      await handleRefreshTasks();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
      await refreshProject(selectedProject.id).catch(() => undefined);
    } finally {
      setRecoveringVideoTaskId(undefined);
      setBusy(false);
    }
  }

  async function handleRefreshTasks() {
    const taskList = await listTasks(selectedProjectId || undefined).catch(() => []);
    setTasks(taskList);
  }

  function handleDeleteTask(taskId: string) {
    setTasks(current => current.filter(t => t.taskId !== taskId));
  }

  async function handleClearTasks() {
    const taskList = await clearTasks(selectedProjectId || undefined).catch(() => []);
    setTasks(taskList);
  }

  function selectModule(module: WorkbenchModule) {
    setActiveModule(module);
    if (module === "settings") setSelection(undefined);
  }

  function beginInspectorResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(420, Math.max(240, startWidth - (moveEvent.clientX - startX)));
      setInspectorWidth(nextWidth);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function beginSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(Math.min(360, Math.max(220, startWidth + (moveEvent.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const runtimeView = runtime ?? selectedProject?.runtime;

  return (
    <div className="h-screen flex flex-col bg-surface-app text-text overflow-hidden">
      <TopBar
        toolCount={tools.length}
        theme={theme}
        projects={projects}
        tools={tools}
        assets={assets}
        tasks={tasks}
        onThemeToggle={() => setTheme(theme === "light" ? "dark" : "light")}
        onOpenSettings={() => selectModule("settings")}
        onSelectProject={handleSelectProject}
        onOpenModule={selectModule}
        onSelect={handleSelectSelection}
      />

      <div
        className="flex-1 min-h-0 flex overflow-hidden transition-all duration-300"
        style={{ "--inspector-width": inspectorMinimized ? "48px" : `${inspectorWidth}px` } as React.CSSProperties}
      >
        <div className="relative shrink-0 h-full" style={{ width: sidebarCollapsed ? 56 : sidebarWidth }}>
          <ProjectSidebar projects={projects} selectedProjectId={selectedProjectId} activeModule={activeModule} tasks={tasks} collapsed={sidebarCollapsed} width={sidebarWidth} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} onSelectProject={handleSelectProject} onSelectModule={selectModule} onScanProjects={handleScanProjects} />
          {!sidebarCollapsed && <div className="absolute -right-[5px] top-0 bottom-0 w-[10px] z-10 cursor-col-resize hover:bg-brand/20 transition-colors" role="separator" aria-label="调整项目侧栏宽度" onPointerDown={beginSidebarResize} />}
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-surface-app">
          <WorkbenchViewport
            activeModule={activeModule}
            project={selectedProject ? { ...selectedProject, runtime: runtimeView } : undefined}
            projects={projects}
            runtime={runtimeView}
            tools={tools}
            assets={assets}
            tasks={tasks}
            statusText={statusText}
            busy={busy}
            onStartRuntime={handleStartRuntime}
            onScanAssets={handleScanAssets}
            onDeleteAssets={handleDeleteAssets}
            onMoveAssets={handleMoveAssets}
            onRenameAsset={handleRenameAsset}
            onImportAssets={handleImportAssets}
            onCallStatusLite={handleStatusLite}
            onCallTool={handleCallTool}
            onSelect={handleSelectSelection}
            onSelectProject={handleSelectProject}
            onScanProjects={handleScanProjects}
            onOpenModule={(m) => {
              setActiveModule(m);
              setSelection(undefined);
            }}
            onCollapseSidebar={() => {
              setSidebarCollapsed(true);
              setInspectorMinimized(true);
            }}
            onShowError={() => setInspectorMinimized(false)}
          />
        </div>

        <div className="relative shrink-0 flex h-full border-l border-border bg-surface-panel" style={{ width: "var(--inspector-width)", transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          {!inspectorMinimized && (
            <div
              className="absolute -left-[5px] top-0 bottom-0 w-[10px] z-10 cursor-col-resize hover:bg-brand/20 transition-colors"
              role="separator"
              aria-label="调整 Inspector 面板宽度"
              onPointerDown={beginInspectorResize}
            />
          )}
          <AgentInspectorPanel
            project={selectedProject ? { ...selectedProject, runtime: runtimeView } : undefined}
            tools={tools}
            tasks={tasks}
            selection={selection}
            minimized={inspectorMinimized}
            activeTab={rightPanelTab}
            onTabChange={setRightPanelTab}
            onToggleMinimized={() => setInspectorMinimized(!inspectorMinimized)}
            onStartRuntime={handleStartRuntime}
            onRefreshTools={handleRefreshTools}
            onStatusLite={handleStatusLite}
            onSelectSelection={handleSelectSelection}
            onClearTasks={handleClearTasks}
            onRefreshTasks={handleRefreshTasks}
            onDeleteTask={handleDeleteTask}
            onRecoverVideoTask={handleRecoverVideoTask}
            recoveringVideoTaskId={recoveringVideoTaskId}
            videoRecoveryCooldowns={videoRecoveryCooldowns}
          />
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
