"use client";

/**
 * FeatureAnnotationLayer: labels and markers for what can be identified in
 * the telescope view. Everything is placed from real coordinates through the
 * view's own geometry (see modules/explorer/identify.ts).
 */
import { chooseLabels, featureAt, ringAt, toScreen, type PlacedFeature, type PlacedRing, type RingGeometry, type ViewGeometry } from "@/modules/explorer/identify";
import type { SurfaceGeometry } from "@/modules/explorer/projection";
import type { ExplorerObject, ExplorerSelection, RingFeature } from "@/modules/explorer/types";

export interface ExplorerViewProps {
  object: ExplorerObject;
  selected?: ExplorerSelection;
  pinned?: ExplorerSelection;
  /** Click anywhere in the view to identify what is there. */
  identify: boolean;
  showLabels: boolean;
  onSelect: (s: ExplorerSelection) => void;
  /** How features and rings sit on the disc at this time (from modules/explorer/projection). */
  geometry?: SurfaceGeometry;
}

/** A planet's moon as drawn: screen px. */
export interface CompanionMark {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Vertical offset of the label below the moon, px, chosen so neighbouring names do not overlap. */
  labelDy?: number;
}

const sameSel = (a?: ExplorerSelection, b?: ExplorerSelection) =>
  Boolean(a && b && a.kind === b.kind && (a.kind === "object" || a.id === (b as { id: string }).id));

