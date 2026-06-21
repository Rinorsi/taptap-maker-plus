import type { ModelPackageSummary } from "../../api";

export const managedAssetRoots = {
  image: "assets/image",
  video: "assets/video",
  audio: "assets/audio",
  project: "assets",
  modelSource: "assets/model/maker_plus/source",
  modelReferences: "assets/model/maker_plus/references",
  modelDiscarded: "assets/model/maker_plus/discarded"
} as const;

export const defaultAssetImportFolders = {
  image: "assets/image/maker_plus",
  video: "assets/video/maker_plus",
  audio: "assets/audio/maker_plus",
  project: "assets"
} as const;

export const ordinaryAssetTypeOrder = ["all", "image", "video", "audio", "model3d", "other"] as const;

export const ordinaryAssetTypeLabels: Record<string, string> = {
  all: "全部",
  image: "图片",
  video: "视频",
  audio: "音频",
  model3d: "模型",
  other: "其他"
};

export const modelGovernanceLabels: Record<ModelPackageSummary["governanceState"], string> = {
  in_use: "使用中",
  adopted: "已采用",
  packaged_unused: "已打包未使用",
  draft: "草稿",
  source_orphan: "待整理",
  runtime_orphan: "待打包",
  discarded: "废弃",
  broken: "有问题"
};

export const modelGovernanceTones: Record<ModelPackageSummary["governanceState"], "success" | "brand" | "warning" | "danger" | "muted"> = {
  in_use: "success",
  adopted: "brand",
  packaged_unused: "warning",
  draft: "brand",
  source_orphan: "warning",
  runtime_orphan: "warning",
  discarded: "muted",
  broken: "danger"
};

export const modelGovernanceCategoryOrder = [
  "all",
  "in_use",
  "runtime_orphan",
  "discarded",
  "issues",
  "adopted",
  "packaged_unused",
  "draft",
  "source_orphan"
] as const;

export const modelGovernanceCategoryLabels: Record<(typeof modelGovernanceCategoryOrder)[number], string> = {
  all: "全部",
  in_use: modelGovernanceLabels.in_use,
  runtime_orphan: modelGovernanceLabels.runtime_orphan,
  discarded: modelGovernanceLabels.discarded,
  issues: modelGovernanceLabels.broken,
  adopted: modelGovernanceLabels.adopted,
  packaged_unused: modelGovernanceLabels.packaged_unused,
  draft: modelGovernanceLabels.draft,
  source_orphan: modelGovernanceLabels.source_orphan
};

export type BatchModelGovernanceAction = "organize" | "discard" | "restore" | "add_to_resource" | "remove_from_resource";

const batchModelGovernanceActionOrder: BatchModelGovernanceAction[] = [
  "organize",
  "restore",
  "add_to_resource",
  "remove_from_resource",
  "discard"
];

export function collectBatchModelGovernanceActions(packages: Pick<ModelPackageSummary, "suggestedActions">[]): BatchModelGovernanceAction[] {
  const selectedActionSet = new Set(packages.flatMap((pkg) => pkg.suggestedActions));
  return batchModelGovernanceActionOrder.filter((action) => selectedActionSet.has(action));
}

export function modelPackageBelongsToGovernanceCategory(
  pkg: Pick<ModelPackageSummary, "governanceState" | "issues">,
  category: (typeof modelGovernanceCategoryOrder)[number]
) {
  if (category === "all") return true;
  if (category === "issues") return pkg.governanceState !== "discarded" && pkg.issues.length > 0;
  return pkg.governanceState === category;
}

export function defaultImageAssetName(date = new Date()) {
  return `maker_plus_image_${formatTimestamp(date)}`;
}

export function defaultMusicAssetName(date = new Date()) {
  return `Track-${formatTimestamp(date).slice(4)}`;
}

function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
