import { Terminal, FolderSync, Search, Settings, Moon, Sun, PanelLeft, PanelRight, RefreshCw, Copy, Trash2, Eye, Save, Play, Code, ClipboardList, Scan, Edit2, Move, ExternalLink, Image, FolderOpen, Download, Crosshair, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  callTool,
  copyAssetFolder,
  copyAssets,
  createAssetFolder,
  deleteAssets,
  deleteAssetFolder,
  getRuntimeStatus,
  getStatusLite,
  getAssetTree,
  importAsset,
  importLocalAssetPaths,
  listAssets,
  listProjects,
  listTasks,
  listTools,
  moveAssetFolder,
  moveAssetsWithResult,
  openLocalAssetPath,
  refreshTools,
  renameAssetFolder,
  renameAssetWithResult,
  removeProjectRecord,
  scanAssets,
  scanAssetReferences,
  scanProjects,
  selectProject,
  startRuntime,
  stopRuntime,
  clearTasks,
  deleteProjectLocalFolder,
  type AgentPageState,
  type AssetDirectoryNode,
  type AssetMutationResponse,
  type AgentSelectionReference,
  type AssetReferenceScanResult,
  type AssetSummary,
  type ProjectSummary,
  type RuntimeSummary,
  type TaskRecord,
  type ToolSummary,
} from "../api";
import { filterAssetsForDirectory } from "../features/assets/assetTree";
import { type WorkbenchModule } from "./routes";
import { type SettingsTab } from "../features/settings/settingsTabs";
import { TopBar } from "../components/layout/TopBar";
import { ProjectSidebar } from "../components/layout/ProjectSidebar";
import { WorkbenchViewport } from "../components/layout/WorkbenchViewport";
import {
  AgentInspectorPanel,
  type InspectorSelection,
} from "../components/layout/AgentInspectorPanel";
import {
  AppMenuBar,
  CommandPalette,
  CommandProvider,
  COMMAND_RUN_EVENT,
  type CommandRunRequest,
  EditableContextMenu,
  closeAllContextMenus,
  clampContextMenuPosition,
  commandShortcuts,
  CONTEXT_MENU_CLOSE_EVENT,
  CONTEXT_MENU_OPEN_EVENT,
  createCommandRegistry,
  getContextMenuCommands,
  isEditableShortcutTarget,
  matchesShortcut,
  notifyContextMenuOpen,
  shouldIgnoreContextMenuEvent,
  shouldUseNativeContextMenu,
  type MenuItem,
  type AppCommandContext,
  type Command,
} from "../commands";
import { copyText } from "../lib/clipboard";
import { ContextMenuStyles } from "../components/ui/ContextMenuStyles";
import { PromptDialog, type PromptConfig } from "../components/ui/PromptDialog";
import { ConfirmDialog, type ConfirmConfig } from "../components/ui/ConfirmDialog";
import { ASSET_DRAG_MIME, clearAssetDragData } from "../components/interaction/assetDragData";

const DEFAULT_PROJECT_MODULE: WorkbenchModule = "assets";
const NODE_PRESET_DRAG_MIME = "application/reactflow";
const NODE_PRESET_TEXT_PREFIX = "taptap-node-preset:";
const BOOTSTRAP_RETRY_DELAYS_MS = [800, 1200, 1800, 2600, 3600];
const ASSET_REFERENCE_CACHE_TTL_MS = 30_000;

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";
type TauriResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";
type ReferenceMutationDecision = "update" | "skip" | "cancel";

function readPlainDragText(dataTransfer?: DataTransfer | null) {
  try {
    return dataTransfer?.getData("text/plain") ?? "";
  } catch {
    return "";
  }
}

function isWorkbenchDrag(event: DragEvent) {
  const types = Array.from(event.dataTransfer?.types ?? []);
  const nodePresetDrag = (
    window as Window & { __taptapNodePresetDrag?: string }
  ).__taptapNodePresetDrag;
  const assetDrag = (window as Window & { __taptapAssetDrag?: unknown })
    .__taptapAssetDrag;
  return (
    types.includes(NODE_PRESET_DRAG_MIME) ||
    types.includes(ASSET_DRAG_MIME) ||
    Boolean(nodePresetDrag) ||
    Boolean(assetDrag) ||
    readPlainDragText(event.dataTransfer).startsWith(NODE_PRESET_TEXT_PREFIX)
  );
}

