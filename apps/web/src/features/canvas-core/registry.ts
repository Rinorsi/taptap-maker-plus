import type { CanvasNodeDefinition, CanvasNodeRegistry } from "./types";

export function createCanvasNodeRegistry(
  id: string,
  label: string,
  nodes: CanvasNodeDefinition[],
): CanvasNodeRegistry {
  return { id, label, nodes };
}

export function findCanvasNodeDefinition(
  registry: CanvasNodeRegistry,
  nodeId: string,
): CanvasNodeDefinition | undefined {
  return registry.nodes.find((node) => node.id === nodeId);
}

