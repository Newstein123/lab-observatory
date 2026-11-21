"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/time-zone";
import { JUPITER_FLATTENING, jupiterOrientation } from "@/modules/sky/jupiter";
import { planetPosition, poleAngleDeg, SATURN_RADIUS_KM, SATURN_RING_RATIO } from "@/modules/sky/planets";
import { loadSaturnMoonData, type SaturnMoonData } from "@/modules/targets/saturn-moons";
import { satellitesOf, type Satellite } from "@/modules/targets/satellites";
import type { ExplorerContext } from "./explorer-context";
import type { JupiterPose, OrbitMoon, PlanetSceneProps } from "./planet-scene";
import { SourceList } from "./shared";

const PlanetScene = dynamic(() => import("./planet-scene"), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Loading 3D view" className="flex size-full items-center justify-center">
      <div className="size-9 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
    </div>
  ),
});

const GALILEAN_PERIOD_DAYS: Record<string, number> = { Io: 1.769, Europa: 3.551, Ganymede: 7.155, Callisto: 16.689 };

/** Moons at a time and their orbits, traced by sampling the same ephemeris over one period. */
function orbitMoons(planet: "jupiter" | "saturn", at: Date, saturn?: SaturnMoonData, onlyIds?: Set<string>): OrbitMoon[] {
  const unit = planet === "saturn" ? SATURN_RING_RATIO : 1; // to equatorial radii
  const moonsAt = (d: Date): Satellite[] => satellitesOf(planet, d, saturn);
  const now = moonsAt(at);
  const period = (name: string) =>
    planet === "jupiter" ? GALILEAN_PERIOD_DAYS[name] : (saturn?.moons.find((m) => m.name === name)?.physical.orbitalPeriodDays ?? 10);
  return now
    .filter((m) => !onlyIds || onlyIds.has(m.name.toLowerCase()))
    .map((m) => {
      const P = period(m.name);
      const N = 96;
      const path: [number, number, number][] = [];
      for (let k = 0; k <= N; k++) {
        const s = moonsAt(new Date(at.getTime() + (k / N) * P * 86_400_000)).find((x) => x.name === m.name)!;
        path.push([s.x * unit, s.y * unit, (s.z ?? 0) * unit]);
      }
      return { id: m.name.toLowerCase(), name: m.name, now: { x: m.x * unit, y: m.y * unit, z: (m.z ?? 0) * unit }, path };
    });
}

type Mode = "planet" | "orbits";

