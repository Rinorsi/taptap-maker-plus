import { type Node, type Edge } from "@xyflow/react";
import { getPresetById } from "./nodeRegistry";

export type PayloadValidationResult = {
  ok: boolean;
  payload?: Record<string, unknown>;
  errors: string[];
  warnings: string[];
};

export function buildVideoPayloadFromGraph(nodes: Node[], edges: Edge[]): PayloadValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Find executors
  const executorNodes = nodes.filter(n => n.type === 'executorNode' && n.data.presetId === 'CreateVideoTaskNode');
  if (executorNodes.length === 0) {
    errors.push("缺少执行节点 (运行流水线)。");
    return { ok: false, errors, warnings };
  }
  const executorNode = executorNodes[0];

  // Build the graph adjacency list for backwards traversal
  const prevMap = new Map<string, Node[]>();
  for (const e of edges) {
    if (!prevMap.has(e.target)) prevMap.set(e.target, []);
    const sourceNode = nodes.find(n => n.id === e.source);
    if (sourceNode) prevMap.get(e.target)!.push(sourceNode);
  }

  // Find MultiModalPayloadNode connected to executor
  const directPrevs = prevMap.get(executorNode.id) || [];
  const aggregator = directPrevs.find(n => n.data.presetId === "MultiModalPayloadNode");
  
  if (!aggregator) {
    errors.push("执行节点必须连接到「规则校验」聚合器 (MultiModalPayloadNode)。请先连接到 Payload 聚合器。");
    return { ok: false, errors, warnings };
  }

  // Traverse recursively from all executor inputs. This allows prompt composer
  // branches to connect directly to the executor while Payload handles validation.
  const collectedNodes: Node[] = [];
  const visited = new Set<string>();
  
  const traverse = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const prevs = prevMap.get(nodeId) || [];
    for (const p of prevs) {
      collectedNodes.push(p);
      traverse(p.id);
    }
  };
  
  for (const node of directPrevs) {
    collectedNodes.push(node);
    traverse(node.id);
  }

  // Now gather data according to presets
  const promptArr: string[] = [];
  const images: any[] = [];
  const videos: any[] = [];
  const audios: any[] = [];
  
  const settings = {
    model: "default",
    ratio: "16:9",
    resolution: "720p",
    duration: 5,
    seed: "",
    generate_audio: false,
    return_last_frame: false
  };

  for (const n of collectedNodes) {
    const preset = getPresetById(n.data.presetId as string);
    if (!preset) continue;

    if (preset.category === "prompt") {
      if (n.data.text) {
        promptArr.push(`[${preset.label}] ${n.data.text}`);
      }
    } else if (preset.category === "image") {
      const url = n.data.relativePath || n.data.url;
      if (!url) {
        errors.push(`存在空的图像参考节点 (${preset.label})，请为其指定有效的图片，或者将其删除。`);
      } else {
        images.push({ url, role: "reference_image" });
      }
    } else if (preset.category === "video") {
      const url = n.data.relativePath || n.data.url;
      if (!url) {
        errors.push(`存在空的视频参考节点 (${preset.label})，请为其指定有效的视频，或者将其删除。`);
      } else {
        videos.push({ url, role: "reference_video" });
      }
    } else if (preset.category === "audio") {
      const url = n.data.relativePath || n.data.url;
      if (!url) {
        errors.push(`存在空的音频参考节点 (${preset.label})，请为其指定有效的音频，或者将其删除。`);
      } else {
        audios.push({ url, role: "reference_audio" });
      }
    } else if (preset.category === "settings") {
      const type = n.data.type || preset.defaultData?.type;
      const value = n.data.value !== undefined ? n.data.value : preset.defaultData?.value;
      
      if (type === "model") settings.model = String(value);
      if (type === "ratio") settings.ratio = String(value);
      if (type === "resolution") settings.resolution = String(value);
      if (type === "duration") settings.duration = Number(value);
      if (type === "seed") settings.seed = String(value);
      if (type === "generate_audio") settings.generate_audio = String(value) === "true";
      if (type === "return_last_frame") settings.return_last_frame = String(value) === "true";
    }
  }

  const prompt = promptArr.join("\n");

  // Validations
  if (!prompt || prompt.trim() === "") {
    warnings.push("未采集到有效提示词。请连接至少一个写入文本的提示词节点；「提示词合并器」只负责中转，不会自动生成提示词。");
  }

  if (images.length === 0 && videos.length === 0 && audios.length === 0) {
    errors.push("多模态参考画布需要至少一个参考素材。如只想纯文生视频，请切换到标准生成或直接选择快速模式。");
  }

  if (audios.length > 0 && images.length === 0) {
    errors.push("带有音频参考时，必须提供至少一张图片作为初始画面参考。");
  }

  if (images.length > 9) {
    errors.push(`图片参考数量超限 (当前 ${images.length} 张，最大允许 9 张)。`);
  }
  
  if (videos.length > 3) {
    errors.push(`视频参考数量超限 (当前 ${videos.length} 个，最大允许 3 个)。`);
  }
  
  if (audios.length > 3) {
    errors.push(`音频参考数量超限 (当前 ${audios.length} 个，最大允许 3 个)。`);
  }

  // Enum and type validations
  const validModels = ["default", "fast"];
  if (!validModels.includes(settings.model)) {
    errors.push(`Model 参数非法: ${settings.model}。仅支持: ${validModels.join(", ")}`);
  }

  const validResolutions = ["480p", "720p"];
  if (!validResolutions.includes(settings.resolution)) {
    errors.push(`Resolution 参数非法: ${settings.resolution}。仅支持: ${validResolutions.join(", ")}`);
  }

  const validRatios = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"];
  if (!validRatios.includes(settings.ratio)) {
    errors.push(`Ratio 参数非法: ${settings.ratio}。仅支持: ${validRatios.join(", ")}`);
  }

  if (!Number.isInteger(settings.duration) || (settings.duration !== -1 && (settings.duration < 4 || settings.duration > 15))) {
    errors.push(`Duration 参数非法: ${settings.duration}。必须是 -1 或 4到15 的整数。`);
  }
  if (settings.duration === -1) {
    warnings.push("推荐指定明确的生成时长，-1 (自动) 可能会导致不确定的长度。");
  }

  let finalSeed: number | undefined = undefined;
  if (settings.seed && settings.seed.trim() !== "") {
    const parsedSeed = Number(settings.seed.trim());
    if (!Number.isInteger(parsedSeed)) {
      errors.push(`Seed 必须是整数，当前传入的是非整数或非法字符。`);
    } else {
      finalSeed = parsedSeed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  // Construct final payload
  const payload: Record<string, unknown> = {
    mode: "multi_modal_reference", // Enforce multi_modal_reference
    prompt: prompt.trim(),
    model: settings.model,
    ratio: settings.ratio,
    resolution: settings.resolution,
    duration: settings.duration,
    generate_audio: settings.generate_audio,
    return_last_frame: settings.return_last_frame
  };

  if (finalSeed !== undefined) {
    payload.seed = finalSeed;
  }
  if (images.length > 0) payload.images = images;
  if (videos.length > 0) payload.videos = videos;
  if (audios.length > 0) payload.audios = audios;

  return {
    ok: true,
    payload,
    errors,
    warnings
  };
}
