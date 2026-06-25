export type CanvasResultAsset = {
  kind: "video" | "image" | "audio" | "model";
  role: "video_result" | "image_result" | "audio_result" | "model_result" | "last_frame";
  path: string;
};

export function extractCanvasResultAssets(rawResult: unknown): CanvasResultAsset[] {
  const assets: CanvasResultAsset[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    const videoPath = record.workspace_video_path;
    if (typeof videoPath === "string" && videoPath && !seen.has(`video:${videoPath}`)) {
      seen.add(`video:${videoPath}`);
      assets.push({ kind: "video", role: "video_result", path: videoPath });
    }
    const lastFramePath = record.workspace_last_frame_path;
    if (typeof lastFramePath === "string" && lastFramePath && !seen.has(`last_frame:${lastFramePath}`)) {
      seen.add(`last_frame:${lastFramePath}`);
      assets.push({ kind: "image", role: "last_frame", path: lastFramePath });
    }
    collectPath(record, assets, seen, "workspace_image_path", "image", "image_result");
    collectPath(record, assets, seen, "workspace_audio_path", "audio", "audio_result");
    collectPath(record, assets, seen, "workspace_music_path", "audio", "audio_result");
    collectPath(record, assets, seen, "workspace_model_path", "model", "model_result");
    collectPathArray(record, assets, seen, "workspace_image_paths", "image", "image_result");
    collectPathArray(record, assets, seen, "workspace_audio_paths", "audio", "audio_result");
    Object.values(record).forEach(visit);
  };
  visit(rawResult);
  return assets;
}

function collectPath(
  record: Record<string, unknown>,
  assets: CanvasResultAsset[],
  seen: Set<string>,
  field: string,
  kind: CanvasResultAsset["kind"],
  role: CanvasResultAsset["role"],
) {
  const path = record[field];
  if (typeof path !== "string" || !path || seen.has(`${field}:${path}`)) return;
  seen.add(`${field}:${path}`);
  assets.push({ kind, role, path });
}

function collectPathArray(
  record: Record<string, unknown>,
  assets: CanvasResultAsset[],
  seen: Set<string>,
  field: string,
  kind: CanvasResultAsset["kind"],
  role: CanvasResultAsset["role"],
) {
  const paths = record[field];
  if (!Array.isArray(paths)) return;
  paths.forEach((path) => {
    if (typeof path !== "string" || !path || seen.has(`${field}:${path}`)) return;
    seen.add(`${field}:${path}`);
    assets.push({ kind, role, path });
  });
}
