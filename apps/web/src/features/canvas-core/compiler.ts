import type { Edge, Node } from "@xyflow/react";
import { collectCanvasAssetReferences, describeAssetUse, extractMentionAliases } from "./assetReferences";
import { getCanvasToolDefinition, getCanvasToolForExecutorPreset } from "./toolRegistry";
import type {
  CanvasAssetReference,
  CanvasCompileIssue,
  CanvasCompileResult,
  CanvasMentionToken,
  CanvasPayloadFieldSource,
  CanvasPromptReference,
  CanvasToolName,
} from "./types";

export function compileCanvasPayload(nodes: Node[], edges: Edge[], executorNodeId?: string): CanvasCompileResult {
  const issues: CanvasCompileIssue[] = [];
  const fieldSources: CanvasPayloadFieldSource[] = [];
  const references = collectCanvasAssetReferences(nodes);
  const executorNode = findExecutorNode(nodes, executorNodeId);
  if (!executorNode) {
    issues.push({
      severity: "error",
      nodeId: executorNodeId,
      message: executorNodeId ? "没有找到要执行的节点。" : "缺少执行节点。",
    });
    return { ok: false, issues, fieldSources, references };
  }

  const toolName = resolveExecutorToolName(executorNode);
  if (!toolName) {
    issues.push({ severity: "error", nodeId: executorNode.id, message: "执行节点没有绑定可识别的 MCP 工具。" });
    return { ok: false, issues, fieldSources, references };
  }

  if (toolName === "create_video_task") {
    return compileVideoCanvasPayload(nodes, edges, executorNode.id);
  }

  return compileSimpleCanvasTool(nodes, edges, executorNode, toolName, issues, fieldSources, references);
}

export function compileVideoCanvasPayload(nodes: Node[], edges: Edge[], executorNodeId?: string): CanvasCompileResult {
  const issues: CanvasCompileIssue[] = [];
  const fieldSources: CanvasPayloadFieldSource[] = [];
  const references = collectCanvasAssetReferences(nodes);
  const executorNodes = nodes.filter(
    (node) => node.type === "executorNode" && resolveExecutorToolName(node) === "create_video_task",
  );
  if (executorNodes.length === 0) {
    issues.push({ severity: "error", message: "缺少执行节点：创建视频任务。" });
    return { ok: false, toolName: "create_video_task", issues, fieldSources, references };
  }

  const executorNode = executorNodeId
    ? executorNodes.find((node) => node.id === executorNodeId)
    : executorNodes[0];
  if (!executorNode) {
    issues.push({ severity: "error", nodeId: executorNodeId, message: "没有找到要执行的创建视频任务节点。" });
    return { ok: false, toolName: "create_video_task", issues, fieldSources, references };
  }
  const definition = getCanvasToolDefinition("create_video_task");
  const settings = { ...(definition?.defaultSettings ?? {}) } as Record<string, unknown>;
  const settingSources = new Map<string, string>();
  const reachableNodes = collectUpstreamNodes(nodes, edges, executorNode.id);
  const promptParts: string[] = [];
  const referencedAliases = new Set<string>();
  const textMentionAliases = new Set<string>();
  const mentionTokens: CanvasMentionToken[] = [];
  const promptReferences: CanvasPromptReference[] = [];

  collectPromptAndSettings(reachableNodes, promptParts, settings, settingSources, fieldSources, referencedAliases, textMentionAliases, mentionTokens, references, promptReferences);

  const prompt = composePrompt(promptParts, []);
  validateVideoSettings(settings, issues, settingSources, prompt);

  const connectedReferences = collectConnectedReferences(reachableNodes, references, mentionTokens, textMentionAliases);
  const finalPrompt = composePrompt(promptParts, connectedReferences);
  const images = connectedReferences.filter((reference) => reference.kind === "image");
  const videos = connectedReferences.filter((reference) => reference.kind === "video");
  const audios = connectedReferences.filter((reference) => reference.kind === "audio");
  validateVideoReferences(String(settings.mode), images, videos, audios, issues);
  validateMentionBindings(referencedAliases, mentionTokens, references, issues);
  validateReferencePaths(connectedReferences, issues);

  const mode = String(settings.mode);
  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, toolName: "create_video_task", issues, fieldSources, references, promptReferences, mode };
  }

  const payload: Record<string, unknown> = {
    mode,
    prompt: finalPrompt,
    model: settings.model,
    ratio: settings.ratio,
    resolution: settings.resolution,
    duration: Number(settings.duration),
    generate_audio: toBoolean(settings.generate_audio),
    return_last_frame: toBoolean(settings.return_last_frame),
    enable_web_search: toBoolean(settings.enable_web_search),
  };

  setOptionalInteger(payload, "seed", settings.seed);
  setOptionalInteger(payload, "execution_expires_after", settings.execution_expires_after);
  const imagePayload = buildVideoImagePayload(mode, images);
  if (imagePayload.length > 0) payload.images = imagePayload;
  images.forEach((reference, index) => pushReferenceFieldSource(fieldSources, `images[${index}].url`, reference));
  if (videos.length > 0) {
    payload.videos = videos.map((reference, index) => {
      pushReferenceFieldSource(fieldSources, `videos[${index}].url`, reference);
      return { url: reference.relativePath ?? reference.url, role: "reference_video" };
    });
  }
  if (audios.length > 0) {
    payload.audios = audios.map((reference, index) => {
      pushReferenceFieldSource(fieldSources, `audios[${index}].url`, reference);
      return { url: reference.relativePath ?? reference.url, role: "reference_audio" };
    });
  }

  return { ok: true, toolName: "create_video_task", payload, issues, fieldSources, references, promptReferences, mode };
}

