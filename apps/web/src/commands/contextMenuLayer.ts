export const CONTEXT_MENU_OPEN_EVENT = "taptap:context-menu-open";
export const CONTEXT_MENU_CLOSE_EVENT = "taptap:context-menu-close";

export type ContextMenuSource =
  | "app"
  | "editable"
  | "radix"
  | "workflow"
  | "videoFlow";

export type ContextMenuPosition = {
  x: number;
  y: number;
};

export function notifyContextMenuOpen(source: ContextMenuSource) {
  window.dispatchEvent(
    new CustomEvent(CONTEXT_MENU_OPEN_EVENT, { detail: { source } }),
  );
}

export function closeAllContextMenus() {
  window.dispatchEvent(new CustomEvent(CONTEXT_MENU_CLOSE_EVENT));
}

export function shouldIgnoreContextMenuEvent(
  event: Event,
  source: ContextMenuSource,
) {
  const detail = (event as CustomEvent<{ source?: ContextMenuSource }>).detail;
  return detail?.source === source;
}

export function clampContextMenuPosition(
  position: ContextMenuPosition,
  size: { width: number; height: number },
  padding = 8,
): ContextMenuPosition {
  const viewportWidth = window.innerWidth || size.width;
  const viewportHeight = window.innerHeight || size.height;
  return {
    x: Math.max(
      padding,
      Math.min(position.x, viewportWidth - size.width - padding),
    ),
    y: Math.max(
      padding,
      Math.min(position.y, viewportHeight - size.height - padding),
    ),
  };
}

export function shouldUseNativeContextMenu(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest(
    [
      "[data-native-context-menu]",
      "[data-no-app-context-menu]",
      "[contenteditable='true']",
      "[contenteditable='']",
      "[role='textbox']",
      ".monaco-editor",
      ".monaco-editor *",
      "model-viewer",
      "video[controls]",
      "audio[controls]",
    ].join(","),
  );
}
