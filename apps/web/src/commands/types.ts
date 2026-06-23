export type CommandScope = "global" | "project" | "asset" | "task" | "mcpTool" | "workflowCanvas" | "workflowNode";

export type AppCommandContext =
  | { objectType: "global" }
  | { objectType: "project"; projectId: string }
  | { objectType: "asset"; relativePath: string }
  | { objectType: "task"; taskId: string }
  | { objectType: "mcpTool"; toolName: string }
  | { objectType: "workflowCanvas" }
  | { objectType: "workflowNode"; nodeId: string };

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
  description?: string;
  shortcut?: CommandShortcut;
  shortcuts?: CommandShortcut[];
  scope: CommandScope;
  danger?: boolean;
  when?: (context: AppCommandContext) => boolean;
  run: (context: AppCommandContext) => void | Promise<void>;
};
