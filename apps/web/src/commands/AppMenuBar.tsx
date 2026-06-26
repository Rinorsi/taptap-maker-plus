import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { AppCommandContext, Command } from "./types";
import { formatShortcut } from "./keyboard";
import { useCommandRegistry } from "./CommandProvider";
import { cn } from "../lib/utils";

type MenuSection = {
  label: string;
  commandIds: string[];
};

type AppMenuBarProps = {
  context: AppCommandContext;
};

const sections: MenuSection[] = [
  {
    label: "文件",
    commandIds: ["app.saveCurrentDraft", "app.quickSwitchProject", "project.scanProjects", "app.openSettings"]
  },
  {
    label: "视图",
    commandIds: ["app.openCommandPalette", "layout.toggleSidebar", "layout.toggleInspector", "app.focusPanelSearch", "app.refreshCurrent"]
  },
  {
    label: "项目",
    commandIds: ["mcp.startRuntime", "mcp.refreshTools", "asset.scanCurrentProject", "project.copyPath", "project.copyId"]
  },
  {
    label: "开发者",
    commandIds: ["developer.openPanel", "developer.copyDiagnostics", "app.toggleTheme"]
  }
];

function suppressNativeContextMenu(event: ReactMouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function AppMenuBar({ context }: AppMenuBarProps) {
  const registry = useCommandRegistry();
  const [openSection, setOpenSection] = useState("");
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!openSection) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenSection("");
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openSection]);

  return (
    <nav
      ref={rootRef}
      className="flex h-8 shrink-0 items-center gap-1 px-1 text-[13px] font-medium text-text-subtle"
      data-no-window-drag
      data-local-context-menu
      onContextMenuCapture={suppressNativeContextMenu}
    >
      {sections.map((section) => {
        const commands = section.commandIds
          .map((commandId) => registry.get(commandId))
          .filter((command): command is Command => !!command && registry.list(context).some((available) => available.commandId === command.commandId));
        if (!commands.length) return null;
        return (
          <div key={section.label} className="relative">
            <button
              type="button"
              className={cn(
                "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-3 whitespace-nowrap transition-colors duration-200",
                openSection === section.label 
                  ? "bg-surface-panel text-text shadow-sm ring-1 ring-border-soft" 
                  : "hover:bg-surface-panel/50 hover:text-text"
              )}
              onClick={() => setOpenSection((current) => current === section.label ? "" : section.label)}
              onContextMenu={suppressNativeContextMenu}
            >
              {section.label}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", openSection === section.label ? "rotate-180 text-text" : "text-text-muted")} />
            </button>
            {openSection === section.label ? (
              <div
                className="absolute left-0 top-full mt-1.5 z-[90] min-w-[300px] overflow-hidden rounded-xl border border-border/60 bg-surface-panel/95 backdrop-blur-xl p-1.5 shadow-popover origin-top-left animate-in fade-in zoom-in-95 duration-100"
                data-local-context-menu
                role="menu"
                onContextMenu={suppressNativeContextMenu}
              >
                {commands.map((command) => (
                  <button
                    type="button"
                    key={command.commandId}
                    onClick={() => {
                      setOpenSection("");
                      void registry.run(command.commandId, context);
                    }}
                    onContextMenu={suppressNativeContextMenu}
                    className={cn(
                      "group grid w-full cursor-pointer select-none grid-cols-[minmax(0,1fr)_auto] items-center gap-8 rounded-lg px-3 py-2.5 text-left text-[13px] outline-none transition-all duration-200",
                      command.danger 
                        ? "text-red-500 hover:bg-red-500/10 hover:text-red-400" 
                        : "text-text hover:bg-brand/10 hover:text-brand-strong"
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">{command.title}</span>
                    {command.shortcut ? (
                      <span className={cn(
                        "justify-self-end whitespace-nowrap rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] tracking-widest transition-colors",
                        command.danger ? "text-red-500/60 group-hover:text-red-400" : "text-text-muted group-hover:text-brand/70"
                      )}>
                        {formatShortcut(command.shortcut)}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
