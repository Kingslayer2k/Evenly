"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 28; // px after resistance — feels snappy
const MAX_PULL = 60;
const RESISTANCE = 0.45;

export default function usePullToRefresh(onRefresh) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullYRef = useRef(0);
  const rafRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    function onTouchStart(e) {
      if (window.scrollY > 2) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }

    function onTouchMove(e) {
      if (!pullingRef.current) return;
      if (window.scrollY > 2) {
        pullingRef.current = false;
        pullYRef.current = 0;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPullY(0);
        return;
      }
      const delta = Math.max(0, e.touches[0].clientY - startYRef.current);
      const progress = Math.min(MAX_PULL, Math.round(delta * RESISTANCE));
      pullYRef.current = progress;
      // Batch visual updates to the next animation frame — avoids 60+ setState/sec
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setPullY(pullYRef.current);
        });
      }
    }

    async function onTouchEnd() {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      const y = pullYRef.current;
      setPullY(0);
      pullYRef.current = 0;
      if (y >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        try {
          await onRefreshRef.current?.();
        } finally {
          setIsRefreshing(false);
        }
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return { pullY, isRefreshing };
}
