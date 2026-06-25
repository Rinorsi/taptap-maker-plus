import type { Node } from "@xyflow/react";
import type { CanvasAssetKind, CanvasAssetReference, CanvasAssetUse } from "./types";

export function getNodeAssetKind(node: Node): CanvasAssetKind {
  if (typeof node.data?.assetKind === "string") return node.data.assetKind as CanvasAssetKind;
  if (node.type !== "mediaNode") return "unknown";
  const presetId = String(node.data?.presetId ?? "");
  if (presetId.includes("Image")) return "image";
  if (presetId.includes("Video")) return "video";
  if (presetId.includes("Audio")) return "audio";
  if (presetId.includes("Model")) return "model";
  return "unknown";
}

export function getNodeAssetUse(node: Node): CanvasAssetUse {
  const role = String(node.data?.role ?? "");
  const presetId = String(node.data?.presetId ?? "");
  if (role === "first_frame" || presetId === "FirstFrameImageNode") return "first_frame";
  if (role === "last_frame" || presetId === "LastFrameImageNode") return "last_frame";
  if (role.includes("character")) return "character";
  if (role.includes("scene")) return "scene";
  if (role.includes("style")) return "style";
  if (role.includes("storyboard")) return "composition";
  if (role.includes("action")) return "action";
  if (role.includes("camera")) return "camera";
  if (role.includes("rhythm")) return "rhythm";
  if (role.includes("music")) return "background_music";
  return "generic";
}

export function collectCanvasAssetReferences(nodes: Node[]): CanvasAssetReference[] {
  const counts: Record<string, number> = {};
  return nodes
    .filter((node) => {
      if (node.type !== "mediaNode") return false;
      const kind = getNodeAssetKind(node);
      return kind === "image" || kind === "video" || kind === "audio" || kind === "model";
    })
    .map((node) => {
      const kind = getNodeAssetKind(node);
      const prefix =
        kind === "image" ? "图" : kind === "video" ? "视频" : kind === "audio" ? "音频" : "模型";
      counts[kind] = (counts[kind] ?? 0) + 1;
      return {
        id: String(node.data?.referenceId ?? node.id),
        nodeId: node.id,
        alias: String(node.data?.alias ?? `${prefix}${counts[kind]}`),
        kind,
        use: getNodeAssetUse(node),
        relativePath: typeof node.data?.relativePath === "string" ? node.data.relativePath : undefined,
        fileName: typeof node.data?.fileName === "string" ? node.data.fileName : undefined,
        url: typeof node.data?.url === "string" ? node.data.url : undefined,
      };
    });
}

export function nextAssetAlias(kind: CanvasAssetKind, existing: CanvasAssetReference[]): string {
  const prefix =
    kind === "image" ? "图" : kind === "video" ? "视频" : kind === "audio" ? "音频" : "模型";
  const used = new Set(existing.filter((item) => item.kind === kind).map((item) => item.alias));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

export function extractMentionAliases(text: string): string[] {
  const aliases = new Set<string>();
  const matcher = /@([\u4e00-\u9fa5A-Za-z0-9_-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) aliases.add(match[1]);
  return [...aliases];
}

export function describeAssetUse(use: CanvasAssetUse): string {
  switch (use) {
    case "first_frame":
      return "首帧";
    case "last_frame":
      return "尾帧";
    case "character":
      return "角色";
    case "scene":
      return "场景";
    case "style":
      return "风格";
    case "composition":
      return "构图";
    case "action":
      return "动作";
    case "camera":
      return "运镜";
    case "rhythm":
      return "节奏";
    case "background_music":
      return "背景音乐";
    default:
      return "参考";
  }
}
