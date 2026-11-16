"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SpecList } from "@/components/lab/choose-telescope";
import { TubeSilhouette } from "@/components/lab/tube-silhouette";
import { EquipmentViewer, type StageItem } from "@/components/equipment-3d";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Icons } from "@/components/ui/icons";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import {
  ACCESSORY_KINDS,
  describeAccessory,
  labelOf,
  MOUNT_TYPES,
  OPTICAL_DESIGNS,
  type Accessory,
  type AccessoryKind,
  type EquipmentStatus,
  type TelescopeProfile,
} from "@/modules/equipment/models";
import { startDraft } from "@/modules/lab/draft";
import { specFromProfile } from "@/modules/lab/start";
import { getRepository, useRepositoryQuery } from "@/modules/persistence/client";
import { AccessoryForm, TelescopeForm } from "./equipment-forms";
import { useMutation } from "./mutations";
import { PageHeader } from "./observatory-shell";

type Tab = "telescopes" | "accessories";
type StatusFilter = EquipmentStatus | "all";

const ICONS: Record<AccessoryKind, (p: { className?: string }) => React.ReactNode> = {
  eyepiece: Icons.Eyepiece,
  camera: Icons.Camera,
  barlow: Icons.Barlow,
  filter: Icons.Filter,
  mount: Icons.Mount,
};

type Editing =
  | { type: "telescope"; item?: TelescopeProfile }
  | { type: "accessory"; item?: Accessory }
  | null;

type Viewing = { title: string; item: StageItem; rows: [string, string][] } | null;

