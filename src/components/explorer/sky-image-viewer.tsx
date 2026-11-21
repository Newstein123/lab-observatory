"use client";

import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getReferenceImage, type FieldReferenceImage } from "@/modules/targets/reference-images";
import type { ExplorerContext } from "./explorer-context";
import { SourceList } from "./shared";

/**
 * AstronomicalImageViewer: the target's real survey image (Digitized Sky
 * Survey via NASA SkyView), zoomable, with catalogued objects marked at their
 * SIMBAD positions and the telescope's current field outlined.
 */
export function SkyImageViewer({ ctx }: { ctx: ExplorerContext }) {
  const image = getReferenceImage(ctx.object.targetId) as FieldReferenceImage | undefined;
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [view, setView] = useState({ zoom: 1, cx: 0.5, cy: 0.5 });
  const project = ctx.geometry?.project;
  const R = ctx.object.skyImage?.radiusArcsec ?? 1;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Centre on the selected feature.
  const selId = ctx.selection.kind === "feature" ? ctx.selection.id : undefined;
  useEffect(() => {
    const f = ctx.object.features.find((x) => x.id === selId);
    if (!f || !project || !image) return;
    const d = project(f);
    setView({ zoom: 2.5, cx: 0.5 + (d.x * R) / image.fieldWidthArcsec, cy: 0.5 + (d.y * R) / image.fieldHeightArcsec });
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = size;
  const H = image ? Math.round(size * (image.fieldHeightArcsec / image.fieldWidthArcsec)) : 0;
  const clamp = (v: typeof view) => {
    const zoom = Math.min(8, Math.max(1, v.zoom));
    const half = 0.5 / zoom;
    return { zoom, cx: Math.min(1 - half, Math.max(half, v.cx)), cy: Math.min(1 - half, Math.max(half, v.cy)) };
  };
  const drag = useRefDrag(view, (v) => setView(clamp(v)), W, H);
  if (!image || !project) return <p className="text-sm text-muted">No survey image for this target.</p>;

  const scale = view.zoom;
  // Image position: (u, v) in 0…1 → screen.
  const toPx = (u: number, v: number) => ({ x: W / 2 + (u - view.cx) * W * scale, y: H / 2 + (v - view.cy) * H * scale });
  const fromSky = (xUnits: number, yUnits: number) => ({ u: 0.5 + (xUnits * R) / image.fieldWidthArcsec, v: 0.5 + (yUnits * R) / image.fieldHeightArcsec });
  const tl = toPx(0, 0);
  const field = ctx.field;
  const fc = field ? toPx(fromSky(field.x, field.y).u, fromSky(field.x, field.y).v) : undefined;
  return (
    <div className="space-y-2">
      <div
        ref={wrap}
        className="relative touch-none overflow-hidden rounded-xl border border-border bg-black"
        style={{ height: H || 260 }}
        onWheel={(e) => setView((v) => clamp({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.25 : 0.8) }))}
        {...drag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={`Survey image of ${ctx.object.name}`}
          draggable={false}
          className="absolute max-w-none select-none"
          style={{ left: tl.x, top: tl.y, width: W * scale, height: H * scale }}
        />
        {fc && field && (
          <span
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-indigo-300/90"
            style={{ left: fc.x, top: fc.y, width: ((2 * field.r * R) / image.fieldWidthArcsec) * W * scale, height: ((2 * field.r * R) / image.fieldWidthArcsec) * W * scale }}
          />
        )}
        {W > 0 &&
          ctx.object.features.map((f) => {
            const d = project(f);
            const q = fromSky(d.x, d.y);
            const p = toPx(q.u, q.v);
            if (p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) return null;
            const sel = f.id === selId;
            const r = Math.max(5, ((f.catalogue?.majorArcmin ?? 0) * 30 * W * scale) / image.fieldWidthArcsec);
            return (
              <button
                key={f.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => ctx.onSelect({ kind: "feature", id: f.id })}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: p.x, top: p.y }}
                aria-label={f.name}
              >
                <span
                  className={`block rounded-full border ${sel ? "border-2 border-accent shadow-[0_0_10px_rgba(129,140,248,0.9)]" : "border-white/60 group-hover:border-accent"}`}
                  style={{ width: r * 2, height: r * 2 }}
                />
                {(sel || f.priority === 1 || (f.priority === 2 && view.zoom >= 3) || view.zoom >= 5) && (
                  <span className={`absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10px] ${sel ? "bg-accent/40 text-white" : "bg-black/60 text-white/85"}`}>
                    {f.name}
                  </span>
                )}
              </button>
            );
          })}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button type="button" aria-label="Zoom in" onClick={() => setView((v) => clamp({ ...v, zoom: v.zoom * 1.5 }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-black/70 hover:border-accent">
            <Icons.Plus className="size-4" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setView((v) => clamp({ ...v, zoom: v.zoom / 1.5 }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-black/70 text-lg leading-none hover:border-accent">
            −
          </button>
        </div>
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 text-[10px] text-white/80">N ↑ E ←</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        <ProvenanceBadge kind="retrieved" />
        <span>
          Real survey photograph: {image.source.credit}. {(image.fieldWidthArcsec / 60).toFixed(0)}′ × {(image.fieldHeightArcsec / 60).toFixed(0)}′. A long photographic exposure: far deeper and more colourful than the eye sees at the eyepiece.
        </span>
      </div>
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <span className="inline-block w-4 border-t-2 border-dashed border-indigo-300" /> Your telescope&apos;s field now · circles: objects at their SIMBAD positions
      </p>
      <SourceList ids={["skyview", "simbad"]} />
    </div>
  );
}

/** Drag to pan, in image fractions. */
function useRefDrag(view: { zoom: number; cx: number; cy: number }, set: (v: { zoom: number; cx: number; cy: number }) => void, W: number, H: number) {
  const drag = useRef<{ x: number; y: number; v: typeof view } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, v: view };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !W || !H) return;
      set({ ...d.v, cx: d.v.cx - (e.clientX - d.x) / (W * d.v.zoom), cy: d.v.cy - (e.clientY - d.y) / (H * d.v.zoom) });
    },
    onPointerUp: () => (drag.current = null),
    onPointerCancel: () => (drag.current = null),
  };
}
