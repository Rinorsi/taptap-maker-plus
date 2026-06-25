import type { Edge, Node } from "@xyflow/react";
import { collectCanvasAssetReferences } from "./assetReferences";
import { compileCanvasPayload } from "./compiler";
import { extractCanvasResultAssets, type CanvasResultAsset } from "./resultExtraction";
import type {
  CanvasAssetReference,
  CanvasCompileIssue,
  CanvasCompileResult,
  CanvasPayloadFieldSource,
  CanvasPromptReference,
} from "./types";

export type CanvasNodeIndex = {
  byId: Map<string, Node>;
  upstreamByTarget: Map<string, string[]>;
  downstreamBySource: Map<string, string[]>;
};

export type SharedCanvasModel = {
  nodes: Node[];
  edges: Edge[];
  index: CanvasNodeIndex;
  references: CanvasAssetReference[];
  compileResult: CanvasCompileResult;
  issues: CanvasCompileIssue[];
  fieldSources: CanvasPayloadFieldSource[];
  promptReferences: CanvasPromptReference[];
  resultAssetsByNodeId: Map<string, CanvasResultAsset[]>;
};

export function createSharedCanvasModel(
  nodes: Node[],
  edges: Edge[],
  executorNodeId?: string,
): SharedCanvasModel {
  const references = collectCanvasAssetReferences(nodes);
  const compileResult = compileCanvasPayload(nodes, edges, executorNodeId);
  return {
    nodes,
    edges,
    index: createCanvasNodeIndex(nodes, edges),
    references,
    compileResult,
    issues: compileResult.issues,
    fieldSources: compileResult.fieldSources,
    promptReferences: compileResult.promptReferences ?? [],
    resultAssetsByNodeId: collectResultAssetsByNodeId(nodes),
  };
}

export function createCanvasNodeIndex(nodes: Node[], edges: Edge[]): CanvasNodeIndex {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const upstreamByTarget = new Map<string, string[]>();
  const downstreamBySource = new Map<string, string[]>();
  for (const edge of edges) {
    const upstream = upstreamByTarget.get(edge.target) ?? [];
    upstream.push(edge.source);
    upstreamByTarget.set(edge.target, upstream);

    const downstream = downstreamBySource.get(edge.source) ?? [];
    downstream.push(edge.target);
    downstreamBySource.set(edge.source, downstream);
  }
  return { byId, upstreamByTarget, downstreamBySource };
}

function collectResultAssetsByNodeId(nodes: Node[]) {
  const resultAssetsByNodeId = new Map<string, CanvasResultAsset[]>();
  for (const node of nodes) {
    if (node.type !== "resultNode") continue;
    const rawResult = node.data?.rawResult;
    const directAssets = node.data?.resultAssets;
    const assets = Array.isArray(directAssets)
      ? directAssets.filter(isCanvasResultAsset)
      : extractCanvasResultAssets(rawResult);
    resultAssetsByNodeId.set(node.id, assets);
  }
  return resultAssetsByNodeId;
}

function isCanvasResultAsset(value: unknown): value is CanvasResultAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === "string" &&
    typeof record.role === "string" &&
    typeof record.path === "string"
  );
}