export function PlanetModelTab({ ctx }: { ctx: ExplorerContext }) {
  const planet = ctx.object.targetId as "jupiter" | "saturn";
  const sel = ctx.selection;
  const [mode, setMode] = useState<Mode>(sel.kind === "companion" ? "orbits" : "planet");
  const [view, setView] = useState<"earth" | "above">("earth");
  const [hours, setHours] = useState(0);
  const [labels, setLabels] = useState(true);
  const [innerOnly, setInnerOnly] = useState(planet === "saturn" && !(sel.kind === "companion" && ["iapetus", "hyperion"].includes(sel.id)));
  const [saturn, setSaturn] = useState<SaturnMoonData>();
  useEffect(() => {
    if (planet === "saturn") loadSaturnMoonData().then(setSaturn, () => {});
  }, [planet]);

  const at = useMemo(() => new Date(ctx.observedAt.getTime() + hours * 3_600_000), [ctx.observedAt, hours]);
  const pose = useMemo(() => {
    if (planet === "jupiter") {
      const o = jupiterOrientation(at);
      const grs = ctx.geometry?.jupiter;
      // Carry the spot's longitude along with the time slider (it barely drifts in days).
      return { tiltDeg: o.subLatDeg, poleDeg: o.axisPaDeg, cm2Deg: o.cm2Deg, grsLonDeg: grs?.grsLonDeg ?? 0 };
    }
    return { tiltDeg: planetPosition("saturn", at).ringTiltDeg ?? 0, poleDeg: poleAngleDeg("saturn", at) ?? 0 };
  }, [planet, at, ctx.geometry?.jupiter]);
  const moons = useMemo(() => {
    if (mode !== "orbits" || (planet === "saturn" && !saturn)) return [];
    const only = planet === "saturn" && innerOnly ? new Set(["mimas", "enceladus", "tethys", "dione", "rhea", "titan"]) : undefined;
    return orbitMoons(planet, at, saturn, only);
  }, [mode, planet, at, saturn, innerOnly]);

  const selectedId = sel.kind === "object" ? undefined : sel.id;
  const props: PlanetSceneProps = {
    planet,
    mode,
    pose,
    rings: ctx.object.rings,
    globeKm: planet === "saturn" ? SATURN_RADIUS_KM : 71_492,
    flattening: planet === "saturn" ? 0.098 : JUPITER_FLATTENING,
    moons,
    selectedId,
    view,
    showLabels: labels,
    onSelectRing: (id) => ctx.onSelect({ kind: "ring", id }),
    onSelectMoon: (id) => ctx.onSelect({ kind: "companion", id }),
    markers:
      planet === "jupiter"
        ? ctx.object.features.map((f) => {
            const jp = pose as JupiterPose;
            return { id: f.id, name: f.name, latDeg: f.latDeg, lonDeg: f.longitude === "central-meridian" ? jp.cm2Deg : f.longitude === "grs" ? jp.grsLonDeg : f.lonDeg };
          })
        : undefined,
  };
  const tz = ctx.timeZone ?? "UTC";

  return (
    <div className="space-y-2">
      <Tabs<Mode>
        label="3D view"
        variant="segmented"
        value={mode}
        onChange={setMode}
        items={[
          { id: "planet", label: planet === "saturn" ? "Planet and rings" : "Planet" },
          { id: "orbits", label: "Moons' orbits" },
        ]}
      />
      <div className="relative h-[340px] overflow-hidden rounded-xl border border-border bg-[#04050b]" data-testid="planet-3d">
        <PlanetScene {...props} />
        <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/60">
          <Icons.Rotate className="mr-1 inline size-3.5" />
          Drag to rotate · scroll to zoom{mode === "orbits" ? " · click a moon" : planet === "saturn" ? " · click a ring" : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        {mode === "orbits" && (
          <span className="inline-flex overflow-hidden rounded-md border border-border">
            {(["earth", "above"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-2 py-1 ${view === v ? "bg-accent/25 text-foreground" : "hover:text-foreground"}`}>
                {v === "earth" ? "From Earth" : "From above"}
              </button>
            ))}
          </span>
        )}
        {mode === "orbits" && planet === "saturn" && (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={!innerOnly} onChange={(e) => setInnerOnly(!e.target.checked)} className="accent-accent" />
            Include Hyperion and Iapetus (far out)
          </label>
        )}
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} className="accent-accent" />
          Labels
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        Time
        <input type="range" min={0} max={planet === "jupiter" ? 96 : 192} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="min-w-0 flex-1 accent-accent" aria-label="Hours after the observation time" />
        <span className="w-40 text-right font-mono text-foreground">{hours ? `+${hours} h · ` : ""}{formatDateTime(at, tz)}</span>
      </label>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <ProvenanceBadge kind="illustrative" />
        <span className="text-muted">
          Scientific reconstruction from calculated positions{planet === "jupiter" ? " and the Cassini map of December 2000 (clouds have changed since)" : "; ring radii measured, shading illustrative; the globe is left plain (no global map exists)"}. Not the telescope image.
        </span>
      </div>
      <SourceList ids={planet === "jupiter" ? ["meeus", "pia07782", "nasaJupiterFacts", "skyTelGrs"] : ["horizons", "nasaRingFacts", "nasaSaturnFacts", "meeus"]} />
    </div>
  );
}

