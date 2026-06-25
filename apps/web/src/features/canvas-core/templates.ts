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
  const imagePromptId = `image-prompt-${timestamp}`;
  const imageNameId = `image-name-${timestamp}`;
  const imageRatioId = `image-ratio-${timestamp}`;
  const imageSizeId = `image-size-${timestamp}`;
  const imageResolutionId = `image-resolution-${timestamp}`;
  const imageModelId = `image-model-${timestamp}`;
  const imageExecutorId = `image-exec-${timestamp}`;
  const imageResultId = `image-result-${timestamp}`;

  const musicPromptId = `music-prompt-${timestamp}`;
  const musicCustomId = `music-custom-${timestamp}`;
  const musicInstrumentalId = `music-instrumental-${timestamp}`;
  const musicModelId = `music-model-${timestamp}`;
  const musicStyleId = `music-style-${timestamp}`;
  const musicTitleId = `music-title-${timestamp}`;
  const musicNegativeId = `music-negative-${timestamp}`;
  const musicExecutorId = `music-exec-${timestamp}`;
  const musicResultId = `music-result-${timestamp}`;

  const videoPromptId = `video-prompt-${timestamp}`;
  const cameraPromptId = `camera-prompt-${timestamp}`;
  const motionPromptId = `motion-prompt-${timestamp}`;
  const stylePromptId = `style-prompt-${timestamp}`;
  const promptComposerId = `prompt-composer-${timestamp}`;
  const modeId = `mode-${timestamp}`;
  const modelId = `model-${timestamp}`;
  const ratioId = `ratio-${timestamp}`;
  const resolutionId = `resolution-${timestamp}`;
  const durationId = `duration-${timestamp}`;
  const returnLastFrameId = `return-last-frame-${timestamp}`;
  const payloadId = `payload-${timestamp}`;
  const taskId = `task-${timestamp}`;
  const resultId = `result-${timestamp}`;
  return {
    id: "video-reference",
    name: "清透二次元动画模板",
    nodes: [
      {
        id: imagePromptId,
        type: "textNode",
        position: { x: 40, y: 40 },
        width: 460,
        height: 260,
        data: {
          presetId: "MainPromptNode",
          text: "可爱清透风格二次元动画首图：一位浅青色短发少女站在玻璃温室门口，白色连衣裙与透明雨披，柔和粉蓝配色，清晰线条，大色块，干净平涂，简洁光影，少量高光，背景元素克制，轻盈治愈，16:9 动画截图。",
          mentionTokens: [],
        },
      },
      { id: imageNameId, type: "settingsNode", position: { x: 580, y: 40 }, data: { presetId: "ImageNameNode", value: "clear_anime_first_frame", type: "name" } },
      { id: imageRatioId, type: "settingsNode", position: { x: 580, y: 180 }, data: { presetId: "ImageAspectRatioNode", value: "16:9", type: "aspect_ratio" } },
      { id: imageSizeId, type: "settingsNode", position: { x: 580, y: 320 }, data: { presetId: "ImageTargetSizeNode", value: "1344x768", type: "target_size" } },
      { id: imageResolutionId, type: "settingsNode", position: { x: 860, y: 40 }, data: { presetId: "ImageResolutionNode", value: "1K", type: "resolution" } },
      { id: imageModelId, type: "settingsNode", position: { x: 860, y: 180 }, data: { presetId: "ImageModelNode", value: "nanobanana", type: "model" } },
      {
        id: imageExecutorId,
        type: "executorNode",
        position: { x: 1180, y: 150 },
        data: {
          presetId: "GenerateImageNode",
          role: "image_executor",
          toolName: "generate_image",
        },
      },
      {
        id: imageResultId,
        type: "resultNode",
        position: { x: 1540, y: 120 },
        width: 380,
        height: 300,
        data: {
          presetId: "ImageResultNode",
          resultKind: "image",
        },
      },
      {
        id: musicPromptId,
        type: "textNode",
        position: { x: 40, y: 600 },
        width: 460,
        height: 250,
        data: {
          presetId: "MainPromptNode",
          text: "no vocals, cute transparent anime opening BGM, glockenspiel, soft synth bell, light future bass drums, airy pads, gentle 92 BPM, sparkling water-drop texture, clean loopable game background music.",
          mentionTokens: [],
        },
      },
      { id: musicCustomId, type: "settingsNode", position: { x: 580, y: 600 }, data: { presetId: "MusicCustomModeNode", value: "true", type: "customMode" } },
      { id: musicInstrumentalId, type: "settingsNode", position: { x: 580, y: 740 }, data: { presetId: "MusicInstrumentalNode", value: "true", type: "instrumental" } },
      { id: musicModelId, type: "settingsNode", position: { x: 580, y: 880 }, data: { presetId: "MusicModelNode", value: "V4_5", type: "model" } },
      { id: musicTitleId, type: "settingsNode", position: { x: 860, y: 600 }, data: { presetId: "MusicTitleNode", value: "Glass Garden Opening", type: "title" } },
      { id: musicStyleId, type: "settingsNode", position: { x: 860, y: 740 }, width: 360, height: 190, data: { presetId: "MusicStyleNode", value: "kawaii future bass, airy synth, glockenspiel, soft bell, clean loop, transparent anime opening", type: "style" } },
      { id: musicNegativeId, type: "settingsNode", position: { x: 860, y: 960 }, width: 360, height: 190, data: { presetId: "MusicNegativeTagsNode", value: "vocals, vocal, singing, rap, dark, aggressive, distorted", type: "negativeTags" } },
      {
        id: musicExecutorId,
        type: "executorNode",
        position: { x: 1280, y: 820 },
        data: {
          presetId: "TextToMusicNode",
          role: "music_executor",
          toolName: "text_to_music",
        },
      },
      {
        id: musicResultId,
        type: "resultNode",
        position: { x: 1640, y: 790 },
        width: 380,
        height: 280,
        data: {
          presetId: "AudioResultNode",
          resultKind: "audio",
        },
      },
      {
        id: videoPromptId,
        type: "textNode",
        position: { x: 40, y: 1180 },
        width: 460,
        height: 260,
        data: {
          presetId: "MainPromptNode",
          text: "少女在玻璃温室前回头微笑，发梢和雨披轻轻飘动，镜头从中景缓慢推进到近景。画面保持清晰线条、大色块、干净平涂、简洁光影，不要复杂光影和过多细节。",
          mentionTokens: [],
        },
      },
      {
        id: cameraPromptId,
        type: "textNode",
        position: { x: 40, y: 1500 },
        width: 460,
        height: 180,
        data: {
          presetId: "CameraPromptNode",
          text: "轻微手持感，缓慢 dolly in，背景轻微景深，角色轮廓清楚，画面不要堆叠复杂反光。",
          mentionTokens: [],
        },
      },
      {
        id: motionPromptId,
        type: "textNode",
        position: { x: 40, y: 1720 },
        width: 460,
        height: 180,
        data: {
          presetId: "MotionPromptNode",
          text: "角色先轻轻抬头，再转身回眸，裙摆和雨披小幅摆动，动作幅度克制，不要剧烈跳切。",
          mentionTokens: [],
        },
      },
      {
        id: stylePromptId,
        type: "textNode",
        position: { x: 40, y: 1940 },
        width: 460,
        height: 180,
        data: {
          presetId: "StylePromptNode",
          text: "清透、明亮、低对比、粉蓝绿色系，二次元动画感，清晰线条，大色块，简约背景，避免暗黑、厚重、复杂光影、过度锐化、真人写实脸。",
          mentionTokens: [],
        },
      },
      {
        id: promptComposerId,
        type: "collectorNode",
        position: { x: 580, y: 1500 },
        width: 500,
        height: 520,
        data: { presetId: "PromptComposerNode", sourcePaneHeight: 180 },
      },
      {
        id: modeId,
        type: "settingsNode",
        position: { x: 1220, y: 1180 },
        data: { presetId: "VideoModeNode", value: "multi_modal_reference", type: "mode" },
      },
      {
        id: modelId,
        type: "settingsNode",
        position: { x: 1220, y: 1320 },
        data: { presetId: "VideoModelNode", value: "default", type: "model" },
      },
      {
        id: ratioId,
        type: "settingsNode",
        position: { x: 1220, y: 1460 },
        data: { presetId: "VideoRatioNode", value: "16:9", type: "ratio" },
      },
      {
        id: resolutionId,
        type: "settingsNode",
        position: { x: 1220, y: 1600 },
        data: { presetId: "VideoResolutionNode", value: "720p", type: "resolution" },
      },
      {
        id: durationId,
        type: "settingsNode",
        position: { x: 1220, y: 1740 },
        data: { presetId: "VideoDurationNode", value: "5", type: "duration" },
      },
      {
        id: returnLastFrameId,
        type: "settingsNode",
        position: { x: 1220, y: 1880 },
        data: { presetId: "ReturnLastFrameNode", value: "true", type: "return_last_frame" },
      },
      {
        id: payloadId,
        type: "collectorNode",
        position: { x: 1580, y: 1500 },
        width: 410,
        height: 300,
        data: { presetId: "MultiModalPayloadNode" },
      },
      {
        id: taskId,
        type: "executorNode",
        position: { x: 2060, y: 1540 },
        data: { presetId: "CreateVideoTaskNode" },
      },
      {
        id: resultId,
        type: "resultNode",
        position: { x: 2420, y: 1500 },
        width: 390,
        height: 310,
        data: { presetId: "VideoResultNode" },
      },
    ],
    edges: [
      { id: `e-${imagePromptId}-${imageExecutorId}`, source: imagePromptId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageNameId}-${imageExecutorId}`, source: imageNameId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageRatioId}-${imageExecutorId}`, source: imageRatioId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageSizeId}-${imageExecutorId}`, source: imageSizeId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageResolutionId}-${imageExecutorId}`, source: imageResolutionId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageModelId}-${imageExecutorId}`, source: imageModelId, target: imageExecutorId, ...defaultEdge },
      { id: `e-${imageExecutorId}-${imageResultId}`, source: imageExecutorId, target: imageResultId, ...defaultEdge },

      { id: `e-${musicPromptId}-${musicExecutorId}`, source: musicPromptId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicCustomId}-${musicExecutorId}`, source: musicCustomId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicInstrumentalId}-${musicExecutorId}`, source: musicInstrumentalId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicModelId}-${musicExecutorId}`, source: musicModelId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicTitleId}-${musicExecutorId}`, source: musicTitleId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicStyleId}-${musicExecutorId}`, source: musicStyleId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicNegativeId}-${musicExecutorId}`, source: musicNegativeId, target: musicExecutorId, ...defaultEdge },
      { id: `e-${musicExecutorId}-${musicResultId}`, source: musicExecutorId, target: musicResultId, ...defaultEdge },

      { id: `e-${videoPromptId}-${promptComposerId}`, source: videoPromptId, target: promptComposerId, ...defaultEdge },
      { id: `e-${cameraPromptId}-${promptComposerId}`, source: cameraPromptId, target: promptComposerId, ...defaultEdge },
      { id: `e-${motionPromptId}-${promptComposerId}`, source: motionPromptId, target: promptComposerId, ...defaultEdge },
      { id: `e-${stylePromptId}-${promptComposerId}`, source: stylePromptId, target: promptComposerId, ...defaultEdge },
      { id: `e-${promptComposerId}-${payloadId}`, source: promptComposerId, target: payloadId, ...defaultEdge },
      { id: `e-${imageResultId}-${payloadId}`, source: imageResultId, target: payloadId, ...defaultEdge },
      { id: `e-${musicResultId}-${payloadId}`, source: musicResultId, target: payloadId, ...defaultEdge },
      { id: `e-${modeId}-${payloadId}`, source: modeId, target: payloadId, ...defaultEdge },
      { id: `e-${modelId}-${payloadId}`, source: modelId, target: payloadId, ...defaultEdge },
      { id: `e-${ratioId}-${payloadId}`, source: ratioId, target: payloadId, ...defaultEdge },
      { id: `e-${resolutionId}-${payloadId}`, source: resolutionId, target: payloadId, ...defaultEdge },
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
