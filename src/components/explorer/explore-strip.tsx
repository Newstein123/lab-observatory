"use client";

import { useRef } from "react";
import { Icons } from "@/components/ui/icons";
import { featureTypeLabel } from "./learn-tab";
import type { ExplorerObject, ExplorerSelection } from "@/modules/explorer/types";
import { LunarThumb } from "./shared";

/**
 * "Explore more on the Moon": landmarks in the field first (lit before
 * unlit), then the rest by prominence. Images are cut from the LROC mosaic.
 */
export function ExploreStrip({
  object,
  inField,
  lit,
  selected,
  onSelect,
  onLearn,
}: {
  object: ExplorerObject;
  inField: ReadonlySet<string>;
  lit: ReadonlySet<string>;
  selected?: ExplorerSelection;
  onSelect: (s: ExplorerSelection) => void;
  onLearn: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = [...object.features].sort(
    (a, b) =>
      Number(inField.has(b.id) && lit.has(b.id)) - Number(inField.has(a.id) && lit.has(a.id)) ||
      Number(inField.has(b.id)) - Number(inField.has(a.id)) ||
      a.priority - b.priority ||
      b.diameterKm - a.diameterKm,
  );
  const scroll = (dir: number) => scroller.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  return (
    <section aria-label={`Explore more on ${object.name}`} className="glass grid gap-3 rounded-2xl p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Icons.Sparkles className="size-4 text-accent" />
          Explore more on {object.name.replace(/^The /, "the ")}
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-foreground sm:flex">
            <Icons.Back className="size-4" />
          </button>
          <div ref={scroller} className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {items.map((f) => {
              const isSel = selected?.kind === "feature" && selected.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelect({ kind: "feature", id: f.id })}
                  className={`flex w-[168px] shrink-0 snap-start items-center gap-2 rounded-xl border p-1.5 text-left transition-colors ${
                    isSel ? "border-accent bg-accent/15" : "border-border bg-surface-sunken/60 hover:border-accent/60"
                  }`}
                >
                  {object.projection === "selenographic" ? (
                    <LunarThumb latDeg={f.latDeg} lonDeg={f.lonDeg} diameterKm={f.diameterKm} size={44} className="rounded-lg" />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
                      <Icons.Target className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{f.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {inField.has(f.id) ? (lit.has(f.id) ? "In view" : "In view · dark") : featureTypeLabel(object, f).label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => scroll(1)} aria-label="Scroll right" className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:text-foreground sm:flex">
            <Icons.Chevron className="size-4" />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onLearn}
        className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent/15"
      >
        <Icons.Moon className="size-7 shrink-0 text-accent" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Learn: {object.name.replace(/^The /, "")}</span>
          <span className="block text-xs text-muted">{object.projection === "selenographic" ? "Its surface, formation and key features" : "What you are seeing, and what to look for"}</span>
        </span>
      </button>
    </section>
  );
}
