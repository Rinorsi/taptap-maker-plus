export type CanvasResultAsset = {
  kind: "video" | "image" | "audio" | "model";
  role:
    | "video_result"
    | "image_result"
    | "audio_result"
    | "model_result"
    | "last_frame"
    | "model_front_view"
    | "model_left_view"
    | "model_back_view"
    | "model_right_view"
    | "model_preview";
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
    collectLocalPath(record, assets, seen);
    collectPath(record, assets, seen, "workspace_audio_path", "audio", "audio_result");
    collectPath(record, assets, seen, "workspace_music_path", "audio", "audio_result");
    collectPath(record, assets, seen, "workspace_model_path", "model", "model_result");
    collectPathArray(record, assets, seen, "workspace_image_paths", "image", "image_result");
    collectPathArray(record, assets, seen, "workspace_audio_paths", "audio", "audio_result");
    collectPathArray(record, assets, seen, "workspace_model_paths", "model", "model_result");
    collectPath(record, assets, seen, "rendered_image_url", "image", "model_preview");
    collectConfirmedImagePaths(record, assets, seen);
    Object.values(record).forEach(visit);
  };
  visit(rawResult);
  return assets;
}

function collectLocalPath(
  record: Record<string, unknown>,
  assets: CanvasResultAsset[],
  seen: Set<string>,
) {
  const path = record.localPath;
  if (typeof path !== "string" || !path || seen.has(`localPath:${path}`)) return;
  const lower = path.toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(lower)) {
    seen.add(`localPath:${path}`);
    assets.push({ kind: "image", role: "image_result", path });
    return;
  }
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(lower)) {
    seen.add(`localPath:${path}`);
    assets.push({ kind: "audio", role: "audio_result", path });
    return;
  }
  if (/\.(mp4|webm|mov)$/.test(lower)) {
    seen.add(`localPath:${path}`);
    assets.push({ kind: "video", role: "video_result", path });
  }
}

export function extractCanvasTaskId(rawResult: unknown): string | undefined {
  let taskId: string | undefined;
  const visit = (value: unknown) => {
    if (taskId || !value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.task_id === "string" && record.task_id.trim()) {
      taskId = record.task_id;
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(rawResult);
  return taskId;
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

function collectConfirmedImagePaths(
  record: Record<string, unknown>,
  assets: CanvasResultAsset[],
  seen: Set<string>,
) {
  const confirmed = record.confirmed_image_paths;
  if (!confirmed || typeof confirmed !== "object" || Array.isArray(confirmed)) return;
  const confirmedRecord = confirmed as Record<string, unknown>;
  collectNamedPath(confirmedRecord, assets, seen, "front", "model_front_view");
  collectNamedPath(confirmedRecord, assets, seen, "left", "model_left_view");
  collectNamedPath(confirmedRecord, assets, seen, "back", "model_back_view");
  collectNamedPath(confirmedRecord, assets, seen, "right", "model_right_view");
}

function collectNamedPath(
  record: Record<string, unknown>,
  assets: CanvasResultAsset[],
  seen: Set<string>,
  field: string,
  role: CanvasResultAsset["role"],
) {
  const path = record[field];
  if (typeof path !== "string" || !path || seen.has(`${role}:${path}`)) return;
  seen.add(`${role}:${path}`);
  assets.push({ kind: "image", role, path });
}
