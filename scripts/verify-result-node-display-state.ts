import assert from "node:assert/strict";
import type { Node } from "@xyflow/react";
import { createSharedCanvasModel } from "../apps/web/src/features/canvas-core/model";

const imageResultNode: Node = {
  id: "image-result-1",
  type: "resultNode",
  position: { x: 0, y: 0 },
  data: {
    presetId: "ImageResultNode",
    busy: true,
    rawResult: {
      workspace_image_path: "assets/image/generated.png",
    },
  },
};

const model = createSharedCanvasModel([imageResultNode], []);
const assets = model.resultAssetsByNodeId.get("image-result-1") ?? [];
const hasDisplayResult = assets.some(
  (asset) => asset.kind === "image" && asset.role !== "last_frame",
);
const shouldShowLoading = Boolean(imageResultNode.data.busy) && !hasDisplayResult;

assert.deepEqual(assets, [
  {
    kind: "image",
    role: "image_result",
    path: "assets/image/generated.png",
  },
]);
assert.equal(shouldShowLoading, false);

console.log("result node display state verified");
