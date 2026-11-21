"use client";

import type { SurfaceFeature, Property } from "@/modules/explorer/types";
import type { ExplorerContext } from "./explorer-context";
import { ObservabilityNote } from "./planet-info";
import { Chip, PropertyTile, SourceList } from "./shared";

/** A star, cluster, nebula region or galaxy in a deep-sky field, with its catalogue data. */
export function DeepSkyFeatureInfo({ ctx, f }: { ctx: ExplorerContext; f: SurfaceFeature }) {
  const c = f.catalogue!;
  const limit = ctx.setup.limitingMag;
  const inField = ctx.inField.has(f.id);
  // Point sources compare directly with the limiting magnitude; extended ones depend on surface brightness.
  const extended = c.kind !== "star";
  const vis = c.visibility
    ? { ...c.visibility, good: false }
    : c.vMag !== undefined && limit !== undefined
      ? c.vMag <= limit - 0.5
        ? {
            title: extended ? "Likely visible with this setup" : "Visible with this setup",
            body: `Magnitude ${c.vMag.toFixed(1)} against your limit of ${limit.toFixed(1)} tonight.${extended ? " Spread-out objects look fainter than their total magnitude suggests: dark skies matter." : ""}`,
            good: true,
          }
        : { title: "Probably too faint tonight", body: `Magnitude ${c.vMag.toFixed(1)} against your limit of ${limit.toFixed(1)}. It is marked from its catalogued position.`, good: false }
      : { title: "Identified by position", body: "Its visibility depends on its surface brightness and your sky; it is marked from its catalogued position.", good: false };
  const props: Property[] = [...f.properties, { label: "Position (J2000)", value: `RA ${(f.lonDeg / 15).toFixed(3)} h, Dec ${f.latDeg >= 0 ? "+" : "−"}${Math.abs(f.latDeg).toFixed(3)}°`, kind: "retrieved", sourceIds: ["simbad"] }];
  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{f.name}</h2>
          <Chip>{f.type}</Chip>
        </div>
        <p className="mt-1 text-sm text-foreground/85">{f.summary}</p>
      </header>
      <dl className="grid grid-cols-2 gap-2">
        {props.map((p) => (
          <PropertyTile key={p.label} p={p} />
        ))}
      </dl>
      <ObservabilityNote title={vis.title} body={vis.body} good={vis.good} />
      {!inField && (
        <button type="button" onClick={() => ctx.onCentre(f.id)} className="inline-flex items-center gap-1.5 rounded-md border border-accent/50 px-2 py-1 text-xs hover:bg-accent/15">
          Outside your field: point the telescope at it
        </button>
      )}
      {f.facts.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
          {f.facts.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        SIMBAD:{" "}
        <a href={c.simbadUrl} target="_blank" rel="noreferrer" className="underline decoration-border hover:text-foreground">
          {c.simbadId}
        </a>{" "}
        · object type {c.otype}
      </p>
      <SourceList ids={[...f.sourceIds, ...props.flatMap((p) => p.sourceIds)]} />
    </div>
  );
}
