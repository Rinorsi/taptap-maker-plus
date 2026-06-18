import fs from "node:fs/promises";
import path from "node:path";
import type { AssetSummary, ProjectSummary } from "../types.js";
import { upsertAssets } from "../lib/db.js";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv"]);
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);
const MODEL_EXT = new Set([".glb", ".gltf", ".fbx", ".obj", ".mdl", ".zip"]);

function classify(extension: string): AssetSummary["assetType"] {
  const ext = extension.toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  if (MODEL_EXT.has(ext)) return "model3d";
  return "other";
}

async function walk(dir: string, output: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, output);
    } else if (entry.isFile()) {
      output.push(full);
    }
  }
}

export async function scanProjectAssets(project: ProjectSummary): Promise<AssetSummary[]> {
  const assetsDir = path.join(project.rootPath, "assets");
  const files: string[] = [];
  await walk(assetsDir, files);
  const now = new Date().toISOString();
  const assets: AssetSummary[] = [];

  for (const absolutePath of files) {
    const stats = await fs.stat(absolutePath).catch(() => undefined);
    if (!stats) continue;
    const relativePath = path.relative(project.rootPath, absolutePath).replaceAll("\\", "/");
    const extension = path.extname(absolutePath).toLowerCase();
    assets.push({
      id: `${project.id}:${relativePath}`,
      projectId: project.id,
      absolutePath,
      relativePath,
      fileName: path.basename(absolutePath),
      extension,
      assetType: classify(extension),
      sizeBytes: stats.size,
      mtimeMs: stats.mtimeMs,
      status: "available",
      updatedAt: now
    });
  }

  upsertAssets(project.id, assets);
  return assets;
}
