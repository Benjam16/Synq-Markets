"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

interface VirtualizedMarketListProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  initialCount?: number; // Number of items to render initially
  loadMoreCount?: number; // Number of items to load when scrolling
  className?: string;
}

export default function VirtualizedMarketList({
  items,
  renderItem,
  initialCount = 50, // Render first 50 items
  loadMoreCount = 50, // Load 50 more when scrolling
  className = "",
}: VirtualizedMarketListProps) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when items change (e.g., category filter)
  useEffect(() => {
    setVisibleCount(Math.min(initialCount, items.length));
  }, [items.length, initialCount]);

  // Intersection Observer for infinite scroll (load more as user scrolls)
  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= items.length) {
      // Clean up observer if we've loaded all items
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < items.length) {
          // Load more items
          setVisibleCount((prev) => 
            Math.min(items.length, prev + loadMoreCount)
          );
        }
      },
      {
        root: null, // Use viewport as root
        rootMargin: "200px", // Start loading 200px before reaching the end
        threshold: 0.1,
      }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visibleCount, items.length, loadMoreCount]);

  // Get items to render
  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {/* Render visible items */}
        {visibleItems.map((item, index) => (
          <div key={index}>
            {renderItem(item, index)}
          </div>
        ))}

        {/* Loading indicator / Sentinel element for intersection observer */}
        {visibleCount < items.length && (
          <div
            ref={sentinelRef}
            className="col-span-full flex justify-center items-center py-8"
            style={{ minHeight: '100px' }}
          >
            <div className="text-slate-500 text-sm">
              Loading more markets... ({visibleCount} of {items.length})
            </div>
          </div>
        )}
        
        {/* All items loaded indicator */}
        {visibleCount >= items.length && items.length > 0 && (
          <div className="col-span-full text-center py-4 text-slate-500 text-sm">
            Showing all {items.length} markets
          </div>
        )}
      </div>
    </div>
  );
}