function compileSimpleCanvasTool(
  nodes: Node[],
  edges: Edge[],
  executorNode: Node,
  toolName: Exclude<CanvasToolName, "create_video_task">,
  issues: CanvasCompileIssue[],
  fieldSources: CanvasPayloadFieldSource[],
  references: CanvasAssetReference[],
): CanvasCompileResult {
  const definition = getCanvasToolDefinition(toolName);
  const settings = { ...(definition?.defaultSettings ?? {}) };
  const settingSources = new Map<string, string>();
  const reachableNodes = collectUpstreamNodes(nodes, edges, executorNode.id);
  const promptParts: string[] = [];
  const referencedAliases = new Set<string>();
  const textMentionAliases = new Set<string>();
  const mentionTokens: CanvasMentionToken[] = [];
  const promptReferences: CanvasPromptReference[] = [];

  collectPromptAndSettings(reachableNodes, promptParts, settings, settingSources, fieldSources, referencedAliases, textMentionAliases, mentionTokens, references, promptReferences);
  const connectedReferences = collectConnectedReferences(reachableNodes, references, mentionTokens, textMentionAliases);
  validateMentionBindings(referencedAliases, mentionTokens, references, issues);
  validateReferencePaths(connectedReferences, issues);

  const prompt = composePrompt(promptParts, connectedReferences);
  if (!prompt.trim()) {
    issues.push({ severity: "error", nodeId: promptParts.length ? undefined : executorNode.id, field: "prompt", message: "缺少提示词。" });
  }

  const payload = buildSimplePayload(toolName, prompt, settings, settingSources, connectedReferences, fieldSources, issues);
  validateRequiredFields(toolName, definition?.requiredFields ?? [], payload, executorNode.id, issues);

  if (issues.some((issue) => issue.severity === "error")) {
    return { ok: false, toolName, issues, fieldSources, references, promptReferences };
  }
  return { ok: true, toolName, payload, issues, fieldSources, references, promptReferences };
}

