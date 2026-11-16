"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignInPrompt } from "@/components/auth/account-menu";
import { EquipmentViewer } from "@/components/equipment-3d";
import { buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDateTime } from "@/lib/format";
import { summarizeConfiguration } from "@/modules/configurations/models";
import { CAMERA_CATALOG, EYEPIECE_CATALOG, FEATURED, displayName, getTelescopeEntry } from "@/modules/equipment/catalog";
import { describeAccessory } from "@/modules/equipment/models";
import { isDraftDirty, startDraft, useLabDraft } from "@/modules/lab/draft";
import { defaultMount, specFromCatalog } from "@/modules/lab/start";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import { TubeSilhouette } from "./tube-silhouette";

const HERO = getTelescopeEntry("skywatcher-explorer-200p")!;

const ENTRY_POINTS = [
  {
    href: "/lab/new?tab=catalog",
    icon: Icons.Telescope,
    title: "Choose a telescope",
    body: "Start from a real model: Celestron, Sky-Watcher, Orion and more.",
  },
  {
    href: "/lab/new?tab=custom",
    icon: Icons.Wrench,
    title: "Create custom",
    body: "Build from your own optical specifications.",
  },
  {
    href: "/lab/new?tab=mine",
    icon: Icons.Home,
    title: "Load from My Observatory",
    body: "Start from a telescope you own or plan to buy.",
  },
];

export function LabHome() {
  const router = useRouter();
  const { draft } = useLabDraft();
  const recent = useOwnerQuery((r) => r.listConfigurations(), []);

  return (
    <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6">
      {/* Hero */}
      <section className="glass relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl lg:grid-cols-[1fr_1.05fr]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(81,98,255,0.22),transparent_55%)]"
        />
        <div className="relative flex flex-col justify-center p-6 sm:p-10">
          <p className="eyebrow">Telescope Lab</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Telescope Lab</h1>
          <p className="mt-2 text-lg text-muted">Configure. Experiment. Simulate.</p>
          <p className="mt-4 max-w-lg text-sm text-muted">
            Build and test telescope setups with real equipment, scientific calculations and a realistic observation
            simulation. Every number shows how it was worked out.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/lab/new" className={buttonStyles({ variant: "primary", size: "lg" })}>
              <Icons.Plus className="size-4" /> New configuration
            </Link>
            <Link href="/observatory/configurations" className={buttonStyles({ size: "lg" })}>
              My configurations
            </Link>
          </div>
        </div>
        <EquipmentViewer
          item={{ kind: "telescope", optics: HERO.optics, mount: defaultMount(HERO.mountType, HERO.otaWeightKg) }}
          controls={false}
          label={`3D model of a ${displayName(HERO)} on an equatorial mount`}
          className="relative h-[300px] sm:h-[380px] lg:h-[440px]"
        />
      </section>

      {/* Entry points */}
      <section aria-label="Start a configuration" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
        {ENTRY_POINTS.map((e) => (
          <Link key={e.href} href={e.href} className="glass group flex gap-4 rounded-xl p-5 transition-colors hover:border-border-strong">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <e.icon className="size-6" />
            </span>
            <span>
              <span className="flex items-center gap-2 font-medium">
                {e.title}
                <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
              <span className="mt-1 block text-sm text-muted">{e.body}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* Continue */}
      {draft && (
        <section className="glass flex flex-wrap items-center gap-4 rounded-xl p-5">
          <TubeSilhouette optics={draft.spec.telescope} className="h-16 w-24 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Continue where you left off</p>
            <p className="mt-1 flex items-center gap-2 font-medium">
              <span className="truncate">{draft.spec.name}</span>
              <StatusChip status={draft.spec.status} />
              {isDraftDirty(draft) && <span className="text-xs text-warning">Unsaved</span>}
            </p>
            <p className="truncate text-sm text-muted">{summarizeConfiguration(draft.spec)}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/lab/configure" className={buttonStyles()}>
              Configure
            </Link>
            <Link href="/lab/simulate" className={buttonStyles({ variant: "primary" })}>
              Simulate
            </Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        {/* Recent configurations */}
        <section className="glass rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent configurations</h2>
            <Link href="/observatory/configurations" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          {recent.status === "loading" && <LoadingList rows={3} />}
          {recent.status === "signed-out" && <SignInPrompt>Sign in to see the configurations you have saved.</SignInPrompt>}
          {recent.status === "error" && <ErrorState message={recent.error.message} />}
          {recent.status === "ready" &&
            (recent.data.length === 0 ? (
              <EmptyState title="No saved configurations yet" icon={<Icons.Layers />}>
                Configurations you save from the Lab appear here.
              </EmptyState>
            ) : (
              <ul className="space-y-2">
                {recent.data.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-3">
                    <TubeSilhouette optics={c.telescope} className="h-12 w-16 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{c.name}</span>
                        <StatusChip status={c.status} />
                      </p>
                      <p className="truncate text-xs text-muted">{summarizeConfiguration(c)}</p>
                      <p className="text-[11px] text-subtle">Updated {formatDateTime(c.updatedAt)}</p>
                    </div>
                    <Link href={`/lab/simulate?config=${c.id}`} className={buttonStyles({ size: "sm" })}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        {/* Featured equipment */}
        <section className="glass rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Featured equipment</h2>
            <Link href="/lab/new?tab=catalog" className="text-sm text-accent hover:underline">
              Browse catalogue
            </Link>
          </div>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-3">
            {FEATURED.telescopes.map((id) => {
              const t = getTelescopeEntry(id)!;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      startDraft(specFromCatalog(t));
                      router.push("/lab/configure");
                    }}
                    className="w-full rounded-lg border border-border bg-surface-sunken/50 p-3 text-left transition-colors hover:border-accent"
                  >
                    <TubeSilhouette optics={t.optics} className="h-20 w-full" />
                    <p className="mt-2 text-xs text-muted">{t.manufacturer}</p>
                    <p className="text-sm font-medium">{t.model}</p>
                    <p className="font-mono text-xs text-muted">
                      {t.optics.apertureMm} mm · f/{(t.optics.focalLengthMm / t.optics.apertureMm).toFixed(1)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
            {[
              { kind: "eyepiece" as const, e: EYEPIECE_CATALOG.find((x) => x.id === FEATURED.eyepieceId)! },
              { kind: "camera" as const, e: CAMERA_CATALOG.find((x) => x.id === FEATURED.cameraId)! },
            ].map(({ kind, e }) => (
              <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  {kind === "eyepiece" ? <Icons.Eyepiece /> : <Icons.Camera />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName(e)}</p>
                  <p className="font-mono text-xs text-muted">
                    {describeAccessory(kind === "eyepiece" ? { kind, spec: e.spec as never } : { kind, spec: e.spec as never })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-subtle">
            Specifications as published by manufacturers; awaiting verification. Not an endorsement.
          </p>
        </section>
      </div>
    </main>
  );
}
