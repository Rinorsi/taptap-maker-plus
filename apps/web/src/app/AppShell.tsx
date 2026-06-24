import { Terminal, FolderSync, Search, Settings, Moon, PanelLeft, PanelRight, RefreshCw, Copy, Trash2, Eye, Save, Play, Code, ClipboardList, Scan, Edit2, Move, ExternalLink, Image, FolderOpen, Download, Crosshair, Check } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  callTool,
  deleteAssets,
  renameAsset,
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
  scanAssetReferences,
  scanProjects,
  selectProject,
  startRuntime,
  clearTasks,
  type AgentPageState,
  type AgentSelectionReference,
  type AssetReferenceScanResult,
  type AssetSummary,
  type ProjectSummary,
  type RuntimeSummary,
  type TaskRecord,
  type ToolSummary,
} from "../api";
import { type WorkbenchModule } from "./routes";
import { TopBar } from "../components/layout/TopBar";
import { ProjectSidebar } from "../components/layout/ProjectSidebar";
import { WorkbenchViewport } from "../components/layout/WorkbenchViewport";
import {
  AgentInspectorPanel,
  type InspectorSelection,
} from "../components/layout/AgentInspectorPanel";
import {
  AppMenuBar,
  buildContextMenuItems,
  CommandPalette,
  CommandProvider,
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
const DESKTOP_ASPECT_WIDTH = 16;
const DESKTOP_ASPECT_HEIGHT = 9;
const DESKTOP_MIN_WIDTH = 1024;
const DESKTOP_MIN_HEIGHT = 576;

type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

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
  const [activeModule, setActiveModule] = useState<WorkbenchModule>(() => {
    const hasProject = localStorage.getItem("taptap.selectedProjectId");
    return hasProject ? DEFAULT_PROJECT_MODULE : "home";
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem("taptap.selectedProjectId") ?? "",
  );
  const [tools, setTools] = useState<ToolSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [runtime, setRuntime] = useState<RuntimeSummary | undefined>();
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState<InspectorSelection>();
  const [notice, setNotice] = useState("准备就绪");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    Number(localStorage.getItem("taptap.sidebarWidth") ?? 240),
  );
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(() =>
    Number(localStorage.getItem("taptap.inspectorWidth") ?? 280),
  );
  const [rightPanelTab, setRightPanelTab] = useState<
    "status" | "tools" | "logs" | "errors"
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
    const [status, toolData, assetList, taskList] = await Promise.all([
      getRuntimeStatus(projectId).catch(() => undefined),
      listTools(projectId).catch(() => undefined),
      listAssets(projectId).catch(() => []),
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
    setTasks(taskList);
  }

  // Auto-refresh tasks every 10 seconds if any task is running
  useEffect(() => {
    if (!selectedProjectId) return;
    const hasRunning = tasks.some(
      (t) => t.status === "running" || t.status === "queued",
    );
    if (!hasRunning) return;
    const interval = setInterval(() => {
      listTasks(selectedProjectId)
        .then(setTasks)
        .catch(() => undefined);
    }, 10000);
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
    setBusy(true);
    setRightPanelTab("status");
    setInspectorMinimized(false);
    setSelection(undefined);
    setRuntime((current) => ({
      projectId: selectedProject.id,
      status: "starting",
      toolCount: current?.toolCount ?? tools.length,
      cwd: selectedProject.rootPath,
      startedAt: new Date().toISOString(),
      toolsListUpdatedAt: current?.toolsListUpdatedAt,
    }));
    setProjects((current) =>
      current.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              runtime: {
                projectId: selectedProject.id,
                status: "starting",
                toolCount: project.runtime?.toolCount ?? tools.length,
                cwd: selectedProject.rootPath,
                startedAt: new Date().toISOString(),
                toolsListUpdatedAt: project.runtime?.toolsListUpdatedAt,
              },
            }
          : project,
      ),
    );
    setNotice(
      "正在启动 MCP runtime：POST /api/projects/:projectId/mcp/start，服务端 http://127.0.0.1:8787",
    );
    try {
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

  async function confirmAssetReferenceMutation(
    projectId: string,
    relativePaths: string[],
    actionLabel: string,
  ) {
    const results = await scanAssetReferences(projectId, relativePaths);
    const referencedResults = results.filter(
      (result) => result.referenceCount > 0,
    );
    if (!referencedResults.length) return true;
    return requestConfirm({
      title: `${actionLabel}已引用资产？`,
      body: buildAssetReferenceConfirmationMessage(actionLabel, referencedResults),
      confirmLabel: `继续${actionLabel}`,
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
      const confirmed = await confirmAssetReferenceMutation(
        selectedProject.id,
        relativePaths,
        "移动",
      );
      if (!confirmed) {
        setNotice("已取消移动资产");
        return;
      }
      const nextAssets = await moveAssets(
        selectedProject.id,
        relativePaths,
        targetFolder,
      );
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
      const confirmed = await confirmAssetReferenceMutation(
        selectedProject.id,
        [relativePath],
        "重命名",
      );
      if (!confirmed) {
        setNotice("已取消重命名资产");
        return;
      }
      const nextAssets = await renameAsset(
        selectedProject.id,
        relativePath,
        newName,
      );
      setAssets(nextAssets);
      setSelection(undefined);
      setNotice(`已重命名文件为 ${newName}`);
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

  async function handleScanAssetReferencesNotice(relativePaths: string[]) {
    if (!selectedProject || !relativePaths.length) return;
    setBusy(true);
    try {
      const results = await scanAssetReferences(selectedProject.id, relativePaths);
      const total = results.reduce((sum, result) => sum + result.referenceCount, 0);
      const title =
        relativePaths.length === 1
          ? `引用情况：${relativePaths[0]}`
          : `目录引用报告：${relativePaths.length} 个资产`;
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
    setActiveModule(module);
    if (module === "settings") setSelection(undefined);
  }

  function promptCanvasOperation() {
    setNotice("请在画布内操作");
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
      activeModule === "studio-video" &&
      canvasCommandContext &&
      (canvasCommandContext.objectType === "videoFlowSelection" ||
        canvasCommandContext.objectType === "videoFlowNode" ||
        canvasCommandContext.objectType === "videoFlowEdge")
    )
      return canvasCommandContext;
    if (activeModule === "workflow") return { objectType: "workflowCanvas" };
    if (activeModule === "studio-video")
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
            : "当前面板没有可保存草稿",
        shortcut: { key: "s", ctrlKey: true },
        scope: "global",
        run: () => {
          if (activeModule === "workflow") {
            window.dispatchEvent(new CustomEvent("taptap:workflow-save"));
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
          void handlePromptRenameAsset(context.relativePath);
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
          void handlePromptMoveAssets([context.relativePath]);
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
              detail: { action: "open", directoryPath: context.directoryPath },
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
        commandId: "assetDirectory.importHere",
        title: "导入到此目录",
        icon: <Download className="h-4 w-4" />,
        description: "将新的资产导入到该目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          window.dispatchEvent(
            new CustomEvent("taptap:asset-directory-command", {
              detail: {
                action: "importHere",
                directoryPath: context.directoryPath,
              },
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
        title: "移动目录内资产",
        icon: <Edit2 className="h-4 w-4" />,
        description: "把该目录下的资产移动到新目录",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          const paths = assets
            .filter((asset) =>
              isAssetUnderDirectory(asset.relativePath, context.directoryPath),
            )
            .map((asset) => asset.relativePath);
          void handlePromptMoveAssets(paths);
        },
      },
      {
        commandId: "assetDirectory.move",
        title: "查看目录引用",
        icon: <Move className="h-4 w-4" />,
        description: "扫描该目录下资产的项目引用",
        scope: "assetDirectory",
        when: (context) => context.objectType === "assetDirectory",
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          const paths = assets
            .filter((asset) =>
              isAssetUnderDirectory(asset.relativePath, context.directoryPath),
            )
            .map((asset) => asset.relativePath);
          void handleScanAssetReferencesNotice(paths);
        },
      },
      {
        commandId: "assetDirectory.delete",
        title: "删除目录内资产",
        icon: <Trash2 className="h-4 w-4" />,
        description: "删除该目录下所有资产",
        scope: "assetDirectory",
        danger: true,
        when: (context) =>
          context.objectType === "assetDirectory" &&
          assets.some((asset) =>
            isAssetUnderDirectory(asset.relativePath, context.directoryPath),
          ),
        run: (context) => {
          if (context.objectType !== "assetDirectory") return;
          const paths = assets
            .filter((asset) =>
              isAssetUnderDirectory(asset.relativePath, context.directoryPath),
            )
            .map((asset) => asset.relativePath);
          void handleDeleteAssets(paths);
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
            body: context.taskId,
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
        description: "切换到节点流后从工具库加入",
        scope: "mcpTool",
        when: (context) => context.objectType === "mcpTool",
        run: () => {
          selectModule("workflow");
          setNotice("已打开节点流，请从左侧工具库加入节点");
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
        description: "切换到 MCP 节点流画布",
        scope: ["workflowCanvas", "videoFlowCanvas"],
        run: () => selectModule("workflow"),
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
        scope: ["workflowCanvas", "videoFlowCanvas"],
        category: "节点流",
        submenu: "画布",
        order: 30,
        when: (context) =>
          context.objectType === "workflowCanvas" ||
          context.objectType === "videoFlowCanvas",
        run: (context) => {
          if (context.objectType === "workflowCanvas") {
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
        scope: "workflowCanvas",
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
        scope: ["workflowNode", "videoFlowNode", "videoFlowSelection"],
        category: "节点流",
        submenu: "节点",
        order: 20,
        when: (context) =>
          context.objectType === "workflowNode" ||
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
          promptCanvasOperation();
        },
      },
      {
        commandId: "node.delete",
        title: "删除节点",
        description: "删除当前节点",
        shortcut: { key: "Delete" },
        scope: ["workflowNode", "videoFlowNode", "videoFlowSelection"],
        category: "节点流",
        submenu: "节点",
        order: 30,
        danger: true,
        when: (context) =>
          context.objectType === "workflowNode" ||
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
          promptCanvasOperation();
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
          promptCanvasOperation();
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
          promptCanvasOperation();
        },
      },
      {
        commandId: "edge.delete",
        title: "删除连线",
        description: "删除当前连线",
        shortcut: { key: "Delete" },
        scope: ["workflowEdge", "videoFlowEdge", "videoFlowSelection"],
        category: "节点流",
        submenu: "连线",
        order: 10,
        danger: true,
        when: (context) =>
          context.objectType === "workflowEdge" ||
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
          promptCanvasOperation();
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
          promptCanvasOperation();
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      if (!isFallbackContextMenuTarget(event.target)) {
        setEditableMenu(undefined);
        setFallbackMenu(undefined);
        return;
      }
      event.preventDefault();
      notifyContextMenuOpen("app");
      setEditableMenu(undefined);
      setFallbackMenu(
        clampContextMenuPosition(
          { x: event.clientX, y: event.clientY },
          { width: 246, height: 330 },
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

  async function beginDesktopAspectResize(
    event: React.PointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      const [{ getCurrentWindow }, { PhysicalPosition, PhysicalSize }] = await Promise.all([
        import("@tauri-apps/api/window"),
        import("@tauri-apps/api/dpi"),
      ]);
      const appWindow = getCurrentWindow();
      if ((await appWindow.isMaximized()) || (await appWindow.isFullscreen()))
        return;
      const startSize = await appWindow.outerSize();
      const startPosition = await appWindow.outerPosition();
      const startX = event.clientX;
      const startY = event.clientY;
      let animationFrame = 0;
      const resizeTo = (width: number, height: number, x: number, y: number) => {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(() => {
          void appWindow.setPosition(
            new PhysicalPosition(Math.round(x), Math.round(y)),
          );
          void appWindow.setSize(
            new PhysicalSize(Math.round(width), Math.round(height)),
          );
        });
      };
      const onMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        const affectsLeft = edge.includes("w");
        const affectsRight = edge.includes("e");
        const affectsTop = edge.includes("n");
        const affectsBottom = edge.includes("s");
        const horizontalDelta = affectsLeft ? -deltaX : affectsRight ? deltaX : 0;
        const verticalDelta = affectsTop ? -deltaY : affectsBottom ? deltaY : 0;
        const widthFromHorizontal = Math.max(
          DESKTOP_MIN_WIDTH,
          startSize.width + horizontalDelta,
        );
        const heightFromVertical = Math.max(
          DESKTOP_MIN_HEIGHT,
          startSize.height + verticalDelta,
        );
        let nextWidth = widthFromHorizontal;
        let nextHeight =
          (nextWidth * DESKTOP_ASPECT_HEIGHT) / DESKTOP_ASPECT_WIDTH;
        if (!affectsLeft && !affectsRight) {
          nextHeight = heightFromVertical;
          nextWidth =
            (nextHeight * DESKTOP_ASPECT_WIDTH) / DESKTOP_ASPECT_HEIGHT;
        } else if ((affectsTop || affectsBottom) && Math.abs(verticalDelta) > Math.abs(horizontalDelta)) {
          nextHeight = heightFromVertical;
          nextWidth =
            (nextHeight * DESKTOP_ASPECT_WIDTH) / DESKTOP_ASPECT_HEIGHT;
        }
        nextWidth = Math.max(DESKTOP_MIN_WIDTH, nextWidth);
        nextHeight = Math.max(DESKTOP_MIN_HEIGHT, nextHeight);
        const nextX = affectsLeft
          ? startPosition.x + startSize.width - nextWidth
          : startPosition.x;
        const nextY = affectsTop
          ? startPosition.y + startSize.height - nextHeight
          : startPosition.y;
        resizeTo(nextWidth, nextHeight, nextX, nextY);
      };
      const onUp = () => {
        window.cancelAnimationFrame(animationFrame);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
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
  const fallbackMenuItems = buildContextMenuItems(
    fallbackContext.objectType,
    getContextMenuCommands(commandRegistry.list(fallbackContext)),
  );

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
      <div
        className="w-full h-full flex flex-col bg-surface-canvas overflow-hidden text-text"
        onClick={() => {
          setFallbackMenu(undefined);
          setEditableMenu(undefined);
        }}
      >
        <DesktopAspectResizeHandles onResizeStart={beginDesktopAspectResize} />

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
          onThemeToggle={() =>
            setTheme((t) => (t === "light" ? "dark" : "light"))
          }
          onOpenSettings={() => selectModule("settings")}
          onSelectProject={handleSelectProject}
          onOpenModule={selectModule}
          onSelect={handleSelectSelection}
          appMenu={<AppMenuBar context={commandContext} />}
          searchFocusSignal={searchFocusSignal}
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
              tasks={tasks}
              collapsed={sidebarCollapsed}
              width={sidebarWidth}
              onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
              onClearProject={handleClearProject}
              onSelectModule={selectModule}
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
              agentPage={agentPage}
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
                {contextMenuTitle(fallbackContext.objectType)}
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

function isFallbackContextMenuTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("[data-workbench-fallback-menu-zone]");
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

function DesktopAspectResizeHandles({
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

function buildAssetReferenceConfirmationMessage(
  actionLabel: string,
  results: AssetReferenceScanResult[],
) {
  const lines = results.flatMap((result) => [
    `${result.relativePath}：${result.referenceCount} 处引用`,
    ...result.references
      .slice(0, 5)
      .map(
        (reference) =>
          `  - ${reference.sourcePath}:${reference.line}:${reference.column} ${reference.lineText.trim()}`,
      ),
  ]);
  return `检测到资产仍被引用，确认${actionLabel}？\n\n${lines.join("\n")}`;
}
