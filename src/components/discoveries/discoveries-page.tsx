"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { TargetGlyph } from "@/components/lab/target-glyph";
import { JupiterThumb } from "@/components/explorer/planet-info";
import { LunarThumb } from "@/components/explorer/shared";
import { SkyThumb } from "@/components/explorer/sky-thumb";
import { formatDateTime } from "@/lib/format";
import { signInHref } from "@/modules/auth/use-auth";
import { useExploreHistory } from "@/modules/discoveries/history";
import { discoveryHref, discoveryKey, type Discovery, type DiscoveryInput } from "@/modules/discoveries/models";
import { useDiscoveries, useDiscoveryActions } from "@/modules/discoveries/use-discoveries";
import { explorerObjectFor } from "@/modules/explorer/objects";
import type { ExplorerObject } from "@/modules/explorer/types";
import { grsLongitude } from "@/modules/sky/jupiter";
import { getTarget } from "@/modules/targets/catalogue";

const KIND_LABEL: Record<Discovery["kind"], string> = { object: "Object", feature: "Feature", companion: "Moon", ring: "Ring" };

function objectOf(targetId: string): ExplorerObject | undefined {
  const t = getTarget(targetId);
  return t ? explorerObjectFor(t) : undefined;
}

/** A picture for a discovery: real imagery where the explorer has it, else the target's glyph. */
function Thumb({ d, size = 64 }: { d: Pick<DiscoveryInput, "targetId" | "kind" | "featureId">; size?: number }) {
  const target = getTarget(d.targetId);
  const object = objectOf(d.targetId);
  const f = d.kind === "feature" ? object?.features.find((x) => x.id === d.featureId) : undefined;
  if (f && object?.projection === "selenographic") return <LunarThumb latDeg={f.latDeg} lonDeg={f.lonDeg} diameterKm={f.diameterKm} size={size} />;
  if (f && object?.projection === "jovian")
    return <JupiterThumb latDeg={f.latDeg} lonWestDeg={grsLongitude(new Date())} grsLonDeg={grsLongitude(new Date())} spanDeg={50} size={size} />;
  if (f?.catalogue) return <SkyThumb targetId={d.targetId} raDeg={f.lonDeg} decDeg={f.latDeg} size={size} spanArcmin={Math.max(6, (f.catalogue.majorArcmin ?? 4) * 2.5)} />;
  return target ? (
    <span className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-sunken" style={{ width: size, height: size }}>
      <TargetGlyph target={target} size={size * 0.6} />
    </span>
  ) : null;
}

function DiscoveryCard({ d }: { d: Discovery }) {
  const { setNote, remove, busy } = useDiscoveryActions();
  const [note, setNoteDraft] = useState(d.note ?? "");
  const dirty = note.trim() !== (d.note ?? "");
  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-surface/60 p-3" data-testid="discovery">
      <Thumb d={d} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium">{d.name}</h3>
            <p className="text-xs text-muted">
              {KIND_LABEL[d.kind]} · saved {formatDateTime(d.createdAt)}
              {d.siteName ? ` · ${d.siteName}` : ""}
            </p>
            {d.setupSummary && <p className="truncate text-xs text-subtle">{d.setupSummary}</p>}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Link href={discoveryHref(d)} className={buttonStyles({ size: "sm" })}>
              <Icons.Telescope className="size-4" />
              Observe
            </Link>
            <button type="button" disabled={busy} onClick={() => remove(d)} aria-label={`Remove ${d.name}`} className={buttonStyles({ size: "sm", variant: "ghost" })}>
              Remove
            </button>
          </div>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setNote(d.id, note);
          }}
        >
          <textarea
            aria-label={`Note for ${d.name}`}
            value={note}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note: what you saw, conditions, what to try next…"
            rows={note ? 2 : 1}
            maxLength={2000}
            className="min-w-0 flex-1 resize-y rounded-lg border border-border bg-surface-sunken px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
          {dirty && (
            <button type="submit" disabled={busy} className={buttonStyles({ size: "sm", variant: "primary" })}>
              Save note
            </button>
          )}
        </form>
      </div>
    </li>
  );
}

