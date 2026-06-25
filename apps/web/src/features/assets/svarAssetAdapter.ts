import type {
  IEntity,
  IFileMenuOption,
  IParsedEntity,
  TID,
  TContextMenuType,
  TMethodsConfig
} from "@svar-ui/react-filemanager";
import { getMenuOptions } from "@svar-ui/react-filemanager";
import type { AssetSummary } from "../../api";
import type { AssetDirectoryNode } from "./assetTree";
import { flattenDirectoryTree, normalizeAssetPath } from "./assetTree";

export type SvarAssetOperation =
  | "create-file"
  | "rename-file"
  | "delete-files"
  | "move-files"
  | "copy-files"
  | "open-file"
  | "download-file";

export const svarAssetOperationApiRoutes: Record<SvarAssetOperation, string> = {
  "create-file": "POST /api/projects/:projectId/assets/folders/create",
  "rename-file": "POST /api/projects/:projectId/assets/rename or POST /api/projects/:projectId/assets/folders/rename",
  "delete-files": "POST /api/projects/:projectId/assets/delete or POST /api/projects/:projectId/assets/folders/delete",
  "move-files": "POST /api/projects/:projectId/assets/move or POST /api/projects/:projectId/assets/folders/move",
  "copy-files": "POST /api/projects/:projectId/assets/copy or POST /api/projects/:projectId/assets/folders/copy",
  "open-file": "POST /api/projects/:projectId/assets/open-local",
  "download-file": "GET /api/projects/:projectId/assets/preview"
};

export function assetPathToSvarId(relativePath: string, rootPath = "") {
  const normalized = normalizeAssetPath(relativePath);
  const root = normalizeAssetPath(rootPath);
  if (root && normalized === root) return "/";
  if (root && normalized.startsWith(`${root}/`)) {
    return `/${normalized.slice(root.length + 1)}`;
  }
  return normalized ? `/${normalized}` : "/";
}

export function svarIdToAssetPath(id: string, rootPath = "") {
  const normalized = normalizeAssetPath(id.replace(/^\/+/, ""));
  const root = normalizeAssetPath(rootPath);
  if (!root) return normalized;
  return normalized ? `${root}/${normalized}` : root;
}

export function assetToSvarEntity(asset: AssetSummary, rootPath = ""): IEntity {
  return {
    id: assetPathToSvarId(asset.relativePath, rootPath),
    type: "file",
    size: asset.sizeBytes,
    date: new Date(asset.mtimeMs),
    assetType: asset.assetType,
    extension: asset.extension,
    relativePath: asset.relativePath,
    absolutePath: asset.absolutePath
  };
}

export function directoryToSvarEntity(directory: AssetDirectoryNode, rootPath = ""): IEntity {
  return {
    id: assetPathToSvarId(directory.path, rootPath),
    type: "folder",
    size: directory.totalAssetCount,
    relativePath: directory.path,
    assetCount: directory.assetCount,
    totalAssetCount: directory.totalAssetCount
  };
}

export function buildSvarAssetEntities(assets: AssetSummary[], tree: AssetDirectoryNode, rootPath = ""): IEntity[] {
  const directories = flattenDirectoryTree(tree)
    .filter((directory) => directory.path && directory.path !== normalizeAssetPath(rootPath))
    .map((directory) => directoryToSvarEntity(directory, rootPath));
  return [...directories, ...assets.map((asset) => assetToSvarEntity(asset, rootPath))];
}

export function buildSvarAssetMenuOptions(
  mode: TContextMenuType,
  item?: IParsedEntity,
  customOptions: Partial<Record<TContextMenuType, IFileMenuOption[]>> = {}
): IFileMenuOption[] | false {
  const baseOptions = getMenuOptions(mode).map((option) => ({ ...option }));
  if (mode === "body") {
    return [
      ...baseOptions,
      { comp: "separator" },
      ...(customOptions.body ?? [])
    ];
  }
  if (mode === "folder") {
    return [
      ...baseOptions,
      { comp: "separator" },
      ...(customOptions.folder ?? [])
    ];
  }
  if (mode === "file" && item) {
    return [
      ...baseOptions,
      { comp: "separator" },
      ...(customOptions.file ?? [])
    ];
  }
  return [...baseOptions, ...(customOptions[mode] ?? [])];
}

export type SvarAssetMutationEvent =
  | TMethodsConfig["create-file"]
  | TMethodsConfig["rename-file"]
  | TMethodsConfig["delete-files"]
  | TMethodsConfig["move-files"]
  | TMethodsConfig["copy-files"];

export function readSvarEventAssetPaths(event: SvarAssetMutationEvent, rootPath = "") {
  if ("ids" in event) return event.ids.map((id: TID) => svarIdToAssetPath(id, rootPath));
  if ("id" in event) return [svarIdToAssetPath(event.id, rootPath)];
  return [];
}
