import type { CanvasNodeDefinition, CanvasToolName } from "./types";

export type CanvasToolDefinition = {
  toolName: CanvasToolName;
  label: string;
  resultPresetId: string;
  resultKind: "image" | "video" | "audio";
  requiredFields: string[];
  defaultSettings: Record<string, unknown>;
  nodePresets: CanvasNodeDefinition[];
};

const imageAspectRatio = {
  id: "ImageAspectRatioNode",
  label: "图片比例 (aspect_ratio)",
  category: "settings",
  defaultData: { value: "1:1", type: "aspect_ratio" },
};

const imageName = {
  id: "ImageNameNode",
  label: "文件名 (name)",
  category: "settings",
  defaultData: { value: "canvas_image", type: "name" },
};

const imageTargetSize = {
  id: "ImageTargetSizeNode",
  label: "目标尺寸 (target_size)",
  category: "settings",
  defaultData: { value: "1024x1024", type: "target_size" },
};

const imageTransparent = {
  id: "ImageTransparentNode",
  label: "透明背景 (transparent)",
  category: "settings",
  defaultData: { value: "false", type: "transparent" },
};

const imageResolution = {
  id: "ImageResolutionNode",
  label: "图片精度 (resolution)",
  category: "settings",
  defaultData: { value: "1K", type: "resolution" },
};

const imageThinkingLevel = {
  id: "ImageThinkingLevelNode",
  label: "思考强度 (thinking_level)",
  category: "settings",
  defaultData: { value: "minimal", type: "thinking_level" },
};

const imageModel = {
  id: "ImageModelNode",
  label: "图片模型 (model)",
  category: "settings",
  defaultData: { value: "", type: "model" },
};

const imageSeed = {
  id: "ImageSeedNode",
  label: "图片种子 (seed)",
  category: "settings",
  defaultData: { value: "", type: "seed" },
};

export const CANVAS_TOOL_DEFINITIONS: CanvasToolDefinition[] = [
  {
    toolName: "generate_image",
    label: "生成图片",
    resultPresetId: "ImageResultNode",
    resultKind: "image",
    requiredFields: ["prompt", "name", "target_size"],
    defaultSettings: {
      name: "canvas_image",
      target_size: "1024x1024",
      aspect_ratio: "1:1",
      transparent: false,
      resolution: "1K",
      thinking_level: "minimal",
      seed: "",
      model: "",
    },
    nodePresets: [
      imageName,
      imageAspectRatio,
      imageTargetSize,
      imageTransparent,
      imageResolution,
      imageThinkingLevel,
      imageModel,
      imageSeed,
      {
        id: "GenerateImageNode",
        label: "执行生成图片",
        category: "executor",
        toolName: "generate_image",
        defaultData: { role: "image_executor", toolName: "generate_image" },
      },
      {
        id: "ImageResultNode",
        label: "图片生成结果",
        category: "executor",
        defaultData: { role: "image_result", resultKind: "image" },
      },
    ],
  },
  {
    toolName: "edit_image",
    label: "编辑图片",
    resultPresetId: "ImageResultNode",
    resultKind: "image",
    requiredFields: ["image", "prompt", "name", "target_size"],
    defaultSettings: {
      name: "canvas_edit",
      target_size: "1024x1024",
      aspect_ratio: "1:1",
      transparent: false,
      resolution: "1K",
      thinking_level: "minimal",
      seed: "",
      model: "",
    },
    nodePresets: [
      {
        id: "EditSourceImageNode",
        label: "编辑原图",
        category: "image",
        defaultData: { url: "", fileName: "", role: "edit_source", assetKind: "image" },
      },
      imageName,
      imageAspectRatio,
      imageTargetSize,
      imageTransparent,
      imageResolution,
      imageThinkingLevel,
      imageModel,
      imageSeed,
      {
        id: "EditImageNode",
        label: "执行编辑图片",
        category: "executor",
        toolName: "edit_image",
        defaultData: { role: "image_edit_executor", toolName: "edit_image" },
      },
    ],
  },
  {
    toolName: "create_video_task",
    label: "创建视频任务",
    resultPresetId: "VideoResultNode",
    resultKind: "video",
    requiredFields: ["mode"],
    defaultSettings: {
      mode: "multi_modal_reference",
      model: "default",
      ratio: "16:9",
      resolution: "720p",
      duration: 5,
      seed: "",
      generate_audio: false,
      return_last_frame: true,
      enable_web_search: false,
      execution_expires_after: "",
    },
    nodePresets: [],
  },
  {
    toolName: "text_to_music",
    label: "生成音乐",
    resultPresetId: "AudioResultNode",
    resultKind: "audio",
    requiredFields: ["prompt"],
    defaultSettings: {
      customMode: false,
      instrumental: false,
      model: "V4_5",
      style: "",
      title: "",
      negativeTags: "",
      vocalGender: "",
    },
    nodePresets: [
      {
        id: "MusicCustomModeNode",
        label: "自定义模式 (customMode)",
        category: "settings",
        defaultData: { value: "false", type: "customMode" },
      },
      {
        id: "MusicInstrumentalNode",
        label: "纯音乐 (instrumental)",
        category: "settings",
        defaultData: { value: "false", type: "instrumental" },
      },
      {
        id: "MusicModelNode",
        label: "音乐模型 (model)",
        category: "settings",
        defaultData: { value: "V4_5", type: "model" },
      },
      {
        id: "MusicStyleNode",
        label: "音乐风格 (style)",
        category: "settings",
        defaultData: { value: "", type: "style" },
      },
      {
        id: "MusicTitleNode",
        label: "曲名 (title)",
        category: "settings",
        defaultData: { value: "", type: "title" },
      },
      {
        id: "MusicNegativeTagsNode",
        label: "排除风格 (negativeTags)",
        category: "settings",
        defaultData: { value: "", type: "negativeTags" },
      },
      {
        id: "MusicVocalGenderNode",
        label: "人声性别 (vocalGender)",
        category: "settings",
        defaultData: { value: "", type: "vocalGender" },
      },
      {
        id: "TextToMusicNode",
        label: "执行生成音乐",
        category: "executor",
        toolName: "text_to_music",
        defaultData: { role: "music_executor", toolName: "text_to_music" },
      },
      {
        id: "AudioResultNode",
        label: "音乐生成结果",
        category: "executor",
        defaultData: { role: "audio_result", resultKind: "audio" },
      },
    ],
  },
];

export function getCanvasToolDefinition(toolName: CanvasToolName) {
  return CANVAS_TOOL_DEFINITIONS.find((definition) => definition.toolName === toolName);
}

export function getCanvasToolForExecutorPreset(presetId: string): CanvasToolName | undefined {
  if (presetId === "CreateVideoTaskNode") return "create_video_task";
  for (const definition of CANVAS_TOOL_DEFINITIONS) {
    if (definition.nodePresets.some((preset) => preset.id === presetId && preset.toolName)) {
      return definition.toolName;
    }
  }
  return undefined;
}

export function getCanvasResultPresetForTool(toolName: CanvasToolName) {
  return getCanvasToolDefinition(toolName)?.resultPresetId;
}