export function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("taptap.theme") === "dark" ? "dark" : "light",
  );
  const [cinemaThemeState, setCinemaThemeState] = useState<{ active: boolean, toTheme: "light" | "dark" }>({ active: false, toTheme: "light" });
  const [activeModule, setActiveModule] = useState<WorkbenchModule>(() => {
    const hasProject = localStorage.getItem("taptap.selectedProjectId");
    return hasProject ? DEFAULT_PROJECT_MODULE : "home";
  });
  const [lastNonSettingsModule, setLastNonSettingsModule] = useState<WorkbenchModule>(() => {
    const hasProject = localStorage.getItem("taptap.selectedProjectId");
    return hasProject ? DEFAULT_PROJECT_MODULE : "home";
  });
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>("project");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem("taptap.selectedProjectId") ?? "",
  );
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [assetTree, setAssetTree] = useState<AssetDirectoryNode>();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runtime, setRuntime] = useState<RuntimeSummary | undefined>();
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<InspectorSelection>();
  const [notice, setNotice] = useState("准备就绪");
  const assetReferenceScanCacheRef = useRef(
    new Map<string, { expiresAt: number; results: AssetReferenceScanResult[] }>(),
  );
  const activeReferenceScanRef = useRef<
    { key: string; controller: AbortController } | undefined
  >(undefined);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Number(localStorage.getItem("taptap.sidebarWidth") ?? 240),
  );
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(() =>
    Number(localStorage.getItem("taptap.inspectorWidth") ?? 280),
  );
  const [rightPanelTab, setRightPanelTab] = useState<
    "status" | "tools" | "gameLogs" | "logs" | "errors"
  >("status");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchFocusSignal, setSearchFocusSignal] = useState(0);
  const [fallbackMenu, setFallbackMenu] = useState<{ x: number; y: number }>();
  const [editableMenu, setEditableMenu] = useState<{
    x: number;
    y: number;
    target: HTMLInputElement | HTMLTextAreaElement;
  }>();
  const [recoveringVideoTaskId, setRecoveringVideoTaskId] = useState<string>();
  const [videoRecoveryCooldowns, setVideoRecoveryCooldowns] = useState<
    Record<string, number>
  >({});
  const [canvasCommandContext, setCanvasCommandContext] =
    useState<AppCommandContext>();
  const [promptConfig, setPromptConfig] = useState<PromptConfig>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
    onCancel: () => {},
  });
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig>({
    isOpen: false,
    title: "",
    onConfirm: () => {},
    onCancel: () => {},
  });
  const failedTasks = useMemo(
    () => tasks.filter((task) => task.status === "failed"),
    [tasks],
  );

  const previousFailedTasksRef = useRef<Set<string>>(new Set());
  const previousTaskStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const currentFailedIds = new Set(failedTasks.map((t) => t.taskId));
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

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  const GENERATION_TOOLS = ["generate_image", "text_to_music", "create_video_task"];

  // 任务完成事件通知
  useEffect(() => {
    for (const task of tasks) {
      const previousStatus = previousTaskStatusRef.current.get(task.taskId);
      const currentStatus = task.status;
      
      // 检测从 running 变为 succeeded/failed
      if (previousStatus === "running" && (currentStatus === "succeeded" || currentStatus === "failed")) {
        // 发送全局事件
        window.dispatchEvent(
          new CustomEvent("taptap:task-completed", {
            detail: {
              taskId: task.taskId,
              task,
              toolName: task.toolName,
            },
          })
        );
        
        // 生成任务完成时刷新资产列表和资产树，画布结果节点依赖 assets 回填。
        if (currentStatus === "succeeded" && GENERATION_TOOLS.includes(task.toolName) && selectedProject) {
          void refreshProjectAssets(selectedProject.id);
        }
      }
      
      previousTaskStatusRef.current.set(task.taskId, currentStatus);
    }
    
    // 清理已不存在的任务
    const currentTaskIds = new Set(tasks.map((t) => t.taskId));
    for (const taskId of previousTaskStatusRef.current.keys()) {
      if (!currentTaskIds.has(taskId)) {
        previousTaskStatusRef.current.delete(taskId);
      }
    }
  }, [tasks, selectedProject]);

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
      const { stored, scanned } = await loadBootstrapDataWithRetry(
        (attempt, maxAttempts) => {
          setNotice(`本地 API 未就绪，正在重试 ${attempt}/${maxAttempts}`);
        },
      );
      const nextProjects = scanned.projects.length
        ? scanned.projects
        : stored.projects;
      setProjects(nextProjects);
      const localSelected =
        localStorage.getItem("taptap.selectedProjectId") ?? "";
      const nextSelected =
        stored.selectedProjectId ||
        (nextProjects.some((project) => project.id === localSelected)
          ? localSelected
          : "");
      if (nextSelected) {
        setSelectedProjectId(nextSelected);
        setActiveModule((current) =>
          current === "home" ? DEFAULT_PROJECT_MODULE : current,
        );
      } else {
        setActiveModule("home");
      }
      setNotice(`发现 ${nextProjects.length} 个项目`);
      const allTasks = await listTasks().catch(() => []);
      setTasks(allTasks);
    } catch (error) {
      setNotice(
        `本地 API 仍未就绪，请确认 Fastify 服务已启动：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function refreshProject(projectId: string) {
    const [status, toolData, assetList, nextAssetTree, taskList] = await Promise.all([
      getRuntimeStatus(projectId).catch(() => undefined),
      listTools(projectId).catch(() => undefined),
      listAssets(projectId).catch(() => []),
      getAssetTree(projectId).catch(() => undefined),
      listTasks(projectId).catch(() => []),
    ]);
    if (status?.project) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? status.project : project,
        ),
      );
      setRuntime(status.runtime ?? status.project.runtime);
    }
    if (toolData) {
      setTools(toolData.tools);
      setRuntime(toolData.runtime ?? status?.runtime);
    }
    setAssets(assetList);
    setAssetTree(nextAssetTree);
    setTasks(taskList);
  }

  async function refreshAssetTree(projectId: string) {
    const nextAssetTree = await getAssetTree(projectId).catch(() => undefined);
    setAssetTree(nextAssetTree);
    return nextAssetTree;
  }

  async function refreshProjectAssets(projectId: string) {
    const [assetList, nextAssetTree] = await Promise.all([
      listAssets(projectId).catch(() => []),
      getAssetTree(projectId).catch(() => undefined),
    ]);
    setAssets(assetList);
    setAssetTree(nextAssetTree);
  }

  const refreshCurrentProject = useCallback(() => {
    if (!selectedProjectId) return undefined;
    return refreshProject(selectedProjectId);
  }, [selectedProjectId]);

  async function applyAssetMutationResult(result: AssetMutationResponse) {
    setAssets(result.assets);
    if (selectedProject) await refreshAssetTree(selectedProject.id);
  }

  // Auto-refresh local task/assets state while generation jobs are running.
  useEffect(() => {
    if (!selectedProjectId) return;
    const hasRunning = tasks.some(
      (t) => t.status === "running" || t.status === "queued",
    );
    if (!hasRunning) return;
    const interval = setInterval(() => {
      listTasks(selectedProjectId)
        .then((taskList) => {
          setTasks(taskList);
          const previousTaskById = new Map(
            tasks.map((task) => [task.taskId, task]),
          );
          const hasGenerationWork = [...tasks, ...taskList].some(
            (task) =>
              GENERATION_TOOLS.includes(task.toolName) &&
              (task.status === "running" || task.status === "queued"),
          );
          const hasCompletedGeneration = taskList.some((task) => {
            const previous = previousTaskById.get(task.taskId);
            return (
              GENERATION_TOOLS.includes(task.toolName) &&
              task.status === "succeeded" &&
              (previous?.status === "running" || previous?.status === "queued")
            );
          });
          if (hasGenerationWork || hasCompletedGeneration)
            void refreshProjectAssets(selectedProjectId);
        })
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedProjectId, tasks]);

  useEffect(() => {
    const hasActiveCooldown = Object.values(videoRecoveryCooldowns).some(
      (until) => until > Date.now(),
    );
    if (!hasActiveCooldown) return;
    const interval = setInterval(() => {
      setVideoRecoveryCooldowns((current) => ({ ...current }));
    }, 1000);
    return () => clearInterval(interval);
  }, [videoRecoveryCooldowns]);

  async function handleSelectProject(projectId: string) {
    if (!projectId) {
      handleClearProject();
      return;
    }
    setSelectedProjectId(projectId);
    setSelection(undefined);
    setActiveModule(DEFAULT_PROJECT_MODULE);
    await selectProject(projectId).catch((error) =>
      setNotice(error instanceof Error ? error.message : String(error)),
    );
  }

  function handleClearProject() {
    localStorage.removeItem("taptap.selectedProjectId");
    setSelectedProjectId("");
    setTools([]);
    setAssets([]);
    setAssetTree(undefined);
    setTasks([]);
    setRuntime(undefined);
    setStatusText("");
    setSelection(undefined);
    setActiveModule("home");
    setRightPanelTab("status");
    setNotice("已退出当前项目");
  }

  async function handleScanProjects() {
    setBusy(true);
    try {
      const response = await scanProjects();
      setProjects(response.projects);
      if (!selectedProjectId && response.projects[0])
        setSelectedProjectId(response.projects[0].id);
      setNotice(`扫描完成：${response.projects.length} 个项目`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartRuntime() {
    if (!selectedProject) return;
    const currentRuntime = runtime ?? selectedProject.runtime;
    const isRestart = currentRuntime?.status === "ready";
    const confirmed = await requestConfirm({
      title: isRestart ? "重启 MCP Runtime" : "启动 MCP Runtime",
      body: (
        <div className="flex flex-col gap-4 mt-1">
          <p className="text-sm text-text-subtle">
            {isRestart
              ? "将先停止当前 MCP runtime，再重新建立连接并刷新工具列表。"
              : "将为当前项目启动 MCP runtime，并通过后台调用既有启动链路。"}
          </p>
          <div className="flex flex-col gap-3 rounded-xl bg-surface-panel/50 p-4 border border-border-soft">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目名称</span>
              <span className="text-sm font-bold text-text">{selectedProject.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目路径</span>
              <span className="text-xs font-mono text-text-subtle truncate" title={selectedProject.rootPath}>
                {selectedProject.rootPath}
              </span>
            </div>
            {isRestart && currentRuntime?.processId ? (
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">当前进程 PID</span>
                <span className="text-xs font-mono text-brand-strong">
                  {currentRuntime.processId}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ),
      confirmLabel: isRestart ? "重启 Runtime" : "启动 Runtime",
      cancelLabel: "取消",
      danger: isRestart,
    });
    if (!confirmed) return;

    const startedAt = new Date().toISOString();
    const startingRuntime: RuntimeSummary = {
      projectId: selectedProject.id,
      status: "starting",
      toolCount: currentRuntime?.toolCount ?? tools.length,
      cwd: selectedProject.rootPath,
      startedAt,
      toolsListUpdatedAt: currentRuntime?.toolsListUpdatedAt,
    };

    setBusy(true);
    setRightPanelTab("status");
    setInspectorMinimized(false);
    setSelection(undefined);
    try {
      if (isRestart) {
        setNotice("正在停止当前 MCP runtime，准备重启...");
        const stopResponse = await stopRuntime(selectedProject.id);
        if (stopResponse.runtime) {
          setRuntime(stopResponse.runtime);
          setProjects((current) =>
            current.map((project) =>
              project.id === selectedProject.id
                ? { ...project, runtime: stopResponse.runtime }
                : project,
            ),
          );
        }
      }
      setRuntime(startingRuntime);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, runtime: startingRuntime }
            : project,
        ),
      );
      setNotice(
        isRestart
          ? "正在重启 MCP runtime：POST /api/projects/:projectId/mcp/start"
          : "正在启动 MCP runtime：POST /api/projects/:projectId/mcp/start",
      );
      const response = await startRuntime(selectedProject.id);
      setRuntime(response.runtime);
      setTools(response.tools);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, runtime: response.runtime }
            : project,
        ),
      );
      setNotice(
        response.runtime.status === "ready"
          ? `MCP 已连接：PID ${response.runtime.processId ?? "-"}，tools/list ${response.tools.length} 个`
          : (response.runtime.lastError ?? response.runtime.status),
      );
      await refreshProject(selectedProject.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedRuntime: RuntimeSummary = {
        projectId: selectedProject.id,
        status: "error",
        toolCount: tools.length,
        cwd: selectedProject.rootPath,
        lastError: message,
      };
      setRuntime(failedRuntime);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, runtime: failedRuntime }
            : project,
        ),
      );
      setNotice(`MCP 启动失败：${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleStopRuntime() {
    if (!selectedProject) return;
    const confirmed = await requestConfirm({
      title: "停止 MCP Runtime",
      body: (
        <div className="flex flex-col gap-4 mt-1">
          <p className="text-sm text-text-subtle">
            将停止当前项目的 MCP runtime。正在运行的本地 MCP 进程会被关闭。
          </p>
          <div className="flex flex-col gap-3 rounded-xl bg-surface-panel/50 p-4 border border-border-soft">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目名称</span>
              <span className="text-sm font-bold text-text">{selectedProject.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目路径</span>
              <span className="text-xs font-mono text-text-subtle truncate" title={selectedProject.rootPath}>
                {selectedProject.rootPath}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">当前进程 PID</span>
              <span className="text-xs font-mono text-brand-strong">{runtimeView?.processId ?? "-"}</span>
            </div>
          </div>
        </div>
      ),
      confirmLabel: "停止 Runtime",
      cancelLabel: "取消",
      danger: true,
    });
    if (!confirmed) return;

    setBusy(true);
    setRightPanelTab("status");
    setInspectorMinimized(false);
    setSelection(undefined);
    try {
      const response = await stopRuntime(selectedProject.id);
      setRuntime(response.runtime);
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? { ...project, runtime: response.runtime }
            : project,
        ),
      );
      setNotice("MCP Runtime 已停止");
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
      await refreshAssetTree(selectedProject.id);
      setNotice(`资产索引完成：${nextAssets.length} 个文件`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function scanAssetReferencesWithCache(
    projectId: string,
    relativePaths: string[],
    noticeLabel = "正在扫描引用...",
    signal?: AbortSignal,
  ) {
    const normalizedPaths = [...new Set(relativePaths)].sort();
    if (!normalizedPaths.length) return [];

    const cacheKey = `${projectId}:${normalizedPaths.join("|")}`;
    const now = Date.now();
    for (const [key, entry] of assetReferenceScanCacheRef.current) {
      if (entry.expiresAt <= now) assetReferenceScanCacheRef.current.delete(key);
    }

    const cached = assetReferenceScanCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.results;
    }

    setNotice(noticeLabel);
    const results = await scanAssetReferences(projectId, normalizedPaths, signal);
    assetReferenceScanCacheRef.current.set(cacheKey, {
      expiresAt: now + ASSET_REFERENCE_CACHE_TTL_MS,
      results,
    });
    return results;
  }

  async function confirmAssetReferenceMutation(
    projectId: string,
    relativePaths: string[],
    actionLabel: string,
  ) {
    const decision = await requestReferenceMutationDecision({
      projectId,
      relativePaths,
      actionLabel,
      allowUpdateReferences: false,
    });
    return decision !== "cancel";
  }

  async function handleConfirmAssetReferenceMutation(
    relativePaths: string[],
    actionLabel: string,
    allowUpdateReferences: boolean,
  ): Promise<ReferenceMutationDecision> {
    if (!selectedProject) return "cancel";
    if (!relativePaths.length) return "skip";
    return requestReferenceMutationDecision({
      projectId: selectedProject.id,
      relativePaths,
      actionLabel,
      allowUpdateReferences,
    });
  }

  function handleAssetMutationResult(prefix: string, result: AssetMutationResponse) {
    void applyAssetMutationResult(result);
    setSelection(undefined);
    setNotice(buildAssetMutationNotice(prefix, result));
  }

  async function requestReferenceMutationDecision({
    projectId,
    relativePaths,
    actionLabel,
    allowUpdateReferences,
  }: {
    projectId: string;
    relativePaths: string[];
    actionLabel: string;
    allowUpdateReferences: boolean;
  }): Promise<ReferenceMutationDecision> {
    const results = await scanAssetReferencesWithCache(
      projectId,
      relativePaths,
      `正在扫描引用，准备${actionLabel}...`,
    );
    const referencedResults = results.filter(
      (result) => result.referenceCount > 0,
    );
    if (!referencedResults.length) return "skip";

    if (!allowUpdateReferences) {
      const confirmed = await requestConfirm({
        title: `${actionLabel}已引用资产？`,
        body: buildAssetReferenceConfirmationMessage(actionLabel, referencedResults),
        confirmLabel: `继续${actionLabel}`,
        danger: true,
      });
      return confirmed ? "skip" : "cancel";
    }

    return requestConfirmChoice({
      title: `${actionLabel}已引用资产？`,
      body: buildAssetReferenceConfirmationMessage(actionLabel, referencedResults),
      confirmLabel: "同步更新引用",
      secondaryLabel: `仅${actionLabel}，引用可能缺失`,
      cancelLabel: "取消",
      danger: true,
    });
  }

  async function handleDeleteAssets(relativePaths: string[]) {
    if (!selectedProject || !relativePaths.length) return;
    const confirmedDelete = await requestConfirm({
      title: `确认删除 ${relativePaths.length} 个资产？`,
      body: relativePaths.join("\n"),
      confirmLabel: "删除",
      danger: true,
    });
    if (!confirmedDelete) {
      setNotice("已取消删除资产");
      return;
    }
    setBusy(true);
    try {
      const confirmed = await confirmAssetReferenceMutation(
        selectedProject.id,
        relativePaths,
        "删除",
      );
      if (!confirmed) {
        setNotice("已取消删除资产");
        return;
      }
      const nextAssets = await deleteAssets(selectedProject.id, relativePaths);
      setAssets(nextAssets);
      await refreshAssetTree(selectedProject.id);
      setSelection(undefined);
      setNotice(`已删除 ${relativePaths.length} 个资产`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleMoveAssets(
    relativePaths: string[],
    targetFolder: string,
  ) {
    if (!selectedProject || !relativePaths.length) return;
    setBusy(true);
    try {
      const decision = await requestReferenceMutationDecision({
        projectId: selectedProject.id,
        relativePaths,
        actionLabel: "移动",
        allowUpdateReferences: true,
      });
      if (decision === "cancel") {
        setNotice("已取消移动资产");
        return;
      }
      const result = await moveAssetsWithResult(
        selectedProject.id,
        relativePaths,
        targetFolder,
        decision === "update",
      );
      await applyAssetMutationResult(result);
      setSelection(undefined);
      setNotice(buildAssetMutationNotice(`已移动 ${relativePaths.length} 个资产到 ${targetFolder}`, result));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyAssets(
    relativePaths: string[],
    targetFolder: string,
  ) {
    if (!selectedProject || !relativePaths.length) return;
    setBusy(true);
    try {
      const nextAssets = await copyAssets(
        selectedProject.id,
        relativePaths,
        targetFolder,
      );
      setAssets(nextAssets);
      await refreshAssetTree(selectedProject.id);
      setNotice(`已复制 ${relativePaths.length} 个资产到 ${targetFolder}`);
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
      const decision = await requestReferenceMutationDecision({
        projectId: selectedProject.id,
        relativePaths: [relativePath],
        actionLabel: "重命名",
        allowUpdateReferences: true,
      });
      if (decision === "cancel") {
        setNotice("已取消重命名资产");
        return;
      }
      const result = await renameAssetWithResult(
        selectedProject.id,
        relativePath,
        newName,
        decision === "update",
      );
      await applyAssetMutationResult(result);
      setSelection(undefined);
      setNotice(buildAssetMutationNotice(`已重命名文件为 ${newName}`, result));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function renameFolderDirect(directoryPath: string, newName: string) {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const paths = assets.filter((asset) => isAssetUnderDirectory(asset.relativePath, directoryPath)).map((asset) => asset.relativePath);
      const decision = await requestReferenceMutationDecision({
        projectId: selectedProject.id,
        relativePaths: paths,
        actionLabel: "重命名",
        allowUpdateReferences: true,
      });
      if (decision === "cancel") {
        setNotice("已取消重命名文件夹");
        return;
      }
      const result = await renameAssetFolder(selectedProject.id, directoryPath, newName, decision === "update");
      await applyAssetMutationResult(result);
      setNotice(buildAssetMutationNotice(`已重命名文件夹为 ${result.directoryPath ?? newName}`, result));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function handlePromptRenameAsset(relativePath: string) {
    const currentName = relativePath.split(/[\\/]/).pop() ?? relativePath;
    setPromptConfig({
      isOpen: true,
      title: "输入新的文件名",
      defaultValue: currentName,
      confirmLabel: "重命名",
      onConfirm: async (nextName) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        if (nextName !== currentName) {
          await handleRenameAsset(relativePath, nextName);
        }
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  function handlePromptMoveAssets(relativePaths: string[]) {
    if (!relativePaths.length) return;
    window.dispatchEvent(
      new CustomEvent("taptap:asset-list-command", {
        detail: { action: "movePaths", panelId: undefined, paths: relativePaths },
      }),
    );
    const currentFolder =
      relativePaths[0]?.split(/[\\/]/).slice(0, -1).join("/") || "assets";
    
    setPromptConfig({
      isOpen: true,
      title: "输入目标目录",
      defaultValue: currentFolder,
      confirmLabel: "移动",
      onConfirm: async (targetFolder) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        if (targetFolder !== currentFolder) {
          await handleMoveAssets(relativePaths, targetFolder);
        }
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  async function handleCreateFolder(parentFolder: string) {
    if (!selectedProject) return;
    const normalizedParent = parentFolder || "assets";
    setPromptConfig({
      isOpen: true,
      title: "新建文件夹",
      defaultValue: "New Folder",
      confirmLabel: "创建",
      onConfirm: async (folderName) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        setBusy(true);
        try {
          const result = await createAssetFolder(selectedProject.id, normalizedParent, folderName);
          await applyAssetMutationResult(result);
          setNotice(`已创建文件夹 ${result.directoryPath ?? folderName}`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  async function handleRenameFolder(directoryPath: string) {
    if (!selectedProject) return;
    const currentName = directoryPath.split(/[\\/]/).filter(Boolean).at(-1) ?? directoryPath;
    setPromptConfig({
      isOpen: true,
      title: "重命名文件夹",
      defaultValue: currentName,
      confirmLabel: "重命名",
      onConfirm: async (newName) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        if (newName !== currentName) await renameFolderDirect(directoryPath, newName);
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  async function handleMoveFolder(directoryPath: string) {
    if (!selectedProject) return;
    const currentFolder = directoryPath.split(/[\\/]/).slice(0, -1).join("/") || "assets";
    setPromptConfig({
      isOpen: true,
      title: "移动文件夹到",
      defaultValue: currentFolder,
      confirmLabel: "移动",
      onConfirm: async (targetFolder) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        setBusy(true);
        try {
          const paths = assets.filter((asset) => isAssetUnderDirectory(asset.relativePath, directoryPath)).map((asset) => asset.relativePath);
          const decision = await requestReferenceMutationDecision({
            projectId: selectedProject.id,
            relativePaths: paths,
            actionLabel: "移动",
            allowUpdateReferences: true,
          });
          if (decision === "cancel") {
            setNotice("已取消移动文件夹");
            return;
          }
          const result = await moveAssetFolder(selectedProject.id, directoryPath, targetFolder, decision === "update");
          await applyAssetMutationResult(result);
          setNotice(buildAssetMutationNotice(`已移动文件夹到 ${result.directoryPath ?? targetFolder}`, result));
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  async function moveFolderDirect(directoryPath: string, targetFolder: string) {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const paths = assets.filter((asset) => isAssetUnderDirectory(asset.relativePath, directoryPath)).map((asset) => asset.relativePath);
      const decision = await requestReferenceMutationDecision({
        projectId: selectedProject.id,
        relativePaths: paths,
        actionLabel: "移动",
        allowUpdateReferences: true,
      });
      if (decision === "cancel") {
        setNotice("已取消移动文件夹");
        return;
      }
      const result = await moveAssetFolder(selectedProject.id, directoryPath, targetFolder, decision === "update");
      await applyAssetMutationResult(result);
      setNotice(buildAssetMutationNotice(`已移动文件夹到 ${result.directoryPath ?? targetFolder}`, result));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyFolder(directoryPath: string) {
    if (!selectedProject) return;
    setPromptConfig({
      isOpen: true,
      title: "复制文件夹到",
      defaultValue: "assets",
      confirmLabel: "复制",
      onConfirm: async (targetFolder) => {
        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        setBusy(true);
        try {
          const result = await copyAssetFolder(selectedProject.id, directoryPath, targetFolder);
          await applyAssetMutationResult(result);
          setNotice(`已复制文件夹到 ${result.directoryPath ?? targetFolder}`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      },
      onCancel: () => setPromptConfig((prev) => ({ ...prev, isOpen: false })),
    });
  }

  async function copyFolderDirect(directoryPath: string, targetFolder: string) {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const result = await copyAssetFolder(selectedProject.id, directoryPath, targetFolder);
      await applyAssetMutationResult(result);
      setNotice(`已复制文件夹到 ${result.directoryPath ?? targetFolder}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function openLocalAssetPathDirect(relativePath: string, mode: "file" | "directory") {
    if (!selectedProject) return;
    try {
      await openLocalAssetPath(selectedProject.id, relativePath, mode);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteFolder(directoryPath: string) {
    if (!selectedProject) return;
    
    // Step 1: Get folder statistics
    const folderAssets = filterAssetsForDirectory(assets, directoryPath, true);
    const subDirectories = new Set(
      folderAssets
        .map(asset => {
          const relativePath = asset.relativePath.replace(/\\/g, '/');
          const dirPath = directoryPath.replace(/\\/g, '/');
          const pathAfterDir = relativePath.startsWith(dirPath + '/')
            ? relativePath.slice(dirPath.length + 1)
            : relativePath;
          const slashIndex = pathAfterDir.indexOf('/');
          return slashIndex >= 0 ? pathAfterDir.slice(0, slashIndex) : null;
        })
        .filter((dir): dir is string => dir !== null)
    );
    
    // Step 2: Show statistics confirmation
    const statsConfirmed = await requestConfirm({
      title: "确认删除文件夹？",
      body: (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{directoryPath}</p>
          <div className="rounded-lg border border-border-soft bg-surface-panel p-3 space-y-1">
            <p className="text-text-muted">📦 资产数量: <span className="font-semibold text-text-strong">{folderAssets.length}</span></p>
            <p className="text-text-muted">📁 子目录数量: <span className="font-semibold text-text-strong">{subDirectories.size}</span></p>
          </div>
        </div>
      ),
      confirmLabel: "继续",
      danger: true,
    });
    
    if (!statsConfirmed) {
      setNotice("已取消删除文件夹");
      return;
    }
    
    // Step 3: Scan references and get user decision
    const assetPaths = folderAssets.map(asset => asset.relativePath);
    const decision = await requestReferenceMutationDecision({
      projectId: selectedProject.id,
      relativePaths: assetPaths,
      actionLabel: "删除",
      allowUpdateReferences: false,
    });
    
    if (decision === "cancel") {
      setNotice("已取消删除文件夹");
      return;
    }
    
    // Step 4: Execute deletion
    setBusy(true);
    try {
      const result = await deleteAssetFolder(selectedProject.id, directoryPath);
      await applyAssetMutationResult(result);
      setSelection(undefined);
      const referencedCount = result.referenceScan?.reduce((total, item) => total + item.referenceCount, 0) ?? 0;
      setNotice(referencedCount > 0 ? `已删除文件夹；删除前检测到 ${referencedCount} 处引用` : "已删除文件夹");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function requestConfirm({
    title,
    body,
    confirmLabel,
    cancelLabel,
    danger,
  }: Omit<ConfirmConfig, "isOpen" | "onConfirm" | "onCancel">) {
    return new Promise<boolean>((resolve) => {
      const close = (result: boolean) => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        resolve(result);
      };
      setConfirmConfig({
        isOpen: true,
        title,
        body,
        confirmLabel,
        cancelLabel,
        danger,
        onConfirm: () => close(true),
        onCancel: () => close(false),
      });
    });
  }

  function requestConfirmChoice({
    title,
    body,
    confirmLabel,
    secondaryLabel,
    cancelLabel,
    danger,
  }: Omit<ConfirmConfig, "isOpen" | "onConfirm" | "onSecondary" | "onCancel">) {
    return new Promise<ReferenceMutationDecision>((resolve) => {
      const close = (result: ReferenceMutationDecision) => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        resolve(result);
      };
      setConfirmConfig({
        isOpen: true,
        title,
        body,
        confirmLabel,
        secondaryLabel,
        cancelLabel,
        danger,
        onConfirm: () => close("update"),
        onSecondary: () => close("skip"),
        onCancel: () => close("cancel"),
      });
    });
  }

  async function handleScanAssetReferencesNotice(relativePaths: string[]) {
    if (!selectedProject || !relativePaths.length) return;
    const normalizedPaths = [...new Set(relativePaths)].sort();
    const scanKey = `${selectedProject.id}:${normalizedPaths.join("|")}`;
    const activeScan = activeReferenceScanRef.current;
    if (activeScan?.key === scanKey) {
      activeScan.controller.abort();
      activeReferenceScanRef.current = undefined;
      setNotice("已取消引用扫描");
      return;
    }
    activeScan?.controller.abort();
    const controller = new AbortController();
    activeReferenceScanRef.current = { key: scanKey, controller };
    try {
      const results = await scanAssetReferencesWithCache(
        selectedProject.id,
        normalizedPaths,
        "正在扫描引用，再次执行可取消...",
        controller.signal,
      );
      const total = results.reduce((sum, result) => sum + result.referenceCount, 0);
      const title =
        normalizedPaths.length === 1
          ? `引用情况：${normalizedPaths[0]}`
          : `目录引用报告：${normalizedPaths.length} 个资产`;
      setSelection({
        type: "assetReferences",
        title,
        scannedAt: new Date().toLocaleString(),
        results,
      });
      setRightPanelTab("status");
      setInspectorMinimized(false);
      setNotice(total > 0 ? `引用扫描完成：共 ${total} 处引用` : "引用扫描完成：未发现引用");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      if (activeReferenceScanRef.current?.key === scanKey) {
        activeReferenceScanRef.current = undefined;
      }
    }
  }

  async function handleImportAssets(files: File[], targetFolder: string) {
    if (!selectedProject || !files.length) return;
    setBusy(true);
    try {
      const localPaths = files
        .map((file) => (file as File & { localPath?: unknown }).localPath)
        .filter((localPath): localPath is string => typeof localPath === "string" && localPath.length > 0);
      if (localPaths.length === files.length) {
        await importLocalAssetPaths(selectedProject.id, localPaths, targetFolder);
      } else {
        for (const file of files) {
          const dataUrl = await readFileAsDataUrl(file);
          await importAsset(selectedProject.id, file.name, targetFolder, dataUrl);
        }
      }
      const nextAssets = await listAssets(selectedProject.id);
      setAssets(nextAssets);
      await refreshAssetTree(selectedProject.id);
      setNotice(`已导入 ${files.length} 个资源到 ${targetFolder}`);
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
    if (sel?.type === "tool") {
      setRightPanelTab("tools");
    } else if (sel?.type === "task") {
      const hasErrorResult =
        sel.item.rawResultJson?.includes('"isError": true') ||
        sel.item.rawResultJson?.includes('"isError":true');
      setRightPanelTab(
        sel.item.status === "failed" || hasErrorResult ? "errors" : "logs",
      );
    } else {
      setRightPanelTab("status");
    }
    setInspectorMinimized(false);
  }

  async function handleCallTool(
    toolName: string,
    args: Record<string, unknown>,
  ) {
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
      inputSummary: "生成中...",
    };
    setTasks((current) => [tempTask, ...current]);

    try {
      const result = await callTool(selectedProject.id, toolName, args);
      setNotice(`${toolName} 完成，资产索引 ${result.assetsIndexed}`);
      await refreshProject(selectedProject.id);
      if (result.task)
        handleSelectSelection({ type: "task", item: result.task });
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
    setVideoRecoveryCooldowns((current) => ({
      ...current,
      [oldTaskId]: Date.now() + 120_000,
    }));
    setRightPanelTab("errors");
    setInspectorMinimized(false);
    setNotice(`正在查询视频任务 ${oldTaskId}，请不要重复点击`);
    try {
      await callTool(selectedProject.id, "query_video_task", {
        task_id: oldTaskId,
      });
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
    const taskList = await listTasks(selectedProjectId || undefined).catch(
      () => [],
    );
    setTasks(taskList);
  }

  function handleDeleteTask(taskId: string) {
    setTasks((current) => current.filter((t) => t.taskId !== taskId));
  }

  async function handleClearTasks() {
    const taskList = await clearTasks(selectedProjectId || undefined).catch(
      () => [],
    );
    setTasks(taskList);
  }

  function selectModule(module: WorkbenchModule) {
    if (module === "workflow" || module === "studio-canvas") {
      setActiveModule(selectedProject ? "studio-video" : "home");
      setNotice("全能画布暂时隐藏，已切换到视频工作室");
      return;
    }
    if (module === "runs") {
      setRightPanelTab("logs");
      setInspectorMinimized(false);
      setActiveModule(selectedProject ? "assets" : "home");
      setNotice("运行记录已合并到右侧任务日志");
      return;
    }
    if (module === "settings") {
      setLastNonSettingsModule(activeModule === "settings" ? lastNonSettingsModule : activeModule);
      setActiveModule("settings");
      setSelection(undefined);
      return;
    }
    setLastNonSettingsModule(module);
    setActiveModule(module);
  }

  function exitSettings() {
    const fallbackModule = selectedProject ? DEFAULT_PROJECT_MODULE : "home";
    const nextModule = lastNonSettingsModule === "settings" ? fallbackModule : lastNonSettingsModule;
    setActiveModule(nextModule);
  }

  function applyProjectRemoval(projectId: string, nextProjects: ProjectSummary[], nextSelectedProjectId?: string) {
    setProjects(nextProjects);
    if (selectedProjectId === projectId) {
      localStorage.removeItem("taptap.selectedProjectId");
      setSelectedProjectId(nextSelectedProjectId ?? "");
      setTools([]);
      setAssets([]);
      setAssetTree(undefined);
      setTasks([]);
      setRuntime(undefined);
      setStatusText("");
      setSelection(undefined);
      setActiveModule(nextSelectedProjectId ? DEFAULT_PROJECT_MODULE : "home");
      setRightPanelTab("status");
    }
  }

  function handleRemoveProjectRecord(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setConfirmConfig({
      isOpen: true,
      title: "移除项目记录",
      body: (
        <div className="flex flex-col gap-4 mt-1">
          <p className="text-sm text-text-subtle">
            只从本地工作台移除这条记录，不删除项目文件夹。
          </p>
          <div className="flex flex-col gap-3 rounded-xl bg-surface-panel/50 p-4 border border-border-soft">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目名称</span>
              <span className="text-sm font-bold text-text">{project.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-0.5">项目路径</span>
              <span className="text-xs font-mono text-text-subtle truncate" title={project.rootPath}>
                {project.rootPath}
              </span>
            </div>
          </div>
        </div>
      ),
      confirmLabel: "移除记录",
      cancelLabel: "取消",
      onCancel: () => setConfirmConfig((current) => ({ ...current, isOpen: false })),
      onConfirm: async () => {
        setConfirmConfig((current) => ({ ...current, isOpen: false }));
        setBusy(true);
        try {
          const response = await removeProjectRecord(project.id);
          applyProjectRemoval(project.id, response.projects, response.selectedProjectId);
          setNotice(`已移除项目记录：${project.name}`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function handleDeleteProjectLocalFolder(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    setConfirmConfig({
      isOpen: true,
      title: "删除本地项目文件夹",
      body: (
        <div className="flex flex-col gap-4 mt-1">
          <p className="text-sm text-text-subtle">
            将删除下面这个本地文件夹，并同时移除工作台记录。此操作不可撤销。
          </p>
          <div className="flex flex-col gap-3 rounded-xl bg-red-500/5 p-4 border border-red-500/20">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider mb-0.5">项目名称</span>
              <span className="text-sm font-bold text-red-500">{project.name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider mb-0.5">项目路径</span>
              <span className="text-xs font-mono text-red-500/80 truncate" title={project.rootPath}>
                {project.rootPath}
              </span>
            </div>
          </div>
        </div>
      ),
      confirmLabel: "删除本地文件夹",
      cancelLabel: "取消",
      danger: true,
      onCancel: () => setConfirmConfig((current) => ({ ...current, isOpen: false })),
      onConfirm: async () => {
        setConfirmConfig((current) => ({ ...current, isOpen: false }));
        setBusy(true);
        try {
          const response = await deleteProjectLocalFolder(project.id);
          applyProjectRemoval(project.id, response.projects, response.selectedProjectId);
          setNotice(`已删除本地文件夹：${response.deletedPath ?? project.rootPath}`);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        } finally {
          setBusy(false);
        }
      },
    });
  }

  function runWorkflowCanvasCommand(detail: Record<string, unknown>) {
    window.dispatchEvent(
      new CustomEvent("taptap:workflow-command", { detail }),
    );
  }

  function runVideoFlowCommand(detail: Record<string, unknown>) {
    window.dispatchEvent(
      new CustomEvent("taptap:video-flow-command", { detail }),
    );
  }

  const commandContext: AppCommandContext = useMemo(() => {
    if (selection?.type === "asset")
      return { objectType: "asset", relativePath: selection.item.relativePath };
    if (selection?.type === "task")
      return { objectType: "task", taskId: selection.item.taskId };
    if (selection?.type === "tool")
      return { objectType: "mcpTool", toolName: selection.item.name };
    if (selection?.type === "project")
      return { objectType: "project", projectId: selection.item.id };
    if (
      activeModule === "workflow" &&
      canvasCommandContext &&
      (canvasCommandContext.objectType === "workflowSelection" ||
        canvasCommandContext.objectType === "workflowNode" ||
        canvasCommandContext.objectType === "workflowEdge")
    )
      return canvasCommandContext;
    if (
      (activeModule === "studio-video" || activeModule === "studio-canvas") &&
      canvasCommandContext &&
      (canvasCommandContext.objectType === "videoFlowSelection" ||
        canvasCommandContext.objectType === "videoFlowNode" ||
        canvasCommandContext.objectType === "videoFlowEdge")
    )
      return canvasCommandContext;
    if (activeModule === "workflow") return { objectType: "workflowCanvas" };
    if (activeModule === "studio-video" || activeModule === "studio-canvas")
      return { objectType: "videoFlowCanvas" };
    if (selectedProject)
      return { objectType: "project", projectId: selectedProject.id };
    return { objectType: "global" };
  }, [activeModule, canvasCommandContext, selectedProject, selection]);

  const commands = useMemo<Command[]>(
    () => [
      {
        commandId: "app.openCommandPalette",
        title: "打开命令面板",
        icon: <Terminal className="h-4 w-4" />,
        description: "搜索并运行当前可用命令",
        shortcut: { key: "k", ctrlKey: true },
        scope: "global",
        run: () => setCommandPaletteOpen(true),
      },
      {
        commandId: "app.quickSwitchProject",
        title: "快速切换项目",
        icon: <FolderSync className="h-4 w-4" />,
        description: "在命令面板中搜索项目",
        shortcut: { key: "p", ctrlKey: true },
        scope: "global",
        run: () => setCommandPaletteOpen(true),
      },
      {
        commandId: "app.focusPanelSearch",
        title: "当前面板搜索",
        icon: <Search className="h-4 w-4" />,
        description: "聚焦工作台搜索，不打开浏览器搜索",
        shortcut: { key: "f", ctrlKey: true },
        scope: "global",
        run: () => setSearchFocusSignal((value) => value + 1),
      },
      {
        commandId: "app.openSettings",
        title: "打开设置",
        icon: <Settings className="h-4 w-4" />,
        description: "切换到设置模块",
        shortcut: { key: ",", ctrlKey: true },
        scope: "global",
        run: () => selectModule("settings"),
      },
      {
        commandId: "app.toggleTheme",
        title: "切换主题",
        icon: <Moon className="h-4 w-4" />,
        description: theme === "light" ? "切换到深色主题" : "切换到浅色主题",
        scope: "global",
        run: () =>
          setTheme((current) => (current === "light" ? "dark" : "light")),
      },
      {
        commandId: "layout.toggleSidebar",
        title: sidebarCollapsed ? "展开左栏" : "折叠左栏",
        description: "切换项目侧栏显示状态",
        shortcut: { key: "b", ctrlKey: true },
        scope: "global",
        run: () => setSidebarCollapsed((value) => !value),
      },
      {
        commandId: "layout.toggleInspector",
        title: inspectorMinimized ? "展开右栏" : "折叠右栏",
        description: "切换 Inspector 面板显示状态",
        shortcut: { key: "b", ctrlKey: true, shiftKey: true },
        shortcuts: [{ key: "i", ctrlKey: true, shiftKey: true }],
        scope: "global",
        run: () => setInspectorMinimized((value) => !value),
      },
      {
        commandId: "app.refreshCurrent",
        title: "刷新当前数据",
        icon: <RefreshCw className="h-4 w-4" />,
        description: "刷新当前项目数据，不触发浏览器刷新",
        shortcut: { key: "r", ctrlKey: true },
        scope: "global",
        run: () =>
          selectedProject
            ? void refreshProject(selectedProject.id)
            : void handleScanProjects(),
      },
      {
        commandId: "app.copyCurrent",
        title: "复制当前选中内容",
        icon: <Copy className="h-4 w-4" />,
        description: "按当前对象复制路径、错误或 raw result",
        shortcut: { key: "c", ctrlKey: true },
        scope: "global",
        when: () => !!selection,
        run: () => {
          if (selection?.type === "asset") {
            void copyText(selection.item.relativePath, {
              successMessage: "资产路径已复制",
            });
            return;
          }
          if (selection?.type === "task") {
            void copyText(getTaskCopyPayload(selection.item), {
              successMessage: "任务内容已复制",
            });
            return;
          }
          if (selection?.type === "tool") {
            void copyText(selection.item.name, {
              successMessage: "工具名已复制",
            });
            return;
          }
          if (selection?.type === "project")
            void copyText(selection.item.rootPath, {
              successMessage: "项目路径已复制",
            });
        },
      },
      {
        commandId: "app.deleteSelected",
        title: "删除当前选中项",
        icon: <Trash2 className="h-4 w-4" />,
        description: "删除前必须确认",
        shortcut: { key: "Delete" },
        scope: "global",
        danger: true,
        when: () => selection?.type === "asset" || selection?.type === "task",
        run: async () => {
          if (selection?.type === "asset") {
            void handleDeleteAssets([selection.item.relativePath]);
            return;
          }
          if (selection?.type === "task") {
            const confirmed = await requestConfirm({
              title: "确认删除任务记录？",
              body: selection.item.taskId,
              confirmLabel: "删除",
              danger: true,
            });
            if (confirmed) handleDeleteTask(selection.item.taskId);
          }
        },
      },
      {
        commandId: "app.previewSelectedAsset",
        title: "预览当前资产",
        icon: <Eye className="h-4 w-4" />,
        description: "打开资产面板并在 Inspector 查看",
        shortcut: { key: " " },
        scope: "global",
        when: () => selection?.type === "asset",
        run: () => {
          if (selection?.type !== "asset") return;
          selectModule("assets");
          handleSelectSelection(selection);
        },
      },
      {
        commandId: "asset.preview",
        title: "预览资产",
        icon: <Eye className="h-4 w-4" />,
        description: "打开资产面板并在 Inspector 查看",
        shortcut: { key: " " },
        scope: "asset",
        when: (context) =>
          context.objectType === "asset" &&
          assets.some((asset) => asset.relativePath === context.relativePath),
        run: (context) => {
          if (context.objectType !== "asset") return;
          const asset = assets.find(
            (item) => item.relativePath === context.relativePath,
          );
          if (!asset) return;
          selectModule("assets");
          handleSelectSelection({ type: "asset", item: asset });
        },
      },
      {
        commandId: "app.saveCurrentDraft",
        title: "保存当前工作流/草稿",
        icon: <Save className="h-4 w-4" />,
        description:
          activeModule === "workflow"
            ? "保存当前节点流"
            : activeModule === "studio-video" || activeModule === "studio-canvas"
              ? "保存当前视频画布"
            : "当前面板没有可保存草稿",
        shortcut: { key: "s", ctrlKey: true },
        scope: "global",
        run: () => {
          if (activeModule === "workflow") {
            window.dispatchEvent(new CustomEvent("taptap:workflow-save"));
            return;
          }
          if (activeModule === "studio-video" || activeModule === "studio-canvas") {
            window.dispatchEvent(new CustomEvent("taptap:video-flow-save"));
            return;
          }
          setNotice("当前面板没有可保存草稿");
        },
      },
      {
        commandId: "app.executeCurrent",
        title: "执行当前生成/节点",
        icon: <Play className="h-4 w-4" />,
        description:
          activeModule === "workflow"
            ? "运行当前节点流中已配置节点"
            : "当前面板执行入口仍在具体工作室内",
        shortcut: { key: "Enter", ctrlKey: true },
        scope: "global",
        run: () => {
          if (activeModule === "workflow") {
            window.dispatchEvent(new CustomEvent("taptap:workflow-run"));
            return;
          }
          setNotice("当前面板没有可全局执行的动作");
        },
      },
      {
        commandId: "project.copyPath",
        title: "复制项目路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制当前项目根目录",
        scope: "project",
        when: () => !!selectedProject,
        run: () =>
          selectedProject
            ? void copyText(selectedProject.rootPath, {
                successMessage: "项目路径已复制",
              })
            : undefined,
      },
      {
        commandId: "project.copyId",
        title: "复制 project_id",
        icon: <Copy className="h-4 w-4" />,
        description: "复制 Maker project_id",
        scope: "project",
        when: () => !!selectedProject,
        run: () =>
          selectedProject
            ? void copyText(selectedProject.makerProjectId, {
                successMessage: "project_id 已复制",
              })
            : undefined,
      },
      {
        commandId: "developer.openPanel",
        title: "打开开发者面板",
        icon: <Code className="h-4 w-4" />,
        description: "查看当前项目、工具、任务和 runtime 上下文",
        scope: "global",
        run: () => selectModule("agent"),
      },
      {
        commandId: "developer.copyDiagnostics",
        title: "复制诊断摘要",
        icon: <ClipboardList className="h-4 w-4" />,
        description: "复制当前桌面工作台状态摘要",
        scope: "global",
        run: () =>
          void copyText(
            buildDiagnosticSummary({
              selectedProject,
              runtime,
              tools,
              assets,
              tasks,
              activeModule,
            }),
            { successMessage: "诊断摘要已复制" },
          ),
      },
      {
        commandId: "project.scanProjects",
        title: "扫描项目",
        icon: <Scan className="h-4 w-4" />,
        description: "刷新本地 Maker 项目列表",
        scope: "global",
        run: () => void handleScanProjects(),
      },
      {
        commandId: "project.refreshCurrent",
        title: "刷新当前项目数据",
        icon: <RefreshCw className="h-4 w-4" />,
        description: "刷新 runtime、tools、assets 和 tasks",
        scope: "project",
        when: () => !!selectedProject,
        run: () =>
          selectedProject ? void refreshProject(selectedProject.id) : undefined,
      },
      {
        commandId: "asset.scanCurrentProject",
        title: "扫描当前项目资产",
        icon: <Scan className="h-4 w-4" />,
        description: "通过本地 Fastify API 更新资产索引",
        scope: "project",
        when: () => !!selectedProject,
        run: () => void handleScanAssets(),
      },
      {
        commandId: "mcp.refreshTools",
        title: "刷新 MCP 工具",
        icon: <RefreshCw className="h-4 w-4" />,
        description: "通过当前项目 runtime 刷新 tools/list",
        scope: "project",
        when: () => !!selectedProject,
        run: () => void handleRefreshTools(),
      },
      {
        commandId: "mcp.startRuntime",
        title: "启动 MCP runtime",
        icon: <Play className="h-4 w-4" />,
        description: "走本地 Fastify 到项目 MCP Runtime",
        scope: "project",
        when: () => !!selectedProject,
        run: () => void handleStartRuntime(),
      },
      {
        commandId: "asset.revealInInspector",
        title: "在 Inspector 查看资产",
        icon: <PanelRight className="h-4 w-4" />,
        description: "把资产详情打开到右侧面板",
        scope: "asset",
        when: (context) =>
          context.objectType === "asset" &&
          assets.some((asset) => asset.relativePath === context.relativePath),
        run: (context) => {
          if (context.objectType !== "asset") return;
          const asset = assets.find(
            (item) => item.relativePath === context.relativePath,
          );
          if (asset) handleSelectSelection({ type: "asset", item: asset });
        },
      },
      {
        commandId: "asset.copyRelativePath",
        title: "复制资产路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制资产相对路径",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: (context) => {
          if (context.objectType === "asset")
            void copyText(context.relativePath, {
              successMessage: "资产路径已复制",
            });
        },
      },
      {
        commandId: "asset.copyAbsolutePath",
        title: "复制完整路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制本机完整文件路径",
        scope: "asset",
        when: (context) => context.objectType === "asset" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "asset" || !selectedProject) return;
          void copyText(
            buildProjectPath(selectedProject.rootPath, context.relativePath),
            { successMessage: "完整路径已复制" },
          );
        },
      },
      {
        commandId: "asset.openInExplorer",
        title: "在文件资源管理器打开",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "打开本机目录并定位该资产",
        scope: "asset",
        when: (context) => context.objectType === "asset" && !!selectedProject,
        run: async (context) => {
          if (context.objectType !== "asset" || !selectedProject) return;
          try {
            await openLocalAssetPath(selectedProject.id, context.relativePath, "file");
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error));
          }
        },
      },
      {
        commandId: "asset.scanReferences",
        title: "查看引用情况",
        icon: <Search className="h-4 w-4" />,
        description: "通过本地引用扫描检查项目内引用",
        scope: "asset",
        when: (context) => context.objectType === "asset" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "asset") return;
          void handleScanAssetReferencesNotice([context.relativePath]);
        },
      },
      {
        commandId: "asset.rename",
        title: "重命名",
        icon: <Edit2 className="h-4 w-4" />,
        description: "重命名前先做引用扫描确认",
        scope: "asset",
        when: (context) => context.objectType === "asset" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "asset") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "renamePrimary", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
        },
      },
      {
        commandId: "asset.move",
        title: "移动",
        icon: <Move className="h-4 w-4" />,
        description: "移动前先做引用扫描确认",
        scope: "asset",
        when: (context) => context.objectType === "asset" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "asset") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "movePaths", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
        },
      },
      {
        commandId: "asset.cut",
        title: "剪切",
        icon: <Move className="h-4 w-4" />,
        description: "剪切该资产，随后可粘贴到其他目录",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: (context) => {
          if (context.objectType !== "asset") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "selectPaths", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "cutSelection", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
        },
      },
      {
        commandId: "asset.copy",
        title: "复制",
        icon: <Copy className="h-4 w-4" />,
        description: "复制该资产，随后可粘贴到其他目录",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: (context) => {
          if (context.objectType !== "asset") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "selectPaths", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "copySelection", panelId: context.panelId, paths: [context.relativePath] },
            }),
          );
        },
      },
      {
        commandId: "asset.openSourceTask",
        title: "来源任务",
        icon: <ExternalLink className="h-4 w-4" />,
        description: "定位资产来源任务",
        scope: "asset",
        when: (context) =>
          context.objectType === "asset" &&
          assets.some((asset) => asset.relativePath === context.relativePath),
        run: (context) => {
          if (context.objectType !== "asset") return;
          const asset = assets.find(
            (item) => item.relativePath === context.relativePath,
          );
          const provenance = asset?.provenance?.find(
            (source) => source.sourceType === "task",
          );
          const task = provenance
            ? tasks.find((item) => item.taskId === provenance.sourceId)
            : undefined;
          if (task) handleSelectSelection({ type: "task", item: task });
          else setNotice("未找到该资产的来源任务记录");
        },
      },
      {
        commandId: "asset.setVideoFirstFrame",
        title: "设为视频首帧",
        icon: <Image className="h-4 w-4" />,
        description: "该动作需要视频工作室接入后执行",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: () => setNotice("设为视频首帧需要在视频工作室内选择目标节点"),
      },
      {
        commandId: "asset.setVideoLastFrame",
        title: "设为视频尾帧",
        icon: <Image className="h-4 w-4" />,
        description: "该动作需要视频工作室接入后执行",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: () => setNotice("设为视频尾帧需要在视频工作室内选择目标节点"),
      },
      {
        commandId: "asset.setModelReference",
        title: "设为 3D 参考图",
        icon: <Image className="h-4 w-4" />,
        description: "该动作需要 3D 工作室接入后执行",
        scope: "asset",
        when: (context) => context.objectType === "asset",
        run: () => setNotice("设为 3D 参考图需要在 3D 工作室内选择目标流程"),
      },
      {
        commandId: "asset.delete",
        title: "删除资产",
        icon: <Trash2 className="h-4 w-4" />,
        description: "删除前确认，并先做引用扫描",
        scope: "asset",
        danger: true,
        when: (context) => context.objectType === "asset",
        run: (context) => {
          if (context.objectType !== "asset") return;
          void handleDeleteAssets([context.relativePath]);
        },
      },
      {
        commandId: "assetList.createFolderHere",
        title: "新建文件夹",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "在当前资产目录创建文件夹",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection",
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "createFolder", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetList.pasteHere",
        title: "粘贴",
        icon: <Copy className="h-4 w-4" />,
        description: "把剪贴板中的资产或文件夹粘贴到当前目录",
        shortcut: { key: "v", ctrlKey: true },
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection" && !!context.canPaste,
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "pasteHere", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetList.openCurrentDirectory",
        title: "打开当前目录",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "在本地文件资源管理器打开当前资产目录",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "openCurrentDirectory", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetList.copyCurrentDirectoryPath",
        title: "复制当前目录相对路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制当前资产目录相对路径",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection",
        run: (context) => {
          if (context.objectType !== "assetList") return;
          void copyText(context.currentDirectoryPath ?? "assets", {
            successMessage: "目录路径已复制",
          });
        },
      },
      {
        commandId: "assetList.copyCurrentDirectoryAbsolutePath",
        title: "复制当前目录完整路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制当前资产目录本机完整路径",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "assetList" || !selectedProject) return;
          void copyText(
            buildProjectPath(selectedProject.rootPath, context.currentDirectoryPath ?? "assets"),
            { successMessage: "目录完整路径已复制" },
          );
        },
      },
      {
        commandId: "assetList.selectAll",
        title: "全选可见资产",
        icon: <Check className="h-4 w-4" />,
        description: "选中当前资产列表中的可见项",
        shortcut: { key: "a", ctrlKey: true },
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          context.menuMode !== "selection" &&
          (context.visiblePaths.length > 0 || (context.visibleDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "selectPaths", panelId: context.panelId, paths: context.visiblePaths, directoryPaths: context.visibleDirectoryPaths ?? [] },
            }),
          );
        },
      },
      {
        commandId: "assetList.addVisibleToSelection",
        title: "追加选择可见资产",
        icon: <Check className="h-4 w-4" />,
        description: "把当前可见资产加入选择",
        shortcut: { key: "a", ctrlKey: true, shiftKey: true },
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          context.menuMode !== "selection" &&
          (context.visiblePaths.length > 0 || (context.visibleDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          const visible = new Set(context.visiblePaths);
          const visibleDirectories = new Set(context.visibleDirectoryPaths ?? []);
          const next = [
            ...context.selectedPaths.filter((path) => !visible.has(path)),
            ...context.visiblePaths.filter(
              (path) => !context.selectedPaths.includes(path),
            ),
          ];
          const nextDirectories = [
            ...(context.selectedDirectoryPaths ?? []).filter((path) => !visibleDirectories.has(path)),
            ...(context.visibleDirectoryPaths ?? []).filter(
              (path) => !(context.selectedDirectoryPaths ?? []).includes(path),
            ),
          ];
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "selectPaths", panelId: context.panelId, paths: next, directoryPaths: nextDirectories },
            }),
          );
        },
      },
      {
        commandId: "assetList.copyPaths",
        title: "复制选中资产路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制资产列表当前选中路径",
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          context.menuMode !== "selection" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          const paths = [
            ...(context.selectedDirectoryPaths ?? []),
            ...context.selectedPaths,
          ];
          void copyText(paths.join("\n"), {
            successMessage:
              paths.length === 1 ? "路径已复制" : "路径列表已复制",
          });
        },
      },
      {
        commandId: "assetList.importFilesHere",
        title: "导入文件到当前目录",
        icon: <Download className="h-4 w-4" />,
        description: "打开文件选择器并导入到当前资产目录",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection",
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "importFilesHere", panelId: context.panelId },
            }),
          );
          setNotice("正在打开文件选择器...");
        },
      },
      {
        commandId: "assetList.importFolderHere",
        title: "导入文件夹到当前目录",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "打开文件夹选择器并导入到当前资产目录",
        scope: "assetList",
        when: (context) => context.objectType === "assetList" && context.menuMode !== "selection",
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "importFolderHere", panelId: context.panelId },
            }),
          );
          setNotice("正在打开文件夹选择器...");
        },
      },
      {
        commandId: "assetList.cutSelection",
        title: "剪切",
        icon: <Move className="h-4 w-4" />,
        description: "剪切当前选中的资产或文件夹",
        shortcut: { key: "x", ctrlKey: true },
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0 || !!context.primaryPath || !!context.primaryDirectoryPath),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "cutSelection", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetList.copySelection",
        title: "复制",
        icon: <Copy className="h-4 w-4" />,
        description: "复制当前选中的资产或文件夹",
        shortcut: { key: "c", ctrlKey: true },
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0 || !!context.primaryPath || !!context.primaryDirectoryPath),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "copySelection", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetList.copyToDirectory",
        title: "复制到...",
        icon: <Copy className="h-4 w-4" />,
        description: "把选中资产复制到目录",
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "copyPaths", panelId: context.panelId, paths: context.selectedPaths, directoryPaths: context.selectedDirectoryPaths ?? [] },
            }),
          );
        },
      },
      {
        commandId: "assetList.moveToDirectory",
        title: "移动到...",
        icon: <Move className="h-4 w-4" />,
        description: "把选中资产移动到目录",
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "movePaths", panelId: context.panelId, paths: context.selectedPaths, directoryPaths: context.selectedDirectoryPaths ?? [] },
            }),
          );
        },
      },
      {
        commandId: "assetList.previewPrimary",
        title: "预览选中资产",
        icon: <Eye className="h-4 w-4" />,
        description: "预览资产列表中的当前资产",
        shortcut: { key: " " },
        scope: "assetList",
        when: (context) =>
          context.objectType === "assetList" && !!context.primaryPath,
        run: (context) => {
          if (context.objectType !== "assetList" || !context.primaryPath) return;
          const asset = assets.find(
            (item) => item.relativePath === context.primaryPath,
          );
          if (asset) handleSelectSelection({ type: "asset", item: asset });
        },
      },
      {
        commandId: "assetList.deleteSelected",
        title: "删除选中资产",
        icon: <Trash2 className="h-4 w-4" />,
        description: "删除资产列表当前选中资产",
        shortcut: { key: "Delete" },
        scope: "assetList",
        danger: true,
        when: (context) =>
          context.objectType === "assetList" &&
          (context.selectedPaths.length > 0 || (context.selectedDirectoryPaths?.length ?? 0) > 0),
        run: (context) => {
          if (context.objectType !== "assetList") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-list-command", {
              detail: { action: "deleteSelected", panelId: context.panelId },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.open",
        title: "打开目录",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "切换资产中心当前目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "open", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.copyPath",
        title: "复制目录路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制资产目录相对路径",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          void copyText(context.directoryPath, {
            successMessage: "目录路径已复制",
          });
        },
      },
      {
        commandId: "assetDirectory.copyAbsolutePath",
        title: "复制完整路径",
        icon: <Copy className="h-4 w-4" />,
        description: "复制本机完整目录路径",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "assetDirectory" || !selectedProject) return;
          void copyText(
            buildProjectPath(selectedProject.rootPath, context.directoryPath),
            { successMessage: "目录完整路径已复制" },
          );
        },
      },
      {
        commandId: "assetDirectory.openInExplorer",
        title: "在文件资源管理器打开",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "打开本机目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && !!selectedProject,
        run: async (context) => {
          if (context.objectType !== "assetDirectory" || !selectedProject) return;
          try {
            await openLocalAssetPath(selectedProject.id, context.directoryPath, "directory");
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error));
          }
        },
      },
      {
        commandId: "assetDirectory.importFilesHere",
        title: "导入文件到此目录",
        icon: <Download className="h-4 w-4" />,
        description: "打开文件选择器并导入到该目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "importFilesHere", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
          setNotice("正在打开文件选择器...");
        },
      },
      {
        commandId: "assetDirectory.createFolder",
        title: "新建子文件夹",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "在该目录下创建文件夹",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && !!selectedProject,
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          void handleCreateFolder(context.directoryPath);
        },
      },
      {
        commandId: "assetDirectory.importFolderHere",
        title: "导入文件夹到此目录",
        icon: <FolderOpen className="h-4 w-4" />,
        description: "打开文件夹选择器并导入到该目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "importFolderHere", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
          setNotice("正在打开文件夹选择器...");
        },
      },
      {
        commandId: "assetDirectory.pasteHere",
        title: "粘贴到此处",
        icon: <Copy className="h-4 w-4" />,
        description: "把剪贴板中的资产或文件夹粘贴到该目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "pasteHere", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.refresh",
        title: "刷新资产索引",
        icon: <RefreshCw className="h-4 w-4" />,
        description: "重新扫描当前项目资产",
        scope: "assetDirectory",
        when: () => !!selectedProject,
        run: () => void handleScanAssets(),
      },
      {
        commandId: "assetDirectory.rename",
        title: "重命名文件夹",
        icon: <Edit2 className="h-4 w-4" />,
        description: "重命名整个文件夹，并可同步更新引用",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "rename", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.cut",
        title: "剪切",
        icon: <Move className="h-4 w-4" />,
        description: "剪切整个文件夹，随后可粘贴到其他目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "cutDirectory", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.copy",
        title: "复制",
        icon: <Copy className="h-4 w-4" />,
        description: "复制整个文件夹，随后可粘贴到其他目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "copyDirectory", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.move",
        title: "移动文件夹",
        icon: <Move className="h-4 w-4" />,
        description: "移动整个文件夹，并可同步更新引用",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "move", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.copyFolder",
        title: "复制文件夹",
        icon: <Copy className="h-4 w-4" />,
        description: "复制整个文件夹到目标目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "copyFolder", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.scanReferences",
        title: "查看目录引用",
        icon: <Search className="h-4 w-4" />,
        description: "扫描该目录下资产的项目引用",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "scanReferences", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "assetDirectory.delete",
        title: "删除文件夹",
        icon: <Trash2 className="h-4 w-4" />,
        description: "删除整个文件夹树",
        scope: "assetDirectory",
        danger: true,
        when: (context) => context.objectType === "assetDirectory" && context.directoryPath !== "assets",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: { action: "delete", panelId: context.panelId, directoryPath: context.directoryPath },
            }),
          );
        },
      },
      {
        commandId: "task.revealInInspector",
        title: "在 Inspector 查看任务",
        icon: <PanelRight className="h-4 w-4" />,
        description: "打开任务日志或错误详情",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          if (task) handleSelectSelection({ type: "task", item: task });
        },
      },
      {
        commandId: "task.deleteRecord",
        title: "删除任务记录",
        icon: <Trash2 className="h-4 w-4" />,
        description: "从当前前端列表移除这条任务记录",
        scope: "task",
        danger: true,
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: async (context) => {
          if (context.objectType !== "task") return;
          const confirmed = await requestConfirm({
            title: "确认删除任务记录？",
            body: (
              <div className="flex flex-col gap-4 mt-1">
                <p className="text-sm text-text-subtle">
                  从当前前端列表移除这条任务记录。
                </p>
                <div className="flex flex-col gap-3 rounded-xl bg-red-500/5 p-4 border border-red-500/20">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider mb-0.5">任务 ID</span>
                    <span className="text-xs font-mono text-red-500/80 truncate">{context.taskId}</span>
                  </div>
                </div>
              </div>
            ),
            confirmLabel: "删除",
            danger: true,
          });
          if (confirmed) handleDeleteTask(context.taskId);
        },
      },
      {
        commandId: "task.copyRaw",
        title: "复制任务 raw/error",
        icon: <Copy className="h-4 w-4" />,
        description: "复制完整 raw result 或错误内容",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          if (task)
            void copyText(getTaskCopyPayload(task), {
              successMessage: "任务 raw/error 已复制",
            });
        },
      },
      {
        commandId: "task.copySummary",
        title: "复制摘要",
        icon: <Copy className="h-4 w-4" />,
        description: "复制任务名称与输入摘要",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          if (!task) return;
          void copyText(`${task.toolName}\n${task.inputSummary}`, {
            successMessage: "任务摘要已复制",
          });
        },
      },
      {
        commandId: "task.retry",
        title: "重试",
        icon: <Play className="h-4 w-4" />,
        description: "使用原始 inputJson 重新调用工具",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          if (!task) return;
          try {
            const args = JSON.parse(task.inputJson) as Record<string, unknown>;
            void handleCallTool(task.toolName, args);
          } catch {
            setNotice("任务 inputJson 不是可重试的 JSON 对象");
          }
        },
      },
      {
        commandId: "task.locateTool",
        title: "定位相关工具",
        icon: <Crosshair className="h-4 w-4" />,
        description: "在 Inspector 中打开任务对应工具",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          const tool = task
            ? tools.find((item) => item.name === task.toolName)
            : undefined;
          if (tool) handleSelectSelection({ type: "tool", item: tool });
          else setNotice("未找到该任务对应的 MCP 工具");
        },
      },
      {
        commandId: "task.locateAssets",
        title: "定位相关资产",
        icon: <Crosshair className="h-4 w-4" />,
        description: "根据 raw result 中的文件名定位资产",
        scope: "task",
        when: (context) =>
          context.objectType === "task" &&
          tasks.some((task) => task.taskId === context.taskId),
        run: (context) => {
          if (context.objectType !== "task") return;
          const task = tasks.find((item) => item.taskId === context.taskId);
          const asset = task
            ? assets.find((item) => task.rawResultJson?.includes(item.fileName))
            : undefined;
          if (asset) handleSelectSelection({ type: "asset", item: asset });
          else setNotice("未在任务 raw result 中定位到资产");
        },
      },
      {
        commandId: "task.markHandled",
        title: "标记已处理",
        icon: <Check className="h-4 w-4" />,
        description: "当前仅隐藏选中状态，不删除记录",
        scope: "task",
        when: (context) => context.objectType === "task",
        run: () => {
          setSelection(undefined);
          setNotice("已从当前选择中移除该任务");
        },
      },
      {
        commandId: "mcpTool.revealInInspector",
        title: "查看 MCP 工具",
        icon: <PanelRight className="h-4 w-4" />,
        description: "打开工具 Schema 与描述",
        scope: "mcpTool",
        when: (context) =>
          context.objectType === "mcpTool" &&
          tools.some((tool) => tool.name === context.toolName),
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          const tool = tools.find((item) => item.name === context.toolName);
          if (tool) handleSelectSelection({ type: "tool", item: tool });
        },
      },
      {
        commandId: "mcpTool.copyName",
        title: "复制工具名",
        icon: <Copy className="h-4 w-4" />,
        description: "复制 MCP 工具 name",
        scope: "mcpTool",
        when: (context) => context.objectType === "mcpTool",
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          void copyText(context.toolName, { successMessage: "工具名已复制" });
        },
      },
      {
        commandId: "mcpTool.copySchema",
        title: "复制 schema",
        description: "复制 MCP 工具 inputSchema",
        scope: "mcpTool",
        when: (context) =>
          context.objectType === "mcpTool" &&
          tools.some((tool) => tool.name === context.toolName),
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          const tool = tools.find((item) => item.name === context.toolName);
          if (!tool) return;
          void copyText(JSON.stringify(tool.inputSchema, null, 2), {
            successMessage: "工具 schema 已复制",
          });
        },
      },
      {
        commandId: "mcpTool.execute",
        title: "执行工具",
        description: "打开工具面板执行当前 MCP 工具",
        scope: "mcpTool",
        when: (context) =>
          context.objectType === "mcpTool" &&
          tools.some((tool) => tool.name === context.toolName),
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          const tool = tools.find((item) => item.name === context.toolName);
          if (!tool) return;
          handleSelectSelection({ type: "tool", item: tool });
          selectModule("agent");
        },
      },
      {
        commandId: "mcpTool.addToWorkflow",
        title: "加入节点流",
        description: "遗留节点流入口，当前产品不展示",
        scope: "mcpTool",
        menu: { hiddenInContextMenu: true },
        when: () => false,
        run: () => {
          setNotice("节点流页面已隐藏，当前不再作为产品入口");
        },
      },
      {
        commandId: "mcpTool.showHistory",
        title: "调用历史",
        description: "打开该工具相关任务记录",
        scope: "mcpTool",
        when: (context) => context.objectType === "mcpTool",
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          const task = tasks.find((item) => item.toolName === context.toolName);
          if (task) handleSelectSelection({ type: "task", item: task });
          else setNotice("未找到该工具的调用历史");
        },
      },
      {
        commandId: "mcpTool.copyRawResult",
        title: "复制最近 raw result",
        description: "复制该工具最近一次任务 raw result",
        scope: "mcpTool",
        when: (context) => context.objectType === "mcpTool",
        run: (context) => {
          if (context.objectType !== "mcpTool") return;
          const task = tasks.find((item) => item.toolName === context.toolName);
          if (task)
            void copyText(getTaskCopyPayload(task), {
              successMessage: "最近 raw result 已复制",
            });
          else setNotice("未找到该工具的 raw result");
        },
      },
      {
        commandId: "workflow.openCanvas",
        title: "打开节点流",
        description: "遗留节点流入口，当前产品不展示",
        scope: ["workflowCanvas", "videoFlowCanvas"],
        menu: { hiddenInContextMenu: true },
        when: () => false,
        run: () => {
          setNotice("节点流页面已隐藏，当前不再作为产品入口");
        },
      },
      {
        commandId: "canvas.fitView",
        title: "适应画布",
        description: "将当前节点流缩放到可见范围",
        scope: ["workflowCanvas", "videoFlowCanvas"],
        category: "节点流",
        submenu: "画布",
        order: 10,
        when: (context) =>
          context.objectType === "workflowCanvas" ||
          context.objectType === "videoFlowCanvas",
        run: (context) => {
          if (context.objectType === "workflowCanvas") {
            runWorkflowCanvasCommand({ action: "fitView" });
            return;
          }
          runVideoFlowCommand({ action: "fitView" });
        },
      },
      {
        commandId: "canvas.toggleGrid",
        title: "切换网格",
        description: "切换当前画布网格显示或吸附状态",
        scope: ["workflowCanvas", "videoFlowCanvas"],
        category: "节点流",
        submenu: "画布",
        order: 20,
        when: (context) =>
          context.objectType === "workflowCanvas" ||
          context.objectType === "videoFlowCanvas",
        run: (context) => {
          if (context.objectType === "workflowCanvas") {
            setNotice("普通节点流当前没有网格切换");
            return;
          }
          runVideoFlowCommand({ action: "toggleGrid" });
        },
      },
      {
        commandId: "canvas.selectAll",
        title: "全选画布元素",
        description: "选择当前画布内的节点和连线",
        shortcut: { key: "a", ctrlKey: true },
        scope: ["workflowCanvas", "workflowSelection", "videoFlowCanvas", "videoFlowSelection"],
        category: "节点流",
        submenu: "画布",
        order: 30,
        when: (context) =>
          context.objectType === "workflowCanvas" ||
          context.objectType === "workflowSelection" ||
          context.objectType === "videoFlowSelection" ||
          context.objectType === "videoFlowCanvas",
        run: (context) => {
          if (
            context.objectType === "workflowCanvas" ||
            context.objectType === "workflowSelection"
          ) {
            runWorkflowCanvasCommand({ action: "selectAll" });
            return;
          }
          runVideoFlowCommand({ action: "selectAll" });
        },
      },
      {
        commandId: "canvas.clear",
        title: "清空画布",
        description: "清空当前画布内的节点和连线",
        scope: ["workflowCanvas", "videoFlowCanvas"],
        category: "节点流",
        submenu: "画布",
        order: 40,
        danger: true,
        when: (context) =>
          context.objectType === "workflowCanvas" ||
          context.objectType === "videoFlowCanvas",
        run: (context) => {
          if (context.objectType === "workflowCanvas") {
            runWorkflowCanvasCommand({ action: "clear" });
            return;
          }
          runVideoFlowCommand({ action: "clear" });
        },
      },
      {
        commandId: "videoFlow.openCanvas",
        title: "打开视频画布",
        description: "切换到视频工作室画布",
        scope: "global",
        category: "视频画布",
        submenu: "画布",
        order: 5,
        run: () => selectModule("studio-video"),
      },
      {
        commandId: "node.copyId",
        title: "复制节点 ID",
        description: "复制当前节点 ID",
        scope: ["workflowNode", "videoFlowNode"],
        category: "节点流",
        submenu: "节点",
        order: 10,
        when: (context) =>
          context.objectType === "workflowNode" ||
          context.objectType === "videoFlowNode",
        run: (context) => {
          if (
            context.objectType === "workflowNode" ||
            context.objectType === "videoFlowNode"
          )
            void copyText(context.nodeId, { successMessage: "节点 ID 已复制" });
        },
      },
      {
        commandId: "node.copy",
        title: "复制节点",
        description: "复制当前节点",
        shortcut: { key: "c", ctrlKey: true },
        scope: ["workflowNode", "workflowSelection", "videoFlowNode", "videoFlowSelection"],
        category: "节点流",
        submenu: "节点",
        order: 20,
        when: (context) =>
          context.objectType === "workflowNode" ||
          context.objectType === "workflowSelection" ||
          context.objectType === "videoFlowNode" ||
          context.objectType === "videoFlowSelection",
        run: (context) => {
          if (context.objectType === "workflowNode") {
            runWorkflowCanvasCommand({
              action: "copyNode",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "videoFlowNode") {
            runVideoFlowCommand({
              action: "copyNode",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "workflowSelection") {
            runWorkflowCanvasCommand({ action: "copyNode" });
            return;
          }
          if (context.objectType === "videoFlowSelection") {
            runVideoFlowCommand({ action: "copyNode" });
            return;
          }
        },
      },
      {
        commandId: "node.delete",
        title: "删除节点",
        description: "删除当前节点",
        shortcut: { key: "Delete" },
        scope: ["workflowNode", "workflowSelection", "videoFlowNode", "videoFlowSelection"],
        category: "节点流",
        submenu: "节点",
        order: 30,
        danger: true,
        when: (context) =>
          context.objectType === "workflowNode" ||
          (context.objectType === "workflowSelection" &&
            context.nodeIds.length > 0) ||
          context.objectType === "videoFlowNode" ||
          (context.objectType === "videoFlowSelection" &&
            context.nodeIds.length > 0),
        run: (context) => {
          if (context.objectType === "workflowNode") {
            runWorkflowCanvasCommand({
              action: "deleteNode",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "videoFlowNode") {
            runVideoFlowCommand({
              action: "deleteNode",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "workflowSelection") {
            runWorkflowCanvasCommand({ action: "deleteNode" });
            return;
          }
          if (context.objectType === "videoFlowSelection") {
            runVideoFlowCommand({ action: "deleteNode" });
            return;
          }
        },
      },
      {
        commandId: "node.collapseToggle",
        title: "折叠/展开节点",
        description: "切换当前节点折叠状态",
        scope: ["workflowNode", "videoFlowNode"],
        category: "节点流",
        submenu: "节点",
        order: 40,
        when: (context) =>
          context.objectType === "workflowNode" ||
          context.objectType === "videoFlowNode",
        run: (context) => {
          if (context.objectType === "workflowNode") {
            runWorkflowCanvasCommand({
              action: "toggleNodeCollapse",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "videoFlowNode") {
            runVideoFlowCommand({
              action: "toggleNodeCollapse",
              nodeId: context.nodeId,
            });
            return;
          }
        },
      },
      {
        commandId: "node.run",
        title: "运行节点",
        description: "运行当前节点",
        shortcut: { key: "Enter", ctrlKey: true },
        scope: ["workflowNode", "videoFlowNode"],
        category: "节点流",
        submenu: "节点",
        order: 50,
        when: (context) =>
          context.objectType === "workflowNode" ||
          context.objectType === "videoFlowNode",
        run: (context) => {
          if (context.objectType === "workflowNode") {
            runWorkflowCanvasCommand({
              action: "runNode",
              nodeId: context.nodeId,
            });
            return;
          }
          if (context.objectType === "videoFlowNode") {
            runVideoFlowCommand({
              action: "runNode",
              nodeId: context.nodeId,
            });
            return;
          }
        },
      },
      {
        commandId: "edge.delete",
        title: "删除连线",
        description: "删除当前连线",
        shortcut: { key: "Delete" },
        scope: ["workflowEdge", "workflowSelection", "videoFlowEdge", "videoFlowSelection"],
        category: "节点流",
        submenu: "连线",
        order: 10,
        danger: true,
        when: (context) =>
          context.objectType === "workflowEdge" ||
          (context.objectType === "workflowSelection" &&
            context.edgeIds.length > 0) ||
          context.objectType === "videoFlowEdge" ||
          (context.objectType === "videoFlowSelection" &&
            context.edgeIds.length > 0),
        run: (context) => {
          if (context.objectType === "workflowEdge") {
            runWorkflowCanvasCommand({
              action: "deleteEdge",
              edgeId: context.edgeId,
            });
            return;
          }
          if (context.objectType === "videoFlowEdge") {
            runVideoFlowCommand({
              action: "deleteEdge",
              edgeId: context.edgeId,
            });
            return;
          }
          if (context.objectType === "workflowSelection") {
            runWorkflowCanvasCommand({
              action: "deleteEdge",
              edgeId: context.edgeIds[0],
            });
            return;
          }
          if (context.objectType === "videoFlowSelection") {
            runVideoFlowCommand({
              action: "deleteEdge",
              edgeId: context.edgeIds[0],
            });
            return;
          }
        },
      },
      {
        commandId: "edge.copyId",
        title: "复制连线 ID",
        description: "复制当前连线 ID",
        scope: ["workflowEdge", "videoFlowEdge"],
        category: "节点流",
        submenu: "连线",
        order: 20,
        when: (context) =>
          context.objectType === "workflowEdge" ||
          context.objectType === "videoFlowEdge",
        run: (context) => {
          if (
            context.objectType === "workflowEdge" ||
            context.objectType === "videoFlowEdge"
          )
            void copyText(context.edgeId, { successMessage: "连线 ID 已复制" });
        },
      },
      {
        commandId: "edge.inspectData",
        title: "检查连线数据",
        description: "查看当前连线携带的数据",
        scope: ["workflowEdge", "videoFlowEdge"],
        category: "节点流",
        submenu: "连线",
        order: 30,
        when: (context) =>
          context.objectType === "workflowEdge" ||
          context.objectType === "videoFlowEdge",
        run: (context) => {
          if (context.objectType === "workflowEdge") {
            runWorkflowCanvasCommand({
              action: "showEdgePayload",
              edgeId: context.edgeId,
            });
            return;
          }
          if (context.objectType === "videoFlowEdge") {
            runVideoFlowCommand({
              action: "showEdgePayload",
              edgeId: context.edgeId,
            });
            return;
          }
        },
      },
    ],
    [
      activeModule,
      assets,
      inspectorMinimized,
      runtime,
      selectedProject,
      selection,
      sidebarCollapsed,
      tasks,
      theme,
      tools,
    ],
  );

  const commandRegistry = useMemo(
    () => createCommandRegistry(commands),
    [commands],
  );
  const lastCommandRunRef = useRef<{ commandId: string; at: number } | null>(null);

  function beginInspectorResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        420,
        Math.max(240, startWidth - (moveEvent.clientX - startX)),
      );
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
      setSidebarWidth(
        Math.min(360, Math.max(220, startWidth + (moveEvent.clientX - startX))),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    const onCommandRun = (event: Event) => {
      const detail = (event as CustomEvent<CommandRunRequest>).detail;
      if (!detail?.commandId) return;
      event.preventDefault();
      const now = Date.now();
      const lastRun = lastCommandRunRef.current;
      if (lastRun?.commandId === detail.commandId && now - lastRun.at < 120) return;
      lastCommandRunRef.current = { commandId: detail.commandId, at: now };
      console.debug("[AppShell] command-run", detail.commandId, detail.context ?? commandContext);
      void commandRegistry.run(
        detail.commandId,
        detail.context ?? commandContext,
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      for (const command of commandRegistry.list(commandContext)) {
        if (
          !commandShortcuts(command.shortcut, command.shortcuts).some(
            (shortcut) => matchesShortcut(event, shortcut),
          )
        )
          continue;
        event.preventDefault();
        void commandRegistry.run(command.commandId, commandContext);
        return;
      }
    };
    window.addEventListener(COMMAND_RUN_EVENT, onCommandRun);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(COMMAND_RUN_EVENT, onCommandRun);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [commandContext, commandRegistry]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>("taptap://native-menu", (event) => {
          if (!event.payload) return;
          void commandRegistry.run(event.payload, commandContext);
        }),
      )
      .then((handler) => {
        unlisten = handler;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, [commandContext, commandRegistry]);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      closeAllContextMenus();
      if (isLocalContextMenuTarget(event.target)) {
        setFallbackMenu(undefined);
        setEditableMenu(undefined);
        return;
      }
      if (shouldUseNativeContextMenu(event.target)) {
        setFallbackMenu(undefined);
        setEditableMenu(undefined);
        return;
      }
      const editableTarget = getEditableMenuTarget(event.target);
      if (editableTarget) {
        event.preventDefault();
        notifyContextMenuOpen("editable");
        setFallbackMenu(undefined);
        setEditableMenu({
          ...clampContextMenuPosition(
            { x: event.clientX, y: event.clientY },
            { width: 190, height: 160 },
          ),
          target: editableTarget,
        });
        return;
      }
      event.preventDefault();
      notifyContextMenuOpen("app");
      setEditableMenu(undefined);
      setFallbackMenu(
        clampContextMenuPosition(
          { x: event.clientX, y: event.clientY },
          { width: 220, height: 56 },
        ),
      );
    };
    const onCloseContextMenus = () => {
      setFallbackMenu(undefined);
      setEditableMenu(undefined);
    };
    const onOtherContextMenuOpen = (event: Event) => {
      if (shouldIgnoreContextMenuEvent(event, "app")) return;
      if (shouldIgnoreContextMenuEvent(event, "editable")) return;
      setFallbackMenu(undefined);
      setEditableMenu(undefined);
    };
    const stopNavigationDrop = (event: DragEvent) => {
      if (!event.dataTransfer) return;
      if (isWorkbenchDrag(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
    };
    const stopBrowserShortcuts = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (
        key === "f12" ||
        key === "f5" ||
        ((event.ctrlKey || event.metaKey) &&
          (key === "f" ||
            key === "o" ||
            key === "p" ||
            key === "r" ||
            key === "s" ||
            key === "u")) ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          (key === "c" || key === "i" || key === "j"))
      ) {
        event.preventDefault();
      }
    };
    document.addEventListener("contextmenu", onContextMenu, { capture: true });
    window.addEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
    window.addEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
    window.addEventListener("dragenter", stopNavigationDrop, { capture: true });
    window.addEventListener("dragover", stopNavigationDrop, { capture: true });
    window.addEventListener("dragend", clearAssetDragData, { capture: true });
    window.addEventListener("drop", stopNavigationDrop, { capture: true });
    window.addEventListener("keydown", stopBrowserShortcuts, { capture: true });
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, {
        capture: true,
      });
      window.removeEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
      window.removeEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
      window.removeEventListener("dragenter", stopNavigationDrop, {
        capture: true,
      });
      window.removeEventListener("dragover", stopNavigationDrop, {
        capture: true,
      });
      window.removeEventListener("dragend", clearAssetDragData, {
        capture: true,
      });
      window.removeEventListener("drop", stopNavigationDrop, { capture: true });
      window.removeEventListener("keydown", stopBrowserShortcuts, {
        capture: true,
      });
    };
  }, []);

  async function beginDesktopWindowResize(
    event: React.PointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      if ((await appWindow.isMaximized()) || (await appWindow.isFullscreen()))
        return;
      await appWindow.startResizeDragging(toTauriResizeDirection(edge));
    } catch {
      // Browser preview has no desktop shell to resize.
    }
  }

  const runtimeView = runtime ?? selectedProject?.runtime;
  const agentPage: AgentPageState = useMemo(
    () => ({
      activeTab: rightPanelTab,
      selection: toAgentSelectionReference(selection),
    }),
    [rightPanelTab, selection],
  );
  const fallbackContext: AppCommandContext = { objectType: "global" };
  const fallbackMenuItems: MenuItem[] = getContextMenuCommands(
    commandRegistry.list(fallbackContext),
  )
    .filter((command) => command.commandId === "app.refreshCurrent")
    .map((command) => ({ type: "command", command }));

  function renderFallbackMenuItem(item: MenuItem): React.ReactNode {
    if (item.type === "separator")
      return <div key={item.id} className={ContextMenuStyles.separator} />;
    if (item.type === "submenu") {
      return (
        <div key={item.id} className="py-1">
          <div className={ContextMenuStyles.label}>
            {item.title}
          </div>
          {item.items.map(renderFallbackMenuItem)}
        </div>
      );
    }
    const command = item.command;
    return (
      <button
        key={command.commandId}
        type="button"
        className={[
          ContextMenuStyles.item,
          command.danger ? "text-red-500 hover:bg-red-500/10 hover:text-red-400" : "",
        ].join(" ")}
        onClick={() => {
          setFallbackMenu(undefined);
          closeAllContextMenus();
          void commandRegistry.run(command.commandId, fallbackContext);
        }}
      >
        {command.icon && <span className="shrink-0 text-text-muted flex items-center">{command.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{command.title}</span>
      </button>
    );
  }

  return (
    <CommandProvider registry={commandRegistry}>
      <ThemeCinemaOverlay 
         active={cinemaThemeState.active} 
         toTheme={cinemaThemeState.toTheme} 
         onMidpoint={(newTheme) => {
           document.documentElement.dataset.theme = newTheme;
           setTheme(newTheme);
         }}
         onComplete={() => setCinemaThemeState(prev => ({ ...prev, active: false }))}
      />
      <div
        className="w-full h-full flex flex-col app-background overflow-hidden text-text rounded-[10px] border border-border-soft shadow-panel"
        onClick={() => {
          setFallbackMenu(undefined);
          setEditableMenu(undefined);
        }}
      >
        <DesktopWindowResizeHandles onResizeStart={beginDesktopWindowResize} />

        <TopBar
          project={selectedProject}
          runtime={runtimeView}
          notice={notice}
          toolCount={tools.length}
          theme={theme}
          projects={projects}
          tools={tools}
          assets={assets}
          tasks={tasks}
          onThemeToggle={() => {
            const nextTheme = theme === "light" ? "dark" : "light";
            setCinemaThemeState({ active: true, toTheme: nextTheme });
          }}
          onOpenSettings={() => selectModule("settings")}
          onSelectProject={handleSelectProject}
          onOpenModule={selectModule}
          onOpenLogs={() => {
            setRightPanelTab("logs");
            setInspectorMinimized(false);
          }}
          onOpenTools={() => {
            setRightPanelTab("tools");
            setInspectorMinimized(false);
          }}
          onSelect={handleSelectSelection}
          appMenu={<AppMenuBar context={commandContext} />}
          searchFocusSignal={searchFocusSignal}
          onStartRuntime={handleStartRuntime}
          onStopRuntime={handleStopRuntime}
        />

        <div
          className="flex-1 min-h-0 flex overflow-hidden transition-all duration-300"
          style={
            {
              "--inspector-width": inspectorMinimized
                ? "48px"
                : `${inspectorWidth}px`,
            } as React.CSSProperties
          }
        >
          <div
            className="relative shrink-0 h-full"
            style={{ width: sidebarCollapsed ? 56 : sidebarWidth }}
          >
            <ProjectSidebar
              projects={projects}
              selectedProjectId={selectedProjectId}
              activeModule={activeModule}
              activeSettingsTab={activeSettingsTab}
              tasks={tasks}
              collapsed={sidebarCollapsed}
              width={sidebarWidth}
              onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
              onClearProject={handleClearProject}
              onSelectModule={selectModule}
              onSelectSettingsTab={setActiveSettingsTab}
              onExitSettings={exitSettings}
              onScanProjects={handleScanProjects}
            />
            {!sidebarCollapsed && (
              <div
                className="absolute -right-[5px] top-0 bottom-0 w-[10px] z-10 cursor-col-resize hover:bg-brand/20 transition-colors"
                role="separator"
                aria-label="调整项目侧栏宽度"
                onPointerDown={beginSidebarResize}
              />
            )}
          </div>

          <div
            className={[
              "flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden",
              "app-background",
            ].join(" ")}
            data-workbench-fallback-menu-zone
          >
            <WorkbenchViewport
              activeModule={activeModule}
              project={
                selectedProject
                  ? { ...selectedProject, runtime: runtimeView }
                  : undefined
              }
              projects={projects}
              runtime={runtimeView}
              tools={tools}
              assets={assets}
              assetTree={assetTree}
              tasks={tasks}
              statusText={statusText}
              busy={busy}
              onStartRuntime={handleStartRuntime}
              onStopRuntime={handleStopRuntime}
              onRefreshTools={handleRefreshTools}
              onScanAssets={handleScanAssets}
              onRemoveProjectRecord={handleRemoveProjectRecord}
              onDeleteProjectLocalFolder={handleDeleteProjectLocalFolder}
              onDeleteAssets={handleDeleteAssets}
              onMoveAssets={handleMoveAssets}
              onCopyAssets={handleCopyAssets}
              onRenameAsset={handleRenameAsset}
              onRenameDirectory={renameFolderDirect}
              onMoveDirectory={moveFolderDirect}
              onCopyDirectory={copyFolderDirect}
              onDeleteDirectory={handleDeleteFolder}
              onOpenLocalAssetPath={openLocalAssetPathDirect}
              onImportAssets={handleImportAssets}
              onCreateFolder={handleCreateFolder}
              onConfirmReferenceMutation={handleConfirmAssetReferenceMutation}
              onAssetMutationResult={handleAssetMutationResult}
              onScanAssetReferences={handleScanAssetReferencesNotice}
              onRefreshProject={refreshCurrentProject}
              onNotice={setNotice}
              onCallStatusLite={handleStatusLite}
              onCallTool={handleCallTool}
              onSelect={handleSelectSelection}
              agentPage={agentPage}
              onSelectProject={handleSelectProject}
              onScanProjects={handleScanProjects}
              onOpenModule={selectModule}
              activeSettingsTab={activeSettingsTab}
              sidebarCollapsed={sidebarCollapsed}
              onActiveSettingsTabChange={setActiveSettingsTab}
              onExitSettings={exitSettings}
              onCollapseSidebar={() => {
                setSidebarCollapsed(true);
                setInspectorMinimized(true);
              }}
              onShowError={() => setInspectorMinimized(false)}
              onCanvasCommandContextChange={setCanvasCommandContext}
            />
          </div>

          <div
            className="relative shrink-0 flex h-full border-l border-border bg-surface-panel"
            style={{
              width: "var(--inspector-width)",
              transition: "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {!inspectorMinimized && (
              <div
                className="absolute -left-[5px] top-0 bottom-0 w-[10px] z-10 cursor-col-resize hover:bg-brand/20 transition-colors"
                role="separator"
                aria-label="调整 Inspector 面板宽度"
                onPointerDown={beginInspectorResize}
              />
            )}
            <AgentInspectorPanel
              project={
                selectedProject
                  ? { ...selectedProject, runtime: runtimeView }
                  : undefined
              }
              tools={tools}
              tasks={tasks}
              selection={selection}
              busy={busy}
              notice={notice}
              minimized={inspectorMinimized}
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
              onToggleMinimized={() =>
                setInspectorMinimized(!inspectorMinimized)
              }
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
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
          context={commandContext}
          projects={projects}
          tools={tools}
          assets={assets}
          tasks={tasks}
          onSelectProject={handleSelectProject}
          onOpenModule={selectModule}
          onOpenLogs={() => {
            setRightPanelTab("logs");
            setInspectorMinimized(false);
          }}
          onSelect={handleSelectSelection}
        />
        {fallbackMenu ? (
          <>
            <div
              className="fixed inset-0 z-[59]"
              data-app-context-menu
              onPointerDown={() => setFallbackMenu(undefined)}
              onContextMenu={(event) => {
                event.preventDefault();
                setFallbackMenu(undefined);
              }}
              onWheel={() => setFallbackMenu(undefined)}
            />
            <div
              className={["fixed z-[60]", ContextMenuStyles.content].join(" ")}
              style={{ left: fallbackMenu.x, top: fallbackMenu.y }}
              data-app-context-menu
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className={ContextMenuStyles.label}>
                页面操作
              </div>
              <div className={ContextMenuStyles.separator} />
              {fallbackMenuItems.length ? (
                fallbackMenuItems.map(renderFallbackMenuItem)
              ) : (
                <div className="px-2.5 py-2 text-xs text-text-muted">
                  暂无可用命令
                </div>
              )}
            </div>
          </>
        ) : null}
        <EditableContextMenu
          menu={editableMenu}
          onClose={() => setEditableMenu(undefined)}
        />
        <PromptDialog config={promptConfig} />
        <ConfirmDialog config={confirmConfig} />
      </div>
    </CommandProvider>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function loadBootstrapDataWithRetry(
  onRetry: (attempt: number, maxAttempts: number) => void,
) {
  let lastError: unknown;
  const maxAttempts = BOOTSTRAP_RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const [stored, scanned] = await Promise.all([
        listProjects(),
        scanProjects(),
      ]);
      return { stored, scanned };
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      onRetry(attempt, maxAttempts);
      await sleep(BOOTSTRAP_RETRY_DELAYS_MS[attempt - 1]);
    }
  }
  throw lastError;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function getTaskCopyPayload(task: TaskRecord) {
  return (
    task.rawResultJson || task.errorMessage || JSON.stringify(task, null, 2)
  );
}

function getEditableMenuTarget(
  target: EventTarget | null,
): HTMLInputElement | HTMLTextAreaElement | undefined {
  if (!(target instanceof HTMLElement)) return undefined;
  const editable = target.closest("input, textarea");
  if (
    editable instanceof HTMLInputElement ||
    editable instanceof HTMLTextAreaElement
  )
    return editable;
  return undefined;
}

function isLocalContextMenuTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    [
      "[data-app-context-menu]",
      "[data-local-context-menu]",
      ".react-flow",
      ".react-flow__renderer",
      ".react-flow__node",
      ".react-flow__edge",
      "[role='menu']",
    ].join(","),
  );
}

function contextMenuTitle(objectType: AppCommandContext["objectType"]) {
  const titles: Record<AppCommandContext["objectType"], string> = {
    global: "工作台操作",
    project: "项目操作",
    asset: "资产操作",
    assetList: "资产列表操作",
    assetDirectory: "目录操作",
    task: "任务操作",
    mcpTool: "MCP 工具操作",
    workflowCanvas: "节点流画布操作",
    workflowSelection: "节点流选择操作",
    workflowNode: "节点操作",
    workflowEdge: "连线操作",
    videoFlowCanvas: "视频画布操作",
    videoFlowNode: "视频节点操作",
    videoFlowEdge: "视频连线操作",
    videoFlowSelection: "视频画布选择操作",
  };
  return titles[objectType];
}

function isAssetUnderDirectory(relativePath: string, directoryPath: string) {
  const normalizedPath = relativePath
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  const normalizedDirectory = directoryPath
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!normalizedDirectory) return true;
  return (
    normalizedPath === normalizedDirectory ||
    normalizedPath.startsWith(`${normalizedDirectory}/`)
  );
}

function DesktopWindowResizeHandles({
  onResizeStart,
}: {
  onResizeStart: (
    event: React.PointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => void;
}) {
  return (
    <>
      <div
        className="fixed left-5 right-5 top-0 z-[70] h-2 cursor-ns-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "n")}
      />
      <div
        className="fixed bottom-5 left-0 top-14 z-[70] w-2 cursor-ew-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "w")}
      />
      <div
        className="fixed bottom-5 right-0 top-14 z-[70] w-2 cursor-ew-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "e")}
      />
      <div
        className="fixed bottom-0 left-5 right-5 z-[70] h-2 cursor-ns-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "s")}
      />
      <div
        className="fixed left-0 top-0 z-[71] h-5 w-5 cursor-nwse-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "nw")}
      />
      <div
        className="fixed right-0 top-0 z-[71] h-5 w-5 cursor-nesw-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "ne")}
      />
      <div
        className="fixed bottom-0 left-0 z-[71] h-5 w-5 cursor-nesw-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "sw")}
      />
      <div
        className="fixed bottom-0 right-0 z-[71] h-5 w-5 cursor-nwse-resize"
        data-no-window-drag
        onPointerDown={(event) => onResizeStart(event, "se")}
      />
    </>
  );
}

function toTauriResizeDirection(edge: ResizeEdge): TauriResizeDirection {
  const directions: Record<ResizeEdge, TauriResizeDirection> = {
    e: "East",
    n: "North",
    ne: "NorthEast",
    nw: "NorthWest",
    s: "South",
    se: "SouthEast",
    sw: "SouthWest",
    w: "West",
  };
  return directions[edge];
}

function buildDiagnosticSummary({
  selectedProject,
  runtime,
  tools,
  assets,
  tasks,
  activeModule,
}: {
  selectedProject?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  activeModule: WorkbenchModule;
}) {
  return JSON.stringify(
    {
      activeModule,
      project: selectedProject
        ? {
            id: selectedProject.id,
            name: selectedProject.name,
            makerProjectId: selectedProject.makerProjectId,
            rootPath: selectedProject.rootPath,
          }
        : undefined,
      runtime: runtime
        ? {
            status: runtime.status,
            processId: runtime.processId,
            toolCount: runtime.toolCount,
            cwd: runtime.cwd,
            toolsListUpdatedAt: runtime.toolsListUpdatedAt,
            lastError: runtime.lastError,
          }
        : undefined,
      counts: {
        tools: tools.length,
        assets: assets.length,
        tasks: tasks.length,
        failedTasks: tasks.filter((task) => task.status === "failed").length,
      },
    },
    null,
    2,
  );
}

function toAgentSelectionReference(
  selection: InspectorSelection,
): AgentSelectionReference | undefined {
  if (!selection) return undefined;
  if (selection.type === "project")
    return { type: "project", projectId: selection.item.id };
  if (selection.type === "tool")
    return { type: "tool", toolName: selection.item.name };
  if (selection.type === "task")
    return { type: "task", taskId: selection.item.taskId };
  if (selection.type === "assetReferences") return undefined;
  return { type: "asset", relativePath: selection.item.relativePath };
}

function buildProjectPath(projectRoot: string, relativePath: string) {
  const normalizedRoot = projectRoot.replace(/[\\/]+$/g, "");
  const normalizedRelative = relativePath.replace(/^[/\\]+/g, "");
  const separator = projectRoot.includes("\\") ? "\\" : "/";
  return `${normalizedRoot}${separator}${normalizedRelative.replace(/[\\/]/g, separator)}`;
}

function buildAssetReferenceConfirmationMessage(
  actionLabel: string,
  results: AssetReferenceScanResult[],
) {
  // Group references by file type
  const groupedByType = results.reduce((groups, result) => {
    const references = result.references.map(ref => ({
      ...ref,
      assetPath: result.relativePath,
      assetRefCount: result.referenceCount,
    }));
    
    references.forEach(ref => {
      const ext = ref.sourcePath.toLowerCase();
      let type = 'Resources';
      if (ext.endsWith('.lua')) type = 'Lua';
      else if (ext.endsWith('.json') || ext.endsWith('.fsm') || ext.endsWith('.blendspace')) type = 'Flow';
      
      if (!groups[type]) groups[type] = [];
      groups[type].push(ref);
    });
    
    return groups;
  }, {} as Record<string, Array<{ sourcePath: string; line: number; lineText: string; assetPath: string; assetRefCount: number }>>);

  const typeOrder = ['Lua', 'Flow', 'Resources'];
  const sortedTypes = typeOrder.filter(t => groupedByType[t]);

  // Count badge color based on reference count
  const getBadgeColor = (count: number) => {
    if (count === 0) return 'bg-green-500/10 text-green-600';
    if (count <= 5) return 'bg-yellow-500/10 text-yellow-600';
    return 'bg-red-500/10 text-red-600';
  };

  return (
    <div className="flex flex-col gap-3 text-sm text-text mt-1">
      <p className="font-medium text-text-strong">检测到以下资产仍被引用，确认{actionLabel}？</p>
      <div className="flex flex-col gap-2 rounded-xl border border-border-soft bg-surface-app p-3 max-h-[400px] overflow-y-auto custom-scrollbar shadow-inner">
        {sortedTypes.map((type) => {
          const refs = groupedByType[type];
          const displayRefs = refs.slice(0, 20);
          const hasMore = refs.length > 20;
          
          return (
            <details key={type} open className="group">
              <summary className="cursor-pointer list-none font-semibold text-text-strong text-[13px] py-2 px-2 rounded-lg hover:bg-surface-panel/50 select-none">
                <span className="inline-flex items-center gap-2">
                  <span className="text-xs">▶</span>
                  <span>{type}</span>
                  <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {refs.length} 处引用
                  </span>
                </span>
              </summary>
              <div className="flex flex-col gap-2 mt-2 pl-4">
                {displayRefs.map((ref, i) => (
                  <div key={i} className="flex flex-col gap-1.5 border-b border-border-soft/50 pb-2 last:border-0">
                    <div className="flex items-start gap-2 text-xs text-text-muted">
                      <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-border-soft" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-[10px] text-text-subtle" title={`${ref.sourcePath}:${ref.line}`}>
                            {ref.sourcePath}:{ref.line}
                          </span>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${getBadgeColor(ref.assetRefCount)}`}>
                            {ref.assetRefCount}
                          </span>
                        </div>
                        <code className="rounded bg-surface-panel px-1.5 py-1 font-mono text-[11px] text-text-muted border border-border-soft shadow-sm break-all">
                          {ref.lineText.trim()}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <p className="text-xs italic text-text-subtle ml-3 mt-1">
                    还有 {refs.length - 20} 条引用未显示
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function buildAssetMutationNotice(prefix: string, result: AssetMutationResponse) {
  const referenceUpdate = result.referenceUpdate;
  if (!referenceUpdate) {
    const referencedCount = result.referenceScan?.reduce(
      (total, item) => total + item.referenceCount,
      0,
    ) ?? 0;
    return referencedCount > 0
      ? `${prefix}；未同步引用，可能有 ${referencedCount} 处引用缺失`
      : prefix;
  }
  const fileCount = referenceUpdate.updatedFiles.length;
  const skippedCount = referenceUpdate.skipped.length;
  return `${prefix}；同步更新 ${referenceUpdate.totalReplacements} 处引用，涉及 ${fileCount} 个文件${skippedCount ? `，仍有 ${skippedCount} 项未同步` : ""}`;
}

function ThemeCinemaOverlay({ 
  active, 
  toTheme,
  onMidpoint,
  onComplete
}: { 
  active: boolean; 
  toTheme: "light" | "dark";
  onMidpoint: (theme: "light" | "dark") => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "fade-in" | "morph" | "fade-out">("idle");
  const [iconState, setIconState] = useState<"light" | "dark">(toTheme === "dark" ? "light" : "dark");

  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onCompleteRef.current = onComplete;
  }, [onMidpoint, onComplete]);

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }
    
    // 1. Fade in overlay completely first
    setPhase("fade-in");
    setIconState(toTheme === "dark" ? "light" : "dark");
    
    // 2. Wait 200ms until overlay is 100% opaque. Then trigger morph AND underlying theme change.
    const t1 = setTimeout(() => {
      setPhase("morph");
      setIconState(toTheme);
      // At this point, screen is perfectly solid color. Safe to freeze main thread for heavy DOM update.
      onMidpointRef.current(toTheme);
    }, 200); 

    // 3. Wait 500ms for morph to finish beautifully. Then reveal.
    const t2 = setTimeout(() => {
      setPhase("fade-out");
    }, 700); // 200 + 500

    // 4. Wait 300ms for fade out. Clean up.
    const t3 = setTimeout(() => {
      onCompleteRef.current();
    }, 1000); // 700 + 300

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active, toTheme]); // Removed function dependencies to fix the loop bug

  if (!active) return null;

  const bg = toTheme === "dark" ? "#18191B" : "#F7F9FA"; 
  const brand = "#00D9C5";
  
  const opacity = phase === "idle" || phase === "fade-out" ? 0 : 1;
  const isDarkIcon = iconState === "dark";
  const easeCurve = "cubic-bezier(0.4, 0, 0.2, 1)"; // Smooth Material ease, NO BOUNCING

  return (
    <div 
      className="fixed inset-0 z-[999999] pointer-events-none flex items-center justify-center transition-opacity duration-200"
      style={{ backgroundColor: bg, opacity }}
    >
      <div 
        className="transition-all duration-300"
        style={{
          transform: phase === "fade-out" ? "scale(2.5) blur(12px)" : "scale(1) blur(0px)",
          opacity: phase === "fade-out" ? 0 : 1,
          filter: `drop-shadow(0 0 50px ${brand}80)` 
        }}
      >
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke={brand}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isDarkIcon ? "rotate(-90deg)" : "rotate(0deg)",
            transition: `transform 0.4s ${easeCurve}`
          }}
        >
          <mask id="moon-mask-cinema">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <circle
              cx={isDarkIcon ? "16" : "28"}
              cy={isDarkIcon ? "8" : "-4"}
              r="9"
              fill="black"
              style={{ transition: `cx 0.4s ${easeCurve}, cy 0.4s ${easeCurve}` }}
            />
          </mask>
          <circle
            cx="12"
            cy="12"
            r={isDarkIcon ? "9" : "5"}
            fill={isDarkIcon ? brand : "none"}
            mask="url(#moon-mask-cinema)"
            style={{ transition: `r 0.4s ${easeCurve}, fill 0.4s ease` }}
          />
          <g
            style={{
              opacity: isDarkIcon ? 0 : 1,
              transform: isDarkIcon ? "scale(0.3) rotate(45deg)" : "scale(1) rotate(0deg)",
              transformOrigin: "center",
              transition: `opacity 0.2s ease, transform 0.4s ${easeCurve}`
            }}
          >
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
            <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
            <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
          </g>
        </svg>
      </div>
    </div>
  );
}

