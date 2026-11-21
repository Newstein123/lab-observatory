"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { classifyObservability, type Observability } from "@/modules/explorer/identify";
import { lunarTypeLabel } from "@/modules/explorer/lunar/features";
import { craterMetrics, loadTerrain, type CraterMetrics } from "@/modules/explorer/terrain";
import type { Companion, Property, SurfaceFeature } from "@/modules/explorer/types";
import { projectSelenographic } from "@/modules/sky/moon";
import type { ExplorerContext } from "./explorer-context";
import { MoonLocator } from "./moon-locator";
import { Chip, fmtKm, fmtLatLon, LunarThumb, PropertyTile, SourceList } from "./shared";
import { JovianFeatureInfo, RingInfo } from "./planet-info";
import { DeepSkyFeatureInfo } from "./deep-sky-info";

const fmtArcsec = (a: number) => (a >= 60 ? `${(a / 60).toFixed(1)}′` : `${a.toFixed(a >= 10 ? 0 : 1)}″`);

export function ObjectInfoTab({ ctx }: { ctx: ExplorerContext }) {
  const { object, selection } = ctx;
  if (selection.kind === "feature") {
    const f = object.features.find((x) => x.id === selection.id);
    if (f && object.projection === "jovian") return <JovianFeatureInfo ctx={ctx} f={f} />;
    if (f?.catalogue) return <DeepSkyFeatureInfo ctx={ctx} f={f} />;
    if (f) return <FeatureInfo ctx={ctx} f={f} />;
  }
  if (selection.kind === "ring") {
    const r = object.rings.find((x) => x.id === selection.id);
    if (r) return <RingInfo ctx={ctx} r={r} />;
  }
  if (selection.kind === "companion") {
    const c = object.companions.find((x) => x.id === selection.id);
    if (c) return <CompanionInfo ctx={ctx} c={c} />;
  }
  return <BodyInfo ctx={ctx} />;
}