function buildSimplePayload(
  toolName: Exclude<CanvasToolName, "create_video_task">,
  prompt: string,
  settings: Record<string, unknown>,
  settingSources: Map<string, string>,
  references: CanvasAssetReference[],
  fieldSources: CanvasPayloadFieldSource[],
  issues: CanvasCompileIssue[],
) {
  if (toolName === "text_to_music") {
    const customMode = toBoolean(settings.customMode);
    const payload: Record<string, unknown> = {
      prompt,
      customMode,
      model: String(settings.model || "V4_5"),
    };
    setOptionalString(payload, "negativeTags", settings.negativeTags);
    if (customMode) {
      setOptionalString(payload, "title", settings.title);
      setOptionalString(payload, "style", settings.style);
      payload.instrumental = toBoolean(settings.instrumental);
      if (!payload.instrumental) setOptionalString(payload, "vocalGender", settings.vocalGender);
      if (!payload.title) issues.push({ severity: "error", nodeId: settingSources.get("title"), field: "title", message: "customMode=true 时必须填写 title。" });
      if (!payload.style) issues.push({ severity: "error", nodeId: settingSources.get("style"), field: "style", message: "customMode=true 时必须填写 style。" });
    }
    return payload;
  }

  const images = references.filter((reference) => reference.kind === "image");
  const payload: Record<string, unknown> = {
    prompt,
    name: String(settings.name || (toolName === "edit_image" ? "canvas_edit" : "canvas_image")),
    target_size: String(settings.target_size || "1024x1024"),
    aspect_ratio: String(settings.aspect_ratio || "1:1"),
    transparent: toBoolean(settings.transparent),
  };
  setOptionalString(payload, "resolution", settings.resolution);
  setOptionalString(payload, "thinking_level", settings.thinking_level);
  setOptionalInteger(payload, "seed", settings.seed);
  setOptionalString(payload, "model", settings.model);

  if (toolName === "edit_image") {
    const source = images.find((reference) => reference.use === "generic" || reference.use === "first_frame") ?? images[0];
    if (source) {
      payload.image = source.relativePath ?? source.url;
      pushReferenceFieldSource(fieldSources, "image", source);
    } else {
      issues.push({ severity: "error", field: "image", message: "edit_image 必须连接 1 张编辑原图。" });
    }
    const rest = images.filter((reference) => reference.nodeId !== source?.nodeId);
    if (rest.length > 0) {
      payload.reference_images = rest.map((reference, index) => {
        pushReferenceFieldSource(fieldSources, `reference_images[${index}]`, reference);
        return reference.relativePath ?? reference.url;
      });
    }
    if (rest.length > 13) {
      issues.push({ severity: "error", nodeId: rest[13]?.nodeId, field: "reference_images", message: `edit_image 参考图最多 13 张，当前 ${rest.length} 张。` });
    }
    return payload;
  }

  if (images.length > 0) {
    payload.reference_images = images.map((reference, index) => {
      pushReferenceFieldSource(fieldSources, `reference_images[${index}]`, reference);
      return reference.relativePath ?? reference.url;
    });
  }
  if (images.length > 14) {
    issues.push({ severity: "error", nodeId: images[14]?.nodeId, field: "reference_images", message: `generate_image 参考图最多 14 张，当前 ${images.length} 张。` });
  }
  return payload;
}

function findExecutorNode(nodes: Node[], executorNodeId?: string) {
  if (executorNodeId) return nodes.find((node) => node.id === executorNodeId);
  return nodes.find((node) => node.type === "executorNode" && resolveExecutorToolName(node));
}

function resolveExecutorToolName(node: Node): CanvasToolName | undefined {
  const toolName = node.data?.toolName;
  if (isCanvasToolName(toolName)) return toolName;
  return getCanvasToolForExecutorPreset(String(node.data?.presetId ?? ""));
}

function isCanvasToolName(value: unknown): value is CanvasToolName {
  return value === "generate_image" || value === "edit_image" || value === "create_video_task" || value === "text_to_music";
}

