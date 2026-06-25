import { useRef, useState, type PointerEvent } from "react";
import { cn } from "../../lib/utils";

type ResizeSide = "left" | "right";

type UseResizablePanelWidthOptions = {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side: ResizeSide;
};

export function useResizablePanelWidth({
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: UseResizablePanelWidthOptions) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const nextWidthRef = useRef(defaultWidth);
  const cleanupRef = useRef<(() => void) | null>(null);

  function startResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    resizeStartRef.current = { pointerX: event.clientX, width };
    nextWidthRef.current = width;
    setIsResizing(true);
    cleanupRef.current?.();
    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      moveEvent.preventDefault();
      const delta = side === "right" ? start.pointerX - moveEvent.clientX : moveEvent.clientX - start.pointerX;
      nextWidthRef.current = Math.min(maxWidth, Math.max(minWidth, start.width + delta));
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        setWidth(nextWidthRef.current);
      });
    };
    const handleEnd = () => {
      finishResize();
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd, { once: true });
    window.addEventListener("pointercancel", handleEnd, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };
  }

  function resize(event: PointerEvent<HTMLButtonElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    const delta = side === "right" ? start.pointerX - event.clientX : event.clientX - start.pointerX;
    nextWidthRef.current = Math.min(maxWidth, Math.max(minWidth, start.width + delta));
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setWidth(nextWidthRef.current);
    });
  }

  function stopResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeStartRef.current) return;
    event.preventDefault();
    cleanupRef.current?.();
    cleanupRef.current = null;
    finishResize();
  }

  function finishResize() {
    resizeStartRef.current = null;
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setWidth(nextWidthRef.current);
    setIsResizing(false);
  }

  return {
    width,
    isResizing,
    resetWidth: () => setWidth(defaultWidth),
    resizeHandleProps: {
      onPointerDown: startResize,
      onPointerMove: resize,
      onPointerUp: stopResize,
      onPointerCancel: stopResize,
    },
  };
}

type ResizablePanelHandleProps = ReturnType<typeof useResizablePanelWidth>["resizeHandleProps"] & {
  className?: string;
  title?: string;
  onDoubleClick?: () => void;
};

export function ResizablePanelHandle({
  className,
  title = "拖动调整宽度，双击恢复默认",
  onDoubleClick,
  ...resizeHandleProps
}: ResizablePanelHandleProps) {
  return (
    <button
      type="button"
      aria-label="调整素材面板宽度"
      title={title}
      className={cn(
        "group relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        className,
      )}
      onDoubleClick={onDoubleClick}
      {...resizeHandleProps}
    >
      <span className="my-4 w-px rounded-full bg-border-soft transition-colors group-hover:bg-brand/60 group-active:bg-brand" />
      <span className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-raised opacity-0 shadow-sm ring-1 ring-border-soft transition-opacity group-hover:opacity-100 group-active:opacity-100" />
    </button>
  );
}
