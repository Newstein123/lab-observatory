"use client";

import { useCallback, useEffect, useState } from "react";

/** What is drawn over the view. */
export interface ViewLayers {
  labels: boolean;
  scale: boolean;
  compass: boolean;
  grid: boolean;
  /** The other instrument's field: the camera frame in eyepiece view, the eyepiece circle in camera view. */
  otherField: boolean;
}

/**
 * How the view is shown on screen. Brightness, contrast and colour are
 * display adjustments only; orientation matches the optics in use; seeing
 * switches the atmosphere's blur in the simulation itself.
 */
export interface ViewDisplay {
  brightness: number;
  contrast: number;
  colour: "natural" | "red" | "mono";
  orientation: Orientation;
  seeing: boolean;
}

/** "sky": north up, east left. "diagonal": mirrored, as through a star diagonal. "inverted": rotated 180°, as straight through. */
export type Orientation = "sky" | "diagonal" | "inverted";

export const DEFAULT_LAYERS: ViewLayers = { labels: true, scale: true, compass: false, grid: false, otherField: false };
export const DEFAULT_DISPLAY: ViewDisplay = { brightness: 1, contrast: 1, colour: "natural", orientation: "sky", seeing: true };

/** CSS filter for the display adjustments. */
export function displayFilter(d: ViewDisplay): string {
  const parts: string[] = [];
  if (d.brightness !== 1) parts.push(`brightness(${d.brightness})`);
  if (d.contrast !== 1) parts.push(`contrast(${d.contrast})`);
  if (d.colour === "mono") parts.push("grayscale(1)");
  // Red night-vision: luminance in red only, as astronomers' red screens.
  if (d.colour === "red") parts.push("grayscale(1) sepia(1) saturate(8) hue-rotate(-38deg) brightness(0.85)");
  return parts.join(" ") || "none";
}

/** Map a point (relative to the view centre, sky orientation) to the screen. Each is its own inverse. */
export function orient(o: Orientation, x: number, y: number): { x: number; y: number } {
  if (o === "diagonal") return { x: -x, y };
  if (o === "inverted") return { x: -x, y: -y };
  return { x, y };
}

export const ORIENTATION_CSS: Record<Orientation, string | undefined> = {
  sky: undefined,
  diagonal: "scaleX(-1)",
  inverted: "rotate(180deg)",
};

const KEY = "ue.view.v1";

/** Layers and display settings, remembered per viewer (falls back to defaults if storage is unavailable). */
export function useViewOptions() {
  const [layers, setLayersState] = useState<ViewLayers>(DEFAULT_LAYERS);
  const [display, setDisplayState] = useState<ViewDisplay>(DEFAULT_DISPLAY);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
      if (saved?.layers) setLayersState({ ...DEFAULT_LAYERS, ...saved.layers });
      if (saved?.display) setDisplayState({ ...DEFAULT_DISPLAY, ...saved.display });
    } catch {
      // Storage unavailable: defaults.
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ layers, display }));
    } catch {
      // Ignore.
    }
  }, [loaded, layers, display]);
  const setLayers = useCallback((patch: Partial<ViewLayers>) => setLayersState((prev) => ({ ...prev, ...patch })), []);
  const setDisplay = useCallback((patch: Partial<ViewDisplay>) => setDisplayState((prev) => ({ ...prev, ...patch })), []);
  return { layers, setLayers, display, setDisplay };
}
