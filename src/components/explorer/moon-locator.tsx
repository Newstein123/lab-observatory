"use client";

import { useEffect, useRef } from "react";
import { albedoFor } from "@/modules/explorer/lunar/assets";
import { loadGreyMap } from "@/modules/explorer/use-moon-disc";
import { projectSelenographic, type MoonOrientation } from "@/modules/sky/moon";
import { projectMoonDisc } from "@/modules/simulations/renderers/moon-projection";

/**
 * "Location on Moon": the Moon as it faces Earth at the observation time
 * (lunar north up), lit as tonight, with the feature marked.
 */
export function MoonLocator({ orientation, latDeg, lonDeg, size = 132 }: { orientation: MoonOrientation; latDeg: number; lonDeg: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const flat = { ...orientation, axisPaDeg: 0 };
  const p = projectSelenographic(latDeg, lonDeg, flat);

  useEffect(() => {
    let cancelled = false;
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    loadGreyMap(albedoFor(2048).src).then((map) => {
      const c = ref.current;
      if (cancelled || !c) return;
      c.width = c.height = px;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(px, px);
      projectMoonDisc(map, orientation, px, img.data);
      // Tonight's sunlight: darken the night side (terminator from the sub-solar point).
      const s = projectSelenographic(flat.subSolarLatDeg, flat.subSolarLonDeg, flat);
      const sz = Math.sqrt(Math.max(0, 1 - s.x * s.x - s.y * s.y)) * (s.z > 0 ? 1 : -1);
      for (let y = 0; y < px; y++)
        for (let x = 0; x < px; x++) {
          const i = (y * px + x) * 4;
          if (!img.data[i + 3]) continue;
          const u = (x + 0.5) / (px / 2) - 1;
          const v = (y + 0.5) / (px / 2) - 1;
          const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
          const lit = u * s.x + v * s.y + z * sz;
          const k = lit > 0 ? 1 : 0.18;
          img.data[i] *= k;
          img.data[i + 1] *= k;
          img.data[i + 2] *= k;
        }
      ctx.putImageData(img, 0, 0);
    });
    return () => {
      cancelled = true;
    };
  }, [orientation, size]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <figure className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <canvas ref={ref} style={{ width: size, height: size }} className="rounded-full" aria-label="The Moon as it faces Earth now, with the feature marked" role="img" />
        {p.z > 0 && (
          <span
            aria-hidden
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-accent shadow-[0_0_8px_rgba(129,140,248,0.9)]"
            style={{ left: size / 2 + p.x * (size / 2), top: size / 2 + p.y * (size / 2) }}
          />
        )}
      </div>
      <figcaption className="text-center text-[11px] text-muted">{p.z > 0 ? "Location on the Moon now · lunar north up" : "On the far side now: libration hides it"}</figcaption>
    </figure>
  );
}
