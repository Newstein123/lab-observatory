"use client";

import { Icons } from "@/components/ui/icons";
import { lunarTypeLabel } from "@/modules/explorer/lunar/features";
import type { ExplorerObject, LearnSection, SurfaceFeature } from "@/modules/explorer/types";
import type { ExplorerContext } from "./explorer-context";
import { LunarThumb, SourceList } from "./shared";

/** Context for what is open: how it formed, what was found there, and where to go next. No lessons, no quizzes. */
export function LearnTab({ ctx }: { ctx: ExplorerContext }) {
  const { object, selection } = ctx;
  let sections: LearnSection[] = object.learn;
  let related: SurfaceFeature[] = [];
  let sourceIds = object.sourceIds;
  let facts: string[] = [];
  if (selection.kind === "feature") {
    const f = object.features.find((x) => x.id === selection.id);
    sections = f?.learn ?? [];
    facts = f && !f.learn.length ? f.facts : [];
    related = (f?.related ?? []).map((id) => object.features.find((x) => x.id === id)).filter((x): x is SurfaceFeature => Boolean(x));
    sourceIds = f?.sourceIds ?? [];
  } else if (selection.kind === "ring") {
    const r = object.rings.find((x) => x.id === selection.id);
    sections = r?.learn ?? [];
    facts = r && !r.learn.length ? r.facts : [];
    sourceIds = r?.sourceIds ?? [];
  } else if (selection.kind === "companion") {
    const c = object.companions.find((x) => x.id === selection.id);
    sections = c?.learn ?? [];
    sourceIds = c?.sourceIds ?? [];
  }
  const allSources = [...sourceIds, ...sections.flatMap((s) => s.sourceIds)];

  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section key={s.heading}>
          <h3 className="mb-1 text-sm font-semibold">{s.heading}</h3>
          <p className="text-sm leading-relaxed text-foreground/85">{s.body}</p>
        </section>
      ))}
      {facts.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85 marker:text-accent">
          {facts.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {related.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Explore nearby and related</h3>
          <div className="grid grid-cols-2 gap-2">
            {related.map((r) => (
              <FeatureButton key={r.id} object={object} f={r} onClick={() => ctx.onSelect({ kind: "feature", id: r.id })} inField={ctx.inField.has(r.id)} />
            ))}
          </div>
        </section>
      )}
      {selection.kind === "object" && object.features.length > 0 && <FeatureIndex ctx={ctx} />}
      {selection.kind === "object" && object.rings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Rings and gaps</h3>
          <div className="flex flex-wrap gap-2">
            {object.rings.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => ctx.onSelect({ kind: "ring", id: r.id })}
                className="rounded-lg border border-border bg-surface-sunken/60 px-3 py-1.5 text-sm hover:border-accent/60"
              >
                {r.name}
              </button>
            ))}
          </div>
        </section>
      )}
      {selection.kind === "object" && object.companions.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Moons</h3>
          <div className="flex flex-wrap gap-2">
            {object.companions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => ctx.onSelect({ kind: "companion", id: c.id })}
                className="rounded-lg border border-border bg-surface-sunken/60 px-3 py-1.5 text-sm hover:border-accent/60"
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <SourceList ids={allSources} />
    </div>
  );
}

/** Kind of feature, in words. */
export function featureTypeLabel(object: ExplorerObject, f: SurfaceFeature): { label: string; plural: string } {
  if (object.projection === "selenographic") return lunarTypeLabel(f.type, f.name);
  if (f.type === "Band") return f.name.includes("Zone") ? { label: "Cloud zone", plural: "Belts and zones" } : { label: "Cloud belt", plural: "Belts and zones" };
  return { label: f.type, plural: `${f.type}s` };
}

function FeatureButton({ object, f, onClick, inField }: { object: ExplorerObject; f: SurfaceFeature; onClick: () => void; inField: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-xl border border-border bg-surface-sunken/60 p-1.5 text-left hover:border-accent/60">
      {object.projection === "selenographic" ? (
        <LunarThumb latDeg={f.latDeg} lonDeg={f.lonDeg} diameterKm={f.diameterKm} size={40} className="rounded-lg" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
          <Icons.Target className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm">{f.name}</span>
        <span className="block truncate text-[11px] text-muted">
          {featureTypeLabel(object, f).label}
          {inField && " · in view"}
        </span>
      </span>
    </button>
  );
}

/** Every named feature, grouped by kind. */
function FeatureIndex({ ctx }: { ctx: ExplorerContext }) {
  const groups = new Map<string, SurfaceFeature[]>();
  for (const f of ctx.object.features) {
    const k = featureTypeLabel(ctx.object, f).plural;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Icons.Crosshair className="size-4 text-accent" />
        Features you can identify
      </h3>
      <div className="space-y-3">
        {[...groups].map(([k, fs]) => (
          <div key={k}>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{k}</p>
            <div className="flex flex-wrap gap-1.5">
              {fs.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => ctx.onSelect({ kind: "feature", id: f.id })}
                  className={`rounded-md border px-2 py-1 text-xs hover:border-accent/60 ${ctx.inField.has(f.id) ? "border-border-strong text-foreground" : "border-border text-muted"}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
