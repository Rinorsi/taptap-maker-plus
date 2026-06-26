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

const neonRainChaseStoryboardColumns = [
  "镜号",
  "时长",
  "画面",
  "动作",
  "镜头",
  "角色/场景",
  "声音/音乐",
  "字幕/旁白",
  "生成提示词备注",
];

const neonRainChaseStoryboardRows = [
  ["01", "2s", "雨夜城市天桥，霓虹广告牌倒映在积水里。", "主角停在天桥边缘，回头看向远处追光。", "广角建立镜头，缓慢前推。", "黑色短夹克主角，赛博都市，湿润路面。", "低频合成器铺底，远处警笛。", "今晚，城市只剩下一条出口。", "冷色调，高反差，雨滴清晰，电影感。"],
  ["02", "3s", "主角穿过拥挤夜市，摊位蒸汽和灯牌交错。", "主角快步穿行，身后无人机搜索灯扫过人群。", "手持跟拍，轻微晃动，穿过遮挡物。", "夜市小摊，蒸汽，红蓝霓虹，人群剪影。", "鼓点开始加速，人群嘈杂。", "别回头，灯光会记住你的脸。", "运动模糊适中，保持主角轮廓可辨。"],
  ["03", "2s", "无人机从巷口上方俯冲，蓝色扫描线铺满墙面。", "主角贴墙闪避，扫描线擦过肩膀。", "无人机 POV，快速俯冲后急停。", "窄巷，金属管线，雨水从屋檐落下。", "电子扫描声，刹停音效。", "目标丢失：0.7 秒。", "强调蓝色扫描线和雨水颗粒。"],
  ["04", "3s", "主角跃过屋顶广告牌支架，远处高架灯线拉开。", "脚踩湿滑金属架，身体失衡后重新抓住边缘。", "低角度仰拍，随后快速横移跟随。", "屋顶广告牌，远处高楼，风雨。", "音乐进入主旋律，金属碰撞声。", "有些路，只能跳过去。", "动作要连贯，避免夸张翻滚。"],
];

const neonRainChaseStoryboardText = neonRainChaseStoryboardRows
  .map((row) =>
    neonRainChaseStoryboardColumns
      .map((column, index) => `${column}：${row[index] ?? ""}`)
      .join("\n"),
  )
  .join("\n\n");

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
  const storyboardPromptId = `storyboard-prompt-${timestamp}`;
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
    name: "雨夜霓虹追逐模板",
    nodes: [
      {
        id: imagePromptId,
        type: "textNode",
        position: { x: 40, y: 40 },
        width: 460,
        height: 260,
        data: {
          presetId: "MainPromptNode",
          text: "雨夜赛博都市追逐电影首图：黑色短夹克主角站在湿润天桥边缘，回头看向远处无人机搜索灯，霓虹广告牌倒映在积水里，蓝红冷色高反差，雨滴清晰，电影感，16:9 动画关键帧。",
          mentionTokens: [],
        },
      },
      { id: imageNameId, type: "settingsNode", position: { x: 580, y: 40 }, data: { presetId: "ImageNameNode", value: "neon_rain_chase_first_frame", type: "name" } },
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
          text: "no vocals, cyberpunk night chase soundtrack, dark synthwave bass, fast electronic drums, pulsing arpeggio, rain texture, distant siren, tense but stylish, 128 BPM, cinematic loopable background music.",
          mentionTokens: [],
        },
      },
      { id: musicCustomId, type: "settingsNode", position: { x: 580, y: 600 }, data: { presetId: "MusicCustomModeNode", value: "true", type: "customMode" } },
      { id: musicInstrumentalId, type: "settingsNode", position: { x: 580, y: 740 }, data: { presetId: "MusicInstrumentalNode", value: "true", type: "instrumental" } },
      { id: musicModelId, type: "settingsNode", position: { x: 580, y: 880 }, data: { presetId: "MusicModelNode", value: "V4_5", type: "model" } },
      { id: musicTitleId, type: "settingsNode", position: { x: 860, y: 600 }, data: { presetId: "MusicTitleNode", value: "Neon Rain Chase", type: "title" } },
      { id: musicStyleId, type: "settingsNode", position: { x: 860, y: 740 }, width: 360, height: 190, data: { presetId: "MusicStyleNode", value: "dark synthwave, cinematic chase, electronic drums, pulsing bass, rain ambience, distant siren, neon cyberpunk", type: "style" } },
      { id: musicNegativeId, type: "settingsNode", position: { x: 860, y: 960 }, width: 360, height: 190, data: { presetId: "MusicNegativeTagsNode", value: "vocals, vocal, singing, rap, cute, cheerful, acoustic, lo-fi", type: "negativeTags" } },
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
          text: "黑色短夹克主角在雨夜赛博都市中逃离无人机追踪，从天桥、夜市、窄巷、屋顶到高架飞驰，节奏紧张，动作连贯，主体轮廓清楚，雨滴、霓虹反射和蓝色扫描线清晰可见。",
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
          text: "开场广角建立城市雨夜环境，中段手持跟拍和低角度仰拍增强追逐感，高速段贴近车尾跟随，结尾远景拉开到城市天际线。",
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
          text: "主角回头、穿过夜市、贴墙闪避扫描线、跃过屋顶广告牌、冲刺上悬浮摩托、压低车身穿过窄缝，动作要连续，不要随机跳切。",
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
          text: "赛博雨夜、霓虹反射、冷色高反差、电影感追逐镜头。保持主体轮廓清晰，避免画面糊成一片，避免过度复杂光污染。",
          mentionTokens: [],
        },
      },
      {
        id: storyboardPromptId,
        type: "storyboardNode",
        position: { x: 40, y: 2160 },
        width: 720,
        height: 420,
        data: {
          presetId: "StoryboardTableNode",
          role: "storyboard_prompt",
          sourceName: "雨夜霓虹追逐当前片段分镜表",
          sourceType: "preset",
          columns: neonRainChaseStoryboardColumns,
          rows: neonRainChaseStoryboardRows,
          text: neonRainChaseStoryboardText,
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
      { id: `e-${storyboardPromptId}-${promptComposerId}`, source: storyboardPromptId, target: promptComposerId, ...defaultEdge },
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
