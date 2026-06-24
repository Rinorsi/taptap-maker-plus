import type React from "react";

export type CommandScope =
  | "global"
  | "project"
  | "asset"
  | "assetDirectory"
  | "task"
  | "mcpTool"
  | "workflowCanvas"
  | "workflowNode"
  | "workflowEdge"
  | "videoFlowCanvas"
  | "videoFlowNode"
  | "videoFlowEdge"
  | "videoFlowSelection";

export type AppCommandContext =
  | { objectType: "global" }
  | { objectType: "project"; projectId: string }
  | { objectType: "asset"; relativePath: string }
  | { objectType: "assetDirectory"; directoryPath: string }
  | { objectType: "task"; taskId: string }
  | { objectType: "mcpTool"; toolName: string }
  | { objectType: "workflowCanvas" }
  | { objectType: "workflowSelection"; nodeIds: string[]; edgeIds: string[] }
  | { objectType: "workflowNode"; nodeId: string }
  | { objectType: "workflowEdge"; edgeId: string }
  | { objectType: "videoFlowCanvas" }
  | { objectType: "videoFlowNode"; nodeId: string }
  | { objectType: "videoFlowEdge"; edgeId: string }
  | { objectType: "videoFlowSelection"; nodeIds: string[]; edgeIds: string[] };

export type CommandShortcut = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

export type Command = {
  commandId: string;
  title: string;
  icon?: React.ReactNode;
  description?: string;
  shortcut?: CommandShortcut;
  shortcuts?: CommandShortcut[];
  scope: CommandScope | readonly CommandScope[];
  group?: string;
  category?: string;
  submenu?: string | readonly string[];
  order?: number;
  danger?: boolean;
  menu?: {
    primary?: boolean;
    section?: string;
    hiddenInContextMenu?: boolean;
  };
  when?: (context: AppCommandContext) => boolean;
  run: (context: AppCommandContext) => void | Promise<void>;
};
