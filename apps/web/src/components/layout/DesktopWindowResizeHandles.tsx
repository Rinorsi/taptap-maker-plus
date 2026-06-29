export type ResizeEdge = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export type TauriResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

export function DesktopWindowResizeHandles({
  onResizeStart,
}: {
  onResizeStart: (
    event: React.PointerEvent<HTMLDivElement>,
    edge: ResizeEdge,
  ) => void;
}) {
  return (
    <>
      <div
        className="fixed left-5 right-5 top-0 z-[120] h-2 cursor-ns-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "n")}
      />
      <div
        className="fixed bottom-5 left-0 top-14 z-[120] w-2 cursor-ew-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "w")}
      />
      <div
        className="fixed bottom-5 right-0 top-14 z-[120] w-2 cursor-ew-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "e")}
      />
      <div
        className="fixed bottom-0 left-5 right-5 z-[120] h-2 cursor-ns-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "s")}
      />
      <div
        className="fixed left-0 top-0 z-[121] h-5 w-5 cursor-nwse-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "nw")}
      />
      <div
        className="fixed right-0 top-0 z-[121] h-5 w-5 cursor-nesw-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "ne")}
      />
      <div
        className="fixed bottom-0 left-0 z-[121] h-5 w-5 cursor-nesw-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "sw")}
      />
      <div
        className="fixed bottom-0 right-0 z-[121] h-5 w-5 cursor-nwse-resize"
        data-no-window-drag
        onPointerDownCapture={(event) => onResizeStart(event, "se")}
      />
    </>
  );
}

export function toTauriResizeDirection(edge: ResizeEdge): TauriResizeDirection {
  const directions: Record<ResizeEdge, TauriResizeDirection> = {
    e: "East",
    n: "North",
    ne: "NorthEast",
    nw: "NorthWest",
    s: "South",
    se: "SouthEast",
    sw: "SouthWest",
    w: "West",
  };
  return directions[edge];
}