function FeatureInfo({ ctx, f }: { ctx: ExplorerContext; f: SurfaceFeature }) {
  const metrics = useCraterMetrics(f);
  const type = lunarTypeLabel(f.type, f.name);
  const o = ctx.orientation;
  const disc = o ? projectSelenographic(f.latDeg, f.lonDeg, o) : undefined;
  const obs = ctx.distanceKm ? classifyObservability(f.diameterKm, ctx.distanceKm, ctx.setup) : undefined;

  const props: Property[] = [
    { label: f.type === "Crater" ? "Diameter" : "Extent", value: `≈ ${fmtKm(f.diameterKm)}`, kind: "retrieved", sourceIds: ["gazetteer"] },
    ...(metrics && f.type === "Crater"
      ? [
          {
            label: "Depth (rim to floor)",
            value: `≈ ${(metrics.depthM / 1000).toFixed(1)} km`,
            kind: "calculated" as const,
            sourceIds: ["lolaLdem118"],
            note: "Measured here from LOLA laser altimetry.",
          },
        ]
      : []),
    ...f.properties,
    { label: "Position", value: fmtLatLon(f.latDeg, f.lonDeg), kind: "retrieved", sourceIds: ["gazetteer"] },
    ...(obs ? [{ label: "Apparent size tonight", value: fmtArcsec(obs.angularArcsec), kind: "calculated" as const, sourceIds: ["meeus"] }] : []),
  ];

  return (
    <div className="space-y-4">
      <header className="flex gap-3">
        <LunarThumb latDeg={f.latDeg} lonDeg={f.lonDeg} diameterKm={f.diameterKm} size={104} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{f.name}</h2>
            <Chip>{type.label}</Chip>
          </div>
          <p className="mt-1 text-sm text-foreground/85">{f.summary}</p>
          <p className="mt-1 text-[11px] text-subtle">Image: LRO WAC mosaic (NASA/GSFC/ASU), not the eyepiece view.</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2">
        {props.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>

      {obs && disc && (
        <ObservabilityCard
          obs={obs}
          setupLabel={ctx.setup.label}
          nearSide={disc.z > 0}
          lit={disc.sunDot > 0}
          inField={ctx.inField.has(f.id)}
          onCentre={disc.z > 0 ? () => ctx.onCentre(f.id) : undefined}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        {f.facts.length > 0 && (
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Icons.Info className="size-4 text-accent" />
              Key facts
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
              {f.facts.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}
        {o && <MoonLocator orientation={o} latDeg={f.latDeg} lonDeg={f.lonDeg} />}
      </div>

      <p className="text-xs text-muted">
        Named after {f.nameOrigin.replace(/\.$/, "")}.{" "}
        <a href={f.gazetteerUrl} target="_blank" rel="noreferrer" className="underline decoration-border hover:text-foreground">
          IAU Gazetteer entry
        </a>
      </p>
      <SourceList ids={[...f.sourceIds, ...props.flatMap((p) => p.sourceIds)]} />
    </div>
  );
}

/** Typical opposition magnitudes of the moons the explorer places. RETRIEVED (JPL). */
const COMPANION_MAG: Record<string, number> = {
  io: 5.0, europa: 5.3, ganymede: 4.6, callisto: 5.6,
  titan: 8.4, rhea: 9.7, iapetus: 11.0, dione: 10.4, tethys: 10.2, enceladus: 11.7, mimas: 12.9, hyperion: 14.4,
};

function CompanionInfo({ ctx, c }: { ctx: ExplorerContext; c: Companion }) {
  const mag = COMPANION_MAG[c.id];
  const limit = ctx.setup.limitingMag;
  const bright = mag !== undefined && limit !== undefined ? mag <= limit - 0.5 : undefined;
  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{c.name}</h2>
          <Chip>{c.classification}</Chip>
        </div>
        <p className="mt-1 text-sm text-foreground/85">{c.summary}</p>
      </header>
      <section className="flex gap-3 rounded-xl border border-prov-estimated/40 bg-prov-estimated/10 px-3 py-2.5 text-sm" aria-label="What your telescope shows">
        <Icons.Locate className="mt-0.5 size-5 shrink-0 text-prov-estimated" />
        <div>
          <p className="font-medium">Identified by position, not resolved</p>
          <p className="mt-0.5 text-xs text-foreground/75">
            In your {ctx.setup.label} it is a point of light. It is named from its predicted position at this time, not from any surface detail.
          </p>
          {bright !== undefined && (
            <p className="mt-1 text-xs text-foreground/75">
              {bright
                ? `Bright enough to see: about magnitude ${mag!.toFixed(1)}, against your limit of ${limit!.toFixed(1)} tonight.`
                : `Probably too faint tonight: about magnitude ${mag!.toFixed(1)}, against your limit of ${limit!.toFixed(1)}.`}
              {c.id === "iapetus" && " Iapetus is much brighter when west of Saturn."}
            </p>
          )}
        </div>
      </section>
      <dl className="grid grid-cols-2 gap-2">
        {c.properties.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>
      {c.facts.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
          {c.facts.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <SourceList ids={[...c.sourceIds, ...c.properties.flatMap((p) => p.sourceIds), "meeus"]} />
    </div>
  );
}

function BodyInfo({ ctx }: { ctx: ExplorerContext }) {
  const { object, orientation: o } = ctx;
  const live: Property[] = [];
  if (ctx.distanceKm) live.push({ label: "Distance from you now", value: `${Math.round(ctx.distanceKm).toLocaleString("en-US")} km`, kind: "calculated", sourceIds: ["meeus"] });
  if (o)
    live.push({
      label: "Libration now",
      value: `${o.librationLonDeg >= 0 ? "+" : "−"}${Math.abs(o.librationLonDeg).toFixed(1)}° lon, ${o.librationLatDeg >= 0 ? "+" : "−"}${Math.abs(o.librationLatDeg).toFixed(1)}° lat`,
      kind: "calculated",
      sourceIds: ["meeus"],
      note: "Which way the Moon is tipped towards you: positive longitude shows more of the eastern limb (Mare Crisium side).",
    });
  const j = ctx.geometry?.jupiter;
  if (j)
    live.push({
      label: "Central meridian now (System II)",
      value: `${j.cm2Deg.toFixed(0)}°`,
      kind: "calculated",
      sourceIds: ["meeus"],
      note: "The longitude facing you; Jupiter turns about 36° an hour.",
    });
  const rg = ctx.geometry?.rings;
  if (rg)
    live.push({
      label: "Ring opening now",
      value: `${Math.abs(rg.tiltDeg).toFixed(1)}° (${rg.tiltDeg >= 0 ? "north" : "south"} face)`,
      kind: "calculated",
      sourceIds: ["meeus"],
      note: Math.abs(rg.tiltDeg) < 3 ? "Nearly edge-on: the rings are a thin line." : undefined,
    });
  const props = [...object.properties, ...live];
  const visible = object.features.filter((f) => ctx.inField.has(f.id)).length;
  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{object.name}</h2>
          <Chip>{object.classification}</Chip>
        </div>
        {object.summary && <p className="mt-1 text-sm text-foreground/85">{object.summary}</p>}
      </header>
      <dl className="grid grid-cols-2 gap-2">
        {props.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>
      {object.identifiable === "surface-features" && (
        <p className="rounded-xl border border-border bg-surface-sunken/60 px-3 py-2 text-sm text-foreground/85">
          <Icons.Crosshair className="mr-1.5 inline size-4 text-accent" />
          {visible} named features are in your field now. Click a label, or use <strong>Identify</strong> and click the view.
        </p>
      )}
      {object.identifiable === "satellites" && (
        <p className="rounded-xl border border-border bg-surface-sunken/60 px-3 py-2 text-sm text-foreground/85">
          <Icons.Crosshair className="mr-1.5 inline size-4 text-accent" />
          Click a moon&apos;s name{object.features.length ? ", a belt or the Great Red Spot" : object.rings.length ? " or a ring" : ""} in the view to identify it from its predicted position.
        </p>
      )}
      {object.facts.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
          {object.facts.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <SourceList ids={[...object.sourceIds, ...props.flatMap((p) => p.sourceIds)]} />
    </div>
  );
}

/** What this setup really shows of the feature tonight (spec §9). */
function ObservabilityCard({
  obs,
  setupLabel,
  nearSide,
  lit,
  inField,
  onCentre,
}: {
  obs: Observability;
  setupLabel: string;
  nearSide: boolean;
  lit: boolean;
  inField: boolean;
  onCentre?: () => void;
}) {
  const text = !nearSide
    ? { title: "Out of sight tonight", body: "Libration has turned it just beyond the limb." }
    : !lit
      ? { title: "In darkness at this time", body: "It is on the night side of the terminator. Its position is known, but there is nothing to see until sunrise there." }
      : obs.resolvability === "resolved"
        ? { title: `Resolved by your ${setupLabel}`, body: `About ${fmtArcsec(obs.angularArcsec)} across, well above your ${obs.resolutionArcsec.toFixed(1)}″ resolution limit.` }
        : obs.resolvability === "at-limit"
          ? { title: "At the limit of your setup", body: `About ${fmtArcsec(obs.angularArcsec)} across: detectable, but its shape is hard to make out at this magnification.` }
          : { title: "Identified by position, not resolved", body: `About ${fmtArcsec(obs.angularArcsec)} across: too small for your ${setupLabel} to show. The label marks where it is.` };
  const good = nearSide && lit && obs.resolvability === "resolved";
  return (
    <section
      aria-label="What your telescope shows"
      className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${good ? "border-success/40 bg-success/10" : "border-prov-estimated/40 bg-prov-estimated/10"}`}
    >
      {good ? <Icons.Eye className="mt-0.5 size-5 shrink-0 text-success" /> : <Icons.Locate className="mt-0.5 size-5 shrink-0 text-prov-estimated" />}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {text.title}
          <ProvenanceBadge kind="calculated" />
        </p>
        <p className="mt-0.5 text-xs text-foreground/75">{text.body}</p>
        {nearSide && !inField && onCentre && (
          <button type="button" onClick={onCentre} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-accent/50 px-2 py-1 text-xs hover:bg-accent/15">
            <Icons.Target className="size-3.5" />
            Outside your field: point the telescope at it
          </button>
        )}
      </div>
    </section>
  );
}

function useCraterMetrics(f: SurfaceFeature): CraterMetrics | undefined {
  const [m, setM] = useState<{ id: string; m: CraterMetrics }>();
  useEffect(() => {
    if (!f.terrain || f.type !== "Crater") return;
    let cancelled = false;
    loadTerrain(f.id).then(
      (t) => !cancelled && setM({ id: f.id, m: craterMetrics(t, f.diameterKm) }),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [f]);
  return m?.id === f.id ? m.m : undefined;
}