export function EquipmentPage({ initialTab = "telescopes" }: { initialTab?: Tab }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<AccessoryKind | "all">("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [viewing, setViewing] = useState<Viewing>(null);
  const { run } = useMutation();
  const q = useRepositoryQuery(async (r) => ({ profiles: await r.listProfiles(), accessories: await r.listAccessories() }), []);

  const byStatus = <T extends { status: EquipmentStatus }>(xs: T[]) => (status === "all" ? xs : xs.filter((x) => x.status === status));

  return (
    <div>
      <PageHeader
        title="My Equipment"
        description="Telescopes and accessories you own, are trying out, or plan to buy."
        actions={
          <>
            <Button onClick={() => setEditing({ type: "accessory" })}>
              <Icons.Plus className="size-4" /> Add accessory
            </Button>
            <Button variant="primary" onClick={() => setEditing({ type: "telescope" })}>
              <Icons.Plus className="size-4" /> Add telescope
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs<Tab>
          label="Equipment type"
          value={tab}
          onChange={(t) => {
            setTab(t);
            window.history.replaceState(null, "", `?tab=${t}`);
          }}
          items={[
            { id: "telescopes", label: "Telescopes", count: q.data?.profiles.length },
            { id: "accessories", label: "Accessories", count: q.data?.accessories.length },
          ]}
        />
        <Tabs<StatusFilter>
          label="Status"
          variant="segmented"
          value={status}
          onChange={setStatus}
          items={[
            { id: "all", label: "All" },
            { id: "owned", label: "Owned" },
            { id: "experimental", label: "Experimental" },
            { id: "planned", label: "Planned" },
          ]}
        />
      </div>

      {q.status === "loading" && <LoadingList />}
      {q.status === "error" && <ErrorState message={q.error.message} />}

      {q.status === "ready" && tab === "telescopes" && (
        byStatus(q.data.profiles).length === 0 ? (
          <EmptyState
            title={q.data.profiles.length === 0 ? "No telescopes yet" : "No telescopes with this status"}
            icon={<Icons.Telescope />}
            action={<Button variant="primary" size="sm" onClick={() => setEditing({ type: "telescope" })}>Add telescope</Button>}
          >
            Add the telescopes you own or plan to buy, then build configurations from them.
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {byStatus(q.data.profiles).map((p) => (
              <li key={p.id} className="glass flex flex-col rounded-xl p-4">
                <button
                  type="button"
                  className="rounded-lg text-left"
                  onClick={() =>
                    setViewing({
                      title: p.name,
                      item: { kind: "telescope", optics: p },
                      rows: [
                        ["Optical design", labelOf(OPTICAL_DESIGNS, p.opticalDesign)],
                        ["Aperture", `${p.apertureMm} mm`],
                        ["Focal length", `${p.focalLengthMm} mm`],
                        ["Focal ratio", `f/${(p.focalLengthMm / p.apertureMm).toFixed(1)}`],
                        ["Mount", labelOf(MOUNT_TYPES, p.mountType)],
                        ...(p.manufacturer || p.model ? [["Model", [p.manufacturer, p.model].filter(Boolean).join(" ")] as [string, string]] : []),
                      ],
                    })
                  }
                  aria-label={`View ${p.name} in 3D`}
                >
                  <TubeSilhouette optics={p} className="h-24 w-full" />
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <h3 className="truncate font-medium">{p.name}</h3>
                  <StatusChip status={p.status} />
                </div>
                {(p.manufacturer || p.model) && <p className="text-xs text-muted">{[p.manufacturer, p.model].filter(Boolean).join(" ")}</p>}
                <p className="mt-1 font-mono text-xs text-muted">
                  {labelOf(OPTICAL_DESIGNS, p.opticalDesign)} · {p.apertureMm} mm · {p.focalLengthMm} mm · f/{(p.focalLengthMm / p.apertureMm).toFixed(1)}
                </p>
                <p className="text-xs text-subtle">{labelOf(MOUNT_TYPES, p.mountType)} mount</p>
                {p.notes && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.notes}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      startDraft(specFromProfile(p));
                      router.push("/lab/configure");
                    }}
                  >
                    New configuration
                  </Button>
                  <Button size="sm" onClick={() => setEditing({ type: "telescope", item: p })}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete “${p.name}”? Configurations using it keep their optics but become hypothetical.`))
                        run(() => getRepository().deleteProfile(p.id), "Telescope deleted.");
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {q.status === "ready" && tab === "accessories" && (
        <div className="space-y-4">
          <div role="group" aria-label="Accessory type" className="flex flex-wrap gap-1.5">
            {[{ value: "all" as const, label: "All", plural: "All" }, ...ACCESSORY_KINDS].map((k) => (
              <button
                key={k.value}
                type="button"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`rounded-full border px-3 py-1 text-sm ${kind === k.value ? "border-accent bg-accent/15" : "border-border text-muted hover:text-foreground"}`}
              >
                {k.plural}
              </button>
            ))}
          </div>
          {(() => {
            const list = byStatus(q.data.accessories).filter((a) => kind === "all" || a.kind === kind);
            if (list.length === 0)
              return (
                <EmptyState
                  title="No accessories here yet"
                  icon={<Icons.Eyepiece />}
                  action={<Button size="sm" variant="primary" onClick={() => setEditing({ type: "accessory" })}>Add accessory</Button>}
                >
                  Eyepieces, cameras, Barlow lenses, filters and mounts you add here appear in the Lab&apos;s equipment configurator.
                </EmptyState>
              );
            return (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {list.map((a) => {
                  const Icon = ICONS[a.kind];
                  return (
                    <li key={a.id} className="glass flex gap-3 rounded-xl p-4">
                      <button
                        type="button"
                        aria-label={`View ${a.name} in 3D`}
                        onClick={() =>
                          setViewing({
                            title: a.name,
                            item: (a.kind === "mount" ? { kind: "mount", spec: a.spec } : { kind: a.kind, spec: a.spec }) as StageItem,
                            rows: [
                              ["Type", labelOf(ACCESSORY_KINDS, a.kind)],
                              ["Specification", describeAccessory(a)],
                              ...(a.manufacturer || a.model ? [["Model", [a.manufacturer, a.model].filter(Boolean).join(" ")] as [string, string]] : []),
                            ],
                          })
                        }
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent hover:bg-accent/20"
                      >
                        <Icon className="size-6" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{a.name}</h3>
                          <StatusChip status={a.status} />
                        </div>
                        <p className="text-xs text-muted">
                          {labelOf(ACCESSORY_KINDS, a.kind)}
                          {(a.manufacturer || a.model) && ` · ${[a.manufacturer, a.model].filter(Boolean).join(" ")}`}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted">{describeAccessory(a)}</p>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" onClick={() => setEditing({ type: "accessory", item: a })}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              if (confirm(`Delete “${a.name}”?`)) run(() => getRepository().deleteAccessory(a.id), "Accessory deleted.");
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </div>
      )}

      <Dialog
        open={editing?.type === "telescope"}
        onClose={() => setEditing(null)}
        title={editing?.type === "telescope" && editing.item ? "Edit telescope" : "Add telescope"}
        wide
      >
        {editing?.type === "telescope" && (
          <TelescopeForm
            initial={editing.item}
            submitLabel={editing.item ? "Save changes" : "Add telescope"}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const repo = getRepository();
              if (editing.item) await repo.updateProfile(editing.item.id, input);
              else await repo.createProfile(input);
              setEditing(null);
              setTab("telescopes");
            }}
          />
        )}
      </Dialog>
      <Dialog
        open={editing?.type === "accessory"}
        onClose={() => setEditing(null)}
        title={editing?.type === "accessory" && editing.item ? "Edit accessory" : "Add accessory"}
        wide
      >
        {editing?.type === "accessory" && (
          <AccessoryForm
            initial={editing.item}
            defaultKind={kind === "all" ? "eyepiece" : kind}
            submitLabel={editing.item ? "Save changes" : "Add accessory"}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const repo = getRepository();
              if (editing.item) await repo.updateAccessory(editing.item.id, input);
              else await repo.createAccessory(input);
              setEditing(null);
              setTab("accessories");
            }}
          />
        )}
      </Dialog>
      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.title ?? ""} wide>
        {viewing && (
          <div className="space-y-4">
            <EquipmentViewer item={viewing.item} label={`3D model of ${viewing.title}`} className="h-72 rounded-xl bg-surface-sunken/60" />
            <SpecList rows={viewing.rows.map(([l, v]) => [l, v, l === "Focal ratio" ? ("calculated" as const) : undefined] as const)} />
            <p className="text-xs text-subtle">Values as you entered them. The 3D model is built from these dimensions and is illustrative.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
