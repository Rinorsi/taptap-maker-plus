import { Image as ImageIcon, Film, Music, Settings2, WandSparkles, AlertCircle, Boxes, MessageSquare, Frame, FileVideo, Clapperboard, AudioLines, Drum, FileAudio, Ratio, LayoutList, Fingerprint, Layers, Type, LayoutTemplate, Activity, Route, Search, Timer, FileImage, Paintbrush, SlidersHorizontal, Table2 } from "lucide-react";
import { CANVAS_TOOL_DEFINITIONS, type CanvasToolName } from "../canvas-core";

export type NodeCategory = "prompt" | "image" | "video" | "audio" | "settings" | "collector" | "executor" | "utility";

export type NodePreset = {
  id: string; // The unique preset ID (e.g., 'CharacterImageNode')
  label: string;
  category: NodeCategory;
  icon: any; // Lucide icon
  description: string;
  inputHandles: string[];
  outputHandles: string[];
  defaultData: Record<string, unknown>;
  toolName?: CanvasToolName;
  mcpMapping?: {
    target: "prompt" | "images" | "videos" | "audios" | "settings";
    role?: "reference_image" | "reference_video" | "reference_audio";
  };
};

export const NODE_PRESETS: NodePreset[] = [
  // ==================== PROMPT ====================
  {
    id: "MainPromptNode",
    label: "导演提示词",
    category: "prompt",
    icon: MessageSquare,
    description: "用 @素材 绑定参考素材，并描述视频的主体、动作、镜头和节奏",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "director_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "StoryboardTableNode",
    label: "当前片段分镜表",
    category: "prompt",
    icon: Table2,
    description: "承载当前 10s 左右视频片段的镜号、画面、动作、镜头、声音等结构化信息",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { sourceName: "当前片段分镜表", sourceType: "manual", columns: [], rows: [], text: "", role: "storyboard_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "FirstFrameImageNode",
    label: "首帧图片",
    category: "image",
    icon: Frame,
    description: "作为视频第一帧，适用于首帧或首尾帧模式",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "first_frame" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "LastFrameImageNode",
    label: "尾帧图片",
    category: "image",
    icon: Frame,
    description: "作为视频结束帧，适用于首尾帧模式",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "last_frame" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "CameraPromptNode",
    label: "镜头语言",
    category: "prompt",
    icon: Frame,
    description: "描述运镜方式，如推镜、摇摄、无人机航拍等",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "camera_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "VideoModeNode",
    label: "生成模式 (Mode)",
    category: "settings",
    icon: Route,
    description: "选择文生视频、首帧、首尾帧或多模态参考",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "multi_modal_reference", type: "mode" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "MotionPromptNode",
    label: "动作描述",
    category: "prompt",
    icon: Activity,
    description: "描述主体或场景的物理运动规律",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "motion_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "StylePromptNode",
    label: "风格描述",
    category: "prompt",
    icon: LayoutTemplate,
    description: "文字描述视觉风格，如赛博朋克、水彩、写实",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "style_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "AtmospherePromptNode",
    label: "氛围描述",
    category: "prompt",
    icon: WandSparkles,
    description: "描述画面整体氛围、情绪或光影感觉",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "atmosphere_prompt" },
    mcpMapping: { target: "prompt" }
  },
  {
    id: "ConstraintPromptNode",
    label: "约束描述",
    category: "prompt",
    icon: AlertCircle,
    description: "负面提示词或不希望出现的内容约束",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "constraint_prompt" },
    mcpMapping: { target: "prompt" }
  },

  // ==================== IMAGE REFERENCE ====================
  {
    id: "CharacterImageNode",
    label: "角色参考图",
    category: "image",
    icon: ImageIcon,
    description: "指定视频中出现的核心角色长相与穿搭",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "character_image" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "SceneImageNode",
    label: "场景参考图",
    category: "image",
    icon: ImageIcon,
    description: "指定视频发生的环境和背景构造",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "scene_image" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "StyleImageNode",
    label: "风格参考图",
    category: "image",
    icon: ImageIcon,
    description: "提取参考图的美术风格和材质质感",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "style_image" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "StoryboardImageNode",
    label: "分镜参考图",
    category: "image",
    icon: ImageIcon,
    description: "指定画面的具体构图与物理位置关系",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "storyboard_image" },
    mcpMapping: { target: "images", role: "reference_image" }
  },
  {
    id: "GenericImageNode",
    label: "普通图片参考",
    category: "image",
    icon: ImageIcon,
    description: "通用的垫图参考功能",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "generic_image" },
    mcpMapping: { target: "images", role: "reference_image" }
  },

  // ==================== VIDEO REFERENCE ====================
  {
    id: "ActionVideoNode",
    label: "动作参考视频",
    category: "video",
    icon: FileVideo,
    description: "提取视频中人物或物体的运动轨迹",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "action_video" },
    mcpMapping: { target: "videos", role: "reference_video" }
  },
  {
    id: "CameraVideoNode",
    label: "运镜参考视频",
    category: "video",
    icon: Clapperboard,
    description: "提取视频中的摄像机运动轨迹",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "camera_video" },
    mcpMapping: { target: "videos", role: "reference_video" }
  },
  {
    id: "GenericVideoNode",
    label: "普通视频参考",
    category: "video",
    icon: Film,
    description: "通用的视频垫底功能",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "generic_video" },
    mcpMapping: { target: "videos", role: "reference_video" }
  },

  // ==================== AUDIO REFERENCE ====================
  {
    id: "MusicAudioNode",
    label: "音乐参考",
    category: "audio",
    icon: Music,
    description: "基于音乐的旋律和风格生成视频",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "music_audio" },
    mcpMapping: { target: "audios", role: "reference_audio" }
  },
  {
    id: "RhythmAudioNode",
    label: "节奏参考",
    category: "audio",
    icon: Drum,
    description: "提取音频的BPM和鼓点用于视频卡点",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "rhythm_audio" },
    mcpMapping: { target: "audios", role: "reference_audio" }
  },
  {
    id: "GenericAudioNode",
    label: "普通音频参考",
    category: "audio",
    icon: FileAudio,
    description: "通用的音频垫底功能",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { url: "", fileName: "", role: "generic_audio" },
    mcpMapping: { target: "audios", role: "reference_audio" }
  },

  // ==================== SETTINGS ====================
  {
    id: "VideoModelNode",
    label: "模型选择 (Model)",
    category: "settings",
    icon: Layers,
    description: "选择生成底层大模型",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "default", type: "model" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "VideoRatioNode",
    label: "画面比例 (Ratio)",
    category: "settings",
    icon: Ratio,
    description: "选择16:9, 9:16等画幅",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "16:9", type: "ratio" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "VideoResolutionNode",
    label: "分辨率 (Resolution)",
    category: "settings",
    icon: LayoutList,
    description: "指定输出画质",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "720p", type: "resolution" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "VideoDurationNode",
    label: "时长 (Duration)",
    category: "settings",
    icon: Settings2,
    description: "视频生成的秒数",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "5", type: "duration" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "VideoSeedNode",
    label: "随机种子 (Seed)",
    category: "settings",
    icon: Fingerprint,
    description: "用于固定生成的随机性",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "", type: "seed" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "GenerateAudioNode",
    label: "生成音频 (GenAudio)",
    category: "settings",
    icon: AudioLines,
    description: "开启后模型会自动配音",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "false", type: "generate_audio" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "ReturnLastFrameNode",
    label: "返回尾帧 (LastFrame)",
    category: "settings",
    icon: Frame,
    description: "生成完成后是否返回最后一帧图片",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "true", type: "return_last_frame" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "EnableWebSearchNode",
    label: "联网增强 (WebSearch)",
    category: "settings",
    icon: Search,
    description: "仅文生视频可用，按需联网补充提示词信息",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "false", type: "enable_web_search" },
    mcpMapping: { target: "settings" }
  },
  {
    id: "ExecutionExpiresAfterNode",
    label: "任务超时 (Expires)",
    category: "settings",
    icon: Timer,
    description: "设置任务超时时间，单位秒，范围 3600 到 259200",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { value: "", type: "execution_expires_after" },
    mcpMapping: { target: "settings" }
  },

  // ==================== COLLECTOR ====================
  {
    id: "PromptComposerNode",
    label: "提示词合并器",
    category: "collector",
    icon: Type,
    description: "将多个零散的提示词节点合并为一段完整的文本",
    inputHandles: ["left"],
    outputHandles: ["right"],
    defaultData: {}
  },
  {
    id: "MultiModalPayloadNode",
    label: "Payload 聚合器",
    category: "collector",
    icon: Boxes,
    description: "汇聚所有多模态数据并进行严格的 MCP 规则校验",
    inputHandles: ["left"],
    outputHandles: ["right"],
    defaultData: {}
  },

  // ==================== EXECUTOR ====================
  {
    id: "CreateVideoTaskNode",
    label: "创建视频任务",
    category: "executor",
    icon: Film,
    description: "将 Payload 发送到 Maker 后端执行视频生成",
    inputHandles: ["left"],
    outputHandles: ["right"],
    defaultData: { role: "video_executor", toolName: "create_video_task" },
    toolName: "create_video_task"
  },
  {
    id: "VideoResultNode",
    label: "视频生成结果",
    category: "executor",
    icon: Film,
    description: "预览最新生成的视频",
    inputHandles: ["left"],
    outputHandles: [],
    defaultData: { role: "video_result", resultKind: "video" }
  }
];

