import type { DragEvent, ReactNode } from "react";
import type { AssetSummary } from "../../api";
import { clearAssetDragData, writeAssetDragData } from "./assetDragData";

type DraggableRenderProps = {
  ref: (node: HTMLElement | null) => void;
    draggableProps: {
      draggable: boolean;
      onDragStart: (event: DragEvent) => void;
      onDragEnd: () => void;
      [key: string]: unknown;
    };
  isDragging: false;
};

type AssetDraggableProps = {
  asset: AssetSummary;
  onDragStart?: (event: DragEvent, asset: AssetSummary) => void;
  disabled?: boolean;
  children: (props: DraggableRenderProps) => ReactNode;
};

export function AssetDraggable({ asset, onDragStart, disabled, children }: AssetDraggableProps) {
  function handleDragStart(event: DragEvent) {
    if (disabled) {
      event.preventDefault();
      return;
    }
    writeAssetDragData(event, asset);
    onDragStart?.(event, asset);
  }

  return (
    <>
      {children({
        ref: () => undefined,
        draggableProps: {
          draggable: !disabled,
          onDragStart: handleDragStart,
          onDragEnd: clearAssetDragData,
        },
        isDragging: false
      })}
    </>
  );
}
