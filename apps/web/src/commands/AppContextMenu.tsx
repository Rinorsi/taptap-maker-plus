import * as ContextMenu from "@radix-ui/react-context-menu";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { AppCommandContext, Command } from "./types";
import { formatShortcut } from "./keyboard";
import { useCommandRegistry } from "./CommandProvider";
import { cn } from "../lib/utils";

type AppContextMenuProps = {
  context: AppCommandContext;
  children: ReactNode;
};

type MenuCommandItem = {
  type: "command";
  command: Command;
};

type MenuSubmenuItem = {
  type: "submenu";
  id: string;
  title: string;
  items: MenuItem[];
};

type MenuSeparatorItem = {
  type: "separator";
  id: string;
};

type MenuItem = MenuCommandItem | MenuSubmenuItem | MenuSeparatorItem;

export function AppContextMenu({ context, children }: AppContextMenuProps) {
  const registry = useCommandRegistry();
  const commands = registry.list(context);

  if (commands.length === 0) return <>{children}</>;

  const isGlobalContext = context.objectType === "global";
  const primaryCommands = isGlobalContext
    ? commands
    : commands.filter((c) => !isGlobalScope(c.scope));
  const globalCommands = isGlobalContext
    ? []
    : commands.filter((c) => isGlobalScope(c.scope));
  const primaryMenuItems = buildMenuItems(primaryCommands);
  const globalMenuItems = buildMenuItems(globalCommands);

  function renderCommandItem(command: Command) {
    return (
      <ContextMenu.Item
        key={command.commandId}
        onSelect={() => void registry.run(command.commandId, context)}
        className={cn(
          "group flex h-7 cursor-pointer select-none items-center gap-4 rounded-sm px-2.5 text-[13px] outline-none transition-colors",
          command.danger
            ? "text-red-500 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-400"
            : "text-text data-[highlighted]:bg-brand/15 data-[highlighted]:text-brand-strong",
        )}
      >
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
          className="my-1 mx-1.5 h-px bg-border/60"
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

  const menuContentClasses =
    "z-50 min-w-[244px] max-h-[min(420px,calc(100vh-24px))] overflow-y-auto overflow-x-hidden overscroll-contain rounded-md border border-border/70 bg-surface-panel/98 p-1 shadow-[0_12px_34px_-14px_rgba(0,0,0,0.65)] ring-1 ring-white/5 origin-top-left animate-in fade-in zoom-in-95 duration-100 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent";
  const submenuTriggerClasses =
    "group flex h-7 cursor-pointer select-none items-center gap-4 rounded-sm px-2.5 text-[13px] text-text outline-none transition-colors data-[highlighted]:bg-brand/15 data-[highlighted]:text-brand-strong";

  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <div
          className="contents"
          data-app-context-menu
          onContextMenu={(event) => {
            if (
              (event.target as HTMLElement | null)?.closest("input, textarea")
            )
              return;
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
        >
          <ContextMenu.Label className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
            {contextMenuTitle(context.objectType)}
          </ContextMenu.Label>
          <ContextMenu.Separator className="mb-1 mx-1.5 h-px bg-border/60" />

          {primaryMenuItems.map(renderMenuItem)}

          {globalCommands.length > 0 && (
            <>
              {primaryMenuItems.length > 0 && (
                <ContextMenu.Separator className="my-1 mx-1.5 h-px bg-border/60" />
              )}
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className={submenuTriggerClasses}>
                  <span className="min-w-0 flex-1 truncate text-text-subtle group-data-[highlighted]:text-brand-strong">
                    更多全局命令
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted group-data-[highlighted]:text-brand-strong" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent
                    className={menuContentClasses}
                    sideOffset={4}
                    alignOffset={-4}
                  >
                    {globalMenuItems.map(renderMenuItem)}
                  </ContextMenu.SubContent>
                </ContextMenu.Portal>
              </ContextMenu.Sub>
            </>
          )}
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
    task: "任务操作",
    mcpTool: "MCP 工具操作",
    workflowCanvas: "节点流画布操作",
    workflowNode: "节点操作",
    workflowEdge: "连线操作",
    videoFlowCanvas: "视频画布操作",
    videoFlowNode: "视频节点操作",
    videoFlowEdge: "视频连线操作",
    videoFlowSelection: "视频画布选择操作",
  };
  return titles[objectType];
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

function isGlobalScope(scope: Command["scope"]) {
  return Array.isArray(scope) ? scope.includes("global") : scope === "global";
}