const EXTRA_CANVAS_PRESETS: NodePreset[] = CANVAS_TOOL_DEFINITIONS.flatMap((definition) =>
  definition.nodePresets
    .filter((preset) => !NODE_PRESETS.some((existing) => existing.id === preset.id))
    .map((preset) => {
      const isImageNode = preset.id === "EditSourceImageNode";
      const isImageResult = preset.id === "ImageResultNode";
      const isAudioResult = preset.id === "AudioResultNode";
      const icon =
        preset.toolName === "generate_image"
          ? FileImage
          : preset.toolName === "edit_image"
            ? Paintbrush
            : preset.toolName === "text_to_music"
              ? Music
              : isImageNode || isImageResult
                ? ImageIcon
                : isAudioResult
                  ? FileAudio
                  : SlidersHorizontal;
      const inputHandles = preset.category === "executor" ? ["left"] : [];
      const outputHandles =
        preset.id === "ImageResultNode" || preset.id === "AudioResultNode"
          ? []
          : preset.category === "settings" || preset.category === "image" || preset.category === "executor"
            ? ["right"]
            : [];
      return {
        id: preset.id,
        label: preset.label,
        category: preset.category as NodeCategory,
        icon,
        description: preset.description ?? preset.label,
        inputHandles,
        outputHandles,
        defaultData: preset.defaultData,
        toolName: preset.toolName,
        mcpMapping: preset.category === "settings" ? { target: "settings" as const } : undefined,
      };
    }),
);

