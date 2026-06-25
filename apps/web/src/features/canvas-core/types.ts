import type { Edge, Node } from "@xyflow/react";

export type CanvasAssetKind = "image" | "video" | "audio" | "model" | "text" | "unknown";

export type CanvasToolName = "generate_image" | "edit_image" | "create_video_task" | "text_to_music";

export type CanvasAssetUse =
  | "first_frame"
  | "last_frame"
  | "character"
  | "scene"
  | "style"
  | "composition"
  | "action"
  | "camera"
  | "rhythm"
  | "background_music"
  | "generic";

export type CanvasAssetReference = {
  id: string;
  nodeId: string;
  alias: string;
  kind: CanvasAssetKind;
  use: CanvasAssetUse;
  relativePath?: string;
  fileName?: string;
  url?: string;
};

export type CanvasMentionToken = {
  id: string;
  alias: string;
  nodeId: string;
  kind: CanvasAssetKind;
  use: CanvasAssetUse;
};

export type CanvasPromptReference = {
  promptNodeId: string;
  tokenId: string;
  alias: string;
  nodeId: string;
  kind: CanvasAssetKind;
  use: CanvasAssetUse;
  broken: boolean;
};

export type CanvasCompileIssue = {
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
  field?: string;
};

export type CanvasPayloadFieldSource = {
  path: string;
  nodeId: string;
  label: string;
  value?: unknown;
};

export type CanvasCompileResult = {
  ok: boolean;
  toolName?: CanvasToolName;
  payload?: Record<string, unknown>;
  issues: CanvasCompileIssue[];
  fieldSources: CanvasPayloadFieldSource[];
  references: CanvasAssetReference[];
  promptReferences?: CanvasPromptReference[];
  mode?: string;
};

export type CanvasGraphSnapshot = {
  nodes: Node[];
  edges: Edge[];
};

export type CanvasExecutionAdapter = {
  callTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
};

export type CanvasNodeDefinition = {
  id: string;
  label: string;
  category: string;
  description?: string;
  toolName?: CanvasToolName;
  defaultData: Record<string, unknown>;
};

export type CanvasNodeRegistry = {
  id: string;
  label: string;
  nodes: CanvasNodeDefinition[];
};
