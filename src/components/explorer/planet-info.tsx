"use client";

import { useState } from "react";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatDateTime, formatTime } from "@/lib/time-zone";
import { classifyObservability } from "@/modules/explorer/identify";
import jupiterAssets from "@/modules/explorer/jupiter/assets.json";
import { hoursToCentralMeridian } from "@/modules/explorer/projection";
import type { Property, RingFeature, SurfaceFeature } from "@/modules/explorer/types";
import { GRS_MODEL } from "@/modules/sky/jupiter";
import type { ExplorerContext } from "./explorer-context";
import { Chip, PropertyTile, SourceList } from "./shared";

const fmtArcsec = (a: number) => (a >= 60 ? `${(a / 60).toFixed(1)}′` : `${a.toFixed(a >= 10 ? 0 : 1)}″`);

/**
 * A view of a Jovian feature cut from the Cassini global map (December 2000),
 * aligned so the Great Red Spot sits at its current estimated longitude.
 */
export function JupiterThumb({ latDeg, lonWestDeg, grsLonDeg, spanDeg = 40, size = 96 }: { latDeg: number; lonWestDeg: number; grsLonDeg: number; spanDeg?: number; size?: number }) {
  const map = jupiterAssets.map;
  // West longitude increases to the left on a map seen from outside.
  const u = (((map.grsU - (lonWestDeg - grsLonDeg) / 360) % 1) + 1) % 1;
  const bgW = (size * 360) / spanDeg;
  const bgH = (size * 180) / spanDeg;
  return (
    <div
      role="img"
      aria-label="Cassini image of this part of Jupiter (December 2000)"
      className="shrink-0 overflow-hidden rounded-xl border border-border bg-black"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${map.src})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundRepeat: "repeat-x",
        backgroundPosition: `${-u * bgW + size / 2}px ${-((90 - latDeg) / 180) * bgH + size / 2}px`,
      }}
    />
  );
}

