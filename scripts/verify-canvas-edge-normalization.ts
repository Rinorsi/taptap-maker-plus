import {
  cleanCanvasEdgeForStorage,
  migrateCanvasStoragePayload,
  normalizeCanvasEdges,
} from "../apps/web/src/features/canvas-core/storage";
import type { Edge } from "@xyflow/react";

const dirtyEdge = {
  id: "e-image-result-1782408833197-payload-1782408833197",
  source: "image-result-1782408833197",
  target: "payload-1782408833197",
  sourceHandle: null,
  targetHandle: null,
  type: "custom",
} as unknown as Edge;
const dirtyStringHandleEdge = {
  id: "e-music-result-1782413212327-payload-1782413212327",
  source: "music-result-1782413212327",
  target: "payload-1782413212327",
  sourceHandle: "null",
  targetHandle: "null",
  type: "custom",
} as unknown as Edge;

const normalized = normalizeCanvasEdges([dirtyEdge])[0];
if ("sourceHandle" in normalized || "targetHandle" in normalized) {
  throw new Error("normalizeCanvasEdges should remove null handle ids");
}
const normalizedStringHandle = normalizeCanvasEdges([dirtyStringHandleEdge])[0];
if (
  "sourceHandle" in normalizedStringHandle ||
  "targetHandle" in normalizedStringHandle
) {
  throw new Error('normalizeCanvasEdges should remove "null" handle ids');
}

const cleaned = cleanCanvasEdgeForStorage(dirtyEdge);
if ("sourceHandle" in cleaned || "targetHandle" in cleaned) {
  throw new Error("cleanCanvasEdgeForStorage should not persist null handle ids");
}

const migrated = migrateCanvasStoragePayload(
  {
    schema: "taptap.canvas.video.v1",
    kind: "video-reference",
    nodes: [],
    edges: [dirtyEdge],
  },
  "video-reference",
);
if (
  "sourceHandle" in migrated.edges[0] ||
  "targetHandle" in migrated.edges[0]
) {
  throw new Error("migrateCanvasStoragePayload should normalize stored edges");
}

console.log("canvas edge normalization verified");
