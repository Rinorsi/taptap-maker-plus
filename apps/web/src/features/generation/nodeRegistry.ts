import { Image as ImageIcon, Film, Music, Settings2, WandSparkles, Play, AlertCircle, Boxes, MessageSquare, Frame, FileVideo, Clapperboard, AudioLines, Drum, FileAudio, Ratio, LayoutList, Fingerprint, Layers, Type, LayoutTemplate, Activity } from "lucide-react";

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
  mcpMapping?: {
    target: "prompt" | "images" | "videos" | "audios" | "settings";
    role?: "reference_image" | "reference_video" | "reference_audio";
  };
};

export const NODE_PRESETS: NodePreset[] = [
  // ==================== PROMPT ====================
  {
    id: "MainPromptNode",
    label: "主提示词",
    category: "prompt",
    icon: MessageSquare,
    description: "描述视频的主体画面和核心内容",
    inputHandles: [],
    outputHandles: ["right"],
    defaultData: { text: "", role: "main_prompt" },
    mcpMapping: { target: "prompt" }
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
    defaultData: { role: "video_executor" }
  },
  {
    id: "VideoResultNode",
    label: "视频生成结果",
    category: "executor",
    icon: Film,
    description: "预览最新生成的视频",
    inputHandles: ["left"],
    outputHandles: [],
    defaultData: { role: "video_result" }
  }
];

export function getPresetById(id: string): NodePreset | undefined {
  return NODE_PRESETS.find(p => p.id === id);
}

export function getPresetsByCategory(category: NodeCategory): NodePreset[] {
  return NODE_PRESETS.filter(p => p.category === category);
}
