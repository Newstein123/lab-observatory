"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { summarizeConfiguration } from "@/modules/configurations/models";
import { getRepository, useRepositoryQuery } from "@/modules/persistence/client";
import type { SimulationMode } from "@/modules/simulations/engine";
import { TARGET_GROUPS, TARGETS } from "@/modules/targets/catalogue";
import { AddToProject } from "./add-to-project";
import { useMutation } from "./mutations";
import { PageHeader } from "./observatory-shell";
import { SessionThumbnail } from "./session-thumbnail";

export function SimulationsPage() {
  const q = useRepositoryQuery(async (r) => ({ sessions: await r.listSessions(), projects: await r.listProjects() }), []);
  const [target, setTarget] = useState<string>("all");
  const [mode, setMode] = useState<SimulationMode | "all">("all");
  const { run } = useMutation();

  const list = q.status === "ready" ? q.data.sessions.filter((s) => (target === "all" || s.targetSnapshot.id === target) && (mode === "all" || s.mode === mode)) : [];

  return (
    <div>
      <PageHeader
        title="Simulations"
        description="Saved observation sessions. Each keeps a frozen copy of its configuration, conditions and results, so later edits never change it."
        actions={
          <Link href="/lab/simulate" className={buttonStyles({ variant: "primary" })}>
            <Icons.Play className="size-4" /> New simulation
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Target
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface-sunken px-2 text-sm text-foreground"
          >
            <option value="all">All targets</option>
            {TARGET_GROUPS.map((g) => (
              <optgroup key={g.category} label={g.label}>
                {TARGETS.filter((t) => g.categories.includes(t.category)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.designation ? `${t.designation} · ${t.name}` : t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <Tabs<SimulationMode | "all">
          label="Mode"
          variant="segmented"
          value={mode}
          onChange={setMode}
          items={[
            { id: "all", label: "All" },
            { id: "eyepiece", label: "Eyepiece" },
            { id: "camera", label: "Camera" },
          ]}
        />
      </div>

      {q.status === "loading" && <LoadingList />}
      {q.status === "error" && <ErrorState message={q.error.message} />}
      {q.status === "ready" &&
        (list.length === 0 ? (
          <EmptyState
            title={q.data.sessions.length === 0 ? "No saved simulations" : "No simulations match"}
            icon={<Icons.Play />}
            action={
              q.data.sessions.length === 0 ? (
                <Link href="/lab/simulate" className={buttonStyles({ size: "sm", variant: "primary" })}>
                  Run a simulation
                </Link>
              ) : undefined
            }
          >
            {q.data.sessions.length === 0 ? "In the Telescope Lab, choose “Save simulation”." : "Try another target or mode."}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2">
            {list.map((s) => (
              <li key={s.id} className="glass flex gap-4 rounded-xl p-3">
                <Link href={`/observatory/simulations/${s.id}`} aria-label={`Open ${s.name}`}>
                  <SessionThumbnail session={s} size={96} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/observatory/simulations/${s.id}`} className="block truncate font-medium hover:text-accent">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {s.targetSnapshot.name} · {s.mode === "eyepiece" ? "Eyepiece view" : "Camera view"} · {formatDateTime(s.createdAt)}
                  </p>
                  <p className="truncate text-xs text-subtle">
                    {s.configurationSnapshot.name}: {summarizeConfiguration(s.configurationSnapshot)} · engine v{s.engineVersion}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link href={`/observatory/simulations/${s.id}`} className={buttonStyles({ size: "sm" })}>
                      Open
                    </Link>
                    <AddToProject sessionId={s.id} projects={q.data.projects} />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`Delete simulation “${s.name}”?`)) run(() => getRepository().deleteSession(s.id), "Simulation deleted.");
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
