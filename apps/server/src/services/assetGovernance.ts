import path from "node:path";

export const serverManagedAssetRoots = {
  image: "assets/image",
  video: "assets/video",
  audio: "assets/audio",
  project: "assets",
  model: "assets/model",
  modelFinal: "assets/model/final",
  modelSource: "assets/model/maker_plus/source",
  modelDiscarded: "assets/model/maker_plus/discarded",
  runtimeMeshes: "assets/Meshes",
  runtimeMaterials: "assets/Materials",
  runtimeTextures: "assets/Textures",
  runtimePrefabs: "assets/Prefabs"
} as const;

export function normalizeProjectPath(value: string) {
  return value.replace(/\\/g, "/");
}

export function isUnderProjectRoot(relativePath: string, root: string) {
  const normalized = normalizeProjectPath(relativePath);
  return normalized === root || normalized.startsWith(`${root}/`);
}

export function projectRelativePath(rootPath: string, relativePath: string) {
  return path.join(rootPath, ...normalizeProjectPath(relativePath).split("/"));
}

export function modelSourcePackagePath(rootPath: string, safeName: string) {
  return projectRelativePath(rootPath, `${serverManagedAssetRoots.modelSource}/${safeName}`);
}

export function modelDiscardedPackagePath(rootPath: string, safeName: string) {
  return projectRelativePath(rootPath, `${serverManagedAssetRoots.modelDiscarded}/${safeName}`);
}
