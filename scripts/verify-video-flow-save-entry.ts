import { readFileSync } from "node:fs";

const drawerSource = readFileSync(
  "apps/web/src/features/generation/NodeLibraryDrawer.tsx",
  "utf8",
);
const appShellSource = readFileSync("apps/web/src/app/AppShell.tsx", "utf8");
const contextMenuSource = readFileSync(
  "apps/web/src/commands/AppContextMenu.tsx",
  "utf8",
);
const menuBarSource = readFileSync("apps/web/src/commands/AppMenuBar.tsx", "utf8");
const apiSource = readFileSync("apps/web/src/api.ts", "utf8");
const canvasSource = readFileSync(
  "apps/web/src/features/generation/VideoFlowCanvas.tsx",
  "utf8",
);
const templateSource = readFileSync(
  "apps/web/src/features/canvas-core/templates.ts",
  "utf8",
);

for (const required of [
  "VIDEO_FLOW_SAVE_EVENT",
  "formatFlowTimestamp",
  "String(date.getFullYear()).slice(-2)",
  "pad(date.getMonth() + 1)",
  "pad(date.getDate())",
  "我的画布-\" + formatFlowTimestamp()",
  "createCleanCanvasStoragePayload(reactFlow.toObject(), canvasKind)",
  "setSavedFlows((flows) => [",
]) {
  if (!drawerSource.includes(required)) {
    throw new Error(`Video flow drawer save behavior missing: ${required}`);
  }
}

for (const required of [
  "taptap:video-flow-save",
  "保存当前视频画布",
]) {
  if (!appShellSource.includes(required)) {
    throw new Error(`Video flow save command missing: ${required}`);
  }
}

if (!contextMenuSource.includes("global: [") || !contextMenuSource.includes("\"app.saveCurrentDraft\"")) {
  throw new Error("Video flow context menu should include save command");
}

if (!menuBarSource.includes("\"app.saveCurrentDraft\"")) {
  throw new Error("App menu file section should include save command");
}

if (!apiSource.includes("Promise<{ id: string; name: string; mtimeMs?: number }>")) {
  throw new Error("saveFlow should return saved flow id and name");
}

for (const required of [
  "saveFlowSnapshot(startingNodes, startingEdges)",
  "saveFlowSnapshot(completedNodes, startingEdges)",
  "saveFlowSnapshot(failedNodes, startingEdges)",
  "VIDEO_FLOW_RUN_SNAPSHOT_EVENT",
  "publishRunSnapshot(completedNodes, startingEdges)",
  "publishRunSnapshot(failedNodes, startingEdges)",
  "window.addEventListener(VIDEO_FLOW_RUN_SNAPSHOT_EVENT",
  "busy: runningExecutorIds.has(n.id) || Boolean(n.data?.busy)",
]) {
  if (!canvasSource.includes(required)) {
    throw new Error(`Video flow generation persistence missing: ${required}`);
  }
}

if (!templateSource.includes('presetId: "ImageModelNode", value: "nanobanana"')) {
  throw new Error("Video flow template should default image model to nanobanana");
}

console.log("video flow save entry verified");
