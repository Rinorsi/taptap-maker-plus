import type { Edge, Node, Viewport } from "@xyflow/react";

export type CanvasKind = "video-reference" | "universal";

export type CanvasStorageSchema =
  | "taptap.canvas.video.v1"
  | "taptap.canvas.universal.v1";

export type CanvasStoragePayload = {
  schema: CanvasStorageSchema;
  kind: CanvasKind;
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport;
};

export type CanvasFlowObject = {
  nodes?: Node[];
  edges?: Edge[];
  viewport?: Viewport;
};

export const CANVAS_TRANSIENT_NODE_DATA_KEYS = new Set([
  "allAssets",
  "error",
  "imagesCount",
  "isCloudVideoRunning",
  "onAssetDrop",
  "onChange",
  "onDelete",
  "onPreviewMedia",
  "onRun",
  "onFocusReference",
  "project",
  "promptCount",
  "references",
  "settingsCount",
  "videosCount",
  "audiosCount",
]);

export const CANVAS_TRANSIENT_EDGE_DATA_KEYS = new Set(["onDelete"]);

const schemaByKind: Record<CanvasKind, CanvasStorageSchema> = {
  "video-reference": "taptap.canvas.video.v1",
  universal: "taptap.canvas.universal.v1",
};

export function createCanvasStoragePayload(
  flow: CanvasFlowObject,
  kind: CanvasKind,
  cleanNode: (node: Node) => Node = defaultCleanNode,
  cleanEdge: (edge: Edge) => Edge = defaultCleanEdge,
): CanvasStoragePayload {
  return {
    schema: schemaByKind[kind],
    kind,
    nodes: (flow.nodes ?? []).map(cleanNode),
    edges: (flow.edges ?? []).map(cleanEdge),
    viewport: flow.viewport,
  };
}

export function createCleanCanvasStoragePayload(
  flow: CanvasFlowObject,
  kind: CanvasKind,
): CanvasStoragePayload {
  return createCanvasStoragePayload(
    flow,
    kind,
    cleanCanvasNodeForStorage,
    cleanCanvasEdgeForStorage,
  );
}

export function migrateCanvasStoragePayload(
  input: unknown,
  fallbackKind: CanvasKind,
): CanvasStoragePayload {
  const record = isRecord(input) ? input : {};
  const kind = readCanvasKind(record.kind, fallbackKind);
  const nodes = Array.isArray(record.nodes) ? (record.nodes as Node[]) : [];
  const edges = Array.isArray(record.edges) ? (record.edges as Edge[]) : [];
  const viewport = isRecord(record.viewport) ? (record.viewport as Viewport) : undefined;
  return {
    schema: readCanvasSchema(record.schema, kind),
    kind,
    nodes,
    edges: normalizeCanvasEdges(edges),
    viewport,
  };
}

export function getCanvasSchemaForKind(kind: CanvasKind): CanvasStorageSchema {
  return schemaByKind[kind];
}

export function cleanCanvasNodeForStorage(node: Node): Node {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    width: node.width,
    height: node.height,
    selected: false,
    dragging: false,
    data: cleanCanvasDataForStorage(node.data, CANVAS_TRANSIENT_NODE_DATA_KEYS),
  };
}

export function cleanCanvasEdgeForStorage(edge: Edge): Edge {
  const cleanEdge: Edge = {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    animated: false,
    selected: false,
    style: edge.style,
    markerEnd: edge.markerEnd,
    data: cleanCanvasDataForStorage(edge.data, CANVAS_TRANSIENT_EDGE_DATA_KEYS),
  };
  if (edge.sourceHandle != null) cleanEdge.sourceHandle = edge.sourceHandle;
  if (edge.targetHandle != null) cleanEdge.targetHandle = edge.targetHandle;
  return cleanEdge;
}

export function normalizeCanvasEdge(edge: Edge): Edge {
  const normalized: Edge = { ...edge };
  if (normalized.sourceHandle == null || normalized.sourceHandle === "null")
    delete normalized.sourceHandle;
  if (normalized.targetHandle == null || normalized.targetHandle === "null")
    delete normalized.targetHandle;
  return normalized;
}

export function normalizeCanvasEdges(edges: Edge[] | undefined): Edge[] {
  return (edges ?? []).map(normalizeCanvasEdge);
}

export function cleanCanvasDataForStorage(
  data: Node["data"] | Edge["data"] | undefined,
  transientKeys: Set<string>,
) {
  const clean: Record<string, unknown> = {};
  if (!data) return clean;
  for (const [key, value] of Object.entries(data)) {
    if (transientKeys.has(key)) continue;
    if (typeof value === "function") continue;
    if (key === "rawResult") {
      clean[key] = summarizeRawResultForStorage(value);
      continue;
    }
    if (isPlainJsonValue(value)) clean[key] = value;
  }
  return clean;
}

export function summarizeRawResultForStorage(rawResult: unknown) {
  const summary: Record<string, unknown> = {};
  const addField = (key: string, value: unknown) => {
    if (summary[key] !== undefined) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      summary[key] = value;
    }
  };
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of [
      "task_id",
      "status",
      "workspace_video_path",
      "workspace_last_frame_path",
      "workspace_image_path",
      "workspace_audio_path",
      "workspace_music_path",
      "localPath",
      "error",
      "message",
    ]) {
      addField(key, record[key]);
    }
    Object.values(record).forEach(visit);
  };
  visit(rawResult);
  try {
    const text = JSON.stringify(rawResult);
    summary.rawPreview = text.length > 6000 ? `${text.slice(0, 6000)}...` : text;
    summary.rawSizeBytes = text.length;
  } catch {
    summary.rawPreview = String(rawResult ?? "");
  }
  return summary;
}

function readCanvasKind(value: unknown, fallbackKind: CanvasKind): CanvasKind {
  return value === "video-reference" || value === "universal" ? value : fallbackKind;
}

function readCanvasSchema(value: unknown, kind: CanvasKind): CanvasStorageSchema {
  return value === "taptap.canvas.video.v1" || value === "taptap.canvas.universal.v1"
    ? value
    : schemaByKind[kind];
}

function defaultCleanNode(node: Node): Node {
  return node;
}

function defaultCleanEdge(edge: Edge): Edge {
  return edge;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
