"use client";
import { useCallback, useEffect, useRef, useState } from "react";
const BATCH_SIZE = 10;

/** Incremental rendering for the local demo; query and total always cover the full collection. */
export function useQueueScroll<T extends { id: string }>(items: T[], scope: string, enabled: boolean, focus?: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [window, setWindow] = useState({ scope, limit: BATCH_SIZE });
  if (window.scope !== scope) setWindow({ scope, limit: BATCH_SIZE });
  const focusIndex = focus ? items.findIndex(item => item.id === focus) : -1;
  const limit = Math.max(window.scope === scope ? window.limit : BATCH_SIZE, focusIndex + 1);
  const hasMore = enabled && limit < items.length;
  const loadMore = useCallback(() => {
    setWindow(previous => ({ scope, limit: Math.min(items.length, Math.max(previous.scope === scope ? previous.limit : BATCH_SIZE, limit) + BATCH_SIZE) }));
  }, [scope, items.length, limit]);
  useEffect(() => {
    if (enabled && containerRef.current) containerRef.current.scrollTop = 0;
  }, [scope, enabled]);
  useEffect(() => {
    if (!hasMore || !containerRef.current || !sentinelRef.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore();
    }, { root: containerRef.current, rootMargin: "0px 0px 160px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);
  return { rows: items.slice(0, limit), hasMore, loadMore, containerRef, sentinelRef };
}
