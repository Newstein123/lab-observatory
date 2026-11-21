"use client";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { albedoFor } from "@/modules/explorer/lunar/assets";
import { getSource } from "@/modules/explorer/sources";
import type { Property } from "@/modules/explorer/types";

/** Compact list of the sources behind what is shown. */
export function SourceList({ ids, className = "" }: { ids: readonly string[]; className?: string }) {
  const unique = [...new Set(ids)].map(getSource).filter((s) => s !== undefined);
  if (!unique.length) return null;
  return (
    <details className={`text-xs text-muted ${className}`}>
      <summary className="cursor-pointer select-none">Sources ({unique.length})</summary>
      <ul className="mt-2 space-y-1.5">
        {unique.map((s) => (
          <li key={s.id}>
            {s.url.startsWith("http") ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-border hover:text-foreground">
                {s.name}
              </a>
            ) : (
              s.name
            )}
            <span className="text-subtle"> · {s.credit} · {s.license}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A labelled value with its provenance. */
export function PropertyTile({ p, icon }: { p: Property; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl border border-border bg-surface-sunken/60 px-3 py-2.5" title={p.note}>
      {icon && <span className="mt-0.5 text-accent">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="truncate text-[11px] text-muted">{p.label}</dt>
          <ProvenanceBadge kind={p.kind} />
        </div>
        <dd className="mt-0.5 text-sm font-medium tabular-nums">{p.value}</dd>
        {p.note && <p className="mt-0.5 text-[11px] leading-snug text-subtle">{p.note}</p>}
      </div>
    </div>
  );
}

/**
 * A view of a lunar feature cut from the LROC global mosaic (real imagery,
 * equirectangular, so features far from the equator look stretched east–west).
 */
export function LunarThumb({ latDeg, lonDeg, diameterKm, size = 96, className = "" }: { latDeg: number; lonDeg: number; diameterKm: number; size?: number; className?: string }) {
  const map = albedoFor(4096);
  const spanLat = Math.max(2.5, (diameterKm * 2.4) / 30.32);
  const spanLon = spanLat / Math.max(0.2, Math.cos((latDeg * Math.PI) / 180));
  const bgW = (size * 360) / spanLon;
  const bgH = (size * 180) / spanLat;
  return (
    <div
      role="img"
      aria-label="LROC mosaic image of the feature"
      className={`shrink-0 overflow-hidden rounded-xl border border-border bg-black ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${map.src})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `${-((lonDeg + 180) / 360) * bgW + size / 2}px ${-((90 - latDeg) / 180) * bgH + size / 2}px`,
      }}
    />
  );
}

export function Chip({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "muted" }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
        tone === "accent" ? "border-accent/50 bg-accent/15 text-foreground" : "border-border bg-surface-sunken text-muted"
      }`}
    >
      {children}
    </span>
  );
}

export const fmtKm = (km: number) => (km >= 100 ? `${Math.round(km).toLocaleString("en-US")} km` : `${km.toFixed(km >= 10 ? 0 : 1)} km`);
export const fmtLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : "W"}`;
