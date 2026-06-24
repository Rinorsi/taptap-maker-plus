import type { DragEvent, ReactNode } from "react";
import type { AssetSummary } from "../../api";
import { clearAssetDragData, writeAssetDragData } from "./assetDragData";

type DraggableRenderProps = {
  ref: (node: HTMLElement | null) => void;
    draggableProps: {
      draggable: true;
      onDragStart: (event: DragEvent) => void;
      onDragEnd: () => void;
      [key: string]: unknown;
    };
  isDragging: false;
};

type AssetDraggableProps = {
  asset: AssetSummary;
  onDragStart?: (event: DragEvent, asset: AssetSummary) => void;
  children: (props: DraggableRenderProps) => ReactNode;
};

export function AssetDraggable({ asset, onDragStart, children }: AssetDraggableProps) {
  function handleDragStart(event: DragEvent) {
    writeAssetDragData(event, asset);
    onDragStart?.(event, asset);
  }

  return (
    <>
      {children({
        ref: () => undefined,
        draggableProps: {
          draggable: true,
          onDragStart: handleDragStart,
          onDragEnd: clearAssetDragData,
        },
        isDragging: false
      })}
    </>
  );
}
