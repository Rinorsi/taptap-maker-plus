import type { Edge, Node } from "@xyflow/react";

export type CanvasTemplate = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
};

const defaultEdge = {
  animated: false,
  type: "custom",
  style: { stroke: "#00D9C5", strokeWidth: 2 },
};

export function createVideoReferenceTemplate(timestamp = Date.now()): CanvasTemplate {
  const promptId = `prompt-${timestamp}`;
  const modeId = `mode-${timestamp}`;
  const modelId = `model-${timestamp}`;
  const durationId = `duration-${timestamp}`;
  const returnLastFrameId = `return-last-frame-${timestamp}`;
  const payloadId = `payload-${timestamp}`;
  const taskId = `task-${timestamp}`;
  const resultId = `result-${timestamp}`;
  return {
    id: "video-reference",
    name: "多模态参考视频",
    nodes: [
      {
        id: promptId,
        type: "textNode",
        position: { x: 50, y: 50 },
        data: {
          presetId: "MainPromptNode",
          text: "在导演提示词里用 @图1、@视频1、@音频1 指定参考用途，例如：@图1 作为角色外观，@视频1 参考运镜，@音频1 参考节奏。",
          mentionTokens: [],
        },
      },
      {
        id: modeId,
        type: "settingsNode",
        position: { x: 50, y: 270 },
        data: { presetId: "VideoModeNode", value: "multi_modal_reference", type: "mode" },
      },
      {
        id: modelId,
        type: "settingsNode",
        position: { x: 50, y: 430 },
        data: { presetId: "VideoModelNode", value: "default", type: "model" },
      },
      {
        id: durationId,
        type: "settingsNode",
        position: { x: 50, y: 590 },
        data: { presetId: "VideoDurationNode", value: "5", type: "duration" },
      },
      {
        id: returnLastFrameId,
        type: "settingsNode",
        position: { x: 50, y: 750 },
        data: { presetId: "ReturnLastFrameNode", value: "true", type: "return_last_frame" },
      },
      {
        id: payloadId,
        type: "collectorNode",
        position: { x: 450, y: 180 },
        data: { presetId: "MultiModalPayloadNode" },
      },
      {
        id: taskId,
        type: "executorNode",
        position: { x: 800, y: 180 },
        data: { presetId: "CreateVideoTaskNode" },
      },
      {
        id: resultId,
        type: "resultNode",
        position: { x: 1120, y: 180 },
        data: { presetId: "VideoResultNode" },
      },
    ],
    edges: [
      { id: `e-${promptId}-${payloadId}`, source: promptId, target: payloadId, ...defaultEdge },
      { id: `e-${modeId}-${payloadId}`, source: modeId, target: payloadId, ...defaultEdge },
      { id: `e-${modelId}-${payloadId}`, source: modelId, target: payloadId, ...defaultEdge },
      { id: `e-${durationId}-${payloadId}`, source: durationId, target: payloadId, ...defaultEdge },
      { id: `e-${returnLastFrameId}-${payloadId}`, source: returnLastFrameId, target: payloadId, ...defaultEdge },
      { id: `e-${payloadId}-${taskId}`, source: payloadId, target: taskId, ...defaultEdge },
      { id: `e-${taskId}-${resultId}`, source: taskId, target: resultId, ...defaultEdge },
    ],
  };
}

