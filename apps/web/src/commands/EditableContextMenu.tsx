import { Clipboard, Copy, Scissors, TextCursorInput } from "lucide-react";
import type { ReactNode } from "react";

type EditableMenuState = {
  x: number;
  y: number;
  target: HTMLInputElement | HTMLTextAreaElement;
};

type EditableContextMenuProps = {
  menu?: EditableMenuState;
  onClose: () => void;
};

export function EditableContextMenu({ menu, onClose }: EditableContextMenuProps) {
  if (!menu) return null;
  const canWrite = !menu.target.readOnly && !menu.target.disabled;

  async function run(action: "cut" | "copy" | "paste" | "selectAll") {
    if (!menu) return;
    const target = menu.target;
    target.focus();
    if (action === "selectAll") {
      target.select();
      onClose();
      return;
    }
    if (action === "copy" || action === "cut") {
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const selectedText = target.value.slice(start, end);
      if (selectedText) await navigator.clipboard.writeText(selectedText).catch(() => undefined);
      if (action === "cut" && canWrite && selectedText) {
        replaceEditableSelection(target, "");
      }
      onClose();
      return;
    }
    if (action === "paste" && canWrite) {
      const text = await navigator.clipboard.readText().catch(() => "");
      if (text) replaceEditableSelection(target, text);
      onClose();
    }
  }

  return (
    <div
      className="fixed z-[80] min-w-[210px] overflow-hidden rounded-xl border border-white/10 bg-surface-panel/95 p-1.5 shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <EditableMenuButton icon={<Scissors className="h-3.5 w-3.5" />} label="剪切" shortcut="Ctrl+X" disabled={!canWrite} onClick={() => void run("cut")} />
      <EditableMenuButton icon={<Copy className="h-3.5 w-3.5" />} label="复制" shortcut="Ctrl+C" onClick={() => void run("copy")} />
      <EditableMenuButton icon={<Clipboard className="h-3.5 w-3.5" />} label="粘贴" shortcut="Ctrl+V" disabled={!canWrite} onClick={() => void run("paste")} />
      <div className="my-1 h-px bg-border/50" />
      <EditableMenuButton icon={<TextCursorInput className="h-3.5 w-3.5" />} label="全选" shortcut="Ctrl+A" onClick={() => void run("selectAll")} />
    </div>
  );
}

function EditableMenuButton({ icon, label, shortcut, disabled, onClick }: { icon: ReactNode; label: string; shortcut: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-medium text-text outline-none transition-all hover:bg-brand/15 hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text"
      onClick={onClick}
    >
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] tracking-widest text-text-muted">{shortcut}</span>
    </button>
  );
}

function replaceEditableSelection(target: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
  target.value = nextValue;
  const nextCursor = start + text.length;
  target.setSelectionRange(nextCursor, nextCursor);
  target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
}
