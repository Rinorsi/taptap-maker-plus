import type { DragEvent } from "react";
import type { AssetSummary } from "../../api";

const ASSET_DRAG_MIME = "application/taptap-maker-plus-asset";

type DraggedAsset = {
  projectId: string;
  relativePath: string;
  fileName: string;
  assetType: string;
};

export function writeAssetDragData(event: DragEvent, asset: AssetSummary) {
  const data: DraggedAsset = {
    projectId: asset.projectId,
    relativePath: asset.relativePath,
    fileName: asset.fileName,
    assetType: asset.assetType
  };
  event.dataTransfer.setData(ASSET_DRAG_MIME, JSON.stringify(data));
  event.dataTransfer.setData("text/plain", asset.relativePath);
  event.dataTransfer.effectAllowed = "copyMove";
}

export function readAssetDragPath(dataTransfer: DataTransfer) {
  const raw = dataTransfer.getData(ASSET_DRAG_MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DraggedAsset>;
      if (typeof parsed.relativePath === "string" && parsed.relativePath.length > 0) {
        return parsed.relativePath;
      }
    } catch {
      return undefined;
    }
  }

  const plain = dataTransfer.getData("text/plain");
  return plain || undefined;
}
