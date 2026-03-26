"use client";

import { useEffect } from "react";

/**
 * Locks body scroll for iOS Safari bottom-sheet modals.
 * Uses the position:fixed trick — the only fully reliable approach on iOS.
 * Restores exact scroll position on unmount.
 */
export default function useBodyScrollLock() {
  useEffect(() => {
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    return () => {
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);
}
