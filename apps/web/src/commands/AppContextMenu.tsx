import * as ContextMenu from "@radix-ui/react-context-menu";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { AppCommandContext, Command } from "./types";
import { formatShortcut } from "./keyboard";
import { useCommandRegistry } from "./CommandProvider";
import { cn } from "../lib/utils";
import { notifyContextMenuOpen, shouldUseNativeContextMenu } from "./contextMenuLayer";
import { ContextMenuStyles } from "../components/ui/ContextMenuStyles";
type AppContextMenuProps = {
  context: AppCommandContext;
  children: ReactNode;
};

export type MenuCommandItem = {
  type: "command";
  command: Command;
};

export type MenuSubmenuItem = {
  type: "submenu";
  id: string;
  title: string;
  items: MenuItem[];
};

export type MenuSeparatorItem = {
  type: "separator";
  id: string;
};

export type MenuItem = MenuCommandItem | MenuSubmenuItem | MenuSeparatorItem;

type MenuTemplateItem =
  | string
  | { type: "separator"; id: string }
  | { type: "submenu"; id: string; title: string; commandIds: string[] };

const MENU_TEMPLATES: Partial<
  Record<AppCommandContext["objectType"], MenuTemplateItem[]>
> = {
  global: [
    "app.openCommandPalette",
    "app.quickSwitchProject",
    "project.scanProjects",
    "app.refreshCurrent",
    { type: "separator", id: "global:view" },
    "layout.toggleSidebar",
    "layout.toggleInspector",
    {
      type: "submenu",
      id: "global:more",
      title: "更多",
      commandIds: ["app.openSettings", "app.toggleTheme", "developer.openPanel"],
    },
  ],
  project: [
    "project.refreshCurrent",
    "mcp.startRuntime",
    "mcp.refreshTools",
    "asset.scanCurrentProject",
    { type: "separator", id: "project:copy" },
    {
      type: "submenu",
      id: "project:copy-more",
      title: "复制",
      commandIds: ["project.copyPath", "project.copyId"],
    },
  ],
  asset: [
    "asset.revealInInspector",
    "asset.preview",
    "asset.copyRelativePath",
    "asset.copyAbsolutePath",
    "asset.openInExplorer",
    "asset.scanReferences",
    {
      type: "submenu",
      id: "asset:more",
      title: "更多",
      commandIds: [
        "asset.rename",
        "asset.move",
        "asset.openSourceTask",
        "asset.setVideoFirstFrame",
        "asset.setVideoLastFrame",
        "asset.setModelReference",
      ],
    },
    { type: "separator", id: "asset:danger" },
    "asset.delete",
  ],
  assetList: [
    "assetList.previewPrimary",
    "assetList.copyPaths",
    "assetList.copyToDirectory",
    "assetList.moveToDirectory",
    "assetList.selectAll",
    "assetList.addVisibleToSelection",
    { type: "separator", id: "assetList:danger" },
    "assetList.deleteSelected",
  ],
  assetDirectory: [
    "assetDirectory.open",
    "assetDirectory.copyPath",
    "assetDirectory.copyAbsolutePath",
    "assetDirectory.openInExplorer",
    "assetDirectory.importHere",
    "assetDirectory.refresh",
    {
      type: "submenu",
      id: "assetDirectory:more",
      title: "更多",
      commandIds: ["assetDirectory.rename", "assetDirectory.move"],
    },
    { type: "separator", id: "assetDirectory:danger" },
    "assetDirectory.delete",
  ],
  mcpTool: [
    "mcpTool.revealInInspector",
    "mcpTool.copyName",
    "mcpTool.copySchema",
    "mcpTool.execute",
    {
      type: "submenu",
      id: "mcpTool:more",
      title: "更多",
      commandIds: [
        "mcpTool.addToWorkflow",
        "mcpTool.showHistory",
        "mcpTool.copyRawResult",
      ],
    },
  ],
  task: [
    "task.revealInInspector",
    "task.copySummary",
    "task.copyRaw",
    "task.retry",
    {
      type: "submenu",
      id: "task:more",
      title: "更多",
      commandIds: ["task.locateTool", "task.locateAssets", "task.markHandled"],
    },
    { type: "separator", id: "task:danger" },
    "task.deleteRecord",
  ],
  workflowCanvas: [
    "workflow.openCanvas",
    "canvas.fitView",
    "canvas.selectAll",
    "canvas.toggleGrid",
    { type: "separator", id: "workflowCanvas:danger" },
    "canvas.clear",
  ],
  workflowSelection: [
    "node.copy",
    "canvas.selectAll",
    { type: "separator", id: "workflowSelection:danger" },
    "node.delete",
    "edge.delete",
  ],
  workflowNode: [
    "node.run",
    "node.copy",
    "node.copyId",
    "node.collapseToggle",
    { type: "separator", id: "workflowNode:danger" },
    "node.delete",
  ],
  workflowEdge: [
    "edge.copyId",
    "edge.inspectData",
    { type: "separator", id: "workflowEdge:danger" },
    "edge.delete",
  ],
  videoFlowCanvas: [
    "videoFlow.openCanvas",
    "canvas.fitView",
    "canvas.selectAll",
    "canvas.toggleGrid",
    { type: "separator", id: "videoFlowCanvas:danger" },
    "canvas.clear",
  ],
  videoFlowNode: [
    "node.run",
    "node.copy",
    "node.copyId",
    "node.collapseToggle",
    { type: "separator", id: "videoFlowNode:danger" },
    "node.delete",
  ],
  videoFlowEdge: [
    "edge.copyId",
    "edge.inspectData",
    { type: "separator", id: "videoFlowEdge:danger" },
    "edge.delete",
  ],
  videoFlowSelection: [
    "node.copy",
    "canvas.selectAll",
    { type: "separator", id: "videoFlowSelection:danger" },
    "node.delete",
    "edge.delete",
  ],
};

