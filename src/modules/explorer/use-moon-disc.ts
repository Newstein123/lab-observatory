"use client";

import { useEffect, useState } from "react";
import type { MoonOrientation } from "@/modules/sky/moon";
import { discTier, projectMoonDisc, type GreyMap } from "@/modules/simulations/renderers/moon-projection";
import type { LoadedReference } from "@/modules/simulations/renderers/target-drawing";
import { albedoFor, moonDiscMeta } from "./lunar/assets";

/** Decoded global maps, shared by every view for the page's lifetime. */
const greyCache = new Map<string, Promise<GreyMap>>();

export function loadGreyMap(src: string): Promise<GreyMap> {
  let p = greyCache.get(src);
  if (!p) {
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${src}`));
      img.src = src;
    }).then((img) => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("No 2D canvas");
      ctx.drawImage(img, 0, 0);
      const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
      const data = new Uint8Array(c.width * c.height);
      for (let i = 0, j = 0; j < data.length; i += 4, j++) data[j] = Math.round(0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]);
      return { data, width: c.width, height: c.height };
    });
    p.catch(() => greyCache.delete(src));
    greyCache.set(src, p);
  }
  return p;
}

/** Libration changes by ~0.005° a minute; re-project only after it moves this much. */
const STEP_DEG = 0.05;

/**
 * The Moon's disc for this observation, projected from the LROC global
 * mosaic for the computed libration (lunar north up; the view turns it by
 * the axis angle). Undefined while loading, if disabled, or on error — the
 * view then falls back to the reference photograph.
 */
export function useMoonDisc(enabled: boolean, orientation: MoonOrientation | undefined, discDevicePx: number): LoadedReference | undefined {
  const tier = discTier(discDevicePx);
  const l = orientation ? Math.round(orientation.librationLonDeg / STEP_DEG) * STEP_DEG : 0;
  const b = orientation ? Math.round(orientation.librationLatDeg / STEP_DEG) * STEP_DEG : 0;
  const key = enabled && orientation ? `${tier}:${l.toFixed(2)}:${b.toFixed(2)}` : "";
  const [disc, setDisc] = useState<{ key: string; ref: LoadedReference }>();

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    // A map with at least as many pixels across the visible hemisphere as the disc has.
    const asset = albedoFor(tier * 2);
    loadGreyMap(asset.src).then(
      (map) => {
        if (cancelled) return;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = tier;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(tier, tier);
        projectMoonDisc(map, { librationLonDeg: l, librationLatDeg: b }, tier, img.data);
        ctx.putImageData(img, 0, 0);
        setDisc({ key, ref: { image: canvas, meta: moonDiscMeta(asset, tier) } });
      },
      () => {
        // Keep the fallback photograph.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key) return undefined;
  // While a new tier or libration is being prepared, keep showing the previous disc.
  return disc?.ref;
}
