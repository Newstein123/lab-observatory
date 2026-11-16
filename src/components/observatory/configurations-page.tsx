"use client";

import Link from "next/link";
import { useState } from "react";
import { TubeSilhouette } from "@/components/lab/tube-silhouette";
import { Button, buttonStyles } from "@/components/ui/button";
import { inputClass } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import {
  CONFIGURATION_STATUSES,
  specOf,
  summarizeConfiguration,
  type ConfigurationStatus,
  type TelescopeConfiguration,
} from "@/modules/configurations/models";
import { describeAccessory, labelOf, OPTICAL_DESIGNS } from "@/modules/equipment/models";
import { getRepository, useRepositoryQuery } from "@/modules/persistence/client";
import { useMutation } from "./mutations";
import { PageHeader } from "./observatory-shell";

type StatusFilter = ConfigurationStatus | "all";

export function ConfigurationsPage() {
  const q = useRepositoryQuery(async (r) => ({ configs: await r.listConfigurations(), profiles: await r.listProfiles() }), []);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { run } = useMutation();

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));

  const list =
    q.status === "ready"
      ? q.data.configs.filter(
          (c) =>
            (status === "all" || c.status === status) &&
            (!search.trim() || `${c.name} ${summarizeConfiguration(c)}`.toLowerCase().includes(search.trim().toLowerCase())),
        )
      : [];

  return (
    <div>
      <PageHeader
        title="Configurations"
        description="Saved setups: a telescope with its eyepiece, camera and accessories. Based on your equipment or entirely hypothetical."
        actions={
          <Link href="/lab/new" className={buttonStyles({ variant: "primary" })}>
            <Icons.Plus className="size-4" /> New configuration
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <label htmlFor="config-search" className="sr-only">
            Search configurations
          </label>
          <Icons.Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" />
          <input id="config-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className={`${inputClass} pl-8`} />
        </div>
        <Tabs<StatusFilter>
          label="Status"
          variant="segmented"
          value={status}
          onChange={setStatus}
          items={[{ id: "all", label: "All" }, ...CONFIGURATION_STATUSES.map((s) => ({ id: s.value, label: s.label }))]}
        />
      </div>

      {selected.length > 0 && (
        <div className="glass sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm">
          <span className="flex-1">
            {selected.length === 1 ? "Select one more configuration to compare." : "Two configurations selected."}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
          {selected.length === 2 && (
            <Link href={`/lab/compare?a=saved:${selected[0]}&b=saved:${selected[1]}`} className={buttonStyles({ size: "sm", variant: "primary" })}>
              <Icons.Compare className="size-4" /> Compare
            </Link>
          )}
        </div>
      )}

      {q.status === "loading" && <LoadingList />}
      {q.status === "error" && <ErrorState message={q.error.message} />}
      {q.status === "ready" &&
        (list.length === 0 ? (
          <EmptyState
            title={q.data.configs.length === 0 ? "No saved configurations" : "Nothing matches"}
            icon={<Icons.Layers />}
            action={
              q.data.configs.length === 0 ? (
                <Link href="/lab/new" className={buttonStyles({ size: "sm", variant: "primary" })}>
                  Open the Telescope Lab
                </Link>
              ) : undefined
            }
          >
            {q.data.configs.length === 0 ? "Build one in the Telescope Lab and choose “Save configuration”." : "Try another search or status."}
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => (
              <ConfigurationRow
                key={c.id}
                config={c}
                profileName={q.data.profiles.find((p) => p.id === c.profileId)?.name}
                selected={selected.includes(c.id)}
                onToggle={() => toggle(c.id)}
                onStatus={(s) => run(() => getRepository().updateConfiguration(c.id, { ...specOf(c), status: s }), `Status set to ${s}.`)}
                onDuplicate={() => run(() => getRepository().duplicateConfiguration(c.id), "Configuration duplicated.")}
                onDelete={() => {
                  if (confirm(`Delete “${c.name}”? Saved simulations keep their own copy.`)) run(() => getRepository().deleteConfiguration(c.id), "Configuration deleted.");
                }}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function ConfigurationRow({
  config: c,
  profileName,
  selected,
  onToggle,
  onStatus,
  onDuplicate,
  onDelete,
}: {
  config: TelescopeConfiguration;
  profileName?: string;
  selected: boolean;
  onToggle: () => void;
  onStatus: (s: ConfigurationStatus) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const components: [string, string][] = [
    ["Telescope", `${c.telescope.label ? `${c.telescope.label} · ` : ""}${labelOf(OPTICAL_DESIGNS, c.telescope.opticalDesign)} ${c.telescope.apertureMm} mm, ${c.telescope.focalLengthMm} mm`],
    ...(c.mount ? [["Mount", c.mount.label ?? describeAccessory({ kind: "mount", spec: c.mount })] as [string, string]] : []),
    ...(c.eyepiece ? [["Eyepiece", `${c.eyepiece.label ? `${c.eyepiece.label} · ` : ""}${describeAccessory({ kind: "eyepiece", spec: c.eyepiece })}`] as [string, string]] : []),
    ...(c.camera ? [["Camera", `${c.camera.label ? `${c.camera.label} · ` : ""}${describeAccessory({ kind: "camera", spec: c.camera })}`] as [string, string]] : []),
    ...(c.barlow ? [["Barlow", describeAccessory({ kind: "barlow", spec: c.barlow })] as [string, string]] : []),
    ...(c.filter ? [["Filter", c.filter.name] as [string, string]] : []),
  ];
  return (
    <li className={`glass rounded-xl p-4 transition-colors ${selected ? "border-accent" : ""}`}>
      <div className="flex flex-wrap items-start gap-4">
        <label className="mt-1 flex items-center">
          <input type="checkbox" checked={selected} onChange={onToggle} className="size-4 accent-accent" aria-label={`Select ${c.name} to compare`} />
        </label>
        <TubeSilhouette optics={c.telescope} className="hidden h-16 w-24 shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{c.name}</h3>
            <StatusChip status={c.status} />
            <span className="text-xs text-muted">
              v{c.version} · updated {formatDateTime(c.updatedAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{summarizeConfiguration(c)}</p>
          <p className="text-xs text-subtle">{profileName ? `Equipment: ${profileName}` : "Hypothetical telescope"}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-accent">Details</summary>
            <dl className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {components.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            {c.notes && <p className="mt-2 text-xs text-muted">{c.notes}</p>}
          </details>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-[8.5rem]">
        <Link href={`/lab/simulate?config=${c.id}`} className={buttonStyles({ size: "sm", variant: "primary" })}>
          Open in Lab
        </Link>
        <Link href={`/lab/configure?config=${c.id}`} className={buttonStyles({ size: "sm" })}>
          Edit equipment
        </Link>
        <Button size="sm" onClick={onDuplicate}>
          Duplicate
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Status
          <select
            value={c.status}
            onChange={(e) => onStatus(e.target.value as ConfigurationStatus)}
            className="h-8 rounded-lg border border-border bg-surface-sunken px-2 text-xs text-foreground"
          >
            {CONFIGURATION_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}
