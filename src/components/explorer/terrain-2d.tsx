"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { profile, type CraterMetrics, type Terrain } from "@/modules/explorer/terrain";

/** Hypsometric colours: low (deep blue-violet) → high (pale). */
function hypsometric(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [38, 24, 92]],
    [0.25, [58, 72, 170]],
    [0.5, [72, 150, 170]],
    [0.72, [196, 186, 120]],
    [1, [246, 240, 228]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [a, ca] = stops[i - 1];
      const [b, cb] = stops[i];
      const k = (t - a) / (b - a);
      return [0, 1, 2].map((j) => ca[j] + (cb[j] - ca[j]) * k) as [number, number, number];
    }
  }
  return stops[stops.length - 1][1];
}

/** Colour-coded elevation with hillshade and 500 m contours, from LOLA. */
export function TopographicMap({ terrain, azimuthDeg }: { terrain: Terrain; azimuthDeg?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const { n, elevation, minM, maxM, kmPerSample } = terrain;
    c.width = c.height = n;
    const g = c.getContext("2d")!;
    const img = g.createImageData(n, n);
    const span = Math.max(1, maxM - minM);
    const mPerSample = kmPerSample * 1000;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const e = elevation[i];
        const ex = elevation[y * n + Math.min(n - 1, x + 1)] - elevation[y * n + Math.max(0, x - 1)];
        const ey = elevation[Math.min(n - 1, y + 1) * n + x] - elevation[Math.max(0, y - 1) * n + x];
        // Light from the north-west (cartographic convention).
        const nx = -ex / (2 * mPerSample);
        const ny = -ey / (2 * mPerSample);
        const shade = Math.max(0, (-nx * 0.6 + ny * 0.6 + 1) / Math.sqrt(nx * nx + ny * ny + 1) / 1.56);
        const contour = Math.floor(e / 500) !== Math.floor(elevation[y * n + Math.min(n - 1, x + 1)] / 500) || Math.floor(e / 500) !== Math.floor(elevation[Math.min(n - 1, y + 1) * n + x] / 500);
        const [r, gg, b] = hypsometric((e - minM) / span);
        const k = 0.45 + 0.75 * shade;
        img.data[i * 4] = contour ? 20 : Math.min(255, r * k);
        img.data[i * 4 + 1] = contour ? 20 : Math.min(255, gg * k);
        img.data[i * 4 + 2] = contour ? 30 : Math.min(255, b * k);
        img.data[i * 4 + 3] = 255;
      }
    g.putImageData(img, 0, 0);
  }, [terrain]);
  const a = azimuthDeg !== undefined ? (azimuthDeg * Math.PI) / 180 : undefined;
  return (
    <figure className="space-y-1.5">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border">
        <canvas ref={ref} className="block size-full" role="img" aria-label="Topographic map from LOLA elevation" />
        {a !== undefined && (
          <svg viewBox="-1 -1 2 2" className="pointer-events-none absolute inset-0 size-full">
            <line x1={-Math.sin(a) * 0.95} y1={Math.cos(a) * 0.95} x2={Math.sin(a) * 0.95} y2={-Math.cos(a) * 0.95} stroke="#fff" strokeWidth={0.012} strokeDasharray="0.04 0.025" />
            <text x={-Math.sin(a) * 0.86} y={Math.cos(a) * 0.86} fill="#fff" fontSize={0.08} textAnchor="middle" dominantBaseline="middle">A</text>
            <text x={Math.sin(a) * 0.86} y={-Math.cos(a) * 0.86} fill="#fff" fontSize={0.08} textAnchor="middle" dominantBaseline="middle">B</text>
          </svg>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 text-[10px] text-white/80">N ↑</span>
      </div>
      <figcaption className="flex items-center gap-2 text-[11px] text-muted">
        <span className="font-mono">{(terrain.minM / 1000).toFixed(1)} km</span>
        <span className="h-2 flex-1 rounded" style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.72, 1].map((t) => `rgb(${hypsometric(t).join(",")})`).join(",")})` }} />
        <span className="font-mono">+{(terrain.maxM / 1000).toFixed(1)} km</span>
      </figcaption>
      <p className="text-[11px] text-subtle">Elevation relative to the 1,737.4 km reference sphere · contours every 500 m · {terrain.sideKm} km across</p>
    </figure>
  );
}

/** Elevation profile A→B through the centre, at true scale or exaggerated. */
export function CrossSection({ terrain, metrics, azimuthDeg, onAzimuthChange }: { terrain: Terrain; metrics?: CraterMetrics; azimuthDeg: number; onAzimuthChange: (a: number) => void }) {
  const [trueScale, setTrueScale] = useState(false);
  const pts = useMemo(() => profile(terrain, azimuthDeg), [terrain, azimuthDeg]);
  const W = 560;
  const lengthKm = pts[pts.length - 1].dKm;
  const lo = Math.min(...pts.map((p) => p.elevationM));
  const hi = Math.max(...pts.map((p) => p.elevationM));
  // True scale: 1 km up = 1 km across. Otherwise stretch the relief to fill the chart.
  const kmPerPx = lengthKm / W;
  const H = trueScale ? Math.max(24, ((hi - lo) / 1000 / kmPerPx) * 1.1 + 16) : 200;
  const vScale = trueScale ? 1 / kmPerPx / 1000 : (H - 30) / Math.max(1, hi - lo);
  const exaggeration = trueScale ? 1 : vScale * 1000 * kmPerPx;
  const x = (d: number) => (d / lengthKm) * W;
  const y = (e: number) => H - 14 - (e - lo) * vScale;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.dKm).toFixed(1)},${y(p.elevationM).toFixed(1)}`).join("");
  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <label className="flex flex-1 items-center gap-2 text-muted">
          Direction
          <input type="range" min={0} max={179} value={azimuthDeg} onChange={(e) => onAzimuthChange(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" aria-label="Profile direction (degrees from north)" />
          <span className="w-10 font-mono text-foreground">{azimuthDeg}°</span>
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted">
          <input type="checkbox" checked={trueScale} onChange={(e) => setTrueScale(e.target.checked)} className="accent-accent" />
          True scale
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-border bg-[#05060c]" role="img" aria-label={`Elevation profile across the feature, direction ${azimuthDeg}°`}>
        <defs>
          <linearGradient id="xs-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#818cf8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#818cf8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path d={`${path}L${W},${H}L0,${H}Z`} fill="url(#xs-fill)" />
        <path d={path} fill="none" stroke="#c7d2fe" strokeWidth={1.5} />
        {metrics && !trueScale && (
          <>
            <line x1={0} x2={W} y1={y(metrics.rimM)} y2={y(metrics.rimM)} stroke="#a5b4fc" strokeDasharray="4 4" strokeWidth={0.8} />
            <line x1={0} x2={W} y1={y(metrics.floorM)} y2={y(metrics.floorM)} stroke="#a5b4fc" strokeDasharray="4 4" strokeWidth={0.8} />
            <text x={W - 4} y={y(metrics.rimM) - 4} fill="#c7d2fe" fontSize={11} textAnchor="end">rim</text>
            <text x={W - 4} y={y(metrics.floorM) - 4} fill="#c7d2fe" fontSize={11} textAnchor="end">floor · depth {(metrics.depthM / 1000).toFixed(1)} km</text>
          </>
        )}
        <text x={4} y={12} fill="#fff" fontSize={11}>A</text>
        <text x={W - 4} y={12} fill="#fff" fontSize={11} textAnchor="end">B</text>
      </svg>
      <figcaption className="flex flex-wrap justify-between gap-2 text-[11px] text-muted">
        <span>
          {Math.round(lengthKm)} km across · {((hi - lo) / 1000).toFixed(1)} km of relief
        </span>
        <span className={trueScale ? "" : "text-prov-estimated"}>{trueScale ? "True scale (no exaggeration)" : `Elevation exaggerated ${exaggeration.toFixed(0)}×`}</span>
      </figcaption>
    </figure>
  );
}
