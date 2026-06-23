import type { CommandShortcut } from "./types";

const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[role='textbox']",
  ".monaco-editor",
  ".monaco-editor *"
].join(",");

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(EDITABLE_SELECTOR);
}

export function matchesShortcut(event: KeyboardEvent, shortcut: CommandShortcut) {
  const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
  if (!keyMatches) return false;
  return Boolean(shortcut.ctrlKey) === event.ctrlKey
    && Boolean(shortcut.metaKey) === event.metaKey
    && Boolean(shortcut.shiftKey) === event.shiftKey
    && Boolean(shortcut.altKey) === event.altKey;
}

export function commandShortcuts(shortcut?: CommandShortcut, shortcuts?: CommandShortcut[]) {
  return [shortcut, ...(shortcuts ?? [])].filter((item): item is CommandShortcut => !!item);
}

export function formatShortcut(shortcut?: CommandShortcut) {
  if (!shortcut) return "";
  return [
    shortcut.ctrlKey ? "Ctrl" : "",
    shortcut.metaKey ? "Meta" : "",
    shortcut.shiftKey ? "Shift" : "",
    shortcut.altKey ? "Alt" : "",
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key
  ].filter(Boolean).join("+");
}
