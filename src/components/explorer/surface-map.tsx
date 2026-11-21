"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { albedoFor } from "@/modules/explorer/lunar/assets";
import type { ExplorerSelection, SurfaceFeature } from "@/modules/explorer/types";
import { unprojectDisc, type MoonOrientation } from "@/modules/sky/moon";
import type { ExplorerContext } from "./explorer-context";
import { SourceList } from "./shared";

const D2R = Math.PI / 180;

/** Shading for tonight: night side (dark) and the part turned away from Earth (hatched), on a 1°-per-pixel grid. */
function tonightOverlay(o: MoonOrientation): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 180;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(360, 180);
  const vec = (lat: number, lon: number) => [Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R)];
  const earth = vec(o.librationLatDeg, o.librationLonDeg);
  const sun = vec(o.subSolarLatDeg, o.subSolarLonDeg);
  for (let y = 0; y < 180; y++)
    for (let x = 0; x < 360; x++) {
      const p = vec(89.5 - y, -179.5 + x);
      const facing = p[0] * earth[0] + p[1] * earth[1] + p[2] * earth[2] > 0;
      const lit = p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2] > 0;
      const i = (y * 360 + x) * 4;
      if (!facing) {
        const hatch = (x + y) % 6 < 2;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = hatch ? 40 : 8;
        img.data[i + 3] = 170;
      } else if (!lit) {
        img.data[i + 3] = 140;
      }
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function SurfaceMap({ ctx }: { ctx: ExplorerContext }) {
  const { object, selection, orientation } = ctx;
  const selected = selection.kind === "feature" ? object.features.find((f) => f.id === selection.id) : undefined;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [img, setImg] = useState<HTMLImageElement>();
  const [view, setView] = useState(() => ({ lon: selected?.lonDeg ?? 0, lat: selected?.latDeg ?? 0, zoom: selected ? 3 : 1 }));
  const [showShade, setShowShade] = useState(true);
  const map = albedoFor(4096);
  const overlay = useMemo(() => (orientation && typeof document !== "undefined" ? tonightOverlay(orientation) : undefined), [orientation]);

  // Re-centre when another feature is chosen.
  const selId = selected?.id;
  useEffect(() => {
    if (selected) setView((v) => ({ lon: selected.lonDeg, lat: selected.latDeg, zoom: Math.max(v.zoom, 3) }));
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = map.src;
  }, [map.src]);

  const height = Math.round(width * 0.62);
  const ppd = (width / 360) * view.zoom; // pixels per degree
  const toPx = (lat: number, lon: number) => ({ x: width / 2 + (lon - view.lon) * ppd, y: height / 2 - (lat - view.lat) * ppd });
  const clampView = (v: typeof view) => {
    const zoom = Math.min(24, Math.max(1, v.zoom));
    const halfLon = width / 2 / ((width / 360) * zoom);
    const halfLat = height / 2 / ((width / 360) * zoom);
    return {
      zoom,
      lon: Math.min(180 - halfLon, Math.max(-180 + halfLon, v.lon)),
      lat: Math.min(90 - halfLat, Math.max(-90 + halfLat, v.lat)),
    };
  };

  // The telescope's field, traced onto the map.
  const footprint = useMemo(() => {
    if (!ctx.field || !orientation) return undefined;
    const pts: { lat: number; lon: number }[] = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * 2 * Math.PI;
      const q = unprojectDisc(ctx.field.x + ctx.field.r * Math.cos(a), ctx.field.y + ctx.field.r * Math.sin(a), orientation);
      if (q) pts.push({ lat: q.latDeg, lon: q.lonDeg });
    }
    return pts.length > 3 ? pts : undefined;
  }, [ctx.field, orientation]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#05060c";
    g.fillRect(0, 0, width, height);
    const tl = toPx(90, -180);
    if (img) {
      g.imageSmoothingQuality = "high";
      g.drawImage(img, tl.x, tl.y, 360 * ppd, 180 * ppd);
    }
    if (overlay && showShade) {
      g.imageSmoothingEnabled = true;
      g.drawImage(overlay, tl.x, tl.y, 360 * ppd, 180 * ppd);
    }
    if (footprint) {
      g.strokeStyle = "rgba(165,180,252,0.95)";
      g.lineWidth = 1.5;
      g.setLineDash([5, 4]);
      g.beginPath();
      footprint.forEach((p, i) => {
        const q = toPx(p.lat, p.lon);
        if (i) g.lineTo(q.x, q.y);
        else g.moveTo(q.x, q.y);
      });
      g.stroke();
      g.setLineDash([]);
    }
  }); // redraw every render: cheap, one image draw

  const visible = (f: SurfaceFeature) => {
    const p = toPx(f.latDeg, f.lonDeg);
    return p.x > -20 && p.y > -20 && p.x < width + 20 && p.y < height + 20;
  };

  const drag = useRef<{ x: number; y: number; v: typeof view } | null>(null);
  const select = (s: ExplorerSelection) => ctx.onSelect(s);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>LROC WAC global mosaic · equirectangular (east to the right)</span>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={showShade} onChange={(e) => setShowShade(e.target.checked)} className="accent-accent" />
          Tonight&apos;s night side and far side
        </label>
      </div>
      <div
        ref={wrap}
        className="relative touch-none overflow-hidden rounded-xl border border-border"
        style={{ height: height || 240 }}
        onWheel={(e) => setView((v) => clampView({ ...v, zoom: v.zoom * (e.deltaY < 0 ? 1.25 : 0.8) }))}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: view };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setView(clampView({ ...d.v, lon: d.v.lon - (e.clientX - d.x) / ppd, lat: d.v.lat + (e.clientY - d.y) / ppd }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <canvas ref={canvas} style={{ width, height }} className="block cursor-grab active:cursor-grabbing" role="img" aria-label="Map of the Moon from the LRO Wide Angle Camera mosaic" />
        {width > 0 &&
          object.features.filter(visible).map((f) => {
            const p = toPx(f.latDeg, f.lonDeg);
            const isSel = f.id === selected?.id;
            const r = Math.max(4, Math.min(60, (f.diameterKm / 30.32 / 2) * ppd));
            const showName = isSel || f.priority === 1 || (view.zoom >= 3 && f.priority === 2) || view.zoom >= 6;
            return (
              <button
                key={f.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => select({ kind: "feature", id: f.id })}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: p.x, top: p.y }}
                aria-label={f.name}
              >
                <span
                  className={`block rounded-full border ${isSel ? "border-2 border-accent shadow-[0_0_10px_rgba(129,140,248,0.9)]" : "border-white/50 group-hover:border-accent"}`}
                  style={{ width: r * 2, height: r * 2 }}
                />
                {showName && (
                  <span className={`absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10px] ${isSel ? "bg-accent/40 text-foreground" : "bg-black/60 text-foreground/80"}`}>
                    {f.name}
                  </span>
                )}
              </button>
            );
          })}
        <div className="absolute bottom-2 right-2 flex flex-col gap-1">
          <button type="button" aria-label="Zoom in" onClick={() => setView((v) => clampView({ ...v, zoom: v.zoom * 1.5 }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-black/70 hover:border-accent">
            <Icons.Plus className="size-4" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setView((v) => clampView({ ...v, zoom: v.zoom / 1.5 }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-black/70 text-lg leading-none hover:border-accent">
            −
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {footprint && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-indigo-300" /> Your telescope&apos;s field now
          </span>
        )}
        <span>Circles: feature sizes from the IAU Gazetteer</span>
      </div>
      <SourceList ids={["svsMoonKit", "gazetteer", "meeus"]} />
    </div>
  );
}
