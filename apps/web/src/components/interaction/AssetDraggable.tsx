import type { CSSProperties, DragEvent, ReactNode } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { AssetSummary } from "../../api";
import { writeAssetDragData } from "./assetDragData";

type DraggableRenderProps = {
  ref: (node: HTMLElement | null) => void;
  draggableProps: {
    draggable: true;
    onDragStart: (event: DragEvent) => void;
    style?: CSSProperties;
    [key: string]: unknown;
  };
  isDragging: boolean;
};

type AssetDraggableProps = {
  asset: AssetSummary;
  onDragStart?: (event: DragEvent, asset: AssetSummary) => void;
  children: (props: DraggableRenderProps) => ReactNode;
};

export function AssetDraggable({ asset, onDragStart, children }: AssetDraggableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `asset:${asset.relativePath}`,
    data: {
      type: "asset",
      asset: {
        projectId: asset.projectId,
        relativePath: asset.relativePath,
        fileName: asset.fileName,
        assetType: asset.assetType
      }
    }
  });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  function handleDragStart(event: DragEvent) {
    writeAssetDragData(event, asset);
    onDragStart?.(event, asset);
  }

  return (
    <>
      {children({
        ref: setNodeRef,
        draggableProps: {
          ...attributes,
          ...listeners,
          draggable: true,
          onDragStart: handleDragStart,
          style
        },
        isDragging
      })}
    </>
  );
}
