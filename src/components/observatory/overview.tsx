"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, ErrorState, LoadingList, Skeleton } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDateTime } from "@/lib/format";
import { summarizeConfiguration } from "@/modules/configurations/models";
import { describeAccessory, labelOf, OPTICAL_DESIGNS, ACCESSORY_KINDS } from "@/modules/equipment/models";
import { useRepositoryQuery } from "@/modules/persistence/client";
import { PageHeader } from "./observatory-shell";
import { SessionThumbnail } from "./session-thumbnail";

export function ObservatoryOverview() {
  const q = useRepositoryQuery(
    async (r) => {
      const [profiles, accessories, configurations, sessions, projects] = await Promise.all([
        r.listProfiles(),
        r.listAccessories(),
        r.listConfigurations(),
        r.listSessions(),
        r.listProjects(),
      ]);
      return { profiles, accessories, configurations, sessions, projects };
    },
    [],
  );

  return (
    <div>
      <PageHeader
        title="My Observatory"
        description="Your equipment, configurations, saved simulations and observation projects."
        actions={
          <>
            <Link href="/observatory/projects" className={buttonStyles()}>
              <Icons.Folder className="size-4" /> Projects
            </Link>
            <Link href="/lab/new" className={buttonStyles({ variant: "primary" })}>
              <Icons.Plus className="size-4" /> New configuration
            </Link>
          </>
        }
      />
      {q.status === "error" && <ErrorState message={q.error.message} />}
      {q.status === "loading" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <LoadingList rows={3} />
        </div>
      )}
      {q.status === "ready" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Telescopes" value={q.data.profiles.length} href="/observatory/equipment" hint={`${q.data.accessories.length} accessories`} />
            <StatCard label="Configurations" value={q.data.configurations.length} href="/observatory/configurations" />
            <StatCard label="Simulations" value={q.data.sessions.length} href="/observatory/simulations" />
            <StatCard label="Projects" value={q.data.projects.length} href="/observatory/projects" />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <section className="glass rounded-xl p-5" aria-label="Recent simulations">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">Recent simulations</h2>
                <Link href="/observatory/simulations" className="text-sm text-accent hover:underline">
                  View all
                </Link>
              </div>
              {q.data.sessions.length === 0 ? (
                <EmptyState
                  title="No saved simulations yet"
                  icon={<Icons.Play />}
                  action={
                    <Link href="/lab/simulate" className={buttonStyles({ size: "sm", variant: "primary" })}>
                      Run a simulation
                    </Link>
                  }
                >
                  In the Telescope Lab, choose “Save simulation” to keep a view with its exact inputs.
                </EmptyState>
              ) : (
                <ul className="space-y-2">
                  {q.data.sessions.slice(0, 4).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-sunken/50 p-2.5">
                      <SessionThumbnail session={s} size={64} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/observatory/simulations/${s.id}`} className="block truncate text-sm font-medium hover:text-accent">
                          {s.name}
                        </Link>
                        <p className="truncate text-xs text-muted">{summarizeConfiguration(s.configurationSnapshot)}</p>
                        <p className="text-[11px] text-subtle">{formatDateTime(s.createdAt)}</p>
                      </div>
                      <Link href={`/observatory/simulations/${s.id}`} aria-label={`Open ${s.name}`} className="flex size-9 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-foreground">
                        <Icons.Play className="size-4" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-6">
              <section className="glass rounded-xl p-5" aria-label="Recent equipment">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">Recent equipment</h2>
                  <Link href="/observatory/equipment" className="text-sm text-accent hover:underline">
                    Manage
                  </Link>
                </div>
                {q.data.profiles.length + q.data.accessories.length === 0 ? (
                  <EmptyState
                    title="No equipment yet"
                    icon={<Icons.Telescope />}
                    action={
                      <Link href="/observatory/equipment" className={buttonStyles({ size: "sm" })}>
                        Add equipment
                      </Link>
                    }
                  />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {[
                      ...q.data.profiles.map((p) => ({ id: p.id, at: p.updatedAt, name: p.name, status: p.status, sub: `${labelOf(OPTICAL_DESIGNS, p.opticalDesign)} · ${p.apertureMm} mm f/${(p.focalLengthMm / p.apertureMm).toFixed(1)}` })),
                      ...q.data.accessories.map((a) => ({ id: a.id, at: a.updatedAt, name: a.name, status: a.status, sub: `${labelOf(ACCESSORY_KINDS, a.kind)} · ${describeAccessory(a)}` })),
                    ]
                      .sort((x, y) => y.at.localeCompare(x.at))
                      .slice(0, 5)
                      .map((e) => (
                        <li key={e.id} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{e.name}</p>
                            <p className="truncate text-xs text-muted">{e.sub}</p>
                          </div>
                          <StatusChip status={e.status} />
                        </li>
                      ))}
                  </ul>
                )}
              </section>

              <section className="glass rounded-xl p-5" aria-label="Quick actions">
                <h2 className="mb-3 font-semibold">Quick actions</h2>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { href: "/observatory/equipment", label: "Add equipment", icon: Icons.Telescope },
                    { href: "/lab/new", label: "Build a configuration", icon: Icons.Wrench },
                    { href: "/lab/compare", label: "Compare setups", icon: Icons.Compare },
                    { href: "/observatory/projects", label: "Plan a project", icon: Icons.Folder },
                  ].map((a) => (
                    <Link key={a.href} href={a.href} className="flex items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:border-accent">
                      <a.icon className="size-4 text-accent" />
                      {a.label}
                    </Link>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