export function AppContextMenu({ context, children }: AppContextMenuProps) {
  const registry = useCommandRegistry();
  const commands = getContextMenuCommands(registry.list(context));

  if (commands.length === 0) return <>{children}</>;

  const primaryMenuItems = buildContextMenuItems(context.objectType, commands);

  function renderCommandItem(command: Command) {
    return (
      <ContextMenu.Item
        key={command.commandId}
        onSelect={() => void registry.run(command.commandId, context)}
        className={cn(
          ContextMenuStyles.item,
          command.danger && "text-red-500 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-400"
        )}
      >
        {command.icon && <span className="shrink-0 text-text-muted flex items-center">{command.icon}</span>}
        <span className="min-w-0 flex-1 truncate">{command.title}</span>
        {command.shortcut ? (
          <span
            className={cn(
              "ml-auto min-w-16 shrink-0 text-right font-mono text-[10px] tracking-wider transition-colors",
              command.danger
                ? "text-red-500/60 group-data-[highlighted]:text-red-400"
                : "text-text-muted group-data-[highlighted]:text-brand/70",
            )}
          >
            {formatShortcut(command.shortcut)}
          </span>
        ) : null}
      </ContextMenu.Item>
    );
  }

  function renderMenuItem(item: MenuItem) {
    if (item.type === "separator") {
      return (
        <ContextMenu.Separator
          key={item.id}
          className={ContextMenuStyles.separator}
        />
      );
    }

    if (item.type === "submenu") {
      return (
        <ContextMenu.Sub key={item.id}>
          <ContextMenu.SubTrigger className={submenuTriggerClasses}>
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted group-data-[highlighted]:text-brand-strong" />
          </ContextMenu.SubTrigger>
          <ContextMenu.Portal>
            <ContextMenu.SubContent
              className={menuContentClasses}
              sideOffset={4}
              alignOffset={-4}
            >
              {item.items.map(renderMenuItem)}
            </ContextMenu.SubContent>
          </ContextMenu.Portal>
        </ContextMenu.Sub>
      );
    }

    return renderCommandItem(item.command);
  }

  const menuContentClasses = ContextMenuStyles.content;
  const submenuTriggerClasses = ContextMenuStyles.item;

  return (
    <ContextMenu.Root modal={false} onOpenChange={(open) => {
      if (open) notifyContextMenuOpen("radix");
    }}>
      <ContextMenu.Trigger asChild>
        <div
          className="contents"
          data-app-context-menu
          onContextMenuCapture={(event) => {
            if (
              shouldUseNativeContextMenu(event.target) ||
              (event.target as HTMLElement | null)?.closest("input, textarea")
            ) {
              event.stopPropagation();
            }
          }}
          onContextMenu={(event) => {
            if (shouldUseNativeContextMenu(event.target)) return;
            if (
              (event.target as HTMLElement | null)?.closest("input, textarea")
            )
              return;
            notifyContextMenuOpen("radix");
            event.stopPropagation();
          }}
        >
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className={menuContentClasses}
          data-app-context-menu
          avoidCollisions
          collisionPadding={8}
        >
          <ContextMenu.Label className={ContextMenuStyles.label}>
            {contextMenuTitle(context.objectType)}
          </ContextMenu.Label>
          <ContextMenu.Separator className={ContextMenuStyles.separator} />

          {primaryMenuItems.map(renderMenuItem)}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

function contextMenuTitle(objectType: AppCommandContext["objectType"]) {
  const titles: Record<AppCommandContext["objectType"], string> = {
    global: "工作台操作",
    project: "项目操作",
    asset: "资产操作",
    assetList: "资产列表操作",
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

export function buildContextMenuItems(
  objectType: AppCommandContext["objectType"],
  commands: Command[],
): MenuItem[] {
  const byId = new Map(commands.map((command) => [command.commandId, command]));
  const template = MENU_TEMPLATES[objectType];

  if (!template) return buildMenuItems(commands);

  const items: MenuItem[] = [];
  for (const templateItem of template) {
    if (typeof templateItem === "string") {
      const command = byId.get(templateItem);
      if (command) items.push({ type: "command", command });
      continue;
    }

    if (templateItem.type === "separator") {
      if (items.length > 0 && !endsWithSeparator(items))
        items.push({ type: "separator", id: templateItem.id });
      continue;
    }

    const submenuItems = templateItem.commandIds
      .map((commandId) => byId.get(commandId))
      .filter((command): command is Command => !!command)
      .map((command) => ({ type: "command" as const, command }));
    if (submenuItems.length > 0) {
      items.push({
        type: "submenu",
        id: templateItem.id,
        title: templateItem.title,
        items: submenuItems,
      });
    }
  }

  while (endsWithSeparator(items)) items.pop();
  return items;
}

export function getContextMenuCommands(commands: Command[]) {
  return commands.filter((command) => !command.menu?.hiddenInContextMenu);
}

function endsWithSeparator(items: MenuItem[]) {
  return items[items.length - 1]?.type === "separator";
}

function buildMenuItems(commands: Command[]): MenuItem[] {
  const orderedCommands = [...commands].sort(compareCommands);
  const groups = new Map<string, Command[]>();

  for (const command of orderedCommands) {
    const groupName = command.group ?? command.category ?? "";
    const groupCommands = groups.get(groupName);
    if (groupCommands) groupCommands.push(command);
    else groups.set(groupName, [command]);
  }

  const items: MenuItem[] = [];
  let groupIndex = 0;

  for (const [groupName, groupCommands] of groups) {
    if (groupIndex > 0) {
      items.push({
        type: "separator",
        id: `separator:${groupIndex}:${groupName}`,
      });
    }
    items.push(...buildSubmenuItems(groupCommands, groupName || "root"));
    groupIndex += 1;
  }

  return items;
}

function buildSubmenuItems(commands: Command[], idPrefix: string): MenuItem[] {
  const items: MenuItem[] = [];
  const submenuGroups = new Map<string, Command[]>();

  for (const command of commands) {
    const submenuPath = getSubmenuPath(command);
    if (submenuPath.length === 0) {
      items.push({ type: "command", command });
      continue;
    }

    const submenuKey = submenuPath.join("\u0000");
    const submenuCommands = submenuGroups.get(submenuKey);
    if (submenuCommands) submenuCommands.push(command);
    else submenuGroups.set(submenuKey, [command]);
  }

  for (const [submenuKey, submenuCommands] of submenuGroups) {
    const submenuPath = submenuKey.split("\u0000");
    items.push(buildNestedSubmenu(submenuPath, submenuCommands, idPrefix));
  }

  return items;
}

function buildNestedSubmenu(
  path: string[],
  commands: Command[],
  idPrefix: string,
): MenuSubmenuItem {
  const [title, ...rest] = path;
  const id = `submenu:${idPrefix}:${path.join("/")}`;

  if (rest.length === 0) {
    return {
      type: "submenu",
      id,
      title,
      items: commands.map((command) => ({ type: "command", command })),
    };
  }

  return {
    type: "submenu",
    id,
    title,
    items: [buildNestedSubmenu(rest, commands, `${idPrefix}:${title}`)],
  };
}

function getSubmenuPath(command: Command) {
  if (!command.submenu) return [];
  return Array.isArray(command.submenu) ? command.submenu : [command.submenu];
}

function compareCommands(a: Command, b: Command) {
  const orderDiff = (a.order ?? 0) - (b.order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return a.commandId.localeCompare(b.commandId);
}
