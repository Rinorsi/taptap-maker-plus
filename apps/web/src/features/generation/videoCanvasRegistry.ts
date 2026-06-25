import { createCanvasNodeRegistry } from "../canvas-core";
import { NODE_PRESETS } from "./nodeRegistry";

export const videoCanvasNodeRegistry = createCanvasNodeRegistry(
  "video-reference",
  "视频多模态参考画布",
  NODE_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    category: preset.category,
    description: preset.description,
    toolName: preset.toolName,
    defaultData: preset.defaultData,
  })),
);
