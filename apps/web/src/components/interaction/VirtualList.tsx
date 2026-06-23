import { type ReactNode, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "../../lib/utils";

type VirtualListProps<T> = {
  items: T[];
  estimateSize: number;
  overscan?: number;
  className?: string;
  contentClassName?: string;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
};

export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 8,
  className,
  contentClassName,
  getKey,
  renderItem
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan
  });

  return (
    <div ref={parentRef} className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-thin", className)}>
      <div className={cn("relative", contentClassName)} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return (
            <div
              key={getKey(item, virtualItem.index)}
              className="absolute left-0 top-0 w-full"
              style={{ height: virtualItem.size, transform: `translateY(${virtualItem.start}px)` }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
