import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  Panel,
  BaseEdge,
  getSmoothStepPath,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  MiniMap,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  AlertCircle,
  Boxes,
  Check,
  ChevronsRight,
  Copy,
  CornerDownRight,
  Eye,
  LibrarySquare,
  Maximize2,
  Minimize2,
  Play,
  Trash2,
  Scan,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  assetPreviewUrl,
  type AssetSummary,
  type ProjectSummary,
  type TaskRecord,
  type ToolSummary,
  getFlow,
  autoSaveFlow,
} from "../../api";
import { ChevronRight, ChevronLeft, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { CodeEditorPanel } from "../../components/ui/CodeEditorPanel";
import { ContextMenuStyles } from "../../components/ui/ContextMenuStyles";
import {
  clampContextMenuPosition,
  CONTEXT_MENU_CLOSE_EVENT,
  CONTEXT_MENU_OPEN_EVENT,
  isEditableShortcutTarget,
  notifyContextMenuOpen,
  shouldIgnoreContextMenuEvent,
  shouldUseNativeContextMenu,
  type AppCommandContext,
} from "../../commands";
import { NodeLibraryDrawer } from "./NodeLibraryDrawer";
import { getPresetById, NODE_PRESETS, type NodePreset } from "./nodeRegistry";
import { buildVideoPayloadFromGraph } from "./VideoFlowPayloadBuilder";
import { readAssetDragPath } from "./dragData";
import {
  GenericTextNode,
  GenericMediaNode,
  GenericSettingsNode,
  GenericCollectorNode,
  GenericExecutorNode,
  GenericResultNode,
} from "./VideoFlowNodes";
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: any) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        className={cn(
          selected
            ? "stroke-[4px]"
            : "stroke-[2px] hover:stroke-[3px] hover:stroke-brand",
        )}
        style={{
          ...style,
          stroke: selected ? "#00D9C5" : "rgba(0, 217, 197, 0.55)",
          filter: selected
            ? "drop-shadow(0 0 8px rgba(0,217,197,0.5))"
            : "none",
        }}
      />
    </>
  );
}
function cleanFlowNodeForStorage(node: Node): Node {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width,
    height: node.height,
    selected: false,
    dragging: false,
    data: cleanFlowData(node.data, transientNodeDataKeys),
  };
}
function cleanFlowEdgeForStorage(edge: Edge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    type: edge.type,
    animated: false,
    selected: false,
    style: edge.style,
    markerEnd: edge.markerEnd,
    data: cleanFlowData(edge.data, transientEdgeDataKeys),
  };
}
function cleanFlowData(
  data: Node["data"] | Edge["data"] | undefined,
  transientKeys: Set<string>,
) {
  const clean: Record<string, unknown> = {};
  if (!data) return clean;
  for (const [key, value] of Object.entries(data)) {
    if (transientKeys.has(key)) continue;
    if (typeof value === "function") continue;
    if (isPlainJsonValue(value)) clean[key] = value;
  }
  return clean;
}
function isPlainJsonValue(value: unknown): boolean {
  if (value == null) return true;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (Array.isArray(value)) return value.every(isPlainJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(
    isPlainJsonValue,
  );
}
const nodeTypes = {
  textNode: GenericTextNode,
  mediaNode: GenericMediaNode,
  settingsNode: GenericSettingsNode,
  collectorNode: GenericCollectorNode,
  executorNode: GenericExecutorNode,
  resultNode: GenericResultNode,
};
const edgeTypes = {
  custom: CustomEdge,
};
const defaultEdgeOptions = {
  animated: false,
  type: "custom",
  style: { stroke: "#00D9C5", strokeWidth: 2 },
};
const transientNodeDataKeys = new Set([
  "allAssets",
  "busy",
  "error",
  "imagesCount",
  "isCloudVideoRunning",
  "onAssetDrop",
  "onChange",
  "onDelete",
  "onPreviewMedia",
  "onRun",
  "project",
  "promptCount",
  "settingsCount",
  "videosCount",
  "audiosCount",
]);
const transientEdgeDataKeys = new Set(["onDelete"]);
type CanvasMenuTarget =
  | { kind: "pane"; screenX: number; screenY: number }
  | { kind: "node"; nodeId: string; screenX: number; screenY: number }
  | { kind: "edge"; edgeId: string; screenX: number; screenY: number };
type CanvasSubmenuState =
  | { kind: "root"; left?: number; right?: number; top: number; mode: "add" | "insert"; direction: "left" | "right" }
  | {
      kind: "category";
      categoryKey: string;
      rootLeft?: number;
      rootRight?: number;
      rootTop: number;
      rootDirection: "left" | "right";
      left?: number;
      right?: number;
      top: number;
      mode: "add" | "insert";
      direction: "left" | "right";
    }
  | null;
const CATEGORY_GROUPS = (() => {
  const groups = {
    prompt: { label: "文本提示词", items: [] as typeof NODE_PRESETS },
    image: { label: "图片参考", items: [] as typeof NODE_PRESETS },
    video: { label: "视频参考", items: [] as typeof NODE_PRESETS },
    audio: { label: "音频参考", items: [] as typeof NODE_PRESETS },
    settings: { label: "生成设置", items: [] as typeof NODE_PRESETS },
    collector: { label: "逻辑聚合", items: [] as typeof NODE_PRESETS },
    executor: { label: "执行节点", items: [] as typeof NODE_PRESETS },
  };
  NODE_PRESETS.forEach((preset) => {
    if (preset.category in groups) {
      groups[preset.category as keyof typeof groups].items.push(preset);
    }
  });
  return groups;
})();
type VideoFlowCanvasProps = {
  project?: ProjectSummary;
  allAssets: AssetSummary[];
  activeGenerationTask?: TaskRecord;
  isCloudVideoRunning?: boolean;
  generateTool?: ToolSummary;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onPreviewMedia?: (asset: AssetSummary) => void;
  onCallTool: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  onShowError?: () => void;
  onCommandContextChange?: (context?: AppCommandContext) => void;
};
type PreviewMedia = {
  assetType: string;
  fileName: string;
  relativePath?: string;
  url?: string;
};
declare global {
  interface Window {
    __taptapNodePresetDrag?: string;
  }
}
export function VideoFlowCanvas(props: VideoFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <VideoFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
function VideoFlowCanvasInner({
  project,
  allAssets,
  activeGenerationTask,
  isCloudVideoRunning,
  generateTool,
  isFullscreen,
  onToggleFullscreen,
  onPreviewMedia,
  onCallTool,
  onShowError,
  onCommandContextChange,
}: VideoFlowCanvasProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isPayloadPanelOpen, setIsPayloadPanelOpen] = useState(false);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const isAutoSavingRef = useRef(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clipboard, setClipboard] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const [menuTarget, setMenuTarget] = useState<CanvasMenuTarget>({
    kind: "pane",
    screenX: 0,
    screenY: 0,
  });
  const [isCanvasMenuOpen, setIsCanvasMenuOpen] = useState(false);
  const [submenuState, setSubmenuState] = useState<CanvasSubmenuState>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function selectAllCanvasElements() {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
  }

  function deleteSelectedCanvasElements() {
    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    const selectedEdges = reactFlow
      .getEdges()
      .filter((edge) => edge.selected || edge.id === selectedEdge);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdgeIds = new Set(selectedEdges.map((edge) => edge.id));
    setNodes((nds) => nds.filter((node) => !selectedNodeIds.has(node.id)));
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !selectedEdgeIds.has(edge.id) &&
          !selectedNodeIds.has(edge.source) &&
          !selectedNodeIds.has(edge.target),
      ),
    );
    setSelectedEdge(null);
    setIsCanvasMenuOpen(false);
    setSubmenuState(null);
  }

  useEffect(() => {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    const selectedEdgeIds = edges
      .filter((edge) => edge.selected || edge.id === selectedEdge)
      .map((edge) => edge.id);
    if (selectedNodeIds.length === 1 && selectedEdgeIds.length === 0) {
      onCommandContextChange?.({ objectType: "videoFlowNode", nodeId: selectedNodeIds[0] });
      return;
    }
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 1) {
      onCommandContextChange?.({ objectType: "videoFlowEdge", edgeId: selectedEdgeIds[0] });
      return;
    }
    if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
      onCommandContextChange?.({
        objectType: "videoFlowSelection",
        nodeIds: selectedNodeIds,
        edgeIds: selectedEdgeIds,
      });
      return;
    }
    onCommandContextChange?.({ objectType: "videoFlowCanvas" });
  }, [edges, nodes, onCommandContextChange, selectedEdge]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableShortcutTarget(e.target) || isEditableShortcutTarget(document.activeElement)) return;
      if (e.key === "Escape") {
        if (isCanvasMenuOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsCanvasMenuOpen(false);
          setSubmenuState(null);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        const selectedNodes = reactFlow.getNodes().filter((n) => n.selected);
        if (selectedNodes.length > 0) {
          const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
          const selectedEdges = reactFlow
            .getEdges()
            .filter(
              (edge) =>
                selectedNodeIds.has(edge.source) &&
                selectedNodeIds.has(edge.target),
            );
          setClipboard({ nodes: selectedNodes, edges: selectedEdges });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        if (clipboard) {
          const newNodes: Node[] = [];
          const newEdges: Edge[] = [];
          const idMap = new Map<string, string>();
          clipboard.nodes.forEach((n) => {
            const newId =
              n.type +
              "-" +
              Date.now() +
              Math.random().toString(36).slice(2, 6);
            idMap.set(n.id, newId);
            newNodes.push({
              ...n,
              id: newId,
              selected: true,
              position: { x: n.position.x + 30, y: n.position.y + 30 },
            });
          });
          clipboard.edges.forEach((edge) => {
            if (idMap.has(edge.source) && idMap.has(edge.target)) {
              newEdges.push({
                ...edge,
                id: "e" + idMap.get(edge.source) + "-" + idMap.get(edge.target),
                source: idMap.get(edge.source)!,
                target: idMap.get(edge.target)!,
                selected: true,
              });
            }
          });
          setNodes((nds) => [
            ...nds.map((n) => ({ ...n, selected: false })),
            ...newNodes,
          ]);
          setEdges((eds) => [
            ...eds.map((e) => ({ ...e, selected: false })),
            ...newEdges,
          ]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllCanvasElements();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedCanvasElements();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    reactFlow,
    clipboard,
    setNodes,
    setEdges,
    isCanvasMenuOpen,
    selectedEdge,
  ]);
  useEffect(() => {
    if (!isCanvasMenuOpen) setSubmenuState(null);
  }, [isCanvasMenuOpen]);
  useEffect(() => {
    const handleCanvasContextMenu = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      const target = event.target as HTMLElement | null;
      if (!target || !wrapperRef.current.contains(target)) return;
      if (shouldUseNativeContextMenu(target) || isEditableShortcutTarget(target)) return;
      if (!target.closest(".react-flow")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const position = clampContextMenuPosition(
        { x: event.clientX, y: event.clientY },
        { width: 260, height: 380 },
      );
      const edgeElement = target.closest(".react-flow__edge");
      const nodeElement = target.closest(".react-flow__node");
      const edgeId = edgeElement?.getAttribute("data-id");
      const nodeId = nodeElement?.getAttribute("data-id");
      notifyContextMenuOpen("videoFlow");
      if (edgeId && edges.some((edge) => edge.id === edgeId)) {
        setMenuTarget({
          kind: "edge",
          edgeId,
          screenX: position.x,
          screenY: position.y,
        });
        setSelectedEdge(edgeId);
      } else if (nodeId && nodes.some((node) => node.id === nodeId)) {
        setMenuTarget({
          kind: "node",
          nodeId,
          screenX: position.x,
          screenY: position.y,
        });
      } else {
        setMenuTarget({
          kind: "pane",
          screenX: position.x,
          screenY: position.y,
        });
      }
      setIsCanvasMenuOpen(true);
    };
    const onCloseContextMenus = () => {
      setIsCanvasMenuOpen(false);
      setSubmenuState(null);
    };
    const onOtherContextMenuOpen = (event: Event) => {
      if (shouldIgnoreContextMenuEvent(event, "videoFlow")) return;
      setIsCanvasMenuOpen(false);
      setSubmenuState(null);
    };
    window.addEventListener("contextmenu", handleCanvasContextMenu, {
      capture: true,
    });
    window.addEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
    window.addEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
    return () => {
      window.removeEventListener("contextmenu", handleCanvasContextMenu, {
        capture: true,
      });
      window.removeEventListener(CONTEXT_MENU_CLOSE_EVENT, onCloseContextMenus);
      window.removeEventListener(CONTEXT_MENU_OPEN_EVENT, onOtherContextMenuOpen);
    };
  }, [edges, nodes]);
  // Auto-load on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!project || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    getFlow(project.id, "_autosave")
      .then((data) => {
        if (data && data.nodes && data.edges) {
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          if (data.viewport) reactFlow.setViewport(data.viewport);
        }
      })
      .catch(() => {
        /* ignore, probably doesn't exist yet */
      });
  }, [project, setNodes, setEdges, reactFlow]);
  // Auto-save every 30s
  useEffect(() => {
    if (!project) return;
    const interval = setInterval(() => {
      if (isAutoSavingRef.current) return;
      const viewport = reactFlow.getViewport();
      const data = {
        nodes: nodes.map(cleanFlowNodeForStorage),
        edges: edges.map(cleanFlowEdgeForStorage),
        viewport,
      };
      if (data.nodes.length > 0) {
        isAutoSavingRef.current = true;
        autoSaveFlow(project.id, data)
          .catch((error) => {
            console.warn("Failed to auto save flow", error);
          })
          .finally(() => {
            isAutoSavingRef.current = false;
          });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [edges, nodes, project, reactFlow]);
  useEffect(() => {
    const labels = new Map([
      ["Zoom In", "放大"],
      ["Zoom Out", "缩小"],
      ["Fit View", "适应画布"],
      ["Toggle Interactivity", "锁定/解锁画布"],
    ]);
    const updateControlLabels = () => {
      wrapperRef.current
        ?.querySelectorAll<HTMLButtonElement>(".react-flow__controls-button")
        .forEach((button) => {
          const title = button.getAttribute("title");
          const ariaLabel = button.getAttribute("aria-label");
          const label =
            (title && labels.get(title)) ||
            (ariaLabel && labels.get(ariaLabel));
          if (!label) return;
          button.setAttribute("title", label);
          button.setAttribute("aria-label", label);
        });
    };
    updateControlLabels();
    const observer = new MutationObserver(updateControlLabels);
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["title", "aria-label"],
      });
    }
    return () => observer.disconnect();
  }, []);
  const handleNodeDataChange = useCallback(
    (id: string, key: string, value: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n,
        ),
      );
    },
    [setNodes],
  );
  const updateNodeData = useCallback(
    (id: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      );
    },
    [setNodes],
  );
  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );
  const handleDeleteEdge = useCallback(
    (id: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelectedEdge((current) => (current === id ? null : current));
    },
    [setEdges],
  );
  const copyText = useCallback((value: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }, []);
  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedEdge(null);
    setIsCanvasMenuOpen(false);
    setClearConfirmOpen(false);
  }, [setEdges, setNodes]);
  const handleClearCanvas = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setClearConfirmOpen(true);
      setIsCanvasMenuOpen(false);
      return;
    }
    clearCanvas();
  }, [clearCanvas, edges.length, nodes.length]);
  const handleApplyTemplate = useCallback(() => {
    const taskId = `task-${Date.now()}`;
    const payloadId = `payload-${Date.now()}`;
    const promptId = `prompt-${Date.now()}`;
    const settingsId = `settings-${Date.now()}`;
    setNodes([
      {
        id: promptId,
        type: "textNode",
        position: { x: 50, y: 50 },
        data: {
          presetId: "MainPromptNode",
          text: "一个赛博朋克城市的夜景，霓虹闪烁，高画质，电影级运镜...",
        },
      },
      {
        id: settingsId,
        type: "settingsNode",
        position: { x: 50, y: 350 },
        data: {
          presetId: "VideoModelNode",
          value: "default",
          type: "model",
        },
      },
      {
        id: payloadId,
        type: "collectorNode",
        position: { x: 450, y: 150 },
        data: { presetId: "MultiModalPayloadNode" },
      },
      {
        id: taskId,
        type: "executorNode",
        position: { x: 800, y: 150 },
        data: { presetId: "CreateVideoTaskNode" },
      },
    ]);
    setEdges([
      {
        id: `e-${promptId}-${payloadId}`,
        source: promptId,
        target: payloadId,
        ...defaultEdgeOptions,
      },
      {
        id: `e-${settingsId}-${payloadId}`,
        source: settingsId,
        target: payloadId,
        ...defaultEdgeOptions,
      },
      {
        id: `e-${payloadId}-${taskId}`,
        source: payloadId,
        target: taskId,
        ...defaultEdgeOptions,
      },
    ]);
    setSelectedEdge(null);
  }, [setNodes, setEdges]);
  const validationResult = useMemo(() => {
    return buildVideoPayloadFromGraph(nodes, edges);
  }, [nodes, edges]);
  const handleRun = useCallback(() => {
    if (!generateTool || !project) return;
    if (!validationResult.ok) {
      setValidationError(validationResult.errors?.join("\\n") || "配置错误");
      onShowError?.();
      setTimeout(() => setValidationError(null), 3000);
      return;
    }
    void onCallTool(generateTool.name, validationResult.payload!);
  }, [validationResult, generateTool, project, onCallTool, onShowError]);
  // Inject callbacks into nodes
  const nodesWithCallbacks = useMemo(() => {
    // Find payload nodes for live stats
    const prevMap = new Map<string, Node[]>();
    for (const e of edges) {
      if (!prevMap.has(e.target)) prevMap.set(e.target, []);
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (sourceNode) prevMap.get(e.target)!.push(sourceNode);
    }
    return nodes.map((n) => {
      const handlePreviewMedia = (asset: PreviewMedia) => {
        const completeAsset =
          asset.relativePath !== undefined
            ? allAssets.find((item) => item.relativePath === asset.relativePath)
            : undefined;
        if (completeAsset) {
          onPreviewMedia?.(completeAsset);
          if (completeAsset.assetType !== "audio") return;
        }
        setPreviewMedia(asset);
      };
      const base = { ...n, data: { ...n.data, onDelete: handleDeleteNode } };
      if (
        n.type === "textNode" ||
        n.type === "mediaNode" ||
        n.type === "settingsNode" ||
        n.type === "resultNode"
      ) {
        return {
          ...base,
          data: {
            ...base.data,
            onChange: handleNodeDataChange,
            allAssets,
            project,
            busy:
              n.type === "resultNode"
                ? activeGenerationTask !== undefined || isCloudVideoRunning
                : Boolean(n.data?.["busy"]),
            isCloudVideoRunning,
            onPreviewMedia: handlePreviewMedia,
            onAssetDrop: (id: string, assetPath: string) => {
              const asset = allAssets.find((a) => a.relativePath === assetPath);
              const targetNode = nodes.find((node) => node.id === id);
              const preset = targetNode
                ? getPresetById(targetNode.data.presetId as string)
                : undefined;
              if (!asset || !project || !preset) return;
              if (preset.category === "image" && asset.assetType !== "image") {
                setValidationError("这个节点只能接收图片素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }
              if (preset.category === "video" && asset.assetType !== "video") {
                setValidationError("这个节点只能接收视频素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }
              if (preset.category === "audio" && asset.assetType !== "audio") {
                setValidationError("这个节点只能接收音频素材");
                setTimeout(() => setValidationError(null), 3000);
                return;
              }
              if (asset && project) {
                updateNodeData(id, {
                  relativePath: asset.relativePath,
                  fileName: asset.fileName,
                  url: assetPreviewUrl(project.id, asset.relativePath),
                });
              }
            },
          },
        };
      }
      if (
        n.type === "collectorNode" &&
        n.data.presetId === "MultiModalPayloadNode"
      ) {
        // Collect stats
        let promptCount = 0;
        let imagesCount = 0;
        let videosCount = 0;
        let audiosCount = 0;
        let settingsCount = 0;
        let error = null;
        const executor = nodes.find(
          (node) =>
            node.type === "executorNode" &&
            node.data.presetId === "CreateVideoTaskNode",
        );
        const directPrevs = executor ? prevMap.get(executor.id) || [] : [n];
        const visited = new Set<string>();
        const traverse = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const prevs = prevMap.get(nodeId) || [];
          for (const p of prevs) {
            const preset = getPresetById(p.data.presetId as string);
            if (preset?.category === "prompt" && p.data.text) promptCount++;
            if (preset?.category === "image") imagesCount++;
            if (preset?.category === "video") videosCount++;
            if (preset?.category === "audio") audiosCount++;
            if (preset?.category === "settings") settingsCount++;
            traverse(p.id);
          }
        };
        for (const inputNode of directPrevs) {
          const preset = getPresetById(inputNode.data.presetId as string);
          if (preset?.category === "prompt" && inputNode.data.text)
            promptCount++;
          if (preset?.category === "image") imagesCount++;
          if (preset?.category === "video") videosCount++;
          if (preset?.category === "audio") audiosCount++;
          if (preset?.category === "settings") settingsCount++;
          traverse(inputNode.id);
        }
        if (imagesCount > 9) error = "最多 9 张图片";
        else if (videosCount > 3) error = "最多 3 个视频";
        else if (audiosCount > 3) error = "最多 3 个音频";
        else if (audiosCount > 0 && imagesCount === 0)
          error = "缺少必需的图片参考";
        return {
          ...base,
          data: {
            ...base.data,
            promptCount,
            imagesCount,
            videosCount,
            audiosCount,
            settingsCount,
            error,
          },
        };
      }
      if (n.type === "executorNode") {
        return {
          ...base,
          data: {
            ...base.data,
            onRun: handleRun,
            busy: activeGenerationTask !== undefined || isCloudVideoRunning,
            isCloudVideoRunning,
          },
        };
      }
      return base;
    });
  }, [
    nodes,
    edges,
    handleNodeDataChange,
    updateNodeData,
    handleRun,
    handleDeleteNode,
    activeGenerationTask,
    isCloudVideoRunning,
    allAssets,
    project,
    onPreviewMedia,
  ]);
  const edgesWithCallbacks = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      selected: selectedEdge === e.id ? true : e.selected,
      data: { ...e.data, onDelete: handleDeleteEdge },
    }));
  }, [edges, handleDeleteEdge, selectedEdge]);
  const previewMediaSrc =
    previewMedia && project
      ? previewMedia.relativePath
        ? assetPreviewUrl(project.id, previewMedia.relativePath)
        : previewMedia.url
      : undefined;
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, type: "custom" }, eds)),
    [setEdges],
  );
  // Drag and Drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // Check if dropped file is JSON
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        if (file.name.endsWith(".json")) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const flowData = JSON.parse(e.target?.result as string);
              if (
                flowData &&
                Array.isArray(flowData.nodes) &&
                Array.isArray(flowData.edges)
              ) {
                setNodes(flowData.nodes);
                setEdges(flowData.edges);
                setTimeout(() => reactFlow.fitView(), 50);
              }
            } catch (err) {
              console.error("Invalid JSON flow file", err);
            }
          };
          reader.readAsText(file);
          return;
        }
      }
      if (!wrapperRef.current) return;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      // Check if dropped from Node Library
      const plainDragData = event.dataTransfer.getData("text/plain");
      const presetId =
        event.dataTransfer.getData("application/reactflow") ||
        (plainDragData.startsWith("taptap-node-preset:")
          ? plainDragData.slice("taptap-node-preset:".length)
          : "") ||
        window.__taptapNodePresetDrag ||
        "";
      if (presetId) {
        window.__taptapNodePresetDrag = undefined;
        addNodeFromPreset(presetId, position);
        return;
      }
      // Check if dropped from Asset Library
      if (!project) return;
      const relativePath = readAssetDragPath(event.dataTransfer);
      if (!relativePath) return;
      const asset = allAssets.find((a) => a.relativePath === relativePath);
      if (!asset) return;
      let presetIdMap = "";
      if (asset.assetType === "image") presetIdMap = "GenericImageNode";
      else if (asset.assetType === "video") presetIdMap = "GenericVideoNode";
      else if (asset.assetType === "audio") presetIdMap = "GenericAudioNode";
      else return;
      const preset = getPresetById(presetIdMap);
      const newNode: Node = {
        id: `ref-${Math.random().toString(36).substr(2, 9)}`,
        type: "mediaNode",
        position,
        data: {
          presetId: presetIdMap,
          ...(preset?.defaultData || {}),
          relativePath: asset.relativePath,
          fileName: asset.fileName,
          url: assetPreviewUrl(project.id, asset.relativePath),
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlow, setNodes, project, allAssets],
  );
  const onCanvasDropCapture = useCallback(
    (event: React.DragEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-flow-media-dropzone]")
      ) {
        return;
      }
      onDrop(event);
    },
    [onDrop],
  );
  const createNodeFromPreset = useCallback(
    (preset: NodePreset, position: { x: number; y: number }) => {
      let type = "";
      if (preset.category === "prompt") type = "textNode";
      else if (["image", "video", "audio"].includes(preset.category))
        type = "mediaNode";
      else if (preset.category === "settings") type = "settingsNode";
      else if (preset.category === "collector") type = "collectorNode";
      else if (preset.category === "executor") {
        if (preset.id === "VideoResultNode") type = "resultNode";
        else type = "executorNode";
      } else if (preset.category === "utility") type = "executorNode";
      const baseNode: Node = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        position,
        data: { presetId: preset.id, ...preset.defaultData },
      };
      return baseNode;
    },
    [],
  );
  const addNodeFromPreset = useCallback(
    (presetId: string, position: { x: number; y: number }) => {
      const preset = getPresetById(presetId);
      if (!preset) return;
      const baseNode = createNodeFromPreset(preset, position);
      if (baseNode.type === "resultNode") {
        const executor = reactFlow
          .getNodes()
          .find((n) => n.type === "executorNode");
        if (executor) {
          setEdges((eds) => [
            ...eds,
            {
              id: `e-${executor.id}-${baseNode.id}`,
              source: executor.id,
              target: baseNode.id,
              ...defaultEdgeOptions,
            },
          ]);
        }
      }
      setNodes((nds) => nds.concat(baseNode));
      setIsCanvasMenuOpen(false);
    },
    [createNodeFromPreset, reactFlow, setNodes, setEdges],
  );
  const addNodeAtMenuPosition = useCallback(
    (presetId: string) => {
      const position = reactFlow.screenToFlowPosition({
        x: menuTarget.screenX,
        y: menuTarget.screenY,
      });
      addNodeFromPreset(presetId, position);
    },
    [addNodeFromPreset, menuTarget.screenX, menuTarget.screenY, reactFlow],
  );
  const handleCopyNode = useCallback(
    (nodeId: string) => {
      const sourceNode = reactFlow.getNode(nodeId);
      if (!sourceNode) return;
      const newNode: Node = {
        ...sourceNode,
        id: `${sourceNode.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        selected: true,
        position: {
          x: sourceNode.position.x + 32,
          y: sourceNode.position.y + 32,
        },
        data: { ...sourceNode.data },
      };
      setNodes((nds) => [
        ...nds.map((node) => ({ ...node, selected: false })),
        newNode,
      ]);
      setIsCanvasMenuOpen(false);
    },
    [reactFlow, setNodes],
  );
  const handleToggleNodeCollapsed = useCallback(
    (nodeId: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, collapsed: !node.data.collapsed },
              }
            : node,
        ),
      );
      setIsCanvasMenuOpen(false);
    },
    [setNodes],
  );
  const handleShowPayloadPanel = useCallback(() => {
    setIsPayloadPanelOpen(true);
    setIsCanvasMenuOpen(false);
  }, []);
  const handleCopyNodeRawResult = useCallback(
    (nodeId: string) => {
      const node = reactFlow.getNode(nodeId);
      const rawResult = node?.data.rawResult ?? {
        nodeId,
        rawResult: null,
        note: "该节点当前没有 raw result。",
      };
      copyText(JSON.stringify(rawResult, null, 2));
      setIsCanvasMenuOpen(false);
    },
    [copyText, reactFlow],
  );
  const handleCopyConnectionData = useCallback(
    (edgeId: string) => {
      const edge = reactFlow.getEdge(edgeId);
      if (!edge) return;
      copyText(JSON.stringify(edge, null, 2));
      setIsCanvasMenuOpen(false);
    },
    [copyText, reactFlow],
  );
  const handleInsertNodeIntoEdge = useCallback(
    (edgeId: string, presetId: string) => {
      const edge = reactFlow.getEdge(edgeId);
      const preset = getPresetById(presetId);
      if (!edge || !preset) return;
      const sourceNode = reactFlow.getNode(edge.source);
      const targetNode = reactFlow.getNode(edge.target);
      const fallbackPosition = reactFlow.screenToFlowPosition({
        x: menuTarget.screenX,
        y: menuTarget.screenY,
      });
      const position =
        sourceNode && targetNode
          ? {
              x: (sourceNode.position.x + targetNode.position.x) / 2,
              y: (sourceNode.position.y + targetNode.position.y) / 2,
            }
          : fallbackPosition;
      const newNode = createNodeFromPreset(preset, position);
      setNodes((nds) => nds.concat(newNode));
      setEdges((eds) => [
        ...eds.filter((currentEdge) => currentEdge.id !== edgeId),
        {
          ...defaultEdgeOptions,
          id: `e-${edge.source}-${newNode.id}`,
          source: edge.source,
          sourceHandle: edge.sourceHandle,
          target: newNode.id,
        },
        {
          ...defaultEdgeOptions,
          id: `e-${newNode.id}-${edge.target}`,
          source: newNode.id,
          target: edge.target,
          targetHandle: edge.targetHandle,
        },
      ]);
      setSelectedEdge(null);
      setIsCanvasMenuOpen(false);
    },
    [
      createNodeFromPreset,
      menuTarget.screenX,
      menuTarget.screenY,
      reactFlow,
      setEdges,
      setNodes,
    ],
  );
  const handleRunNode = useCallback(
    (nodeId: string) => {
      const node = reactFlow.getNode(nodeId);
      if (node?.type === "executorNode") handleRun();
      else handleShowPayloadPanel();
    },
    [handleRun, handleShowPayloadPanel, reactFlow],
  );
  useEffect(() => {
    const runCommand = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          action: string;
          nodeId?: string;
          edgeId?: string;
        }>
      ).detail;
      if (!detail) return;
      if (detail.action === "fitView") {
        void reactFlow.fitView({ padding: 0.18, duration: 180 });
        return;
      }
      if (detail.action === "selectAll") {
        selectAllCanvasElements();
        return;
      }
      if (detail.action === "toggleGrid") {
        setSnapToGrid((value) => !value);
        return;
      }
      if (detail.action === "clear") {
        handleClearCanvas();
        return;
      }
      if (detail.action === "copyNode" && detail.nodeId) {
        handleCopyNode(detail.nodeId);
        return;
      }
      if (detail.action === "deleteNode" && detail.nodeId) {
        handleDeleteNode(detail.nodeId);
        return;
      }
      if (detail.action === "runNode" && detail.nodeId) {
        handleRunNode(detail.nodeId);
        return;
      }
      if (detail.action === "toggleNodeCollapse" && detail.nodeId) {
        handleToggleNodeCollapsed(detail.nodeId);
        return;
      }
      if (detail.action === "deleteEdge" && detail.edgeId) {
        handleDeleteEdge(detail.edgeId);
        return;
      }
      if (detail.action === "showEdgePayload" && detail.edgeId) {
        handleCopyConnectionData(detail.edgeId);
      }
    };
    window.addEventListener("taptap:video-flow-command", runCommand);
    return () =>
      window.removeEventListener("taptap:video-flow-command", runCommand);
  }, [
    handleClearCanvas,
    handleCopyConnectionData,
    handleCopyNode,
    handleDeleteEdge,
    handleDeleteNode,
    handleRunNode,
    handleToggleNodeCollapsed,
    reactFlow,
    selectAllCanvasElements,
    setSnapToGrid,
  ]);
  const closeCanvasMenu = useCallback(() => {
    setIsCanvasMenuOpen(false);
    setSubmenuState(null);
  }, []);
  const getViewportSize = useCallback(() => {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  }, []);
  const getSubmenuPosition = useCallback(
    (
      element: HTMLElement,
      estimatedWidth = 180,
      height = 420,
      preferredDirection?: "left" | "right",
    ) => {
      const menuContainer = element.closest('.context-menu-container') as HTMLElement;
      const rect = (menuContainer || element).getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const viewport = getViewportSize();
      const GAP = 0;
      const canOpenRight = rect.right + estimatedWidth + GAP <= viewport.width;
      const canOpenLeft = rect.left - estimatedWidth - GAP >= 0;
      let direction: "left" | "right" = "right";
      if (preferredDirection === "left" && canOpenLeft) direction = "left";
      else if (preferredDirection === "right" && canOpenRight) direction = "right";
      else if (canOpenRight) direction = "right";
      else if (canOpenLeft) direction = "left";
      else direction = "right";
      const top = Math.min(elementRect.top, Math.max(4, viewport.height - height - 4));
      if (direction === "right") {
        return { direction, left: rect.right + GAP, top };
      } else {
        return { direction, right: viewport.width - rect.left + GAP, top };
      }
    },
    [getViewportSize],
  );
  const showRootSubmenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, mode: "add" | "insert") => {
      const activeGroupCount = Object.values(CATEGORY_GROUPS).filter(
        (g) => g.items.length > 0,
      ).length;
      const estimatedHeight = activeGroupCount * 32 + 12;
      const position = getSubmenuPosition(event.currentTarget, 180, estimatedHeight);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setSubmenuState({ kind: "root", mode, ...position });
      }, 150);
    },
    [getSubmenuPosition],
  );
  const showCategorySubmenu = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      mode: "add" | "insert",
      categoryKey: string,
    ) => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      const currentTarget = event.currentTarget;
      hoverTimeoutRef.current = setTimeout(() => {
        setSubmenuState((current) => {
          const prefDir = current?.direction ?? "right";
          const group = CATEGORY_GROUPS[categoryKey as keyof typeof CATEGORY_GROUPS];
          const estimatedHeight = group ? group.items.length * 32 + 12 : 360;
          const position = getSubmenuPosition(currentTarget, 180, estimatedHeight, prefDir);
          return {
            kind: "category",
            mode,
            categoryKey,
            rootLeft:
              current?.kind === "category"
                ? current.rootLeft
                : current?.left ?? position.left,
            rootRight:
              current?.kind === "category"
                ? current.rootRight
                : current?.right ?? position.right,
            rootTop:
              current?.kind === "category"
                ? current.rootTop
                : current?.top ?? position.top,
            rootDirection:
              current?.kind === "category"
                ? current.rootDirection
                : current?.direction ?? position.direction,
            ...position,
          };
        });
      }, 150);
    },
    [getSubmenuPosition, submenuState?.direction],
  );
  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
  }, []);
  const onNodeContextMenu = useCallback((event: any, _node: Node) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);
  const onEdgeContextMenu = useCallback((event: any, _edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);
  const onNodeClick = useCallback(() => {
    setSelectedEdge(null);
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
    setIsCanvasMenuOpen(false);
  }, [setEdges]);
  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
    setIsCanvasMenuOpen(false);
  }, [setEdges]);
  const activeMenuNode =
    menuTarget.kind === "node"
      ? nodes.find((node) => node.id === menuTarget.nodeId)
      : undefined;
  const activeMenuEdge =
    menuTarget.kind === "edge"
      ? edges.find((edge) => edge.id === menuTarget.edgeId)
      : undefined;
  const viewportSize = getViewportSize();
  const menuContentClasses = ContextMenuStyles.content;
  const submenuContentClasses = ContextMenuStyles.content;
  const menuItemClasses = ContextMenuStyles.item;
  const disabledMenuItemClasses = ContextMenuStyles.disabledItem;
  const menuSeparatorClasses = ContextMenuStyles.separator;
  const selectPresetFromSubmenu = useCallback(
    (presetId: string) => {
      if (submenuState?.mode === "insert" && activeMenuEdge) {
        handleInsertNodeIntoEdge(activeMenuEdge.id, presetId);
        return;
      }
      addNodeAtMenuPosition(presetId);
    },
    [
      activeMenuEdge,
      addNodeAtMenuPosition,
      handleInsertNodeIntoEdge,
      submenuState?.mode,
    ],
  );
  const activeSubmenuGroup =
    submenuState?.kind === "category"
      ? CATEGORY_GROUPS[submenuState.categoryKey as keyof typeof CATEGORY_GROUPS]
      : null;
  return (
    <div
      className="flex h-full w-full bg-surface-app relative"
      ref={wrapperRef}
    >
      <NodeLibraryDrawer
        isOpen={isDrawerOpen}
        project={project}
        onLoaded={(data) => {
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          if (data.viewport) reactFlow.setViewport(data.viewport);
        }}
      />
      <div
        className="flex-1 relative min-w-0 transition-all duration-300"
        onDragOverCapture={onDragOver}
        onDropCapture={onCanvasDropCapture}
      >
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edgesWithCallbacks}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionLineStyle={{
            stroke: "#00D9C5",
            strokeWidth: 2,
            filter: "drop-shadow(0 0 8px rgba(0,217,197,0.5))",
          }}
          fitView
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          className="video-flow-canvas bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          <Background
            color="#9ca3af"
            variant={"dots" as any}
            gap={24}
            size={1.5}
            className="opacity-40"
          />
          <Controls />
          <Panel
            position="top-left"
            className="flex flex-wrap items-start justify-between w-[calc(100%-16px)] pointer-events-none mt-2 ml-2 mr-2 z-50 gap-2"
          >
            {/* Left Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-surface-panel/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border pointer-events-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-surface-app"
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              >
                <LibrarySquare className="w-4 h-4 mr-1.5 text-brand" />
                {isDrawerOpen ? "收起节点与布局" : "展开节点与布局"}
              </Button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 text-xs",
                  snapToGrid
                    ? "bg-brand/10 text-brand border-brand/30 hover:bg-brand/20"
                    : "bg-surface-app text-text-subtle hover:text-text",
                )}
                onClick={() => setSnapToGrid(!snapToGrid)}
              >
                <Boxes className="w-4 h-4 mr-1.5" />
                网格吸附
              </Button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-brand/10 text-brand border-brand/30 hover:bg-brand/20"
                onClick={handleApplyTemplate}
              >
                一键模板
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-surface-app"
                onClick={handleClearCanvas}
              >
                清空画布
              </Button>
            </div>
            {/* Right Payload */}
            <div className="flex flex-col items-end gap-2 pointer-events-none ml-auto mr-14">
              <div className="flex items-center gap-2 pointer-events-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 max-w-[150px] gap-1.5 overflow-hidden px-2.5 text-xs bg-surface-panel/90 backdrop-blur-md shadow-lg border-border"
                  onClick={() => setIsPayloadPanelOpen(!isPayloadPanelOpen)}
                >
                  <Activity className="w-4 h-4 shrink-0 text-brand" />
                  <span className="truncate">
                    {isPayloadPanelOpen ? "收起 Payload" : "检查 Payload"}
                  </span>
                  {validationResult.errors.length > 0 && (
                    <span className="ml-1.5 w-2 h-2 rounded-full bg-[#b03939]" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-surface-panel/90 backdrop-blur-md shadow-lg border-border transition-transform duration-200 hover:scale-105 active:scale-95"
                  title={isFullscreen ? "退出全屏画布" : "全屏画布"}
                  aria-label={isFullscreen ? "退出全屏画布" : "全屏画布"}
                  onClick={onToggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-brand transition-transform duration-200 rotate-0 scale-100" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-brand transition-transform duration-200 rotate-0 scale-100" />
                  )}
                </Button>
              </div>
              {isPayloadPanelOpen && (
                <div className="bg-surface-panel/95 backdrop-blur-md p-3 rounded-xl shadow-lg border border-border w-80 max-h-[70vh] flex flex-col gap-3 overflow-hidden pointer-events-auto">
                  <div className="flex items-center gap-2 border-b border-border pb-2 shrink-0">
                    <Activity className="w-4 h-4 text-brand" />
                    <span className="text-xs font-bold">
                      Payload 预览与检查
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                    {validationResult.errors.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-[#b03939]">
                          错误 (阻断执行)
                        </span>
                        {validationResult.errors.map((err, i) => (
                          <div
                            key={i}
                            className="text-[10px] bg-[#b03939]/10 border border-[#b03939]/20 text-[#b03939] p-1.5 rounded flex items-start gap-1.5"
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="leading-tight">{err}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {validationResult.warnings.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-yellow-500">
                          警告 (建议修复)
                        </span>
                        {validationResult.warnings.map((warn, i) => (
                          <div
                            key={i}
                            className="text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-1.5 rounded flex items-start gap-1.5"
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="leading-tight">{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Quick Fixes */}
                    {(validationResult.errors.length > 0 ||
                      validationResult.warnings.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-1 pt-2 border-t border-border-soft">
                        <span className="text-[10px] font-bold text-text-subtle w-full mb-0.5">
                          快捷修复:
                        </span>
                        <button
                          onClick={() => {
                            setNodes((nds) =>
                              nds.filter((n) => {
                                if (
                                  [
                                    "GenericImageNode",
                                    "GenericVideoNode",
                                    "GenericAudioNode",
                                  ].includes(n.data.presetId as string)
                                ) {
                                  return !!(n.data.relativePath || n.data.url);
                                }
                                return true;
                              }),
                            );
                          }}
                          className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                        >
                          删除空素材
                        </button>
                        <button
                          onClick={() => {
                            setNodes((nds) =>
                              nds.map((n) => {
                                if (n.data.type === "seed")
                                  return {
                                    ...n,
                                    data: { ...n.data, value: "" },
                                  };
                                return n;
                              }),
                            );
                          }}
                          className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                        >
                          清空种子
                        </button>
                        <button
                          onClick={() => {
                            setNodes((nds) =>
                              nds.filter(
                                (n) =>
                                  ![
                                    "GenericImageNode",
                                    "GenericVideoNode",
                                    "GenericAudioNode",
                                  ].includes(n.data.presetId as string),
                              ),
                            );
                          }}
                          className="text-[9px] bg-surface-raised hover:bg-surface-muted text-text-muted px-2 py-1 rounded border border-border-soft transition-colors"
                        >
                          转为纯文生视频
                        </button>
                      </div>
                    )}
                    <CodeEditorPanel
                      title="最终 Payload (模拟)"
                      language="json"
                      value={
                        validationResult.payload
                          ? JSON.stringify(validationResult.payload, null, 2)
                          : ""
                      }
                      emptyText="无法生成 Payload (请先修复错误)"
                      maxHeight="240px"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </Panel>
          <Panel position="bottom-right" className="pointer-events-auto mb-9">
            {isMiniMapOpen && (
              <MiniMap
                className="bg-surface-panel border-border-soft"
                bgColor="var(--surface-panel)"
                nodeColor={(n) => {
                  if (n.type === "executorNode") return "#00D9C5";
                  if (n.type === "settingsNode")
                    return "var(--color-text-subtle)";
                  return "var(--color-text-muted)";
                }}
                maskColor="var(--surface-app)"
              />
            )}
          </Panel>
          <Panel position="bottom-right" className="pointer-events-auto">
            <div className="flex items-end justify-end">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 bg-surface-panel/90 backdrop-blur-md shadow-lg border-border"
                title={isMiniMapOpen ? "收起小地图" : "展开小地图"}
                aria-label={isMiniMapOpen ? "收起小地图" : "展开小地图"}
                onClick={() => setIsMiniMapOpen((value) => !value)}
              >
                <MapIcon className="h-3.5 w-3.5 text-brand" />
              </Button>
            </div>
          </Panel>
        </ReactFlow>
        {validationError && (
          <div className="fixed top-12 left-1/2 -translate-x-1/2 bg-red-500/95 text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_20px_40px_rgba(239,68,68,0.4)] z-[9999] animate-in slide-in-from-top-4 fade-in pointer-events-none">
            <AlertCircle className="w-5 h-5" />
            <span className="text-[14px] font-bold">{validationError}</span>
          </div>
        )}
        {clearConfirmOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setClearConfirmOpen(false)}
          >
            <div
              className="w-[min(420px,92vw)] rounded-2xl border border-border bg-surface-panel p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-150"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 text-sm font-bold text-text">清空当前画布？</h3>
                  <p className="m-0 mt-2 text-xs leading-5 text-text-subtle">
                    将删除当前画布里的所有节点和连线。这个操作不会删除资产文件。
                  </p>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearConfirmOpen(false)}
                >
                  取消
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-red-500 text-white hover:bg-red-600"
                  onClick={clearCanvas}
                >
                  清空画布
                </Button>
              </div>
            </div>
          </div>
        )}
        {previewMedia && previewMediaSrc && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
            onClick={() => setPreviewMedia(null)}
          >
            {previewMedia.assetType === "audio" ? (
              <div
                className="flex w-[min(560px,90vw)] flex-col gap-4 rounded-2xl border border-white/10 bg-surface-panel/95 p-5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-text">
                    {previewMedia.fileName}
                  </div>
                  <div className="mt-1 truncate text-xs text-text-subtle">
                    {previewMedia.relativePath}
                  </div>
                </div>
                <audio
                  src={previewMediaSrc}
                  controls
                  autoPlay
                  controlsList="nodownload"
                  className="w-full"
                />
              </div>
            ) : (
              <video
                src={previewMediaSrc}
                controls
                autoPlay
                controlsList="nodownload"
                className="max-h-[95vh] max-w-[95vw] rounded-xl bg-black object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </div>
        )}
        {isCanvasMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-[9998]"
              data-local-context-menu
              onPointerDown={() => closeCanvasMenu()}
              onContextMenu={(event) => {
                event.preventDefault();
                closeCanvasMenu();
              }}
              onWheel={() => closeCanvasMenu()}
            />
            <div
              className={cn(menuContentClasses, "fixed")}
              style={{
                left: menuTarget.screenX,
                top: menuTarget.screenY,
              }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
            {menuTarget.kind === "pane" && (
              <>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
                  画布
                </div>
                <div className={menuSeparatorClasses} />
                <div>
                  <button
                    type="button"
                    className={cn(
                      menuItemClasses,
                      submenuState?.mode === "add" && "bg-brand/15 text-brand-strong font-bold"
                    )}
                    onMouseEnter={(event) => showRootSubmenu(event, "add")}
                  >
                    <Plus className="h-4 w-4 opacity-70" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      新增节点
                    </span>
                    {submenuState?.mode === "add" && (submenuState.kind === "category" ? submenuState.rootDirection : submenuState.direction) === "left" ? (
                      <ChevronLeft className="h-4 w-4 opacity-50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={handleApplyTemplate}
                >
                  <Check className="h-4 w-4 opacity-70" />
                  <span className="font-medium">一键模板</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    void reactFlow.fitView({ padding: 0.18, duration: 180 });
                    closeCanvasMenu();
                  }}
                >
                  <Scan className="h-4 w-4 opacity-70" />
                  <span className="font-medium">适应画布</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    setNodes((nds) =>
                      nds.map((node) => ({ ...node, selected: true })),
                    );
                    setEdges((eds) =>
                      eds.map((edge) => ({ ...edge, selected: true })),
                    );
                    closeCanvasMenu();
                  }}
                >
                  <Check className="h-4 w-4 opacity-70" />
                  <span className="font-medium">全选画布元素</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    setSnapToGrid((value) => !value);
                    closeCanvasMenu();
                  }}
                >
                  <Boxes className="h-4 w-4 opacity-70" />
                  <span className="font-medium">
                    {snapToGrid ? "关闭网格吸附" : "开启网格吸附"}
                  </span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={handleShowPayloadPanel}
                >
                  <Activity className="h-4 w-4 opacity-70" />
                  <span className="font-medium">检查 Payload</span>
                </button>
                <button
                  type="button"
                  className={cn(menuItemClasses, "transition-transform active:scale-[0.98]")}
                  onClick={() => {
                    onToggleFullscreen?.();
                    closeCanvasMenu();
                  }}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4 opacity-70 transition-transform duration-200" />
                  ) : (
                    <Maximize2 className="h-4 w-4 opacity-70 transition-transform duration-200" />
                  )}
                  <span className="font-medium">
                    {isFullscreen ? "退出全屏画布" : "全屏画布"}
                  </span>
                </button>
                <div className={menuSeparatorClasses} />
                <button
                  type="button"
                  className={cn(
                    menuItemClasses,
                    "text-red-500 hover:bg-red-500/10 hover:text-red-400",
                  )}
                  onClick={handleClearCanvas}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="font-medium">清空画布</span>
                </button>
              </>
            )}
            {menuTarget.kind === "node" && activeMenuNode && (
              <>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
                  节点
                </div>
                <div className={menuSeparatorClasses} />
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => handleRunNode(activeMenuNode.id)}
                >
                  <Play className="h-4 w-4 opacity-70" />
                  <span className="font-medium">运行此节点</span>
                </button>
                <button type="button" className={disabledMenuItemClasses}>
                  <ChevronsRight className="h-4 w-4 opacity-50" />
                  <span className="font-medium">运行到此节点</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => handleCopyNode(activeMenuNode.id)}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制节点</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => handleToggleNodeCollapsed(activeMenuNode.id)}
                >
                  <Eye className="h-4 w-4 opacity-70" />
                  <span className="font-medium">
                    {activeMenuNode.data.collapsed ? "展开节点" : "收起节点"}
                  </span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    copyText(activeMenuNode.id);
                    closeCanvasMenu();
                  }}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制节点 ID</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={handleShowPayloadPanel}
                >
                  <Activity className="h-4 w-4 opacity-70" />
                  <span className="font-medium">查看输入 payload</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => handleCopyNodeRawResult(activeMenuNode.id)}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制输出 raw result</span>
                </button>
                <div className={menuSeparatorClasses} />
                <button
                  type="button"
                  className={cn(
                    menuItemClasses,
                    "text-red-500 hover:bg-red-500/10 hover:text-red-400",
                  )}
                  onClick={() => {
                    handleDeleteNode(activeMenuNode.id);
                    closeCanvasMenu();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="font-medium">删除节点</span>
                </button>
              </>
            )}
            {menuTarget.kind === "edge" && activeMenuEdge && (
              <>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
                  连线
                </div>
                <div className={menuSeparatorClasses} />
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    copyText(activeMenuEdge.id);
                    closeCanvasMenu();
                  }}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制连线 ID</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => handleCopyConnectionData(activeMenuEdge.id)}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">查看连接数据</span>
                </button>
                <div>
                  <button
                    type="button"
                    className={cn(
                      menuItemClasses,
                      submenuState?.mode === "insert" && "bg-brand/15 text-brand-strong font-bold"
                    )}
                    onMouseEnter={(event) => showRootSubmenu(event, "insert")}
                  >
                    <CornerDownRight className="h-4 w-4 opacity-70" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      插入节点到此连线
                    </span>
                    {submenuState?.mode === "insert" && (submenuState.kind === "category" ? submenuState.rootDirection : submenuState.direction) === "left" ? (
                      <ChevronLeft className="h-4 w-4 opacity-50" />
                    ) : (
                      <ChevronRight className="h-4 w-4 opacity-50" />
                    )}
                  </button>
                </div>
                <div className={menuSeparatorClasses} />
                <button
                  type="button"
                  className={cn(
                    menuItemClasses,
                    "text-red-500 hover:bg-red-500/10 hover:text-red-400",
                  )}
                  onClick={() => {
                    handleDeleteEdge(activeMenuEdge.id);
                    closeCanvasMenu();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="font-medium">删除连线</span>
                </button>
              </>
            )}
            </div>
          </>
        )}
        {isCanvasMenuOpen && submenuState && (
          <div
            className={cn(submenuContentClasses, "fixed")}
            style={{
              left:
                submenuState.kind === "category"
                  ? submenuState.rootLeft
                  : submenuState.left,
              right:
                submenuState.kind === "category"
                  ? submenuState.rootRight
                  : submenuState.right,
              top:
                submenuState.kind === "category"
                  ? submenuState.rootTop
                  : submenuState.top,
            }}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {Object.entries(CATEGORY_GROUPS).map(([key, group]) => {
              if (group.items.length === 0) return null;
              return (
                <button
                  type="button"
                  key={key}
                  className={cn(
                    menuItemClasses,
                    submenuState?.kind === "category" && submenuState.categoryKey === key && "bg-brand/15 text-brand-strong font-bold"
                  )}
                  onMouseEnter={(event) =>
                    showCategorySubmenu(event, submenuState.mode, key)
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {group.label}
                  </span>
                  {submenuState?.kind === "category" && submenuState.categoryKey === key && submenuState.direction === "left" ? (
                    <ChevronLeft className="h-4 w-4 opacity-50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-50" />
                  )}
                </button>
              );
            })}
          </div>
        )}
        {isCanvasMenuOpen &&
          submenuState?.kind === "category" &&
          activeSubmenuGroup && (
            <div
              className={cn(
                submenuContentClasses,
                "fixed max-h-[min(360px,calc(100vh-24px))]",
              )}
              style={{
                left: submenuState.left,
                right: submenuState.right,
                top: submenuState.top,
              }}
              onMouseEnter={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
              }}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              {activeSubmenuGroup.items.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    type="button"
                    key={preset.id}
                    className={menuItemClasses}
                    onClick={() => selectPresetFromSubmenu(preset.id)}
                  >
                    {Icon && <Icon className="w-4 h-4 opacity-70" />}
                    <span className="min-w-0 truncate font-medium">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
