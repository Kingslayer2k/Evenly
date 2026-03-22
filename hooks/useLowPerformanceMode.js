"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";

export default function useLowPerformanceMode() {
  const reduceMotion = useReducedMotion();

  return useMemo(() => {
    if (reduceMotion) return true;

    const deviceMemory = typeof navigator !== "undefined" ? Number(navigator.deviceMemory || 0) : 0;
    const cpuCores = typeof navigator !== "undefined" ? Number(navigator.hardwareConcurrency || 0) : 0;
    return Boolean((deviceMemory && deviceMemory <= 4) || (cpuCores && cpuCores <= 4));
  }, [reduceMotion]);
}
