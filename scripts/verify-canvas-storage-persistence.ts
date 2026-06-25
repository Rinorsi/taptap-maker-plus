import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";
import {
  cleanCanvasNodeForStorage,
  createCanvasStoragePayload,
} from "../apps/web/src/features/canvas-core/storage";

const resultNode: Node = {
  id: "result-1",
  type: "resultNode",
  position: { x: 100, y: 100 },
  width: 320,
  height: 240,
  data: {
    presetId: "ImageResultNode",
    busy: true,
    taskStatus: "running",
    taskId: "image-task-001",
    pollingIntervalSeconds: 120,
    lastPayload: { prompt: "test prompt", name: "image" },
    rawResult: {
      task_id: "image-task-001",
      workspace_image_path: "assets/image/result.png",
      nested: {
        status: "running",
        workspace_audio_path: "assets/audio/result.mp3",
      },
      verboseLog: "x".repeat(7000),
    },
    resultAssets: [
      { kind: "image", role: "image_result", path: "assets/image/result.png" },
    ],
    project: { id: "project-1" },
    onPreviewMedia: () => undefined,
  },
};

const payload = createCanvasStoragePayload(
  { nodes: [resultNode], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
  "video-reference",
  cleanCanvasNodeForStorage,
);

const savedNode = payload.nodes[0];
assert.equal(savedNode.data.busy, true);
assert.equal(savedNode.data.taskStatus, "running");
assert.equal(savedNode.data.taskId, "image-task-001");
assert.deepEqual(savedNode.data.resultAssets, [
  { kind: "image", role: "image_result", path: "assets/image/result.png" },
]);
assert.equal(typeof savedNode.data.rawResult, "object");
assert.deepEqual(savedNode.data.rawResult, {
  task_id: "image-task-001",
  status: "running",
  workspace_image_path: "assets/image/result.png",
  workspace_audio_path: "assets/audio/result.mp3",
  rawPreview: JSON.stringify(resultNode.data.rawResult).slice(0, 6000) + "...",
  rawSizeBytes: JSON.stringify(resultNode.data.rawResult).length,
});
assert.equal("project" in savedNode.data, false);
assert.equal("onPreviewMedia" in savedNode.data, false);

console.log("canvas storage persistence verified");