export function createUniversalCanvasTemplate(timestamp = Date.now()): CanvasTemplate {
  const imagePromptId = `image-prompt-${timestamp}`;
  const imageNameId = `image-name-${timestamp}`;
  const imageRatioId = `image-ratio-${timestamp}`;
  const imageSizeId = `image-size-${timestamp}`;
  const imageExecutorId = `image-exec-${timestamp}`;
  const imageResultId = `image-result-${timestamp}`;

  const editSourceId = `edit-source-${timestamp}`;
  const editPromptId = `edit-prompt-${timestamp}`;
  const editNameId = `edit-name-${timestamp}`;
  const editSizeId = `edit-size-${timestamp}`;
  const editExecutorId = `edit-exec-${timestamp}`;
  const editResultId = `edit-result-${timestamp}`;

  const videoPromptId = `video-prompt-${timestamp}`;
  const videoModeId = `video-mode-${timestamp}`;
  const videoDurationId = `video-duration-${timestamp}`;
  const videoExecutorId = `video-exec-${timestamp}`;
  const videoResultId = `video-result-${timestamp}`;

  const musicPromptId = `music-prompt-${timestamp}`;
  const musicCustomId = `music-custom-${timestamp}`;
  const musicTitleId = `music-title-${timestamp}`;
  const musicStyleId = `music-style-${timestamp}`;
  const musicExecutorId = `music-exec-${timestamp}`;
  const musicResultId = `music-result-${timestamp}`;

  return {
    id: "universal",
    name: "全能节点画布",
    nodes: [
      {
        id: imagePromptId,
        type: "textNode",
        position: { x: 40, y: 40 },
        data: {
          presetId: "MainPromptNode",
          text: "图片生成：描述画面，并可引用 @素材。",
          mentionTokens: [],
        },
      },
      { id: imageNameId, type: "settingsNode", position: { x: 40, y: 220 }, data: { presetId: "ImageNameNode", value: "canvas_image", type: "name" } },
      { id: imageRatioId, type: "settingsNode", position: { x: 40, y: 380 }, data: { presetId: "ImageAspectRatioNode", value: "1:1", type: "aspect_ratio" } },
      { id: imageSizeId, type: "settingsNode", position: { x: 40, y: 540 }, data: { presetId: "ImageTargetSizeNode", value: "1024x1024", type: "target_size" } },
      { id: imageExecutorId, type: "executorNode", position: { x: 380, y: 230 }, data: { presetId: "GenerateImageNode", toolName: "generate_image" } },
      { id: imageResultId, type: "resultNode", position: { x: 700, y: 230 }, data: { presetId: "ImageResultNode" } },

      { id: editSourceId, type: "mediaNode", position: { x: 40, y: 760 }, data: { presetId: "EditSourceImageNode", role: "edit_source", url: "", fileName: "", assetKind: "image" } },
      { id: editPromptId, type: "textNode", position: { x: 40, y: 940 }, data: { presetId: "MainPromptNode", text: "图片编辑：说明要改什么，也可以继续引用 @素材。", mentionTokens: [] } },
      { id: editNameId, type: "settingsNode", position: { x: 40, y: 1120 }, data: { presetId: "ImageNameNode", value: "canvas_edit", type: "name" } },
      { id: editSizeId, type: "settingsNode", position: { x: 40, y: 1280 }, data: { presetId: "ImageTargetSizeNode", value: "1024x1024", type: "target_size" } },
      { id: editExecutorId, type: "executorNode", position: { x: 380, y: 980 }, data: { presetId: "EditImageNode", toolName: "edit_image" } },
      { id: editResultId, type: "resultNode", position: { x: 700, y: 980 }, data: { presetId: "ImageResultNode" } },

      { id: videoPromptId, type: "textNode", position: { x: 1080, y: 40 }, data: { presetId: "MainPromptNode", text: "视频：描述主体、动作、镜头、节奏，可引用 @素材。", mentionTokens: [] } },
      { id: videoModeId, type: "settingsNode", position: { x: 1080, y: 220 }, data: { presetId: "VideoModeNode", value: "multi_modal_reference", type: "mode" } },
      { id: videoDurationId, type: "settingsNode", position: { x: 1080, y: 380 }, data: { presetId: "VideoDurationNode", value: "5", type: "duration" } },
      { id: videoExecutorId, type: "executorNode", position: { x: 1420, y: 230 }, data: { presetId: "CreateVideoTaskNode", toolName: "create_video_task" } },
      { id: videoResultId, type: "resultNode", position: { x: 1740, y: 230 }, data: { presetId: "VideoResultNode" } },

      { id: musicPromptId, type: "textNode", position: { x: 1080, y: 760 }, data: { presetId: "MainPromptNode", text: "音乐：描述氛围、风格、节奏。", mentionTokens: [] } },
      { id: musicCustomId, type: "settingsNode", position: { x: 1080, y: 940 }, data: { presetId: "MusicCustomModeNode", value: "false", type: "customMode" } },
      { id: musicTitleId, type: "settingsNode", position: { x: 1080, y: 1100 }, data: { presetId: "MusicTitleNode", value: "", type: "title" } },
      { id: musicStyleId, type: "settingsNode", position: { x: 1080, y: 1260 }, data: { presetId: "MusicStyleNode", value: "", type: "style" } },
      { id: musicExecutorId, type: "executorNode", position: { x: 1420, y: 980 }, data: { presetId: "TextToMusicNode", toolName: "text_to_music" } },
      { id: musicResultId, type: "resultNode", position: { x: 1740, y: 980 }, data: { presetId: "AudioResultNode" } },
    ],
    edges: [
      { id: `e-${imagePromptId}-${imageExecutorId}`, source: imagePromptId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageNameId}-${imageExecutorId}`, source: imageNameId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageRatioId}-${imageExecutorId}`, source: imageRatioId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageSizeId}-${imageExecutorId}`, source: imageSizeId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageExecutorId}-${imageResultId}`, source: imageExecutorId, target: imageResultId, ...defaultEdge },

      { id: `e-${editSourceId}-${editExecutorId}`, source: editSourceId, target: editExecutorId, ...defaultEdge },
      { id: `e-${editPromptId}-${editExecutorId}`, source: editPromptId, target: editExecutorId, ...defaultEdge },
      { id: `e-${editNameId}-${editExecutorId}`, source: editNameId, target: editExecutorId, ...defaultEdge },
      { id: `e-${editSizeId}-${editExecutorId}`, source: editSizeId, target: editExecutorId, ...defaultEdge },
      { id: `e-${editExecutorId}-${editResultId}`, source: editExecutorId, target: editResultId, ...defaultEdge },

      { id: `e-${videoPromptId}-${videoExecutorId}`, source: videoPromptId, target: videoExecutorId, ...defaultEdge },
      { id: `e-${videoModeId}-${videoExecutorId}`, source: videoModeId, target: videoExecutorId, ...defaultEdge },
      { id: `e-${videoDurationId}-${videoExecutorId}`, source: videoDurationId, target: videoExecutorId, ...defaultEdge },
      { id: `e-${videoExecutorId}-${videoResultId}`, source: videoExecutorId, target: videoResultId, ...defaultEdge },

      { id: `e-${musicPromptId}-${musicExecutorId}`, source: musicPromptId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicCustomId}-${musicExecutorId}`, source: musicCustomId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicTitleId}-${musicExecutorId}`, source: musicTitleId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicStyleId}-${musicExecutorId}`, source: musicStyleId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicExecutorId}-${musicResultId}`, source: musicExecutorId, target: musicResultId, ...defaultEdge },
    ],
  };
}
