import type { DragEvent } from "react";
import type { AssetSummary } from "../../api";

export const ASSET_DRAG_MIME = "application/taptap-maker-plus-asset";
export const ASSET_DIRECTORY_DRAG_MIME = "application/taptap-maker-plus-asset-directory";

export type AssetDragData = {
  projectId?: string;
  relativePath: string;
  fileName?: string;
  assetType?: string;
};

declare global {
  interface Window {
    __taptapAssetDrag?: AssetDragData;
  }
}

export function toAssetDragData(asset: AssetSummary): Required<AssetDragData> {
  return {
    projectId: asset.projectId,
    relativePath: asset.relativePath,
    fileName: asset.fileName,
    assetType: asset.assetType
  };
}

export function writeAssetDragData(event: DragEvent, asset: AssetSummary) {
  const data = toAssetDragData(asset);
  window.__taptapAssetDrag = data;
  event.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify(data));
  event.dataTransfer.setData("text/plain", asset.relativePath);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function clearAssetDragData() {
  window.__taptapAssetDrag = undefined;
}

export function readAssetDragData(dataTransfer: DataTransfer): AssetDragData | undefined {
  const raw = dataTransfer.getData(ASSET_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AssetDragData>;
      if (typeof parsed.relativePath === "string" && parsed.relativePath.length > 0) {
        return {
          projectId: typeof parsed.projectId === "string" ? parsed.projectId : undefined,
          relativePath: parsed.relativePath,
          fileName: typeof parsed.fileName === "string" ? parsed.fileName : undefined,
          assetType: typeof parsed.assetType === "string" ? parsed.assetType : undefined
        };
      }
    } catch {
      return undefined;
    }
  }

  const plain = dataTransfer.getData("text/plain");
  if (plain) return { relativePath: plain };
  return window.__taptapAssetDrag;
}

export function readAssetDragPath(dataTransfer: DataTransfer) {
  return readAssetDragData(dataTransfer)?.relativePath;
}

export type AssetDirectoryDragData = {
  directoryPath: string;
};

declare global {
  interface Window {
    __taptapAssetDirectoryDrag?: AssetDirectoryDragData;
  }
}

export function writeAssetDirectoryDragData(event: DragEvent, directoryPath: string) {
  const data = { directoryPath };
  window.__taptapAssetDirectoryDrag = data;
  event.dataTransfer.setData(ASSET_DIRECTORY_DRAG_MIME, JSON.stringify(data));
  event.dataTransfer.setData("text/plain", directoryPath);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function clearAssetDirectoryDragData() {
  window.__taptapAssetDirectoryDrag = undefined;
}

export function readAssetDirectoryDragData(dataTransfer: DataTransfer): AssetDirectoryDragData | undefined {
  const raw = dataTransfer.getData(ASSET_DIRECTORY_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AssetDirectoryDragData>;
      if (typeof parsed.directoryPath === "string" && parsed.directoryPath.length > 0) {
        return { directoryPath: parsed.directoryPath };
      }
    } catch {
      return undefined;
    }
  }
  return window.__taptapAssetDirectoryDrag;
}
