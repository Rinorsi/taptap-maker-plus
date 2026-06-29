import { useEffect, useRef, useState, type ReactNode } from "react";
import React from "react";
import { Info } from "lucide-react";
import type { Command } from "../../commands";
import { commandShortcuts, formatShortcut } from "../../commands";
import { Switch } from "../../components/ui/Switch";
import { cn } from "../../lib/utils";

export function SectionHeader({ title, icon, description, badge }: { title: string; icon: ReactNode; description: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-1.5 pb-2">
      <div className="flex items-center gap-2">
        <div className="text-text">{React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-[18px] h-[18px]" })}</div>
        <h2 className="text-base font-semibold text-text m-0">{title}</h2>
        {badge && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">{badge}</span>}
      </div>
      <p className="text-[13px] text-text-subtle m-0 leading-relaxed">{description}</p>
    </div>
  );
}

export function SettingsGroup({ children, preview }: { children: ReactNode; preview?: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [groupWidth, setGroupWidth] = useState(0);
  const hasPreview = Boolean(preview);
  const useSideBySide = hasPreview && groupWidth >= 725;

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const updateWidth = () => setGroupWidth(element.getBoundingClientRect().width);
    updateWidth();

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
      if (!entry) return;
      setGroupWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        "grid grid-cols-1 rounded-xl border border-border-soft bg-surface-panel shadow-sm overflow-hidden",
        useSideBySide && "grid-cols-[minmax(320px,420px)_minmax(420px,1fr)]",
      )}
    >
      {preview && (
        <div
          className={cn(
            "border-b border-border-soft bg-surface-muted/10 flex min-w-0 flex-col items-center justify-center p-6 relative",
            useSideBySide && "border-b-0 border-r",
          )}
        >
          {preview}
        </div>
      )}
      <div className="flex min-w-0 flex-col justify-center">
        {children}
      </div>
    </div>
  );
}

export function SettingContainer({ label, description, children, note }: { label: ReactNode; description?: ReactNode; children?: ReactNode; note?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 p-4 border-b border-border-soft last:border-b-0", note ? "bg-surface-muted/20" : "hover:bg-surface-muted/30 transition-colors")}>
      <div className="flex min-w-0 flex-1 flex-col pr-2">
        <span className="text-[13px] font-medium text-text">{label}</span>
        {description && <span className="mt-1.5 text-xs text-text-muted leading-relaxed">{description}</span>}
      </div>
      {children && <div className="flex min-w-0 shrink-0 items-center justify-end">{children}</div>}
    </div>
  );
}

export function PreferenceNote({ text }: { text: string }) {
  return (
    <SettingContainer
      note
      label={
        <div className="flex items-start gap-2 text-text-muted">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="font-normal">{text}</span>
        </div>
      }
    />
  );
}

export function CommandShortcutList({ commands }: { commands: Command[] }) {
  const sortedCommands = [...commands].sort((a, b) => {
    const aHasShortcut = commandShortcuts(a.shortcut, a.shortcuts).length > 0;
    const bHasShortcut = commandShortcuts(b.shortcut, b.shortcuts).length > 0;
    if (aHasShortcut !== bHasShortcut) return aHasShortcut ? -1 : 1;
    return a.title.localeCompare(b.title, "zh-CN");
  });

  return (
    <div className="flex max-h-[460px] flex-col overflow-y-auto border-t border-border-soft text-sm scrollbar-thin">
      {sortedCommands.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-text-muted">暂无可用命令</div>
      ) : (
        sortedCommands.map((command) => {
          const shortcuts = commandShortcuts(command.shortcut, command.shortcuts);
          const scopeLabel = Array.isArray(command.scope) ? command.scope.join(" / ") : command.scope;
          return (
            <div
              key={command.commandId}
              className="grid gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 hover:bg-surface-muted/30 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-text">{command.title}</span>
                  <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-text-subtle">
                    {scopeLabel}
                  </span>
                </div>
                <div className="mt-1 truncate text-[11px] font-mono text-text-muted">{command.commandId}</div>
                {command.description ? (
                  <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{command.description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-start gap-1.5 md:max-w-[260px] md:justify-end">
                {shortcuts.length > 0 ? (
                  shortcuts.map((shortcut) => (
                    <kbd
                      key={`${command.commandId}-${formatShortcut(shortcut)}`}
                      className="rounded border border-border-soft bg-surface-app px-2 py-1 text-[11px] font-semibold text-text shadow-sm"
                    >
                      {formatShortcut(shortcut)}
                    </kbd>
                  ))
                ) : (
                  <span className="rounded border border-dashed border-border-soft px-2 py-1 text-[11px] text-text-muted">
                    未绑定
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function SwitchSetting({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <SettingContainer label={label} description={description}>
      <Switch checked={checked} onChange={onChange} />
    </SettingContainer>
  );
}

export function SegmentedSetting<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <SettingContainer label={label} description={description}>
      <div className="flex max-w-full bg-surface-app/50 p-1 rounded-lg border border-border-soft shadow-inner">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative whitespace-nowrap px-4 py-1.5 text-center text-[12px] font-medium transition-all duration-200 rounded-md outline-none",
                active
                  ? "text-brand shadow-[0_1px_3px_rgba(0,0,0,0.1)] bg-surface-panel border border-border-soft"
                  : "text-text-subtle hover:text-text hover:bg-surface-muted/50 border border-transparent"
              )}
            >
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>
    </SettingContainer>
  );
}
