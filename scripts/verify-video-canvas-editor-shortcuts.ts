import { readFileSync } from "node:fs";

const editorSource = readFileSync(
  "apps/web/src/features/generation/MentionPromptEditor.tsx",
  "utf8",
);
const canvasSource = readFileSync(
  "apps/web/src/features/generation/VideoFlowCanvas.tsx",
  "utf8",
);

for (const required of [
  "createMentionSuggestionFromRef(referencesRef)",
  "onChangeRef.current(",
  "handleKeyDown(_view, event)",
  "event.stopPropagation();",
  "data-canvas-editor",
  "role=\"textbox\"",
]) {
  if (!editorSource.includes(required)) {
    throw new Error(`Mention editor shortcut guard missing: ${required}`);
  }
}

for (const required of [
  "undoStackRef",
  "redoStackRef",
  "undoCanvasChange",
  "redoCanvasChange",
  "eventStartedInsideCanvas",
  "hasCanvasSelection",
  "copySelectedCanvasElements();",
  "pasteClipboardCanvasElements();",
  "cutSelectedCanvasElements();",
  "deleteSelectedCanvasElements();",
  "clipboardRef.current",
  "lastCanvasInteractionAtRef",
  "recentlyUsedCanvas",
  "latestUndoSnapshot",
  "isEditableShortcutTarget(document.activeElement)",
  "key === \"z\"",
  "key === \"y\"",
]) {
  if (!canvasSource.includes(required)) {
    throw new Error(`Video canvas shortcut support missing: ${required}`);
  }
}

console.log("video canvas editor shortcuts verified");