function collectUpstreamNodes(nodes: Node[], edges: Edge[], targetId: string): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const prevMap = new Map<string, string[]>();
  for (const edge of edges) {
    const list = prevMap.get(edge.target) ?? [];
    list.push(edge.source);
    prevMap.set(edge.target, list);
  }
  const result: Node[] = [];
  const visited = new Set<string>();
  const visit = (nodeId: string) => {
    for (const prevId of prevMap.get(nodeId) ?? []) {
      if (visited.has(prevId)) continue;
      visited.add(prevId);
      const node = byId.get(prevId);
      if (node) result.push(node);
      visit(prevId);
    }
  };
  visit(targetId);
  return result;
}

function collectPromptAndSettings(
  nodes: Node[],
  promptParts: string[],
  settings: Record<string, unknown>,
  settingSources: Map<string, string>,
  fieldSources: CanvasPayloadFieldSource[],
  referencedAliases: Set<string>,
  textMentionAliases: Set<string>,
  mentionTokens: CanvasMentionToken[],
  references: CanvasAssetReference[],
  promptReferences: CanvasPromptReference[],
) {
  const referenceNodeIds = new Set(references.map((reference) => reference.nodeId));
  for (const node of nodes) {
    if (node.type === "textNode") {
      const text = String(node.data?.text ?? "").trim();
      if (!text) continue;
      const promptLabel = promptNodeLabel(node);
      const promptText = promptLabel ? `${promptLabel}：${text}` : text;
      promptParts.push(promptText);
      extractMentionAliases(text).forEach((alias) => {
        referencedAliases.add(alias);
        textMentionAliases.add(alias);
      });
      if (Array.isArray(node.data?.mentionTokens)) {
        for (const token of node.data.mentionTokens as CanvasMentionToken[]) {
          mentionTokens.push(token);
          promptReferences.push({
            promptNodeId: node.id,
            tokenId: token.id,
            alias: token.alias,
            nodeId: token.nodeId,
            kind: token.kind,
            use: token.use,
            broken: !referenceNodeIds.has(token.nodeId),
          });
        }
      }
      fieldSources.push({ path: "prompt", nodeId: node.id, label: promptLabel || "提示词", value: promptText });
      continue;
    }
    if (node.type !== "settingsNode") continue;
    const type = String(node.data?.type ?? "");
    if (!type) continue;
    settings[type] = node.data?.value;
    settingSources.set(type, node.id);
    fieldSources.push({ path: type, nodeId: node.id, label: String(node.data?.presetId ?? "生成设置"), value: node.data?.value });
  }
}

function promptNodeLabel(node: Node) {
  const labels: Record<string, string> = {
    MainPromptNode: "导演提示词",
    CameraPromptNode: "镜头语言",
    MotionPromptNode: "动作描述",
    StylePromptNode: "风格描述",
    AtmospherePromptNode: "氛围描述",
    ConstraintPromptNode: "约束描述",
  };
  return labels[String(node.data?.presetId ?? "")] ?? "";
}

function collectConnectedReferences(
  reachableNodes: Node[],
  references: CanvasAssetReference[],
  mentionTokens: CanvasMentionToken[],
  textMentionAliases: Set<string>,
) {
  const reachableNodeIds = new Set(reachableNodes.map((node) => node.id));
  const mentionedNodeIds = new Set(mentionTokens.map((token) => token.nodeId));
  return references.filter(
    (reference) =>
      reachableNodeIds.has(reference.nodeId) ||
      mentionedNodeIds.has(reference.nodeId) ||
      textMentionAliases.has(reference.alias),
  );
}

function composePrompt(promptParts: string[], references: CanvasAssetReference[]): string {
  const text = promptParts.join("\n").trim();
  if (!references.length) return text;
  const referenceGuide = references
    .map((reference) => `@${reference.alias}=${describeAssetUse(reference.use)}:${reference.fileName ?? reference.relativePath ?? reference.url ?? ""}`)
    .join("；");
  return text ? `${text}\n参考绑定：${referenceGuide}` : `参考绑定：${referenceGuide}`;
}