export function JovianFeatureInfo({ ctx, f }: { ctx: ExplorerContext; f: SurfaceFeature }) {
  const j = ctx.geometry?.jupiter;
  const project = ctx.geometry?.project;
  const disc = project?.(f);
  const isGrs = f.longitude === "grs";
  const lon = !j ? 0 : f.longitude === "central-meridian" ? j.cm2Deg : isGrs ? j.grsLonDeg : f.lonDeg;
  const obs = ctx.distanceKm ? classifyObservability(f.diameterKm, ctx.distanceKm, ctx.setup) : undefined;
  const tz = ctx.timeZone ?? "UTC";
  const props: Property[] = [...f.properties];
  if (isGrs && j) {
    props.push({
      label: "System II longitude now",
      value: `≈ ${lon.toFixed(0)}°`,
      kind: j.grsSource === "measured" ? "calculated" : "estimated",
      sourceIds: j.grsSource === "measured" ? [] : ["skyTelGrs"],
      note: j.grsSource === "measured" ? "From your measured value, carried forward at the usual drift rate." : "From a published drift model: may be several degrees off.",
    });
    const h = hoursToCentralMeridian(j, lon);
    props.push({
      label: "Next crosses the central meridian",
      value: formatTime(new Date(ctx.observedAt.getTime() + h * 3_600_000), tz),
      kind: "calculated",
      sourceIds: ["meeus"],
      note: "Best seen within about an hour of this time.",
    });
  }
  const facing = disc ? disc.z > 0 : true;
  return (
    <div className="space-y-4">
      <header className="flex gap-3">
        {j && <JupiterThumb latDeg={f.latDeg} lonWestDeg={lon} grsLonDeg={j.grsLonDeg} spanDeg={isGrs ? 36 : 60} size={104} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{f.name}</h2>
            <Chip>{f.type === "Band" ? (f.name.includes("Zone") ? "Cloud zone" : "Cloud belt") : "Storm"}</Chip>
          </div>
          <p className="mt-1 text-sm text-foreground/85">{f.summary}</p>
          <p className="mt-1 text-[11px] text-subtle">Image: Cassini, December 2000 (NASA/JPL/SSI). Jupiter&apos;s clouds have changed since; not the eyepiece view.</p>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-2">
        {props.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>
      {obs && (
        <ObservabilityNote
          title={
            !facing
              ? "On the far side of Jupiter now"
              : obs.resolvability === "resolved"
                ? `Within reach of your ${ctx.setup.label}`
                : obs.resolvability === "at-limit"
                  ? "At the limit of your setup"
                  : "Identified by position, not resolved"
          }
          body={
            !facing
              ? "It will rotate into view within about five hours."
              : `About ${fmtArcsec(obs.angularArcsec)} across vs. your ${obs.resolutionArcsec.toFixed(1)}″ limit.${f.type === "Band" ? " Contrast matters as much as size: belts are low-contrast and colour filters help." : " Its contrast changes from year to year."}`
          }
          good={facing && obs.resolvability === "resolved"}
        />
      )}
      {isGrs && ctx.grs && <GrsMeasurementForm ctx={ctx} />}
      {f.facts.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
          {f.facts.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <SourceList ids={[...f.sourceIds, ...props.flatMap((p) => p.sourceIds), "pia07782"]} />
    </div>
  );
}

/** Let the user enter a measured GRS longitude (e.g. from JUPOS) to replace the drift model. */
function GrsMeasurementForm({ ctx }: { ctx: ExplorerContext }) {
  const grs = ctx.grs!;
  const [open, setOpen] = useState(false);
  const [lon, setLon] = useState(grs.measured?.lonDeg ?? Math.round(ctx.geometry?.jupiter?.grsLonDeg ?? GRS_MODEL.lonDeg));
  const tz = ctx.timeZone ?? "UTC";
  return (
    <section className="rounded-xl border border-border bg-surface-sunken/60 px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted">
          {grs.measured
            ? `Using your measured longitude ${grs.measured.lonDeg}° (${formatDateTime(new Date(grs.measured.atIso), tz)}).`
            : `Position from Sky & Telescope's drift model (${GRS_MODEL.lonDeg}° on 1 June 2026, +${GRS_MODEL.driftDegPerMonth}°/month).`}
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-accent hover:underline">
          {open ? "Cancel" : "Use a measured value"}
        </button>
      </div>
      {open && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            grs.onChange({ lonDeg: lon, atIso: new Date().toISOString() });
            setOpen(false);
          }}
        >
          <label className="flex items-center gap-1.5">
            System II longitude
            <input
              type="number"
              min={0}
              max={360}
              step={0.5}
              value={lon}
              onChange={(e) => setLon(Number(e.target.value))}
              className="w-20 rounded-md border border-border bg-surface px-2 py-1 font-mono text-foreground"
            />
            °
          </label>
          <button type="submit" className="rounded-md border border-accent/60 px-2 py-1 hover:bg-accent/15">
            Save
          </button>
          {grs.measured && (
            <button type="button" onClick={() => grs.onChange(undefined)} className="text-muted hover:text-foreground">
              Back to the model
            </button>
          )}
          <span className="w-full text-subtle">Recent values are published by JUPOS and amateur observing groups. Saved on this device.</span>
        </form>
      )}
    </section>
  );
}

export function RingInfo({ ctx, r }: { ctx: ExplorerContext; r: RingFeature }) {
  const g = ctx.geometry?.rings;
  const tilt = g?.tiltDeg ?? 0;
  const obs = ctx.distanceKm ? classifyObservability(r.outerKm - r.innerKm, ctx.distanceKm, ctx.setup) : undefined;
  const props: Property[] = [...r.properties];
  if (obs) props.push({ label: "Apparent width at the ring ends", value: fmtArcsec(obs.angularArcsec), kind: "calculated", sourceIds: ["meeus"] });
  props.push({ label: "Ring opening now", value: `${Math.abs(tilt).toFixed(1)}° (${tilt >= 0 ? "north" : "south"} face)`, kind: "calculated", sourceIds: ["meeus"] });
  const edgeOn = Math.abs(tilt) < 3;
  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{r.name}</h2>
          <Chip>{r.type === "Gap" ? "Ring gap" : "Ring"}</Chip>
        </div>
        <p className="mt-1 text-sm text-foreground/85">{r.summary}</p>
      </header>
      <dl className="grid grid-cols-2 gap-2">
        {props.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>
      {obs && (
        <ObservabilityNote
          title={
            edgeOn
              ? "Rings nearly edge-on tonight"
              : obs.resolvability === "resolved"
                ? `Resolved by your ${ctx.setup.label}`
                : obs.resolvability === "at-limit"
                  ? "At the limit of your setup"
                  : "Identified by position, not resolved"
          }
          body={
            edgeOn
              ? `At ${Math.abs(tilt).toFixed(1)}° the rings are a thin line: their parts and gaps cannot be told apart.`
              : `About ${fmtArcsec(obs.angularArcsec)} wide at the ring ends vs. your ${obs.resolutionArcsec.toFixed(1)}″ limit.`
          }
          good={!edgeOn && obs.resolvability === "resolved"}
        />
      )}
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
        {r.facts.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <SourceList ids={[...r.sourceIds, ...props.flatMap((p) => p.sourceIds)]} />
    </div>
  );
}

export function ObservabilityNote({ title, body, good }: { title: string; body: string; good: boolean }) {
  return (
    <section
      aria-label="What your telescope shows"
      className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${good ? "border-success/40 bg-success/10" : "border-prov-estimated/40 bg-prov-estimated/10"}`}
    >
      {good ? <Icons.Eye className="mt-0.5 size-5 shrink-0 text-success" /> : <Icons.Locate className="mt-0.5 size-5 shrink-0 text-prov-estimated" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {title}
          <ProvenanceBadge kind="calculated" />
        </p>
        <p className="mt-0.5 text-xs text-foreground/75">{body}</p>
      </div>
    </section>
  );
}