NODE_PRESETS.push(...EXTRA_CANVAS_PRESETS);

export type NodePresetGroup = {
  id: string;
  label: string;
  items: NodePreset[];
};

const VIDEO_CANVAS_GROUPS: Array<{ id: string; label: string; presetIds: string[] }> = [
  {
    id: "image-generation",
    label: "图片生成",
    presetIds: [
      "MainPromptNode",
      "ImageNameNode",
      "ImageAspectRatioNode",
      "ImageTargetSizeNode",
      "ImageTransparentNode",
      "ImageResolutionNode",
      "ImageThinkingLevelNode",
      "ImageModelNode",
      "ImageSeedNode",
      "GenerateImageNode",
      "ImageResultNode",
    ],
  },
  {
    id: "image-reference",
    label: "图片参考",
    presetIds: [
      "FirstFrameImageNode",
      "LastFrameImageNode",
      "CharacterImageNode",
      "SceneImageNode",
      "StyleImageNode",
      "StoryboardImageNode",
      "GenericImageNode",
    ],
  },
  {
    id: "audio-generation",
    label: "音频生成",
    presetIds: [
      "MainPromptNode",
      "MusicCustomModeNode",
      "MusicInstrumentalNode",
      "MusicModelNode",
      "MusicStyleNode",
      "MusicTitleNode",
      "MusicNegativeTagsNode",
      "MusicVocalGenderNode",
      "TextToMusicNode",
      "AudioResultNode",
    ],
  },
  {
    id: "audio-reference",
    label: "音频参考",
    presetIds: ["MusicAudioNode", "RhythmAudioNode", "GenericAudioNode"],
  },
  {
    id: "video-prompt",
    label: "视频提示词",
    presetIds: [
      "MainPromptNode",
      "StoryboardTableNode",
      "CameraPromptNode",
      "MotionPromptNode",
      "StylePromptNode",
      "AtmospherePromptNode",
      "ConstraintPromptNode",
      "PromptComposerNode",
    ],
  },
  {
    id: "video-reference",
    label: "视频参考",
    presetIds: ["ActionVideoNode", "CameraVideoNode", "GenericVideoNode"],
  },
  {
    id: "video-settings",
    label: "视频参数",
    presetIds: [
      "VideoModeNode",
      "VideoModelNode",
      "VideoRatioNode",
      "VideoResolutionNode",
      "VideoDurationNode",
      "VideoSeedNode",
      "GenerateAudioNode",
      "ReturnLastFrameNode",
      "EnableWebSearchNode",
      "ExecutionExpiresAfterNode",
    ],
  },
  {
    id: "video-run",
    label: "视频执行与结果",
    presetIds: ["MultiModalPayloadNode", "CreateVideoTaskNode", "VideoResultNode"],
  },
];

const UNIVERSAL_GROUPS: Array<{ id: string; label: string; category: NodeCategory }> = [
  { id: "prompt", label: "提示词", category: "prompt" },
  { id: "image", label: "图片", category: "image" },
  { id: "audio", label: "音频", category: "audio" },
  { id: "video", label: "视频", category: "video" },
  { id: "settings", label: "参数设置", category: "settings" },
  { id: "collector", label: "聚合器", category: "collector" },
  { id: "executor", label: "执行器", category: "executor" },
];

export function getPresetGroupsForCanvas(canvasKind: "video-reference" | "universal"): NodePresetGroup[] {
  if (canvasKind === "video-reference") {
    return VIDEO_CANVAS_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      items: group.presetIds
        .map((presetId) => getPresetById(presetId))
        .filter((preset): preset is NodePreset => Boolean(preset)),
    })).filter((group) => group.items.length > 0);
  }
  return UNIVERSAL_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: NODE_PRESETS.filter((preset) => preset.category === group.category),
  })).filter((group) => group.items.length > 0);
}

export function getPresetById(id: string): NodePreset | undefined {
  return NODE_PRESETS.find(p => p.id === id);
}

export function getPresetsByCategory(category: NodeCategory): NodePreset[] {
  return NODE_PRESETS.filter(p => p.category === category);
}