function validateVideoSettings(
  settings: Record<string, unknown>,
  issues: CanvasCompileIssue[],
  settingSources: Map<string, string>,
  prompt: string,
) {
  const mode = String(settings.mode ?? "");
  if (!["text_to_video", "first_frame", "first_last_frame", "multi_modal_reference"].includes(mode)) {
    issues.push({ severity: "error", nodeId: settingSources.get("mode"), field: "mode", message: `mode 非法：${mode}` });
  }
  const model = String(settings.model ?? "");
  if (!["default", "fast"].includes(model)) {
    issues.push({ severity: "error", nodeId: settingSources.get("model"), field: "model", message: `model 非法：${model}` });
  }
  const resolution = String(settings.resolution ?? "");
  if (!["480p", "720p"].includes(resolution)) {
    issues.push({ severity: "error", nodeId: settingSources.get("resolution"), field: "resolution", message: `resolution 非法：${resolution}` });
  }
  const ratio = String(settings.ratio ?? "");
  if (!["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"].includes(ratio)) {
    issues.push({ severity: "error", nodeId: settingSources.get("ratio"), field: "ratio", message: `ratio 非法：${ratio}` });
  }
  const duration = Number(settings.duration);
  if (!Number.isInteger(duration) || (duration !== -1 && (duration < 4 || duration > 15))) {
    issues.push({ severity: "error", nodeId: settingSources.get("duration"), field: "duration", message: "duration 必须是 -1 或 4 到 15 的整数。" });
  }
  if (duration === -1) {
    issues.push({ severity: "warning", nodeId: settingSources.get("duration"), field: "duration", message: "建议指定明确时长，-1 会降低结果和计费的可预期性。" });
  }
  if (String(settings.seed ?? "").trim() && !Number.isInteger(Number(String(settings.seed).trim()))) {
    issues.push({ severity: "error", nodeId: settingSources.get("seed"), field: "seed", message: "seed 必须是整数。" });
  }
  if (mode === "text_to_video" && !prompt.trim()) {
    issues.push({ severity: "error", nodeId: settingSources.get("mode"), field: "prompt", message: "text_to_video 必须填写提示词。" });
  }
  if (toBoolean(settings.enable_web_search) && mode !== "text_to_video") {
    issues.push({ severity: "error", nodeId: settingSources.get("enable_web_search"), field: "enable_web_search", message: "enable_web_search 仅支持 text_to_video 模式。" });
  }
  const expires = String(settings.execution_expires_after ?? "").trim();
  if (expires) {
    const expiresAfter = Number(expires);
    if (!Number.isInteger(expiresAfter) || expiresAfter < 3600 || expiresAfter > 259200) {
      issues.push({
        severity: "error",
        nodeId: settingSources.get("execution_expires_after"),
        field: "execution_expires_after",
        message: "execution_expires_after 必须是 3600 到 259200 之间的整数秒。",
      });
    }
  }
}

