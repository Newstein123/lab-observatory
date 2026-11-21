"use client";

import { useCallback, useEffect, useState } from "react";
import type { GrsMeasurement } from "./projection";

const KEY = "ue.grs.v1";

/**
 * A measured System II longitude for the Great Red Spot (e.g. from JUPOS or
 * a recent transit timing), remembered on this device. Without one, the
 * spot's position follows the published drift model.
 */
export function useGrsMeasurement(): [GrsMeasurement | undefined, (m: GrsMeasurement | undefined) => void] {
  const [value, setValue] = useState<GrsMeasurement>();
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
      if (saved && Number.isFinite(saved.lonDeg) && typeof saved.atIso === "string") setValue(saved);
    } catch {
      // Storage unavailable: use the model.
    }
  }, []);
  const set = useCallback((m: GrsMeasurement | undefined) => {
    setValue(m);
    try {
      if (m) window.localStorage.setItem(KEY, JSON.stringify(m));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Ignore.
    }
  }, []);
  return [value, set];
}