/** What is at a point of the view: a feature, a companion, the body itself, or nothing. */
export function identifyAt(
  sx: number,
  sy: number,
  v: ViewGeometry,
  placed: readonly PlacedFeature[],
  marks: readonly CompanionMark[],
  rings: readonly RingFeature[] = [],
  ringGeometry?: RingGeometry,
): ExplorerSelection | undefined {
  let best: CompanionMark | undefined;
  let bestD = 16;
  for (const m of marks) {
    const d = Math.hypot(m.x - sx, m.y - sy);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  if (best) return { kind: "companion", id: best.id };
  const f = featureAt(placed, sx, sy);
  if (f) return { kind: "feature", id: f.feature.id };
  if (ringGeometry && rings.length) {
    const r = ringAt(rings, ringGeometry, v, sx, sy);
    if (r === "globe") return { kind: "object" };
    if (r) return { kind: "ring", id: r.id };
  }
  // On the body's disc?
  const c = toScreen(v, 0, 0);
  if (Math.hypot(sx - c.x, sy - c.y) <= Math.max(v.targetPx / 2, 12)) return { kind: "object" };
  return undefined;
}

export function FeatureAnnotationLayer({
  explorer,
  placed,
  rings = [],
  ringScalePx = 0,
  marks,
  hover,
}: {
  explorer: ExplorerViewProps;
  placed: readonly PlacedFeature[];
  rings?: readonly PlacedRing[];
  /** Screen px per body radius, for deciding which rings are big enough to label. */
  ringScalePx?: number;
  marks: readonly CompanionMark[];
  hover?: { x: number; y: number; label: string };
}) {
  const { selected, pinned, showLabels, onSelect } = explorer;
  const ids = [selected, pinned].flatMap((s) => (s && s.kind === "feature" ? [s.id] : []));
  // Stars and other point-like catalogue objects are labelled whatever their size on screen.
  const minRadiusPx = explorer.geometry?.pointFeatures ? 0 : undefined;
  const labels = showLabels ? chooseLabels(placed, { always: ids, minRadiusPx }) : placed.filter((p) => ids.includes(p.feature.id) && p.inField);
  return (
    <>
      {labels.map((p) => {
        const sel: ExplorerSelection = { kind: "feature", id: p.feature.id };
        const isSelected = sameSel(selected, sel);
        const isPinned = sameSel(pinned, sel);
        const ring = Math.max(7, Math.min(26, p.radiusPx * 0.6));
        return (
          <div key={p.feature.id} className="pointer-events-none absolute" style={{ left: p.x, top: p.y }}>
            {(isSelected || isPinned) && (
              <span
                aria-hidden
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent shadow-[0_0_14px_rgba(129,140,248,0.8)]"
                style={{ width: ring * 2, height: ring * 2 }}
              />
            )}
            <button
              type="button"
              data-feature={p.feature.id}
              onClick={() => onSelect(sel)}
              title={`${p.feature.name}${p.lit ? "" : " — in darkness at this time"}`}
              className={`pointer-events-auto absolute flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] leading-tight backdrop-blur-sm transition-colors ${
                isSelected
                  ? "border-accent bg-accent/30 text-foreground"
                  : "border-white/15 bg-black/55 text-foreground/85 hover:border-accent/60 hover:text-foreground"
              } ${p.lit ? "" : "opacity-55"}`}
              style={{ top: isSelected || isPinned ? ring + 4 : 6 }}
            >
              {isPinned && <span aria-label="Pinned" className="size-1.5 rounded-full bg-accent" />}
              {p.feature.name}
            </button>
            {!isSelected && !isPinned && <span aria-hidden className="absolute size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />}
          </div>
        );
      })}
      {(() => {
        const unitKm = explorer.geometry?.rings?.unitKm ?? 1;
        const rows = { west: 0, east: 0 };
        return rings.map((pr) => {
          const sel: ExplorerSelection = { kind: "ring", id: pr.ring.id };
          const isSelected = sameSel(selected, sel) || sameSel(pinned, sel);
          const widthPx = ((pr.ring.outerKm - pr.ring.innerKm) / unitKm) * ringScalePx;
          const radiusPx = (pr.ring.outerKm / unitKm) * ringScalePx;
          const big = pr.ring.priority === 1 ? radiusPx > 28 : pr.ring.priority === 2 ? radiusPx > 70 : widthPx > 2.5;
          if (!isSelected && !(showLabels && big)) return null;
          // Alternate above/below at each ansa so neighbouring rings do not collide.
          const row = rows[pr.side]++;
          const dy = (row % 2 === 0 ? -1 : 1) * (14 + 12 * Math.floor(row / 2));
          const dx = pr.side === "west" ? 10 : -10;
          return (
            <div key={pr.ring.id} className="pointer-events-none absolute" style={{ left: pr.x, top: pr.y }}>
              <svg className="absolute overflow-visible" width="1" height="1" aria-hidden>
                <line x1={0} y1={0} x2={dx} y2={dy} stroke={isSelected ? "#a5b4fc" : "rgba(255,255,255,0.45)"} strokeWidth={1} />
                <circle cx={0} cy={0} r={isSelected ? 3 : 1.5} fill={isSelected ? "#a5b4fc" : "rgba(255,255,255,0.8)"} />
              </svg>
              <button
                type="button"
                data-ring={pr.ring.id}
                onClick={() => onSelect(sel)}
                className={`pointer-events-auto absolute -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] leading-tight backdrop-blur-sm ${
                  isSelected ? "border-accent bg-accent/30 text-foreground" : "border-white/15 bg-black/55 text-foreground/85 hover:border-accent/60"
                } ${pr.side === "east" ? "-translate-x-full" : ""}`}
                style={{ left: dx, top: dy }}
              >
                {pr.ring.name}
              </button>
            </div>
          );
        });
      })()}
      {marks.map((m) => {
        const sel: ExplorerSelection = { kind: "companion", id: m.id };
        const isSelected = sameSel(selected, sel) || sameSel(pinned, sel);
        return (
          <button
            key={m.id}
            type="button"
            data-companion={m.id}
            onClick={() => onSelect(sel)}
            className={`absolute -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] leading-none transition-colors ${
              isSelected ? "bg-accent/30 text-foreground ring-1 ring-accent" : "text-foreground/60 hover:bg-black/60 hover:text-foreground"
            }`}
            style={{ left: m.x, top: m.y + (m.labelDy ?? 6) }}
          >
            {m.name}
          </button>
        );
      })}
      {hover && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-accent/50 bg-black/80 px-2 py-1 text-[11px]"
          style={{ left: hover.x, top: hover.y - 10 }}
        >
          {hover.label}
        </span>
      )}
    </>
  );
}
