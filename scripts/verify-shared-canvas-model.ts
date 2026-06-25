import assert from "node:assert/strict";
import type { Edge, Node } from "@xyflow/react";
import { createSharedCanvasModel } from "../apps/web/src/features/canvas-core/model";

const promptNode: Node = {
  id: "prompt-1",
  type: "textNode",
  position: { x: 0, y: 0 },
  data: {
    presetId: "MainPromptNode",
    text: "@图1 作为角色参考，生成一个跑步镜头。",
    mentionTokens: [
      {
        id: "token-1",
        alias: "图1",
        nodeId: "image-1",
        kind: "image",
        use: "character",
      },
    ],
  },
};

const imageNode: Node = {
  id: "image-1",
  type: "mediaNode",
  position: { x: 0, y: 160 },
  data: {
    presetId: "CharacterImageNode",
    alias: "图1",
    role: "character_image",
    relativePath: "assets/image/hero.png",
    fileName: "hero.png",
  },
};

const modeNode: Node = {
  id: "mode-1",
  type: "settingsNode",
  position: { x: 280, y: 0 },
  data: { presetId: "VideoModeNode", type: "mode", value: "multi_modal_reference" },
};

const executorNode: Node = {
  id: "exec-1",
  type: "executorNode",
  position: { x: 560, y: 0 },
  data: { presetId: "CreateVideoTaskNode", toolName: "create_video_task" },
};

const resultNode: Node = {
  id: "result-1",
  type: "resultNode",
  position: { x: 840, y: 0 },
  data: {
    presetId: "VideoResultNode",
    rawResult: {
      workspace_video_path: "assets/video/result.mp4",
      workspace_last_frame_path: "assets/image/result-last.png",
    },
  },
};

const edges: Edge[] = [
  { id: "e-prompt-exec", source: "prompt-1", target: "exec-1" },
  { id: "e-image-exec", source: "image-1", target: "exec-1" },
  { id: "e-mode-exec", source: "mode-1", target: "exec-1" },
  { id: "e-exec-result", source: "exec-1", target: "result-1" },
];

const model = createSharedCanvasModel(
  [promptNode, imageNode, modeNode, executorNode, resultNode],
  edges,
  "exec-1",
);

assert.equal(model.index.byId.get("image-1")?.id, "image-1");
assert.deepEqual(model.index.upstreamByTarget.get("exec-1"), ["prompt-1", "image-1", "mode-1"]);
assert.deepEqual(model.index.downstreamBySource.get("exec-1"), ["result-1"]);
assert.equal(model.references[0]?.relativePath, "assets/image/hero.png");
assert.equal(model.promptReferences[0]?.nodeId, "image-1");
assert.equal(model.compileResult.ok, true);
assert.equal(model.compileResult.toolName, "create_video_task");
assert.equal(model.fieldSources.some((source) => source.path === "prompt"), true);
assert.equal(model.issues.length, 0);
assert.deepEqual(
  model.resultAssetsByNodeId.get("result-1")?.map((asset) => `${asset.kind}:${asset.role}:${asset.path}`),
  [
    "video:video_result:assets/video/result.mp4",
    "image:last_frame:assets/image/result-last.png",
  ],
);

console.log("shared canvas model verified");
