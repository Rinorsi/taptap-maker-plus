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
  RefreshCw,
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
import { CanvasAudioPlayer } from "../../components/studio/CanvasAudioPlayer";
import {
  clampContextMenuPosition,
  CONTEXT_MENU_CLOSE_EVENT,
  CONTEXT_MENU_OPEN_EVENT,
  isEditableShortcutTarget,
  notifyContextMenuOpen,
  requestCommandRun,
  shouldIgnoreContextMenuEvent,
  shouldUseNativeContextMenu,
  type AppCommandContext,
} from "../../commands";
import { NodeLibraryDrawer } from "./NodeLibraryDrawer";
import { ResizablePanelHandle, useResizablePanelWidth } from "./ResizablePanelWidth";
import { getPresetById, getPresetGroupsForCanvas, type NodePreset, type NodePresetGroup } from "./nodeRegistry";
import { readAssetDragPath } from "./dragData";
import { parseStoryboardFile } from "./storyboardImport";
import {
  readStoredPreference,
  type CanvasAutoSavePreference,
  type CanvasGridPreference,
  type CanvasMiniMapPreference,
} from "../settings/preferences";
import {
  createSharedCanvasModel,
  createVideoReferenceTemplate,
  createUniversalCanvasTemplate,
  createCanvasStoragePayload,
  createCleanCanvasStoragePayload,
  cleanCanvasDataForStorage,
  cleanCanvasEdgeForStorage,
  cleanCanvasNodeForStorage,
  CANVAS_TRANSIENT_NODE_DATA_KEYS,
  executeCompiledCanvasTool,
  extractCanvasResultAssets,
  extractCanvasTaskId,
  migrateCanvasStoragePayload,
  normalizeCanvasEdges,
  type CanvasKind,
  getCanvasResultPresetForTool,
  getNodeAssetKind,
  nextAssetAlias,
  type CanvasCompileIssue,
  type CanvasAssetKind,
  type CanvasToolName,
} from "../canvas-core";
import {
  GenericTextNode,
  StoryboardTableNode,
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
  const normalizedNode = normalizeFlowNodeDimensions(node);
  return cleanCanvasNodeForStorage(normalizedNode);
}
function cleanFlowEdgeForStorage(edge: Edge): Edge {
  return cleanCanvasEdgeForStorage(edge);
}
const nodeTypes = {
  textNode: GenericTextNode,
  storyboardNode: StoryboardTableNode,
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
type FlowHistorySnapshot = {
  nodes: Node[];
  edges: Edge[];
};
const VIDEO_FLOW_RUN_SNAPSHOT_EVENT = "taptap:video-flow-run-snapshot";
type VideoFlowRunSnapshotDetail = {
  canvasKind: CanvasKind;
  nodes: Node[];
  edges: Edge[];
};
function createFlowHistorySnapshot(nodes: Node[], edges: Edge[]): FlowHistorySnapshot {
  return {
    nodes: normalizeFlowNodes(nodes).map(cleanFlowNodeForStorage),
    edges: normalizeFlowEdges(edges).map(cleanFlowEdgeForStorage),
  };
}
function getFlowHistorySignature(snapshot: FlowHistorySnapshot) {
  return JSON.stringify(snapshot);
}
function formatCompileIssues(issues: CanvasCompileIssue[]): string {
  return issues.map((issue) => issue.message).join("\n");
}
function issuesBySeverity(issues: CanvasCompileIssue[], severity: CanvasCompileIssue["severity"]) {
  return issues.filter((issue) => issue.severity === severity);
}
function getPromptNodeLabel(presetId: unknown) {
  const labels: Record<string, string> = {
    MainPromptNode: "导演提示词",
    CameraPromptNode: "镜头语言",
    MotionPromptNode: "动作描述",
    StylePromptNode: "风格描述",
    AtmospherePromptNode: "氛围描述",
    ConstraintPromptNode: "约束描述",
  };
  return labels[String(presetId ?? "")] ?? "";
}
function formatPromptNodeText(node: Node, text: string) {
  if (node.type === "storyboardNode") {
    const sourceName = typeof node.data?.sourceName === "string" ? node.data.sourceName.trim() : "";
    return sourceName ? `分镜表：${sourceName}\n${text}` : `分镜表：${text}`;
  }
  const label = getPromptNodeLabel(node.data?.presetId);
  return label ? `${label}：${text}` : text;
}
function assetTypeToCanvasKind(assetType: string): CanvasAssetKind {
  if (assetType === "image" || assetType === "video" || assetType === "audio" || assetType === "model") {
    return assetType;
  }
  return "unknown";
}
function collectDownstreamResultNodeIds(
  nodes: Node[],
  edges: Edge[],
  executorNodeId: string,
  resultPresetId?: string,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = nextMap.get(edge.source) ?? [];
    list.push(edge.target);
    nextMap.set(edge.source, list);
  }
  const resultIds = new Set<string>();
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    for (const nextId of nextMap.get(nodeId) ?? []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const node = byId.get(nextId);
      if (
        node?.type === "resultNode" &&
        (!resultPresetId || node.data.presetId === resultPresetId)
      ) {
        resultIds.add(nextId);
      }
      visit(nextId);
    }
  };
  visit(executorNodeId);
  return resultIds;
}
function findNearestUpstreamExecutorId(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const upstreamMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = upstreamMap.get(edge.target) ?? [];
    list.push(edge.source);
    upstreamMap.set(edge.target, list);
  }
  const visited = new Set<string>();
  const queue = [...(upstreamMap.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const node = byId.get(currentId);
    if (node?.type === "executorNode") return currentId;
    queue.push(...(upstreamMap.get(currentId) ?? []));
  }
  return undefined;
}
function findNearestDownstreamExecutorId(
  nodes: Node[],
  edges: Edge[],
  nodeId: string,
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const downstreamMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = downstreamMap.get(edge.source) ?? [];
    list.push(edge.target);
    downstreamMap.set(edge.source, list);
  }
  const visited = new Set<string>();
  const queue = [...(downstreamMap.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const node = byId.get(currentId);
    if (node?.type === "executorNode") return currentId;
    queue.push(...(downstreamMap.get(currentId) ?? []));
  }
  return undefined;
}
function resultKindToAssetType(value: unknown) {
  if (value === "image") return "image";
  if (value === "audio") return "audio";
  return "video";
}
function resultKindToRole(value: unknown): "image_result" | "audio_result" | "video_result" {
  if (value === "image") return "image_result";
  if (value === "audio") return "audio_result";
  return "video_result";
}
function isFlowNodeAwaitingGeneratedAsset(node: Node) {
  if (node.type === "executorNode" && node.data?.busy) return true;
  if (node.type !== "resultNode") return false;
  const resultAssets = Array.isArray(node.data.resultAssets)
    ? node.data.resultAssets
    : [];
  if (node.data.busy && resultAssets.length === 0) return true;
  return node.data.taskStatus === "running" || node.data.taskStatus === "querying";
}
function settleExecutorsForReadyResults(nodes: Node[], edges: Edge[], updatedAt: string) {
  const completedExecutorIds = new Set<string>();
  for (const node of nodes) {
    if (node.type !== "resultNode") continue;
    const resultAssets = Array.isArray(node.data.resultAssets)
      ? node.data.resultAssets
      : [];
    const hasReadyResult =
      resultAssets.length > 0 ||
      node.data.taskStatus === "result_ready" ||
      node.data.taskStatus === "completed" ||
      node.data.taskStatus === "completed_no_assets";
    if (!hasReadyResult) continue;
    const executorId = findNearestUpstreamExecutorId(nodes, edges, node.id);
    if (executorId) completedExecutorIds.add(executorId);
  }
  if (completedExecutorIds.size === 0) return nodes;
  let changed = false;
  const settledNodes = nodes.map((node) => {
    if (
      !completedExecutorIds.has(node.id) ||
      (!node.data?.busy && node.data?.taskStatus !== "running")
    ) {
      return node;
    }
    changed = true;
    return {
      ...node,
      data: {
        ...node.data,
        busy: false,
        taskStatus: "completed",
        updatedAt,
      },
    };
  });
  return changed ? settledNodes : nodes;
}
function replaceMentionAlias(text: string, previousAlias: string, nextAlias: string) {
  if (!previousAlias || previousAlias === nextAlias) return text;
  return text.replaceAll(`@${previousAlias}`, `@${nextAlias}`);
}
function getStoryboardImportPlacement(nodes: Node[]): StoryboardImportPlacement {
  const payloadNode = nodes.find(
    (node) => node.type === "collectorNode" && node.data?.presetId === "MultiModalPayloadNode",
  );
  if (payloadNode) {
    return {
      x: payloadNode.position.x - 360,
      y: payloadNode.position.y + 320,
      payloadNodeId: payloadNode.id,
    };
  }
  if (nodes.length === 0) return { x: 80, y: 80 };
  const minX = Math.min(...nodes.map((node) => node.position.x));
  const maxY = Math.max(...nodes.map((node) => node.position.y));
  return { x: minX, y: maxY + 260 };
}
function canImportStoryboardFile(file: File) {
  return /\.(txt|md|markdown|csv|tsv|xlsx|xls|docx)$/i.test(file.name);
}
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
type PayloadPanelTab = "json" | "sources" | "issues" | "raw" | "inspector";
const MEDIA_NODE_DIMENSIONS = { width: 360, height: 300, minWidth: 260, minHeight: 230, maxWidth: 520, maxHeight: 430 };
const SETTINGS_NODE_DIMENSIONS = { width: 260, height: 120, minWidth: 220, minHeight: 100, maxWidth: 420, maxHeight: 220 };
const LONG_TEXT_SETTINGS_NODE_DIMENSIONS = { width: 360, height: 190, minWidth: 280, minHeight: 160, maxWidth: 560, maxHeight: 360 };
const RESULT_NODE_DIMENSIONS = { width: 320, height: 240, minWidth: 260, minHeight: 190, maxWidth: 430, maxHeight: 340 };
const PAYLOAD_NODE_DIMENSIONS = { width: 340, height: 240, minWidth: 320, minHeight: 190, maxWidth: 420, maxHeight: 300 };
const PROMPT_COMPOSER_NODE_DIMENSIONS = { width: 480, height: 460, minWidth: 360, minHeight: 260, maxWidth: 760, maxHeight: 900 };
const STORYBOARD_NODE_DIMENSIONS = { width: 720, height: 420, minWidth: 420, minHeight: 300, maxWidth: 980, maxHeight: 720 };
function normalizeNodeDimension(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}
function normalizeFlowNodeDimensions(node: Node): Node {
  if (node.type === "storyboardNode") {
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        STORYBOARD_NODE_DIMENSIONS.width,
        STORYBOARD_NODE_DIMENSIONS.minWidth,
        STORYBOARD_NODE_DIMENSIONS.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        STORYBOARD_NODE_DIMENSIONS.height,
        STORYBOARD_NODE_DIMENSIONS.minHeight,
        STORYBOARD_NODE_DIMENSIONS.maxHeight,
      ),
    };
  }
  if (node.type === "mediaNode") {
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        MEDIA_NODE_DIMENSIONS.width,
        MEDIA_NODE_DIMENSIONS.minWidth,
        MEDIA_NODE_DIMENSIONS.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        MEDIA_NODE_DIMENSIONS.height,
        MEDIA_NODE_DIMENSIONS.minHeight,
        MEDIA_NODE_DIMENSIONS.maxHeight,
      ),
    };
  }
  if (node.type === "resultNode") {
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        RESULT_NODE_DIMENSIONS.width,
        RESULT_NODE_DIMENSIONS.minWidth,
        RESULT_NODE_DIMENSIONS.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        RESULT_NODE_DIMENSIONS.height,
        RESULT_NODE_DIMENSIONS.minHeight,
        RESULT_NODE_DIMENSIONS.maxHeight,
      ),
    };
  }
  if (node.type === "settingsNode") {
    const dimensions =
      node.data?.type === "style" || node.data?.type === "negativeTags"
        ? LONG_TEXT_SETTINGS_NODE_DIMENSIONS
        : SETTINGS_NODE_DIMENSIONS;
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        dimensions.width,
        dimensions.minWidth,
        dimensions.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        dimensions.height,
        dimensions.minHeight,
        dimensions.maxHeight,
      ),
    };
  }
  if (
    node.type === "collectorNode" &&
    node.data?.presetId === "MultiModalPayloadNode"
  ) {
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        PAYLOAD_NODE_DIMENSIONS.width,
        PAYLOAD_NODE_DIMENSIONS.minWidth,
        PAYLOAD_NODE_DIMENSIONS.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        PAYLOAD_NODE_DIMENSIONS.height,
        PAYLOAD_NODE_DIMENSIONS.minHeight,
        PAYLOAD_NODE_DIMENSIONS.maxHeight,
      ),
    };
  }
  if (
    node.type === "collectorNode" &&
    node.data?.presetId === "PromptComposerNode"
  ) {
    return {
      ...node,
      width: normalizeNodeDimension(
        node.width,
        PROMPT_COMPOSER_NODE_DIMENSIONS.width,
        PROMPT_COMPOSER_NODE_DIMENSIONS.minWidth,
        PROMPT_COMPOSER_NODE_DIMENSIONS.maxWidth,
      ),
      height: normalizeNodeDimension(
        node.height,
        PROMPT_COMPOSER_NODE_DIMENSIONS.height,
        PROMPT_COMPOSER_NODE_DIMENSIONS.minHeight,
        PROMPT_COMPOSER_NODE_DIMENSIONS.maxHeight,
      ),
    };
  }
  return node;
}
function normalizeFlowNodes(nodes: Node[] | undefined): Node[] {
  return (nodes ?? []).map(normalizeFlowNodeDimensions);
}
function normalizeFlowEdges(edges: Edge[] | undefined): Edge[] {
  return normalizeCanvasEdges(edges);
}
function createSemanticCanvasNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: node.data,
    width: node.width,
    height: node.height,
    position: { x: 0, y: 0 },
  }));
}
const semanticDataIdentity = new WeakMap<object, number>();
let semanticDataIdentityCounter = 0;
function getSemanticDataIdentity(data: unknown) {
  if (!data || typeof data !== "object") return String(data ?? "");
  const objectData = data as object;
  const existing = semanticDataIdentity.get(objectData);
  if (existing !== undefined) return existing;
  semanticDataIdentityCounter += 1;
  semanticDataIdentity.set(objectData, semanticDataIdentityCounter);
  return semanticDataIdentityCounter;
}
function createSemanticCanvasSignature(nodes: Node[], edges: Edge[]) {
  const nodeSignature = nodes
    .map((node) => `${node.id}:${node.type ?? ""}:${getSemanticDataIdentity(node.data)}`)
    .join("|");
  const edgeSignature = edges
    .map(
      (edge) =>
        `${edge.id}:${edge.source}:${edge.target}:${edge.sourceHandle ?? ""}:${edge.targetHandle ?? ""}`,
    )
    .join("|");
  return `${nodeSignature}::${edgeSignature}`;
}
function createCategoryGroups(canvasKind: "video-reference" | "universal") {
  return getPresetGroupsForCanvas(canvasKind);
}
type VideoFlowCanvasProps = {
  project?: ProjectSummary;
  allAssets: AssetSummary[];
  activeGenerationTask?: TaskRecord;
  isCloudVideoRunning?: boolean;
  generateTool?: ToolSummary;
  canvasTools?: ToolSummary[];
  canvasKind?: "video-reference" | "universal";
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onPreviewMedia?: (asset: AssetSummary) => void;
  onCallTool: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
  onShowError?: () => void;
  onRequestProjectRefresh?: () => void | Promise<void>;
  onCommandContextChange?: (context?: AppCommandContext) => void;
};
type PreviewMedia = {
  assetType: string;
  fileName: string;
  relativePath?: string;
  url?: string;
};
type InjectedNodeCacheEntry = {
  sourceNode: Node;
  injectedNode: Node;
  injectedData: Node["data"];
  signature: string;
  viewSignature: string;
};
declare global {
  interface Window {
    __taptapNodePresetDrag?: string;
  }
}
type StoryboardImportPlacement = {
  x: number;
  y: number;
  payloadNodeId?: string;
};
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
  canvasTools,
  canvasKind = "video-reference",
  isFullscreen,
  onToggleFullscreen,
  onPreviewMedia,
  onCallTool,
  onShowError,
  onRequestProjectRefresh,
  onCommandContextChange,
}: VideoFlowCanvasProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlow = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isPayloadPanelOpen, setIsPayloadPanelOpen] = useState(false);
  const [payloadPanelTab, setPayloadPanelTab] = useState<PayloadPanelTab>("json");
  const [isMiniMapOpen, setIsMiniMapOpen] = useState(() => (readStoredPreference("canvasMiniMap") as CanvasMiniMapPreference) === "visible");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [runningExecutorIds, setRunningExecutorIds] = useState<Set<string>>(new Set());
  const isAutoSavingRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const latestFlowRef = useRef<{
    nodes: Node[];
    edges: Edge[];
    canvasKind: CanvasKind;
    projectId?: string;
  }>({ nodes: [], edges: [], canvasKind });
  const undoStackRef = useRef<FlowHistorySnapshot[]>([]);
  const redoStackRef = useRef<FlowHistorySnapshot[]>([]);
  const lastHistorySignatureRef = useRef<string>("");
  const isRestoringHistoryRef = useRef(false);
  const runSelectedCanvasElementRef = useRef<() => void>(() => {});
  const injectedNodeCacheRef = useRef<Map<string, InjectedNodeCacheEntry>>(new Map());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [previousViewport, setPreviousViewport] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const [clipboard, setClipboard] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const clipboardRef = useRef<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const lastCanvasInteractionAtRef = useRef(0);
  const [menuTarget, setMenuTarget] = useState<CanvasMenuTarget>({
    kind: "pane",
    screenX: 0,
    screenY: 0,
  });
  const [isCanvasMenuOpen, setIsCanvasMenuOpen] = useState(false);
  const [submenuState, setSubmenuState] = useState<CanvasSubmenuState>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nodeDrawerWidth = useResizablePanelWidth({
    defaultWidth: 360,
    minWidth: 280,
    maxWidth: 560,
    side: "left",
  });
  const categoryGroups = useMemo(() => createCategoryGroups(canvasKind), [canvasKind]);
  const hasPendingGeneratedAsset = useMemo(
    () => runningExecutorIds.size > 0 || nodes.some(isFlowNodeAwaitingGeneratedAsset),
    [nodes, runningExecutorIds],
  );
  useEffect(() => {
    latestFlowRef.current = {
      nodes,
      edges,
      canvasKind,
      projectId: project?.id,
    };
  }, [canvasKind, edges, nodes, project?.id]);
  useEffect(() => {
    if (lastHistorySignatureRef.current) return;
    lastHistorySignatureRef.current = getFlowHistorySignature(
      createFlowHistorySnapshot(nodes, edges),
    );
  }, [edges, nodes]);
  const runnableTools = useMemo(() => {
    const entries: Array<[CanvasToolName, ToolSummary]> = [];
    const all = canvasTools ?? (generateTool ? [generateTool] : []);
    for (const tool of all) {
      if (
        tool.name === "generate_image" ||
        tool.name === "edit_image" ||
        tool.name === "create_video_task" ||
        tool.name === "text_to_music"
      ) {
        entries.push([tool.name, tool]);
      }
    }
    return new Map(entries);
  }, [canvasTools, generateTool]);

  const selectAllCanvasElements = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: true })));
  }, [setEdges, setNodes]);

  const restoreHistorySnapshot = useCallback(
    (snapshot: FlowHistorySnapshot) => {
      isRestoringHistoryRef.current = true;
      const normalizedNodes = normalizeFlowNodes(snapshot.nodes);
      const normalizedEdges = normalizeFlowEdges(snapshot.edges);
      setNodes(normalizedNodes);
      setEdges(normalizedEdges);
      setSelectedEdge(null);
      setIsCanvasMenuOpen(false);
      setSubmenuState(null);
      lastHistorySignatureRef.current = getFlowHistorySignature({
        nodes: normalizedNodes,
        edges: normalizedEdges,
      });
    },
    [setEdges, setNodes],
  );

  const pushCanvasHistorySnapshot = useCallback(() => {
    const snapshot = createFlowHistorySnapshot(
      latestFlowRef.current.nodes,
      latestFlowRef.current.edges,
    );
    const signature = getFlowHistorySignature(snapshot);
    const latestUndoSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (
      latestUndoSnapshot &&
      getFlowHistorySignature(latestUndoSnapshot) === signature
    )
      return;
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-80);
    redoStackRef.current = [];
    lastHistorySignatureRef.current = signature;
  }, []);

  const undoCanvasChange = useCallback(() => {
    const currentSnapshot = createFlowHistorySnapshot(
      latestFlowRef.current.nodes,
      latestFlowRef.current.edges,
    );
    const currentSignature = getFlowHistorySignature(currentSnapshot);
    let undoStack = undoStackRef.current;
    if (undoStack.length === 0) return;
    if (
      getFlowHistorySignature(undoStack[undoStack.length - 1]) ===
      currentSignature
    ) {
      undoStack = undoStack.slice(0, -1);
    }
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    undoStackRef.current = undoStack.slice(0, -1);
    redoStackRef.current = [currentSnapshot, ...redoStackRef.current].slice(0, 80);
    restoreHistorySnapshot(previous);
  }, [restoreHistorySnapshot]);

  const redoCanvasChange = useCallback(() => {
    const next = redoStackRef.current[0];
    if (!next) return;
    const currentSnapshot = createFlowHistorySnapshot(
      latestFlowRef.current.nodes,
      latestFlowRef.current.edges,
    );
    undoStackRef.current = [...undoStackRef.current, currentSnapshot].slice(-80);
    redoStackRef.current = redoStackRef.current.slice(1);
    restoreHistorySnapshot(next);
  }, [restoreHistorySnapshot]);

  const deleteSelectedCanvasElements = useCallback(() => {
    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    const selectedEdges = reactFlow
      .getEdges()
      .filter((edge) => edge.selected || edge.id === selectedEdge);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdgeIds = new Set(selectedEdges.map((edge) => edge.id));
    pushCanvasHistorySnapshot();
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
  }, [pushCanvasHistorySnapshot, reactFlow, selectedEdge, setEdges, setNodes]);

  const copySelectedCanvasElements = useCallback(() => {
    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    if (selectedNodes.length === 0) return;
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = reactFlow
      .getEdges()
      .filter(
        (edge) =>
          selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
      );
    const nextClipboard = { nodes: selectedNodes, edges: selectedEdges };
    clipboardRef.current = nextClipboard;
    setClipboard(nextClipboard);
  }, [reactFlow]);

  const pasteClipboardCanvasElements = useCallback(() => {
    const currentClipboard = clipboardRef.current;
    if (!currentClipboard) return;
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const idMap = new Map<string, string>();
    currentClipboard.nodes.forEach((node) => {
      const newId =
        node.type +
        "-" +
        Date.now() +
        Math.random().toString(36).slice(2, 6);
      idMap.set(node.id, newId);
      newNodes.push(
        normalizeFlowNodeDimensions({
          ...node,
          id: newId,
          selected: true,
          position: { x: node.position.x + 30, y: node.position.y + 30 },
        }),
      );
    });
    currentClipboard.edges.forEach((edge) => {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        newEdges.push(
          ...normalizeFlowEdges([
            {
              ...edge,
              id: "e" + idMap.get(edge.source) + "-" + idMap.get(edge.target),
              source: idMap.get(edge.source)!,
              target: idMap.get(edge.target)!,
              selected: true,
            },
          ]),
        );
      }
    });
    pushCanvasHistorySnapshot();
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      ...newNodes,
    ]);
    setEdges((currentEdges) => [
      ...currentEdges.map((edge) => ({ ...edge, selected: false })),
      ...newEdges,
    ]);
  }, [pushCanvasHistorySnapshot, setEdges, setNodes]);

  const cutSelectedCanvasElements = useCallback(() => {
    copySelectedCanvasElements();
    deleteSelectedCanvasElements();
  }, [copySelectedCanvasElements, deleteSelectedCanvasElements]);

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
      if (!wrapperRef.current) return;
      if (isEditableShortcutTarget(e.target) || isEditableShortcutTarget(document.activeElement)) return;
      const target = e.target as HTMLElement | null;
      const eventStartedInsideCanvas = Boolean(
        target && wrapperRef.current.contains(target),
      );
      const hasCanvasSelection =
        reactFlow.getNodes().some((node) => node.selected) ||
        reactFlow.getEdges().some((edge) => edge.selected) ||
        Boolean(selectedEdge);
      const key = e.key.toLowerCase();
      const isUndoRedoShortcut =
        (e.ctrlKey || e.metaKey) &&
        (key === "z" || key === "y");
      const isPasteShortcut = (e.ctrlKey || e.metaKey) && key === "v";
      const recentlyUsedCanvas =
        Date.now() - lastCanvasInteractionAtRef.current < 30000;
      if (eventStartedInsideCanvas || hasCanvasSelection) {
        lastCanvasInteractionAtRef.current = Date.now();
      }
      if (
        !eventStartedInsideCanvas &&
        !hasCanvasSelection &&
        !(recentlyUsedCanvas && (isUndoRedoShortcut || isPasteShortcut))
      )
        return;
      if (e.key === "Escape") {
        if (isCanvasMenuOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsCanvasMenuOpen(false);
          setSubmenuState(null);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === "z") {
        e.preventDefault();
        undoCanvasChange();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "z") ||
        ((e.ctrlKey || e.metaKey) && key === "y")
      ) {
        e.preventDefault();
        redoCanvasChange();
      } else if ((e.ctrlKey || e.metaKey) && key === "c") {
        e.preventDefault();
        copySelectedCanvasElements();
      } else if ((e.ctrlKey || e.metaKey) && key === "x") {
        e.preventDefault();
        cutSelectedCanvasElements();
      } else if ((e.ctrlKey || e.metaKey) && key === "v") {
        e.preventDefault();
        pasteClipboardCanvasElements();
      } else if ((e.ctrlKey || e.metaKey) && key === "a") {
        e.preventDefault();
        requestCommandRun("canvas.selectAll");
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
        const selectedEdges = reactFlow
          .getEdges()
          .filter((edge) => edge.selected || edge.id === selectedEdge);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          deleteSelectedCanvasElements();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        runSelectedCanvasElementRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    reactFlow,
    copySelectedCanvasElements,
    cutSelectedCanvasElements,
    deleteSelectedCanvasElements,
    pasteClipboardCanvasElements,
    isCanvasMenuOpen,
    selectedEdge,
    undoCanvasChange,
    redoCanvasChange,
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
      lastCanvasInteractionAtRef.current = Date.now();
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
  const saveCurrentFlow = useCallback(async () => {
    if ((readStoredPreference("canvasAutoSave") as CanvasAutoSavePreference) !== "on") return;
    const latest = latestFlowRef.current;
    const projectId = latest.projectId;
    if (!projectId || isAutoSavingRef.current) return;
    const viewport = reactFlow.getViewport();
    const data = createCanvasStoragePayload(
      { nodes: latest.nodes, edges: latest.edges, viewport },
      latest.canvasKind,
      cleanFlowNodeForStorage,
      cleanFlowEdgeForStorage,
    );
    if (data.nodes.length === 0) return;
    isAutoSavingRef.current = true;
    try {
      await autoSaveFlow(projectId, data);
    } catch (error) {
      console.warn("Failed to auto save flow", error);
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [reactFlow]);

  const saveFlowSnapshot = useCallback(
    async (snapshotNodes: Node[], snapshotEdges: Edge[]) => {
      if ((readStoredPreference("canvasAutoSave") as CanvasAutoSavePreference) !== "on") return;
      if (!project) return;
      const viewport = reactFlow.getViewport();
      const data = createCleanCanvasStoragePayload(
        { nodes: snapshotNodes, edges: snapshotEdges, viewport },
        canvasKind,
      );
      if (data.nodes.length === 0) return;
      try {
        await autoSaveFlow(project.id, data);
      } catch (error) {
        console.warn("Failed to save flow snapshot", error);
      }
    },
    [canvasKind, project, reactFlow],
  );

  const publishRunSnapshot = useCallback(
    (snapshotNodes: Node[], snapshotEdges: Edge[]) => {
      const payload = createCleanCanvasStoragePayload(
        { nodes: snapshotNodes, edges: snapshotEdges },
        canvasKind,
      );
      window.dispatchEvent(
        new CustomEvent<VideoFlowRunSnapshotDetail>(VIDEO_FLOW_RUN_SNAPSHOT_EVENT, {
          detail: {
            canvasKind,
            nodes: payload.nodes,
            edges: payload.edges,
          },
        }),
      );
    },
    [canvasKind],
  );

  useEffect(() => {
    const onRunSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<VideoFlowRunSnapshotDetail>).detail;
      if (!detail || detail.canvasKind !== canvasKind) return;
      setNodes(normalizeFlowNodes(detail.nodes));
      setEdges(normalizeFlowEdges(detail.edges));
    };
    window.addEventListener(VIDEO_FLOW_RUN_SNAPSHOT_EVENT, onRunSnapshot);
    return () => window.removeEventListener(VIDEO_FLOW_RUN_SNAPSHOT_EVENT, onRunSnapshot);
  }, [canvasKind, setEdges, setNodes]);
  useEffect(() => {
    if (!project || !onRequestProjectRefresh) return;
    if (!hasPendingGeneratedAsset) return;
    let disposed = false;
    const refresh = () => {
      if (disposed) return;
      void Promise.resolve(onRequestProjectRefresh()).catch(() => undefined);
    };
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [hasPendingGeneratedAsset, onRequestProjectRefresh, project]);
  useEffect(() => {
    if (!project || allAssets.length === 0) return;
    let changed = false;
    const updatedAt = new Date().toISOString();
    const resultNodes = nodes.map((node) => {
      if (node.type !== "resultNode") return node;
      const currentAssets = Array.isArray(node.data.resultAssets)
        ? node.data.resultAssets
        : [];
      if (!node.data.busy || currentAssets.length > 0) return node;
      const assetType = resultKindToAssetType(node.data.resultKind);
      const startedAt =
        typeof node.data.updatedAt === "string"
          ? Date.parse(node.data.updatedAt)
          : 0;
      const matchedAssets = allAssets
        .filter((asset) => asset.assetType === assetType)
        .filter((asset) => !startedAt || asset.mtimeMs >= startedAt - 5000)
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
      const latestAsset = matchedAssets[0];
      if (!latestAsset) return node;
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          busy: false,
          error: undefined,
          resultAssets: [
            {
              kind: assetType,
              role: resultKindToRole(node.data.resultKind),
              path: latestAsset.relativePath,
            },
          ],
          taskStatus: "result_ready",
          updatedAt,
        },
      };
    });
    const nextNodes = settleExecutorsForReadyResults(resultNodes, edges, updatedAt);
    if (!changed && nextNodes === resultNodes) return;
    setNodes(nextNodes);
    void saveFlowSnapshot(nextNodes, edges);
  }, [allAssets, edges, nodes, project, saveFlowSnapshot, setNodes]);
  useEffect(() => {
    if (!project || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    getFlow(project.id, "_autosave")
      .then((data) => {
        const flow = migrateCanvasStoragePayload(data, canvasKind);
        if (flow.nodes.length > 0 || flow.edges.length > 0) {
          setNodes(normalizeFlowNodes(flow.nodes));
          setEdges(normalizeFlowEdges(flow.edges));
          if (flow.viewport) reactFlow.setViewport(flow.viewport);
        }
      })
      .catch(() => {
        /* ignore, probably doesn't exist yet */
      });
  }, [canvasKind, project, setNodes, setEdges, reactFlow]);
  useEffect(() => {
    if (!project || !hasLoadedRef.current) return;
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void saveCurrentFlow();
    }, 1200);
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [edges, nodes, project, saveCurrentFlow]);
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      void saveCurrentFlow();
    };
  }, [saveCurrentFlow]);
  useEffect(() => {
    if (!isFullscreen) return;
    const timeout = window.setTimeout(() => {
      void reactFlow.fitView({ padding: 0.12, duration: 180 });
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [isFullscreen, reactFlow]);
  // Auto-save periodically as a fallback for long-running sessions.
  useEffect(() => {
    if (!project) return;
    const interval = setInterval(() => {
      void saveCurrentFlow();
    }, 30000);
    return () => clearInterval(interval);
  }, [project, saveCurrentFlow]);
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
    (id: string, key: string, value: unknown) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (key === "alias" && n.type === "textNode") {
            const sourceNode = nds.find((item) => item.id === id);
            const previousAlias =
              typeof sourceNode?.data?.alias === "string"
                ? sourceNode.data.alias.trim()
                : "";
            const nextAlias =
              typeof value === "string" ? value.trim() : String(value ?? "").trim();
            if (!previousAlias || !nextAlias || previousAlias === nextAlias) return n;
            const mentionTokens = Array.isArray(n.data?.mentionTokens)
              ? n.data.mentionTokens
              : [];
            const referencesRenamed = mentionTokens.some(
              (token) =>
                token &&
                typeof token === "object" &&
                (token as { nodeId?: unknown }).nodeId === id,
            );
            if (!referencesRenamed) return n;
            return {
              ...n,
              data: {
                ...n.data,
                text:
                  typeof n.data?.text === "string"
                    ? replaceMentionAlias(n.data.text, previousAlias, nextAlias)
                    : n.data?.text,
                mentionTokens: mentionTokens.map((token) =>
                  token &&
                  typeof token === "object" &&
                  (token as { nodeId?: unknown }).nodeId === id
                    ? { ...token, alias: nextAlias }
                    : token,
                ),
              },
            };
          }
          if (n.id !== id) return n;
          const nextData = { ...n.data, [key]: value };
          if (key === "presetId" && typeof value === "string") {
            const nextPreset = getPresetById(value);
            if (nextPreset?.defaultData.role) {
              nextData.role = nextPreset.defaultData.role;
              nextData.referenceUse = nextPreset.defaultData.role;
            }
          }
          return { ...n, data: nextData };
        }),
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
      lastCanvasInteractionAtRef.current = Date.now();
      pushCanvasHistorySnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [pushCanvasHistorySnapshot, setNodes, setEdges],
  );
  const handleDeleteEdge = useCallback(
    (id: string) => {
      lastCanvasInteractionAtRef.current = Date.now();
      pushCanvasHistorySnapshot();
      setEdges((eds) => eds.filter((e) => e.id !== id));
      setSelectedEdge((current) => (current === id ? null : current));
    },
    [pushCanvasHistorySnapshot, setEdges],
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
    pushCanvasHistorySnapshot();
    setNodes([]);
    setEdges([]);
    setSelectedEdge(null);
    setIsCanvasMenuOpen(false);
    setClearConfirmOpen(false);
  }, [pushCanvasHistorySnapshot, setEdges, setNodes]);
  const handleClearCanvas = useCallback(() => {
    if (nodes.length > 0 || edges.length > 0) {
      setClearConfirmOpen(true);
      setIsCanvasMenuOpen(false);
      return;
    }
    clearCanvas();
  }, [clearCanvas, edges.length, nodes.length]);
  const handleApplyTemplate = useCallback(() => {
    pushCanvasHistorySnapshot();
    const template =
      canvasKind === "universal"
        ? createUniversalCanvasTemplate()
        : createVideoReferenceTemplate();
    setNodes(normalizeFlowNodes(template.nodes));
    setEdges(normalizeFlowEdges(template.edges));
    setSelectedEdge(null);
  }, [canvasKind, pushCanvasHistorySnapshot, setEdges, setNodes]);
  const semanticCanvasSignature = useMemo(
    () => createSemanticCanvasSignature(nodes, edges),
    [edges, nodes],
  );
  const semanticNodes = useMemo(() => createSemanticCanvasNodes(nodes), [semanticCanvasSignature]);
  const sharedCanvasModel = useMemo(
    () => createSharedCanvasModel(semanticNodes, edges),
    [edges, semanticCanvasSignature, semanticNodes],
  );
  const references = sharedCanvasModel.references;
  const validationResult = sharedCanvasModel.compileResult;
  const validationErrors = useMemo(
    () => issuesBySeverity(validationResult.issues, "error"),
    [validationResult.issues],
  );
  const validationWarnings = useMemo(
    () => issuesBySeverity(validationResult.issues, "warning"),
    [validationResult.issues],
  );
  const focusNodeById = useCallback(
    (nodeId: string) => {
      const node = reactFlow.getNode(nodeId);
      if (!node) return;
      setPreviousViewport(reactFlow.getViewport());
      setNodes((current) =>
        current.map((item) => ({ ...item, selected: item.id === nodeId })),
      );
      void reactFlow.setCenter(
        node.position.x + ((node.width as number | undefined) ?? 220) / 2,
        node.position.y + ((node.height as number | undefined) ?? 160) / 2,
        { duration: 180, zoom: Math.max(reactFlow.getZoom(), 0.8) },
      );
    },
    [reactFlow, setNodes],
  );
  const importStoryboardFile = useCallback(
    async (file: File, position?: { x: number; y: number }) => {
      try {
        const result = await parseStoryboardFile(file);
        if (!result.text) {
          setValidationError("导入的分镜文件没有可读取文本。");
          setTimeout(() => setValidationError(null), 3000);
          return;
        }
        const timestamp = Date.now();
        const nodeId = `storyboard-${timestamp}`;
        const fallbackPlacement = getStoryboardImportPlacement(nodes);
        const placement = {
          ...fallbackPlacement,
          ...(position ? { x: position.x, y: position.y } : {}),
        };
        const importedNode: Node = normalizeFlowNodeDimensions({
          id: nodeId,
          type: "storyboardNode",
          position: { x: placement.x, y: placement.y },
          width: STORYBOARD_NODE_DIMENSIONS.width,
          height: STORYBOARD_NODE_DIMENSIONS.height,
          selected: true,
          data: {
            presetId: "StoryboardTableNode",
            role: "storyboard_prompt",
            sourceName: result.fileName,
            sourceType: result.sourceType,
            columns: result.columns,
            rows: result.rows,
            text: result.text,
            importedAt: new Date().toISOString(),
          },
        });
        pushCanvasHistorySnapshot();
        setNodes((current) => [
          ...current.map((node) => ({ ...node, selected: false })),
          importedNode,
        ]);
        const payloadNodeId = placement.payloadNodeId;
        if (payloadNodeId) {
          setEdges((current) => [
            ...current,
            {
              id: `e-${nodeId}-${payloadNodeId}`,
              source: nodeId,
              target: payloadNodeId,
              ...defaultEdgeOptions,
            },
          ]);
        }
        setValidationError(null);
        setTimeout(() => {
          focusNodeById(nodeId);
        }, 50);
      } catch (error) {
        setValidationError(error instanceof Error ? error.message : String(error));
        setTimeout(() => setValidationError(null), 5000);
      }
    },
    [focusNodeById, nodes, pushCanvasHistorySnapshot, setEdges, setNodes],
  );
  const returnToPreviousViewport = useCallback(() => {
    if (!previousViewport) return;
    reactFlow.setViewport(previousViewport, { duration: 260 });
    setPreviousViewport(null);
  }, [previousViewport, reactFlow]);
  const continueFromLastFrame = useCallback(
    (resultNodeId: string) => {
      const resultNode = reactFlow.getNode(resultNodeId);
      const resultAssets = (resultNode?.data.resultAssets || []) as Array<{ kind: string; role: string; path: string }>;
      const lastFrame = resultAssets.find((asset) => asset.role === "last_frame");
      if (!lastFrame) {
        setValidationError("当前结果节点没有可用尾帧。");
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      const timestamp = Date.now();
      const imageId = `last-frame-${timestamp}`;
      const promptId = `prompt-${timestamp}`;
      const modeId = `mode-${timestamp}`;
      const returnLastFrameId = `return-last-frame-${timestamp}`;
      const payloadId = `payload-${timestamp}`;
      const taskId = `task-${timestamp}`;
      const resultId = `result-${timestamp}`;
      const alias = nextAssetAlias("image", references);
      const baseX = (resultNode?.position.x ?? 0) + 360;
      const baseY = resultNode?.position.y ?? 0;
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        {
          id: imageId,
          type: "mediaNode",
          position: { x: baseX, y: baseY },
          width: MEDIA_NODE_DIMENSIONS.width,
          height: MEDIA_NODE_DIMENSIONS.height,
          selected: true,
          data: {
            presetId: "FirstFrameImageNode",
            role: "first_frame",
            referenceUse: "first_frame",
            referenceId: imageId,
            alias,
            relativePath: lastFrame.path,
            fileName: lastFrame.path.split(/[\\/]/).pop() ?? "last_frame",
            url: project ? assetPreviewUrl(project.id, lastFrame.path) : lastFrame.path,
          },
        },
        {
          id: promptId,
          type: "textNode",
          position: { x: baseX, y: baseY + 240 },
          data: {
            presetId: "MainPromptNode",
            text: `@${alias} 作为首帧，延续上一段视频的动作和镜头。`,
            mentionTokens: [
              {
                id: `${promptId}-${imageId}`,
                alias,
                nodeId: imageId,
                kind: "image",
                use: "first_frame",
              },
            ],
          },
        },
        {
          id: modeId,
          type: "settingsNode",
          position: { x: baseX, y: baseY + 420 },
          data: { presetId: "VideoModeNode", value: "first_frame", type: "mode" },
        },
        {
          id: returnLastFrameId,
          type: "settingsNode",
          position: { x: baseX, y: baseY + 580 },
          data: { presetId: "ReturnLastFrameNode", value: "true", type: "return_last_frame" },
        },
        {
          id: payloadId,
          type: "collectorNode",
          position: { x: baseX + 360, y: baseY + 80 },
          width: PAYLOAD_NODE_DIMENSIONS.width,
          height: PAYLOAD_NODE_DIMENSIONS.height,
          data: { presetId: "MultiModalPayloadNode" },
        },
        {
          id: taskId,
          type: "executorNode",
          position: { x: baseX + 740, y: baseY + 80 },
          data: { presetId: "CreateVideoTaskNode" },
        },
        {
          id: resultId,
          type: "resultNode",
          position: { x: baseX + 1080, y: baseY + 80 },
          width: RESULT_NODE_DIMENSIONS.width,
          height: RESULT_NODE_DIMENSIONS.height,
          data: { presetId: "VideoResultNode" },
        },
      ]);
      setEdges((current) => [
        ...current,
        { id: `e-${imageId}-${payloadId}`, source: imageId, target: payloadId, ...defaultEdgeOptions },
        { id: `e-${promptId}-${payloadId}`, source: promptId, target: payloadId, ...defaultEdgeOptions },
        { id: `e-${modeId}-${payloadId}`, source: modeId, target: payloadId, ...defaultEdgeOptions },
        { id: `e-${returnLastFrameId}-${payloadId}`, source: returnLastFrameId, target: payloadId, ...defaultEdgeOptions },
        { id: `e-${payloadId}-${taskId}`, source: payloadId, target: taskId, ...defaultEdgeOptions },
        { id: `e-${taskId}-${resultId}`, source: taskId, target: resultId, ...defaultEdgeOptions },
      ]);
    },
    [project, reactFlow, references, setEdges, setNodes],
  );
  const handleQueryVideoTask = useCallback(
    (resultNodeId: string) => {
      const resultNode = reactFlow.getNode(resultNodeId);
      const taskId = resultNode?.data.taskId;
      if (!project || typeof taskId !== "string" || !taskId.trim()) {
        setValidationError("当前结果节点没有可查询的 task_id。");
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      const queryTool = canvasTools?.find((tool) => tool.name === "query_video_task");
      if (!queryTool) {
        setValidationError("当前项目没有可用工具：query_video_task");
        onShowError?.();
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      const confirmed = window.confirm(
        `即将调用 query_video_task 查询任务状态。\n\n${JSON.stringify({ task_id: taskId }, null, 2)}\n\nschema 要求查询间隔不短于 120 秒。`,
      );
      if (!confirmed) return;
      setNodes((current) =>
        current.map((node) =>
          node.id === resultNodeId
            ? { ...node, data: { ...node.data, taskStatus: "querying" } }
            : node,
        ),
      );
      void onCallTool("query_video_task", { task_id: taskId }).then((result) => {
        const rawResult = result ?? null;
        const resultAssets = extractCanvasResultAssets(rawResult);
        const nextTaskId = extractCanvasTaskId(rawResult) ?? taskId;
        setNodes((current) =>
          current.map((node) =>
            node.id === resultNodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    rawResult,
                    resultAssets,
                    taskId: nextTaskId,
                    taskStatus: resultAssets.length > 0 ? "result_ready" : "query_available",
                    pollingIntervalSeconds: 120,
                    updatedAt: new Date().toISOString(),
                  },
                }
              : node,
          ),
        );
      });
    },
    [canvasTools, onCallTool, onShowError, project, reactFlow, setNodes],
  );
  const createReferenceFromResult = useCallback(
    (resultNodeId: string) => {
      const resultNode = reactFlow.getNode(resultNodeId);
      const resultAssets = (resultNode?.data.resultAssets || []) as Array<{ kind: string; role: string; path: string }>;
      const asset =
        resultAssets.find((item) => item.kind === "image" && item.role !== "last_frame") ??
        resultAssets.find((item) => item.kind === "audio") ??
        resultAssets.find((item) => item.kind === "video");
      if (!resultNode || !asset) {
        setValidationError("当前结果节点没有可创建为参考的素材。");
        setTimeout(() => setValidationError(null), 3000);
        return;
      }
      const kind = assetTypeToCanvasKind(asset.kind);
      const alias = nextAssetAlias(kind, references);
      const nodeId = `ref-${Date.now()}`;
      const presetId =
        asset.kind === "image"
          ? "CharacterImageNode"
          : asset.kind === "audio"
            ? "RhythmAudioNode"
            : "GenericVideoNode";
      const role =
        asset.kind === "image"
          ? "character_image"
          : asset.kind === "audio"
            ? "rhythm_audio"
            : "generic_video";
      const baseX = resultNode.position.x + ((resultNode.width as number | undefined) ?? RESULT_NODE_DIMENSIONS.width) + 120;
      const baseY = resultNode.position.y;
      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        normalizeFlowNodeDimensions({
          id: nodeId,
          type: "mediaNode",
          position: { x: baseX, y: baseY },
          selected: true,
          data: {
            presetId,
            role,
            referenceUse: role,
            referenceId: nodeId,
            alias,
            relativePath: asset.path,
            fileName: asset.path.split(/[\\/]/).pop() ?? asset.path,
            url: project ? assetPreviewUrl(project.id, asset.path) : asset.path,
          },
        }),
      ]);
    },
    [project, reactFlow, references, setNodes],
  );
  const handleRun = useCallback((executorNodeId?: string) => {
    if (!project) return;
    const compiled = createSharedCanvasModel(nodes, edges, executorNodeId).compileResult;
    const toolName = compiled.toolName;
    const tool = toolName ? runnableTools.get(toolName) : undefined;
    if (!toolName || !tool) {
      setValidationError(toolName ? `当前项目没有可用工具：${toolName}` : "执行节点没有绑定可用工具");
      onShowError?.();
      setTimeout(() => setValidationError(null), 3000);
      return;
    }
    if (!compiled.ok) {
      setValidationError(formatCompileIssues(compiled.issues) || "配置错误");
      onShowError?.();
      setTimeout(() => setValidationError(null), 3000);
      return;
    }
    const confirmed = window.confirm(
      `即将调用 ${tool.name}，可能消耗额度。\n\n${JSON.stringify(
        compiled.payload,
        null,
        2,
      )}`,
    );
    if (!confirmed) return;
    if (executorNodeId) {
      setRunningExecutorIds((current) => new Set(current).add(executorNodeId));
    }
    const resultPresetId = getCanvasResultPresetForTool(toolName);
    const targetResultIds = executorNodeId
      ? collectDownstreamResultNodeIds(nodes, edges, executorNodeId, resultPresetId)
      : new Set<string>();
    let createdResultNode: Node | null = null;
    if (executorNodeId && targetResultIds.size === 0) {
      const executorNode = nodes.find((node) => node.id === executorNodeId);
      if (executorNode) {
        createdResultNode = {
          id: `result-${toolName}-${Date.now()}`,
          type: "resultNode",
          position: {
            x: executorNode.position.x + 360,
            y: executorNode.position.y,
          },
          width: RESULT_NODE_DIMENSIONS.width,
          height: RESULT_NODE_DIMENSIONS.height,
          data: { presetId: resultPresetId ?? "VideoResultNode" },
        };
        targetResultIds.add(createdResultNode.id);
      }
    }
    const startedAt = new Date().toISOString();
    const startingEdges = createdResultNode
      ? [
          ...edges,
          {
            id: `e-${executorNodeId}-${createdResultNode.id}`,
            source: executorNodeId!,
            target: createdResultNode.id,
            ...defaultEdgeOptions,
          },
        ]
      : edges;
    const startingNodes = (createdResultNode ? [...nodes, createdResultNode] : nodes).map((node) => {
      if (executorNodeId && node.id === executorNodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            busy: true,
            taskStatus: "running",
            updatedAt: startedAt,
          },
        };
      }
      return node.type === "resultNode" &&
        (!resultPresetId || node.data.presetId === resultPresetId) &&
        (!executorNodeId || targetResultIds.has(node.id))
        ? {
            ...node,
            data: {
              ...node.data,
              busy: true,
              error: undefined,
              rawResult: undefined,
              resultAssets: [],
              taskId: undefined,
              taskStatus: "running",
              pollingIntervalSeconds: undefined,
              lastPayload: compiled.payload,
              updatedAt: startedAt,
            },
          }
        : node;
    });
    setEdges(startingEdges);
    setNodes(startingNodes);
    publishRunSnapshot(startingNodes, startingEdges);
    void saveFlowSnapshot(startingNodes, startingEdges);
    void executeCompiledCanvasTool({ callTool: onCallTool }, tool.name, compiled)
      .then((result) => {
        const rawResult = result ?? null;
        const resultAssets = extractCanvasResultAssets(rawResult);
        const taskId = extractCanvasTaskId(rawResult);
        const completedAt = new Date().toISOString();
        const completedNodes = startingNodes.map((node) => {
          if (executorNodeId && node.id === executorNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                busy: false,
                taskStatus: "completed",
                updatedAt: completedAt,
              },
            };
          }
          return node.type === "resultNode" &&
            (!resultPresetId || node.data.presetId === resultPresetId) &&
            (!executorNodeId || targetResultIds.has(node.id))
            ? {
                ...node,
                data: {
                  ...node.data,
                  busy: false,
                  error: undefined,
                  rawResult,
                  resultAssets,
                  taskId,
                  taskStatus: taskId
                    ? "query_available"
                    : resultAssets.length > 0
                      ? "result_ready"
                      : "completed_no_assets",
                  pollingIntervalSeconds: taskId ? 120 : undefined,
                  lastPayload: compiled.payload,
                  updatedAt: completedAt,
                },
              }
            : node;
        });
        setNodes(completedNodes);
        publishRunSnapshot(completedNodes, startingEdges);
        void saveFlowSnapshot(completedNodes, startingEdges);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setValidationError(message || "执行失败");
        onShowError?.();
        setTimeout(() => setValidationError(null), 3000);
        const failedAt = new Date().toISOString();
        const failedNodes = startingNodes.map((node) => {
          if (executorNodeId && node.id === executorNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                busy: false,
                taskStatus: "failed",
                updatedAt: failedAt,
              },
            };
          }
          return node.type === "resultNode" &&
            (!resultPresetId || node.data.presetId === resultPresetId) &&
            (!executorNodeId || targetResultIds.has(node.id))
            ? {
                ...node,
                data: {
                  ...node.data,
                  busy: false,
                  error: message || "执行失败",
                  taskStatus: "failed",
                  updatedAt: failedAt,
                },
              }
            : node;
        });
        setNodes(failedNodes);
        publishRunSnapshot(failedNodes, startingEdges);
        void saveFlowSnapshot(failedNodes, startingEdges);
      })
      .finally(() => {
        if (!executorNodeId) return;
        setRunningExecutorIds((current) => {
          const next = new Set(current);
          next.delete(executorNodeId);
          return next;
        });
      });
  }, [edges, nodes, onCallTool, onShowError, project, publishRunSnapshot, runnableTools, saveFlowSnapshot, setEdges, setNodes]);
  // Inject callbacks into nodes
  const nodesWithCallbacks = useMemo(() => {
    // Find payload nodes for live stats
    const prevMap = new Map<string, Node[]>();
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    for (const e of edges) {
      if (!prevMap.has(e.target)) prevMap.set(e.target, []);
      const sourceNode = nodeById.get(e.source);
      if (sourceNode) prevMap.get(e.target)!.push(sourceNode);
    }
    const handlePreviewMedia = (asset: PreviewMedia) => {
      const completeAsset =
        asset.relativePath !== undefined
          ? allAssets.find((item) => item.relativePath === asset.relativePath)
          : undefined;
      if (completeAsset) {
        if (onPreviewMedia) {
          onPreviewMedia(completeAsset);
          return;
        }
        setPreviewMedia({
          assetType: completeAsset.assetType,
          fileName: completeAsset.fileName,
          relativePath: completeAsset.relativePath,
          url: assetPreviewUrl(completeAsset.projectId, completeAsset.relativePath),
        });
        return;
      }
      setPreviewMedia(asset);
    };
    const edgeStructureSignature = edges
      .map((edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.sourceHandle ?? ""}:${edge.targetHandle ?? ""}`)
      .join("|");
    const nextCache = new Map<string, InjectedNodeCacheEntry>();
    const mappedNodes = nodes.map((n) => {
      const cacheSignatureParts = [
        String(getSemanticDataIdentity(n.data)),
        String(n.selected ?? false),
        runningExecutorIds.has(n.id) ? "running" : "",
        String(validationResult === sharedCanvasModel.compileResult),
        String(sharedCanvasModel.resultAssetsByNodeId.get(n.id)?.length ?? 0),
      ];
      if (n.type === "collectorNode" || n.type === "textNode" || n.type === "storyboardNode" || n.type === "mediaNode") {
        cacheSignatureParts.push(String(references.length));
        cacheSignatureParts.push(String(validationResult.promptReferences?.length ?? 0));
      }
      if (n.type === "collectorNode" || n.type === "executorNode") {
        cacheSignatureParts.push(edgeStructureSignature);
      }
      if (n.type === "resultNode") {
        cacheSignatureParts.push(JSON.stringify(sharedCanvasModel.resultAssetsByNodeId.get(n.id) ?? []));
      }
      const cacheSignature = cacheSignatureParts.join(":");
      const viewSignature = [
        n.position.x,
        n.position.y,
        n.width ?? "",
        n.height ?? "",
        n.selected ? "selected" : "",
        n.dragging ? "dragging" : "",
      ].join(":");
      const cached = injectedNodeCacheRef.current.get(n.id);
      if (cached?.signature === cacheSignature) {
        nextCache.set(n.id, cached);
        if (cached.viewSignature === viewSignature) return cached.injectedNode;
        const injectedNode = { ...n, data: cached.injectedData };
        const movedEntry = {
          ...cached,
          sourceNode: n,
          injectedNode,
          viewSignature,
        };
        nextCache.set(n.id, movedEntry);
        return injectedNode;
      }
      const baseData = { ...n.data, onDelete: handleDeleteNode };
      let injectedData: Node["data"] = baseData;
      if (
        n.type === "textNode" ||
        n.type === "storyboardNode" ||
        n.type === "mediaNode" ||
        n.type === "settingsNode" ||
        n.type === "resultNode"
      ) {
        injectedData = {
            ...baseData,
            onChange: handleNodeDataChange,
            allAssets,
            references,
            promptReferences: validationResult.promptReferences ?? [],
            project,
            busy:
              n.type === "resultNode"
                ? Boolean(n.data?.busy)
                : Boolean(n.data?.["busy"]),
            resultAssets:
              n.type === "resultNode"
                ? sharedCanvasModel.resultAssetsByNodeId.get(n.id) ?? n.data.resultAssets
                : n.data.resultAssets,
            isCloudVideoRunning,
            onPreviewMedia: handlePreviewMedia,
            onFocusReference: focusNodeById,
            onContinueFromLastFrame: continueFromLastFrame,
            onQueryVideoTask: handleQueryVideoTask,
            onCreateReferenceFromResult: createReferenceFromResult,
            onAssetDrop: (id: string, assetPath: string) => {
              const asset = allAssets.find((a) => a.relativePath === assetPath);
              const targetNode = reactFlow.getNode(id) ?? nodeById.get(id);
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
                  referenceId: id,
                  alias:
                    typeof targetNode?.data.alias === "string"
                      ? targetNode.data.alias
                      : nextAssetAlias(
                          targetNode ? getNodeAssetKind(targetNode) : assetTypeToCanvasKind(asset.assetType),
                          references,
                        ),
                  referenceUse: targetNode ? String(targetNode.data.role || "generic") : "generic",
                });
              }
            },
        };
      } else if (
        n.type === "collectorNode" &&
        n.data.presetId === "PromptComposerNode"
      ) {
        const promptParts: Array<{ nodeId: string; text: string }> = [];
        const visited = new Set<string>();
        const traverse = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const prevs = prevMap.get(nodeId) || [];
          for (const prevNode of prevs) {
            const preset = getPresetById(prevNode.data.presetId as string);
            if (preset?.category === "prompt" || prevNode.type === "storyboardNode") {
              const text = String(prevNode.data.text ?? "").trim();
              if (text)
                promptParts.push({
                  nodeId: prevNode.id,
                  text: formatPromptNodeText(prevNode, text),
                });
            }
            traverse(prevNode.id);
          }
        };
        traverse(n.id);
        injectedData = {
            ...baseData,
            promptCount: promptParts.length,
            composedPrompt: promptParts.map((part) => part.text).join("\n"),
            composedPromptSources: promptParts,
            onFocusReference: focusNodeById,
        };
      } else if (
        n.type === "collectorNode" &&
        n.data.presetId === "MultiModalPayloadNode"
      ) {
        const payloadExecutorId = findNearestDownstreamExecutorId(nodes, edges, n.id);
        const payloadValidationResult = payloadExecutorId
          ? createSharedCanvasModel(nodes, edges, payloadExecutorId).compileResult
          : validationResult;
        // Collect stats
        let promptCount = 0;
        let imagesCount = 0;
        let videosCount = 0;
        let audiosCount = 0;
        let settingsCount = 0;
        let error = null;
        const directPrevs = prevMap.get(n.id) || [];
        const visited = new Set<string>();
        const traverse = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const prevs = prevMap.get(nodeId) || [];
          for (const p of prevs) {
            const preset = getPresetById(p.data.presetId as string);
            if ((preset?.category === "prompt" || p.type === "storyboardNode") && p.data.text) promptCount++;
            if (preset?.category === "image") imagesCount++;
            if (preset?.category === "video") videosCount++;
            if (preset?.category === "audio") audiosCount++;
            if (preset?.category === "settings") settingsCount++;
            if (p.type === "resultNode") {
              const resultAssets = Array.isArray(p.data.resultAssets) ? p.data.resultAssets : [];
              imagesCount += resultAssets.filter((asset: any) => asset?.kind === "image").length;
              videosCount += resultAssets.filter((asset: any) => asset?.kind === "video").length;
              audiosCount += resultAssets.filter((asset: any) => asset?.kind === "audio").length;
              continue;
            }
            if (p.type === "executorNode") continue;
            traverse(p.id);
          }
        };
        for (const inputNode of directPrevs) {
          const preset = getPresetById(inputNode.data.presetId as string);
          if ((preset?.category === "prompt" || inputNode.type === "storyboardNode") && inputNode.data.text)
            promptCount++;
          if (preset?.category === "image") imagesCount++;
          if (preset?.category === "video") videosCount++;
          if (preset?.category === "audio") audiosCount++;
          if (preset?.category === "settings") settingsCount++;
          if (inputNode.type === "resultNode") {
            const resultAssets = Array.isArray(inputNode.data.resultAssets) ? inputNode.data.resultAssets : [];
            imagesCount += resultAssets.filter((asset: any) => asset?.kind === "image").length;
            videosCount += resultAssets.filter((asset: any) => asset?.kind === "video").length;
            audiosCount += resultAssets.filter((asset: any) => asset?.kind === "audio").length;
            continue;
          }
          if (inputNode.type === "executorNode") continue;
          traverse(inputNode.id);
        }
        if (!payloadValidationResult.ok) {
          error = payloadValidationResult.issues.find((issue) => issue.severity === "error")?.message ?? null;
        }
        injectedData = {
            ...baseData,
            promptCount,
            imagesCount,
            videosCount,
            audiosCount,
            settingsCount,
            error,
            payload: payloadValidationResult.payload,
            fieldSources: payloadValidationResult.fieldSources,
            issues: payloadValidationResult.issues,
            rawResult: nodes.find((node) => node.type === "resultNode" && node.data.rawResult !== undefined)?.data.rawResult,
            onChange: handleNodeDataChange,
            onFocusReference: focusNodeById,
        };
      } else if (n.type === "executorNode") {
        injectedData = {
            ...baseData,
            onRun: () => handleRun(n.id),
            busy: runningExecutorIds.has(n.id) || Boolean(n.data?.busy),
            isCloudVideoRunning,
        };
      }
      const injectedNode = { ...n, data: injectedData };
      const entry = {
        sourceNode: n,
        injectedNode,
        injectedData,
        signature: cacheSignature,
        viewSignature,
      };
      nextCache.set(n.id, entry);
      return injectedNode;
    });
    injectedNodeCacheRef.current = nextCache;
    return mappedNodes;
  }, [
    nodes,
    edges,
    handleNodeDataChange,
    updateNodeData,
    handleRun,
    handleDeleteNode,
    runningExecutorIds,
    isCloudVideoRunning,
    allAssets,
    project,
    onPreviewMedia,
    references,
    validationResult,
    focusNodeById,
    continueFromLastFrame,
    handleQueryVideoTask,
  ]);
  const edgesWithCallbacks = useMemo(() => {
    return normalizeFlowEdges(edges).map((e) => ({
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
      if (!wrapperRef.current) return;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
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
                setNodes(normalizeFlowNodes(flowData.nodes));
                setEdges(normalizeFlowEdges(flowData.edges));
                setTimeout(() => reactFlow.fitView(), 50);
              }
            } catch (err) {
              console.error("Invalid JSON flow file", err);
            }
          };
          reader.readAsText(file);
          return;
        }
        if (canImportStoryboardFile(file)) {
          void importStoryboardFile(file, position);
          return;
        }
      }
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
      const nodeId = `ref-${Math.random().toString(36).substr(2, 9)}`;
      const newNode: Node = {
        id: nodeId,
        type: "mediaNode",
        position,
        width: MEDIA_NODE_DIMENSIONS.width,
        height: MEDIA_NODE_DIMENSIONS.height,
        data: {
          presetId: presetIdMap,
          ...(preset?.defaultData || {}),
          relativePath: asset.relativePath,
          fileName: asset.fileName,
          url: assetPreviewUrl(project.id, asset.relativePath),
          referenceId: nodeId,
          alias: nextAssetAlias(assetTypeToCanvasKind(asset.assetType), references),
          referenceUse: preset?.defaultData.role ?? "generic",
        },
      };
      setNodes((nds) => nds.concat(normalizeFlowNodeDimensions(newNode)));
    },
    [reactFlow, importStoryboardFile, setNodes, project, allAssets, references],
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
      if (preset.id === "StoryboardTableNode") type = "storyboardNode";
      else if (preset.category === "prompt") type = "textNode";
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
        width:
          type === "storyboardNode"
            ? STORYBOARD_NODE_DIMENSIONS.width
            : type === "mediaNode"
            ? MEDIA_NODE_DIMENSIONS.width
            : type === "resultNode"
              ? RESULT_NODE_DIMENSIONS.width
            : preset.id === "MultiModalPayloadNode"
              ? PAYLOAD_NODE_DIMENSIONS.width
              : preset.id === "PromptComposerNode"
                ? PROMPT_COMPOSER_NODE_DIMENSIONS.width
              : undefined,
        height:
          type === "storyboardNode"
            ? STORYBOARD_NODE_DIMENSIONS.height
            : type === "mediaNode"
            ? MEDIA_NODE_DIMENSIONS.height
            : type === "resultNode"
              ? RESULT_NODE_DIMENSIONS.height
            : preset.id === "MultiModalPayloadNode"
              ? PAYLOAD_NODE_DIMENSIONS.height
              : preset.id === "PromptComposerNode"
                ? PROMPT_COMPOSER_NODE_DIMENSIONS.height
              : undefined,
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
        normalizeFlowNodeDimensions(newNode),
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
    setPayloadPanelTab("json");
    setIsPayloadPanelOpen(true);
    setIsCanvasMenuOpen(false);
  }, []);
  const refreshCanvasStatus = useCallback(() => {
    const updatedAt = new Date().toISOString();
    const settledNodes = settleExecutorsForReadyResults(nodes, edges, updatedAt);
    if (settledNodes !== nodes) {
      setNodes(settledNodes);
      void saveFlowSnapshot(settledNodes, edges);
    }
    void Promise.resolve(onRequestProjectRefresh?.()).catch(() => undefined);
    setIsCanvasMenuOpen(false);
  }, [edges, nodes, onRequestProjectRefresh, saveFlowSnapshot, setNodes]);
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
      setNodes((nds) => nds.concat(normalizeFlowNodeDimensions(newNode)));
      setEdges((eds) => [
        ...eds.filter((currentEdge) => currentEdge.id !== edgeId),
        ...normalizeFlowEdges([
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
        ]),
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
      if (node?.type === "executorNode") handleRun(nodeId);
      else handleShowPayloadPanel();
    },
    [handleRun, handleShowPayloadPanel, reactFlow],
  );
  const runSelectedCanvasElement = useCallback(() => {
    const selectedNodes = reactFlow.getNodes().filter((node) => node.selected);
    if (selectedNodes.length !== 1) return;
    handleRunNode(selectedNodes[0].id);
  }, [handleRunNode, reactFlow]);
  useEffect(() => {
    runSelectedCanvasElementRef.current = runSelectedCanvasElement;
  }, [runSelectedCanvasElement]);
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
      if (detail.action === "undo") {
        undoCanvasChange();
        return;
      }
      if (detail.action === "redo") {
        redoCanvasChange();
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
      if (detail.action === "copyNode") {
        copySelectedCanvasElements();
        return;
      }
      if (detail.action === "deleteNode" && detail.nodeId) {
        handleDeleteNode(detail.nodeId);
        return;
      }
      if (detail.action === "deleteNode") {
        deleteSelectedCanvasElements();
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
      if (detail.action === "deleteEdge") {
        deleteSelectedCanvasElements();
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
    copySelectedCanvasElements,
    handleDeleteEdge,
    handleDeleteNode,
    deleteSelectedCanvasElements,
    handleRunNode,
    handleToggleNodeCollapsed,
    redoCanvasChange,
    reactFlow,
    selectAllCanvasElements,
    setSnapToGrid,
    undoCanvasChange,
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
      const activeGroupCount = Object.values(categoryGroups).filter(
        (g) => g.items.length > 0,
      ).length;
      const estimatedHeight = activeGroupCount * 32 + 12;
      const position = getSubmenuPosition(event.currentTarget, 180, estimatedHeight);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        setSubmenuState({ kind: "root", mode, ...position });
      }, 150);
    },
    [categoryGroups, getSubmenuPosition],
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
          const group = categoryGroups.find((item) => item.id === categoryKey);
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
    [categoryGroups, getSubmenuPosition, submenuState?.direction],
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
    lastCanvasInteractionAtRef.current = Date.now();
    setSelectedEdge(null);
    setEdges((eds) => eds.map((edge) => ({ ...edge, selected: false })));
    setIsCanvasMenuOpen(false);
    if (isPayloadPanelOpen) setPayloadPanelTab("inspector");
  }, [isPayloadPanelOpen, setEdges]);
  const onPaneClick = useCallback(() => {
    lastCanvasInteractionAtRef.current = Date.now();
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
      ? categoryGroups.find((group) => group.id === submenuState.categoryKey)
      : null;
  const selectedNode = nodes.find((node) => node.selected);
  const selectedNodePrefersDownstreamExecutor =
    selectedNode?.type === "collectorNode" ||
    selectedNode?.type === "settingsNode" ||
    selectedNode?.type === "textNode" ||
    selectedNode?.type === "storyboardNode" ||
    selectedNode?.type === "mediaNode";
  const payloadContextExecutorId = selectedNode
    ? selectedNode.type === "executorNode"
      ? selectedNode.id
      : selectedNode.type === "resultNode"
        ? findNearestUpstreamExecutorId(nodes, edges, selectedNode.id)
        : selectedNodePrefersDownstreamExecutor
          ? findNearestDownstreamExecutorId(nodes, edges, selectedNode.id) ??
            findNearestUpstreamExecutorId(nodes, edges, selectedNode.id)
          : findNearestUpstreamExecutorId(nodes, edges, selectedNode.id) ??
            findNearestDownstreamExecutorId(nodes, edges, selectedNode.id)
    : undefined;
  const payloadContextResult = useMemo(
    () =>
      payloadContextExecutorId
        ? createSharedCanvasModel(nodes, edges, payloadContextExecutorId).compileResult
        : undefined,
    [edges, nodes, payloadContextExecutorId],
  );
  const payloadContextErrors = useMemo(
    () => issuesBySeverity(payloadContextResult?.issues ?? [], "error"),
    [payloadContextResult?.issues],
  );
  const payloadContextWarnings = useMemo(
    () => issuesBySeverity(payloadContextResult?.issues ?? [], "warning"),
    [payloadContextResult?.issues],
  );
  const selectedResultNode =
    selectedNode?.type === "resultNode" ? selectedNode : undefined;
  const contextResultNode = useMemo(() => {
    if (selectedResultNode) return selectedResultNode;
    if (!payloadContextExecutorId) return undefined;
    const resultPresetId = payloadContextResult?.toolName
      ? getCanvasResultPresetForTool(payloadContextResult.toolName)
      : undefined;
    const resultIds = collectDownstreamResultNodeIds(
      nodes,
      edges,
      payloadContextExecutorId,
      resultPresetId,
    );
    return nodes.find(
      (node) =>
        node.type === "resultNode" &&
        resultIds.has(node.id) &&
        node.data.rawResult !== undefined,
    );
  }, [edges, nodes, payloadContextExecutorId, payloadContextResult?.toolName, selectedResultNode]);
  const payloadPanelTitle =
    payloadContextExecutorId && selectedNode
      ? getPresetById(
          nodes.find((node) => node.id === payloadContextExecutorId)?.data
            .presetId as string,
        )?.label ?? "当前执行节点"
      : "当前画布";
  const selectedNodeReference = selectedNode
    ? references.find((reference) => reference.nodeId === selectedNode.id)
    : undefined;
  const selectedNodeFieldSources = selectedNode
    ? (payloadContextResult?.fieldSources ?? []).filter((source) => source.nodeId === selectedNode.id)
    : [];
  return (
    <div
      className="flex h-full w-full bg-surface-app relative"
      ref={wrapperRef}
    >
      <NodeLibraryDrawer
        isOpen={isDrawerOpen}
        project={project}
        canvasKind={canvasKind}
        width={nodeDrawerWidth.width}
        onLoaded={(data) => {
          setNodes(normalizeFlowNodes(data.nodes));
          setEdges(normalizeFlowEdges(data.edges));
          if (data.viewport) reactFlow.setViewport(data.viewport);
        }}
      />
      {isDrawerOpen && (
        <ResizablePanelHandle
          className="z-[60] -mx-1"
          title="拖动调整节点与布局宽度，双击恢复默认"
          onDoubleClick={nodeDrawerWidth.resetWidth}
          {...nodeDrawerWidth.resizeHandleProps}
        />
      )}
      <div
        className="relative h-full min-h-0 flex-1 min-w-0 overflow-hidden transition-all duration-300"
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
          className="video-flow-canvas h-full w-full bg-transparent"
          proOptions={{ hideAttribution: true }}
        >
          {(readStoredPreference("canvasGrid") as CanvasGridPreference) === "visible" ? (
            <Background
              color="#9ca3af"
              variant={"dots" as any}
              gap={24}
              size={1.5}
              className="opacity-40"
            />
          ) : null}
          <Controls />
          <Panel
            position="top-left"
            className="flex flex-wrap items-start justify-between w-[calc(100%-16px)] pointer-events-none mt-2 ml-2 mr-2 z-50 gap-2"
          >
            {/* Left Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-surface-panel/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-border pointer-events-auto">
              {previousViewport && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs bg-surface-app"
                  onClick={returnToPreviousViewport}
                >
                  回到上次位置
                </Button>
              )}
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
                onClick={refreshCanvasStatus}
              >
                <RefreshCw className="w-4 h-4 mr-1.5 text-brand" />
                刷新状态
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
                  onClick={() => {
                    if (isPayloadPanelOpen) {
                      setIsPayloadPanelOpen(false);
                      return;
                    }
                    setPayloadPanelTab("json");
                    setIsPayloadPanelOpen(true);
                  }}
                >
                  <Activity className="w-4 h-4 shrink-0 text-brand" />
                  <span className="truncate">
                    {isPayloadPanelOpen ? "收起 Payload" : "检查 Payload"}
                  </span>
                  {validationErrors.length > 0 && (
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
                    <span className="min-w-0 truncate text-xs font-bold">
                      Payload 预览与检查 · {payloadPanelTitle}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 rounded-lg border border-border-soft bg-surface-app p-1">
                    {[
                      ["json", "JSON"],
                      ["sources", "Sources"],
                      ["issues", "Issues"],
                      ["raw", "Raw"],
                      ["inspector", "节点"],
                    ].map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        className={cn(
                          "rounded-md px-1 py-1.5 text-[10px] font-bold transition-colors",
                          payloadPanelTab === tab
                            ? "bg-surface-raised text-brand shadow-sm"
                            : "text-text-subtle hover:text-text",
                        )}
                        onClick={() => setPayloadPanelTab(tab as PayloadPanelTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {payloadPanelTab === "json" && (
                  <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                    <CodeEditorPanel
                      title="最终 Payload"
                      language="json"
                      value={
                        payloadContextResult?.payload
                          ? JSON.stringify(payloadContextResult.payload, null, 2)
                          : ""
                      }
                      emptyText={payloadContextExecutorId ? "无法生成 Payload (请先修复错误)" : "选择一条执行链节点后查看 Payload"}
                      maxHeight="420px"
                      className="mt-1"
                    />
                  </div>
                  )}
                  {payloadPanelTab === "issues" && (
                  <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                    {payloadContextErrors.length === 0 && payloadContextWarnings.length === 0 && (
                      <div className="rounded-lg border border-border-soft bg-surface-app p-4 text-center text-xs text-text-subtle">
                        当前没有错误或警告。
                      </div>
                    )}
                    {payloadContextErrors.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-[#b03939]">
                          错误 (阻断执行)
                        </span>
                        {payloadContextErrors.map((issue, i) => (
                          <button
                            key={i}
                            type="button"
                            className="text-left text-[10px] bg-[#b03939]/10 border border-[#b03939]/20 text-[#b03939] p-1.5 rounded flex items-start gap-1.5 hover:border-[#b03939]/50"
                            onClick={() => issue.nodeId && focusNodeById(issue.nodeId)}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="leading-tight">{issue.message}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {payloadContextWarnings.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-yellow-500">
                          警告 (建议修复)
                        </span>
                        {payloadContextWarnings.map((issue, i) => (
                          <button
                            key={i}
                            type="button"
                            className="text-left text-[10px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-1.5 rounded flex items-start gap-1.5 hover:border-yellow-500/50"
                            onClick={() => issue.nodeId && focusNodeById(issue.nodeId)}
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="leading-tight">{issue.message}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Quick Fixes */}
                    {(payloadContextErrors.length > 0 ||
                      payloadContextWarnings.length > 0) && (
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
                  </div>
                  )}
                  {payloadPanelTab === "sources" && (
                    <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-2 pr-1">
                      {(payloadContextResult?.fieldSources ?? []).length === 0 ? (
                        <div className="rounded-lg border border-border-soft bg-surface-app p-4 text-center text-xs text-text-subtle">
                          {payloadContextExecutorId ? "当前没有字段来源。" : "选择一条执行链节点后查看字段来源。"}
                        </div>
                      ) : (
                        (payloadContextResult?.fieldSources ?? []).map((source, index) => (
                          <button
                            key={`${source.path}-${source.nodeId}-${index}`}
                            type="button"
                            className="flex shrink-0 flex-col gap-1 rounded-lg border border-border-soft bg-surface-app px-2 py-1.5 text-left text-[10px] hover:border-brand/40"
                            onClick={() => focusNodeById(source.nodeId)}
                          >
                            <span className="truncate font-mono font-bold text-text-subtle">{source.path}</span>
                            <span className="line-clamp-2 break-words text-text">
                              {String(source.value ?? source.label)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {payloadPanelTab === "raw" && (
                    <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                      <CodeEditorPanel
                        title="Raw Result"
                        language="json"
                        value={JSON.stringify(
                          contextResultNode?.data.rawResult ?? {
                            note: "运行节点后显示 raw execution result。",
                          },
                          null,
                          2,
                        )}
                        maxHeight="420px"
                      />
                    </div>
                  )}
                  {payloadPanelTab === "inspector" && (
                    <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-3 pr-1">
                      {selectedNode ? (
                        <>
                          <div className="rounded-lg border border-border-soft bg-surface-app p-2">
                            <div className="truncate text-xs font-black text-text">
                              {getPresetById(selectedNode.data.presetId as string)?.label ?? selectedNode.id}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-text-subtle">
                              {selectedNode.id}
                            </div>
                          </div>
                          {selectedNodeReference && (
                            <div className="rounded-lg border border-border-soft bg-surface-app p-2">
                              <div className="text-[10px] font-bold text-text-subtle">素材引用</div>
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black text-brand">
                                  @{selectedNodeReference.alias}
                                </span>
                                <span className="truncate text-[10px] text-text-subtle">
                                  {selectedNodeReference.relativePath || selectedNodeReference.fileName}
                                </span>
                              </div>
                            </div>
                          )}
                          {selectedNodeFieldSources.length > 0 && (
                            <div className="rounded-lg border border-border-soft bg-surface-app p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[10px] font-bold text-text-subtle">MCP 字段映射</div>
                                <span className="text-[10px] text-text-muted">{selectedNodeFieldSources.length} 项</span>
                              </div>
                              <div className="mt-1 flex max-h-28 flex-col gap-1 overflow-y-auto pr-1 scrollbar-thin">
                                {selectedNodeFieldSources.map((source, index) => (
                                  <div key={`${source.path}-${index}`} className="flex shrink-0 items-center justify-between gap-2 text-[10px]">
                                    <span className="truncate font-mono text-text-subtle">{source.path}</span>
                                    <span className="truncate text-text">{source.label}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedNode.data.rawResult !== undefined && (
                            <div className="flex flex-col gap-2">
                              {selectedNode.data.presetId === "VideoResultNode" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => continueFromLastFrame(selectedNode.id)}
                                >
                                  尾帧继续生成
                                </Button>
                              )}
                              <CodeEditorPanel
                                title="Raw Result"
                                language="json"
                                value={JSON.stringify(selectedNode.data.rawResult, null, 2)}
                                maxHeight="180px"
                              />
                            </div>
                          )}
                          <CodeEditorPanel
                            title="节点数据"
                            language="json"
                            value={JSON.stringify(
                              cleanCanvasDataForStorage(
                                selectedNode.data,
                                CANVAS_TRANSIENT_NODE_DATA_KEYS,
                              ),
                              null,
                              2,
                            )}
                            maxHeight="180px"
                          />
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border-soft bg-surface-app p-4 text-center text-xs text-text-subtle">
                          选择一个节点后查看节点数据、素材引用和字段映射。
                        </div>
                      )}
                    </div>
                  )}
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
                <CanvasAudioPlayer src={previewMediaSrc} autoPlay />
              </div>
            ) : previewMedia.assetType === "image" ? (
              <img
                src={previewMediaSrc}
                alt={previewMedia.fileName}
                draggable={false}
                className="max-h-[95vh] max-w-[95vw] rounded-xl bg-black/10 object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
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
                    requestCommandRun("canvas.fitView", {
                      objectType: "videoFlowCanvas",
                    });
                    closeCanvasMenu();
                  }}
                >
                  <Scan className="h-4 w-4 opacity-70" />
                  <span className="font-medium">适应画布</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={refreshCanvasStatus}
                >
                  <RefreshCw className="h-4 w-4 opacity-70" />
                  <span className="font-medium">刷新状态</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    requestCommandRun("canvas.selectAll", {
                      objectType: "videoFlowCanvas",
                    });
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
                    requestCommandRun("canvas.toggleGrid", {
                      objectType: "videoFlowCanvas",
                    });
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
                  onClick={() => {
                    requestCommandRun("canvas.clear", {
                      objectType: "videoFlowCanvas",
                    });
                    closeCanvasMenu();
                  }}
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
                  onClick={() => {
                    requestCommandRun("node.run", {
                      objectType: "videoFlowNode",
                      nodeId: activeMenuNode.id,
                    });
                    closeCanvasMenu();
                  }}
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
                  onClick={() => {
                    requestCommandRun("node.copy", {
                      objectType: "videoFlowNode",
                      nodeId: activeMenuNode.id,
                    });
                    closeCanvasMenu();
                  }}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制节点</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    requestCommandRun("node.collapseToggle", {
                      objectType: "videoFlowNode",
                      nodeId: activeMenuNode.id,
                    });
                    closeCanvasMenu();
                  }}
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
                    requestCommandRun("node.copyId", {
                      objectType: "videoFlowNode",
                      nodeId: activeMenuNode.id,
                    });
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
                    requestCommandRun("node.delete", {
                      objectType: "videoFlowNode",
                      nodeId: activeMenuNode.id,
                    });
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
                    requestCommandRun("edge.copyId", {
                      objectType: "videoFlowEdge",
                      edgeId: activeMenuEdge.id,
                    });
                    closeCanvasMenu();
                  }}
                >
                  <Copy className="h-4 w-4 opacity-70" />
                  <span className="font-medium">复制连线 ID</span>
                </button>
                <button
                  type="button"
                  className={menuItemClasses}
                  onClick={() => {
                    requestCommandRun("edge.inspectData", {
                      objectType: "videoFlowEdge",
                      edgeId: activeMenuEdge.id,
                    });
                    closeCanvasMenu();
                  }}
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
                    requestCommandRun("edge.delete", {
                      objectType: "videoFlowEdge",
                      edgeId: activeMenuEdge.id,
                    });
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
            {categoryGroups.map((group: NodePresetGroup) => {
              if (group.items.length === 0) return null;
              return (
                <button
                  type="button"
                  key={group.id}
                  className={cn(
                    menuItemClasses,
                    submenuState?.kind === "category" && submenuState.categoryKey === group.id && "bg-brand/15 text-brand-strong font-bold"
                  )}
                  onMouseEnter={(event) =>
                    showCategorySubmenu(event, submenuState.mode, group.id)
                  }
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {group.label}
                  </span>
                  {submenuState?.kind === "category" && submenuState.categoryKey === group.id && submenuState.direction === "left" ? (
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