function validateVideoReferences(
  mode: string,
  images: CanvasAssetReference[],
  videos: CanvasAssetReference[],
  audios: CanvasAssetReference[],
  issues: CanvasCompileIssue[],
) {
  if (mode === "text_to_video" && (images.length || videos.length || audios.length)) {
    const first = [...images, ...videos, ...audios][0];
    issues.push({ severity: "error", nodeId: first?.nodeId, message: "text_to_video 不能连接图片、视频或音频参考。" });
  }
  if (mode === "first_frame" && (images.length !== 1 || videos.length || audios.length)) {
    const first = [...videos, ...audios, ...images][0];
    issues.push({ severity: "error", nodeId: first?.nodeId, message: "first_frame 必须且只能连接 1 张图片，不能连接视频或音频。" });
  }
  if (mode === "first_last_frame" && (images.length !== 2 || videos.length || audios.length)) {
    const first = [...videos, ...audios, ...images][0];
    issues.push({ severity: "error", nodeId: first?.nodeId, message: "first_last_frame 必须且只能连接 2 张图片，不能连接视频或音频。" });
  }
  if (mode === "multi_modal_reference") {
    if (images.length === 0 && videos.length === 0 && audios.length === 0) {
      issues.push({ severity: "error", message: "multi_modal_reference 至少需要一个参考素材。" });
    }
    if (audios.length > 0 && images.length === 0) {
      issues.push({ severity: "error", nodeId: audios[0]?.nodeId, message: "带音频参考时，必须至少连接 1 张图片。" });
    }
    if (images.length > 9) issues.push({ severity: "error", nodeId: images[9]?.nodeId, message: `图片参考最多 9 张，当前 ${images.length} 张。` });
    if (videos.length > 3) issues.push({ severity: "error", nodeId: videos[3]?.nodeId, message: `视频参考最多 3 个，当前 ${videos.length} 个。` });
    if (audios.length > 3) issues.push({ severity: "error", nodeId: audios[3]?.nodeId, message: `音频参考最多 3 个，当前 ${audios.length} 个。` });
  }
}

function validateMentionBindings(
  referencedAliases: Set<string>,
  mentionTokens: CanvasMentionToken[],
  references: CanvasAssetReference[],
  issues: CanvasCompileIssue[],
) {
  const knownAliases = new Set(references.map((reference) => reference.alias));
  const knownNodeIds = new Set(references.map((reference) => reference.nodeId));
  for (const token of mentionTokens) {
    if (!knownNodeIds.has(token.nodeId)) {
      issues.push({ severity: "warning", nodeId: token.nodeId, message: `@${token.alias} 的结构化绑定指向了不存在的素材节点。` });
    }
  }
  for (const alias of referencedAliases) {
    if (!knownAliases.has(alias)) {
      issues.push({ severity: "warning", message: `提示词引用了 @${alias}，但画布上没有匹配素材节点。` });
    }
  }
}

function validateReferencePaths(references: CanvasAssetReference[], issues: CanvasCompileIssue[]) {
  for (const reference of references) {
    if (!reference.relativePath && !reference.url) {
      issues.push({ severity: "error", nodeId: reference.nodeId, field: "relativePath", message: `@${reference.alias} 没有绑定真实素材路径。` });
    }
  }
}

function validateRequiredFields(
  toolName: CanvasToolName,
  requiredFields: string[],
  payload: Record<string, unknown>,
  executorNodeId: string,
  issues: CanvasCompileIssue[],
) {
  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      issues.push({ severity: "error", nodeId: executorNodeId, field, message: `${toolName} 缺少必填字段：${field}` });
    }
  }
}

function buildVideoImagePayload(mode: string, images: CanvasAssetReference[]) {
  if (mode === "first_frame") {
    return images.map((reference) => ({ url: reference.relativePath ?? reference.url, role: "first_frame" }));
  }
  if (mode === "first_last_frame") {
    return images.map((reference, index) => ({
      url: reference.relativePath ?? reference.url,
      role: index === 0 ? "first_frame" : "last_frame",
    }));
  }
  return images.map((reference) => ({ url: reference.relativePath ?? reference.url, role: "reference_image" }));
}

function pushReferenceFieldSource(fieldSources: CanvasPayloadFieldSource[], path: string, reference: CanvasAssetReference) {
  fieldSources.push({
    path,
    nodeId: reference.nodeId,
    label: `@${reference.alias}`,
    value: reference.relativePath ?? reference.url,
  });
}

function setOptionalString(payload: Record<string, unknown>, field: string, value: unknown) {
  const text = String(value ?? "").trim();
  if (text) payload[field] = text;
}

function setOptionalInteger(payload: Record<string, unknown>, field: string, value: unknown) {
  const text = String(value ?? "").trim();
  if (text) payload[field] = Number(text);
}

function toBoolean(value: unknown) {
  return value === true || value === "true";
}