/** Related features of what was saved, not yet saved themselves. */
function suggestions(saved: readonly Discovery[]): (DiscoveryInput & { reason: string })[] {
  const have = new Set(saved.map(discoveryKey));
  const out: (DiscoveryInput & { reason: string })[] = [];
  for (const d of saved) {
    const object = objectOf(d.targetId);
    if (!object) continue;
    const related = d.kind === "feature" ? (object.features.find((f) => f.id === d.featureId)?.related ?? []) : [];
    for (const id of related) {
      const f = object.features.find((x) => x.id === id);
      const s = { targetId: d.targetId, kind: "feature" as const, featureId: id, name: f?.name ?? id, reason: `Related to ${d.name}` };
      if (f && !have.has(discoveryKey(s)) && !out.some((o) => discoveryKey(o) === discoveryKey(s))) out.push(s);
    }
    // Moons of a saved planet.
    if (d.kind === "object") {
      for (const c of object.companions.slice(0, 2)) {
        const s = { targetId: d.targetId, kind: "companion" as const, featureId: c.id, name: c.name, reason: `A moon of ${object.name}` };
        if (!have.has(discoveryKey(s))) out.push(s);
      }
    }
  }
  return out.slice(0, 8);
}

export function DiscoveriesPage() {
  const state = useDiscoveries();
  const [history, clearHistory] = useExploreHistory();
  const saved = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const groups = useMemo(() => {
    const m = new Map<string, Discovery[]>();
    for (const d of saved) m.set(d.targetId, [...(m.get(d.targetId) ?? []), d]);
    return [...m];
  }, [saved]);
  const next = useMemo(() => suggestions(saved), [saved]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 px-4 py-6 pb-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Discoveries</h1>
        <p className="mt-1 text-sm text-muted">Objects and features you saved while observing, with your notes. Open one to see it again through your telescope.</p>
      </header>

      <section aria-label="Saved discoveries" className="space-y-5">
        {state.status === "loading" && <LoadingList rows={3} label="Loading discoveries" />}
        {state.status === "error" && <ErrorState message={state.error.message} />}
        {state.status === "signed-out" && (
          <EmptyState title="Sign in to keep your discoveries" icon={<Icons.Bookmark className="size-5" />} action={<Link href={signInHref()} className={buttonStyles({ variant: "primary" })}>Sign in</Link>}>
            Saved discoveries belong to your account, so you can find them on any device.
          </EmptyState>
        )}
        {state.status === "ready" && saved.length === 0 && (
          <EmptyState
            title="No discoveries yet"
            icon={<Icons.Bookmark className="size-5" />}
            action={
              <Link href="/lab/simulate?target=moon" className={buttonStyles({ variant: "primary" })}>
                Explore the Moon
              </Link>
            }
          >
            In the Telescope Lab, open the explorer on anything you can see (a crater, a moon, a nebula) and press Save.
          </EmptyState>
        )}
        {groups.map(([targetId, items]) => {
          const target = getTarget(targetId);
          return (
            <div key={targetId}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {target && <TargetGlyph target={target} size={20} />}
                {target?.name ?? targetId}
                <span className="font-normal text-muted">· {items.length}</span>
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {items.map((d) => (
                  <DiscoveryCard key={d.id} d={d} />
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {next.length > 0 && (
        <section aria-label="Explore next">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Icons.Sparkles className="size-4 text-accent" />
            Explore next
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {next.map((s) => (
              <li key={discoveryKey(s)}>
                <Link href={discoveryHref(s)} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-sunken/60 p-2 hover:border-accent/60">
                  <Thumb d={s} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{s.name}</span>
                    <span className="block truncate text-[11px] text-muted">{s.reason}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Recently explored">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recently explored</h2>
          {history.length > 0 && (
            <button type="button" onClick={clearHistory} className="text-xs text-muted hover:text-foreground">
              Clear history
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted">What you open in the explorer appears here (kept on this device only).</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {history.map((h) => (
              <li key={`${h.targetId}/${h.kind}/${h.featureId ?? ""}`}>
                <Link href={discoveryHref(h)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-sunken/60 px-2.5 py-1 text-sm hover:border-accent/60">
                  {h.name}
                  <span className="text-[11px] text-muted">{getTarget(h.targetId)?.name !== h.name ? `· ${getTarget(h.targetId)?.name ?? ""}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
