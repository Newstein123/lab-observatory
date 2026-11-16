"use client";

import { useEffect, useState } from "react";
import type { LoadedReference } from "@/modules/simulations/renderers/target-drawing";
import { getReferenceImage } from "./reference-images";

/** Loaded images are shared across views and kept for the page's lifetime. */
const cache = new Map<string, Promise<HTMLImageElement>>();

function load(src: string): Promise<HTMLImageElement> {
  let p = cache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => {
        cache.delete(src);
        reject(new Error(`Could not load ${src}`));
      };
      img.src = src;
    });
    cache.set(src, p);
  }
  return p;
}

export type ReferenceState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "ready"; reference: LoadedReference }
  | { status: "error" };

/**
 * Load the reference image for a target. Views fall back to the schematic
 * while loading, on error, or when no image exists for the target.
 */
export function useReferenceImage(targetId: string, variant: "full" | "object" = "full"): ReferenceState {
  const base = getReferenceImage(targetId);
  // The star-free variant exists only for survey fields; it shares the full image's geometry.
  const objectSrc = base?.kind === "field" ? base.objectSrc : undefined;
  const meta = variant === "object" ? (objectSrc && base ? { ...base, src: objectSrc } : undefined) : base;
  const [state, setState] = useState<{ targetId: string; value: ReferenceState }>({
    targetId,
    value: meta ? { status: "loading" } : { status: "none" },
  });

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    load(meta.src).then(
      (image) => !cancelled && setState({ targetId, value: { status: "ready", reference: { image, meta } } }),
      () => !cancelled && setState({ targetId, value: { status: "error" } }),
    );
    return () => {
      cancelled = true;
    };
  }, [meta?.src, targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ignore state left over from a previous target.
  if (state.targetId !== targetId) return meta ? { status: "loading" } : { status: "none" };
  return state.value;
}
