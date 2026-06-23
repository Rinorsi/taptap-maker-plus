import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/utils";

type VirtualGridProps<T> = {
  items: T[];
  minItemWidth: number;
  estimateRowHeight: number;
  gap?: number;
  overscan?: number;
  className?: string;
  contentClassName?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

export function VirtualGrid<T>({
  items,
  minItemWidth,
  estimateRowHeight,
  gap = 12,
  overscan = 4,
  className,
  contentClassName,
  getKey,
  renderItem
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const columnCount = useMemo(() => {
    if (width <= 0) return 1;
    return Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
  }, [gap, minItemWidth, width]);

  const rowCount = Math.ceil(items.length / columnCount);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan
  });

  return (
    <div ref={parentRef} className={cn("h-full overflow-y-auto scrollbar-thin", className)}>
      <div className={cn("relative p-4", contentClassName)} style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columnCount;
          const rowItems = items.slice(start, start + columnCount);
          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid w-full px-4"
              style={{
                gap,
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {rowItems.map((item, offset) => {
                const index = start + offset;
                return <div key={getKey(item, index)}>{renderItem(item, index)}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
