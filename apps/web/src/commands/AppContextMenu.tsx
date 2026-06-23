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

export function AppContextMenu({ context, children }: AppContextMenuProps) {
  const registry = useCommandRegistry();
  const commands = registry.list(context);

  if (commands.length === 0) return <>{children}</>;

  const isGlobalContext = context.objectType === "global";
  const primaryCommands = isGlobalContext ? commands : commands.filter((c) => c.scope !== "global");
  const globalCommands = isGlobalContext ? [] : commands.filter((c) => c.scope === "global");

  function renderCommandItem(command: Command) {
    return (
      <ContextMenu.Item
        key={command.commandId}
        onSelect={() => void registry.run(command.commandId, context)}
        className={cn(
          "group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all duration-200",
          command.danger 
            ? "text-red-500 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-400" 
            : "text-text data-[highlighted]:bg-brand/15 data-[highlighted]:text-brand-strong"
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{command.title}</span>
        {command.shortcut ? (
          <span className={cn(
            "ml-auto shrink-0 font-mono text-[10px] tracking-widest transition-colors",
            command.danger ? "text-red-500/60 group-data-[highlighted]:text-red-400" : "text-text-muted group-data-[highlighted]:text-brand/70"
          )}>
            {formatShortcut(command.shortcut)}
          </span>
        ) : null}
      </ContextMenu.Item>
    );
  }

  const menuContentClasses = "z-50 min-w-[240px] max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent rounded-xl border border-white/10 bg-surface-panel/95 backdrop-blur-xl p-1.5 shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 origin-top-left animate-in fade-in zoom-in-95 duration-100";

  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild>
        <div
          className="contents"
          onContextMenu={(event) => {
            if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
            event.stopPropagation();
          }}
        >
          {children}
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentClasses}>
          <ContextMenu.Label className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-text-muted/60">
            {context.objectType} Actions
          </ContextMenu.Label>
          <ContextMenu.Separator className="mb-1.5 mx-2 h-px bg-border/50" />
          
          {primaryCommands.map(renderCommandItem)}

          {globalCommands.length > 0 && (
            <>
              {primaryCommands.length > 0 && <ContextMenu.Separator className="my-1.5 mx-2 h-px bg-border/50" />}
              <ContextMenu.Sub>
                <ContextMenu.SubTrigger className="group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all duration-200 text-text data-[highlighted]:bg-surface-muted data-[highlighted]:text-text">
                  <span className="min-w-0 flex-1 truncate font-medium text-text-subtle group-data-[highlighted]:text-text">更多全局命令</span>
                  <ChevronRight className="h-4 w-4 text-text-muted group-data-[highlighted]:text-text" />
                </ContextMenu.SubTrigger>
                <ContextMenu.Portal>
                  <ContextMenu.SubContent className={menuContentClasses} sideOffset={8}>
                    {globalCommands.map(renderCommandItem)}
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
