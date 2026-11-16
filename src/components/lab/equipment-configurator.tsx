"use client";

import Link from "next/link";
import { useState } from "react";
import { EquipmentViewer, rigItem, type StageItem } from "@/components/equipment-3d";
import { Button, buttonStyles } from "@/components/ui/button";
import { inputClass, NumberField, SelectField } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { canonicalJson } from "@/lib/canonical-json";
import { friendlyMessage } from "@/lib/validation-messages";
import { CONFIGURATION_STATUSES, type ConfigurationSpec, type ConfigurationStatus } from "@/modules/configurations/models";
import { CATALOGS, displayName, getTelescopeEntry, type AccessoryCatalogEntry } from "@/modules/equipment/catalog";
import { checkCompatibility } from "@/modules/equipment/compatibility";
import {
  describeAccessory,
  labelOf,
  MOUNT_TYPES,
  OPTICAL_DESIGNS,
  type AccessoryKind,
  type AccessorySpecPair,
  type MountSpec,
} from "@/modules/equipment/models";
import { updateDraftSpec, type LabDraft } from "@/modules/lab/draft";
import { useWorkingDraft } from "@/modules/lab/use-lab-draft";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import {
  telescopeOpticsSchema,
  type OpticalDesign,
  type Provenance,
} from "@/modules/simulations/engine";
import { AccessorySpecFields, FILTER_KIND_LABELS } from "@/components/equipment/accessory-spec-fields";
import { LabToolbar } from "./lab-toolbar";
import { ArButton } from "@/components/ar/ar-button";
import { ExpandButton, TelescopeWorkbench } from "./telescope-workbench";

export type Category = "telescope" | AccessoryKind;

const CATEGORIES: { id: Category; label: string; icon: (p: { className?: string }) => React.ReactNode }[] = [
  { id: "telescope", label: "Telescope", icon: Icons.Telescope },
  { id: "mount", label: "Mount", icon: Icons.Mount },
  { id: "eyepiece", label: "Eyepiece", icon: Icons.Eyepiece },
  { id: "camera", label: "Camera", icon: Icons.Camera },
  { id: "barlow", label: "Barlow", icon: Icons.Barlow },
  { id: "filter", label: "Filter", icon: Icons.Filter },
];

type AccessorySpec = AccessorySpecPair["spec"];

function current(spec: ConfigurationSpec, kind: AccessoryKind): AccessorySpec | undefined {
  return spec[kind];
}

/**
 * The whole setup stays on the stage; choosing a category moves the camera
 * to that part, and swapping a part animates it out and the new one in.
 */
function stageItem(spec: ConfigurationSpec, cat: Category): StageItem | undefined {
  if (!telescopeOpticsSchema.safeParse(spec.telescope).success) return undefined;
  const focusPart = cat === "telescope" || cat === "mount" ? undefined : spec[cat] ? cat : "focuser";
  return rigItem(spec, { mode: cat === "camera" ? "imaging" : "visual" }, { focusPart });
}

/** Catalogue entry whose specification is exactly this one, if any. */
function matchCatalog(kind: AccessoryKind, spec: AccessorySpec | undefined): AccessoryCatalogEntry<AccessorySpec> | undefined {
  if (!spec) return undefined;
  const key = canonicalJson(spec);
  return (CATALOGS[kind] as AccessoryCatalogEntry<AccessorySpec>[]).find((e) => canonicalJson(e.spec) === key);
}

function itemTitle(kind: AccessoryKind, spec: AccessorySpec): string {
  const label = (spec as { label?: string }).label;
  if (label) return label;
  if (kind === "filter") return (spec as { name: string }).name;
  return `Custom ${labelOf(
    [
      { value: "eyepiece", label: "eyepiece" },
      { value: "camera", label: "camera" },
      { value: "barlow", label: "Barlow" },
      { value: "mount", label: "mount" },
    ],
    kind as never,
  )}`;
}

export function EquipmentConfigurator({ configId, initialCategory = "eyepiece" }: { configId?: string; initialCategory?: Category }) {
  const { draft, status } = useWorkingDraft(configId);
  const [category, setCategoryState] = useState<Category>(initialCategory);
  const setCategory = (c: Category) => {
    setCategoryState(c);
    const params = new URLSearchParams(window.location.search);
    params.set("category", c);
    window.history.replaceState(null, "", `?${params}`);
  };

  if (!draft) {
    return (
      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-6" aria-busy>
        <Skeleton className="h-16" />
        <Skeleton className="h-[480px]" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-6">
      {status === "missing-config" && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          That configuration no longer exists. You are editing your current working setup.
        </p>
      )}
      <LabToolbar
        draft={draft}
        valid={telescopeOpticsSchema.safeParse(draft.spec.telescope).success}
        actions={
          <Link href="/lab/simulate" className={buttonStyles({ variant: "primary", size: "sm" })}>
            Simulate →
          </Link>
        }
      />
      <Workbench draft={draft} category={category} onCategory={setCategory} />
    </main>
  );
}

function Workbench({ draft, category, onCategory }: { draft: LabDraft; category: Category; onCategory: (c: Category) => void }) {
  const spec = draft.spec;
  const set = (patch: Partial<ConfigurationSpec>) => updateDraftSpec((s) => ({ ...s, ...patch }));
  const item = stageItem(spec, category);
  const notes = checkCompatibility(spec);
  const catLabel = CATEGORIES.find((c) => c.id === category)!.label;
  const [workbench, setWorkbench] = useState(false);
  const missing = category !== "telescope" && !(category === "mount" ? spec.mount : spec[category]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_340px]">
      {/* Category rail */}
      <aside className="space-y-3">
        <div className="glass space-y-3 rounded-xl p-3">
          <div className="space-y-1">
            <label htmlFor="config-name" className="block text-xs text-muted">
              Configuration name
            </label>
            <input
              id="config-name"
              value={spec.name}
              maxLength={100}
              onChange={(e) => set({ name: e.target.value })}
              className={inputClass}
            />
          </div>
          <SelectField<ConfigurationStatus>
            label="Status"
            value={spec.status}
            options={CONFIGURATION_STATUSES}
            onChange={(status) => set({ status })}
          />
        </div>
        <nav aria-label="Equipment categories" className="glass flex gap-1 overflow-x-auto rounded-xl p-1.5 lg:flex-col">
          {CATEGORIES.map((c) => {
            const active = c.id === category;
            const filled = c.id === "telescope" || Boolean(spec[c.id as AccessoryKind]);
            return (
              <button
                key={c.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onCategory(c.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-accent-strong/90 text-accent-foreground shadow-glow" : "text-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                <c.icon className="size-4" />
                <span className="flex-1 text-left">{c.label}</span>
                {filled && <span aria-label="selected" className={`size-1.5 rounded-full ${active ? "bg-white" : "bg-success"}`} />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Stage + carousel */}
      <section className="min-w-0 space-y-3" aria-label={`${catLabel} preview`}>
        <div className="glass relative overflow-hidden rounded-xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_70%,rgba(81,98,255,0.16),transparent_60%)]"
          />
          {item ? (
            <>
              <EquipmentViewer
                item={item}
                label={`3D model of the setup, showing the ${catLabel.toLowerCase()}`}
                className="relative h-[340px] sm:h-[440px]"
              />
              <div className="absolute top-3 right-3 flex gap-1.5">
                <ArButton spec={spec} mode={category === "camera" ? "imaging" : "visual"} />
                <ExpandButton onClick={() => setWorkbench(true)} />
              </div>
              {missing && (
                <p className="absolute top-3 left-3 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-muted">
                  No {catLabel.toLowerCase()} fitted. Choose one below{category === "barlow" || category === "filter" ? ", or leave it out" : ""}.
                </p>
              )}
              <TelescopeWorkbench
                open={workbench}
                onClose={() => setWorkbench(false)}
                config={spec}
                onConfigChange={(c) => updateDraftSpec(() => c)}
                mode={category === "camera" ? "imaging" : "visual"}
                onModeChange={(m) => onCategory(m === "imaging" ? "camera" : "eyepiece")}
              />
            </>
          ) : (
            <div className="relative flex h-[340px] items-center justify-center p-6 sm:h-[440px]">
              <EmptyState title="Enter the telescope's optics">A valid aperture and focal length are needed to build the model.</EmptyState>
            </div>
          )}
        </div>
        <Carousel category={category} spec={spec} />
      </section>

      {/* Details */}
      <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
        <DetailsPanel category={category} spec={spec} />
        <section className="glass rounded-xl p-4" aria-label="Compatibility">
          <h2 className="mb-3 text-sm font-semibold">Compatibility</h2>
          {notes.length === 0 ? (
            <p className="text-sm text-muted">No issues found with this combination.</p>
          ) : (
            <ul className="space-y-2.5">
              {notes.map((n) => (
                <li key={n.id} className="flex gap-2 text-sm">
                  <span aria-hidden className={n.level === "warning" ? "text-warning" : n.level === "ok" ? "text-success" : "text-accent"}>
                    {n.level === "warning" ? "▲" : n.level === "ok" ? "✓" : "●"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      {n.title} <ProvenanceBadge kind={n.kind} />
                    </p>
                    <p className="text-xs text-muted">{n.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Carousel({ category, spec }: { category: Category; spec: ConfigurationSpec }) {
  const owned = useOwnerQuery((r) => r.listAccessories(), []);
  if (category === "telescope") {
    return (
      <div className="glass flex flex-wrap items-center gap-3 rounded-xl p-4 text-sm">
        <p className="flex-1 text-muted">
          {spec.profileId ? "Linked to a telescope in My Observatory." : "Swap the telescope, or edit its optics in the details panel."}
        </p>
        <Link href="/lab/new" className={buttonStyles({ size: "sm" })}>
          Change telescope
        </Link>
      </div>
    );
  }
  const kind = category;
  const entries = CATALOGS[kind] as AccessoryCatalogEntry<AccessorySpec>[];
  const selectedKey = spec[kind] ? canonicalJson(spec[kind]) : undefined;
  const mine = owned.status === "ready" ? owned.data.filter((a) => a.kind === kind) : [];
  const choose = (s: AccessorySpec | undefined) => updateDraftSpec((x) => ({ ...x, [kind]: s ? structuredClone(s) : undefined }));

  return (
    <div className="glass rounded-xl p-3">
      <ul className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label={`${kind} choices`}>
        {mine.map((a) => (
          <CarouselItem
            key={a.id}
            kind={kind}
            title={a.name}
            subtitle={describeAccessory(a)}
            badge="Mine"
            selected={canonicalJson(a.spec) === selectedKey}
            onClick={() => choose(a.spec)}
            spec={a.spec}
          />
        ))}
        {entries.map((e) => (
          <CarouselItem
            key={e.id}
            kind={kind}
            title={displayName(e)}
            subtitle={describeAccessory({ kind, spec: e.spec } as AccessorySpecPair)}
            selected={canonicalJson(e.spec) === selectedKey}
            onClick={() => choose(e.spec)}
            spec={e.spec}
          />
        ))}
        {(kind === "barlow" || kind === "filter" || kind === "camera") && (
          <li className="snap-start">
            <button
              type="button"
              aria-pressed={!spec[kind]}
              onClick={() => choose(undefined)}
              className={`flex h-full w-32 flex-col items-center justify-center rounded-lg border p-3 text-center text-xs transition-colors ${
                !spec[kind] ? "border-accent bg-accent/10" : "border-border text-muted hover:border-border-strong"
              }`}
            >
              None
            </button>
          </li>
        )}
      </ul>
      {owned.status === "ready" && mine.length === 0 && (
        <p className="mt-2 text-xs text-subtle">
          Add your own {kind === "barlow" ? "Barlow lenses" : `${kind}s`} in{" "}
          <Link href="/observatory/equipment" className="text-accent hover:underline">
            My Equipment
          </Link>{" "}
          to see them here.
        </p>
      )}
    </div>
  );
}

function CarouselItem({
  kind,
  title,
  subtitle,
  selected,
  onClick,
  badge,
  spec,
}: {
  kind: AccessoryKind;
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
  badge?: string;
  spec: AccessorySpec;
}) {
  const headline =
    kind === "eyepiece"
      ? `${(spec as { focalLengthMm: number }).focalLengthMm} mm`
      : kind === "barlow"
        ? `${(spec as { factor: number }).factor}×`
        : kind === "camera"
          ? `${(spec as { pixelSizeUm: number }).pixelSizeUm} µm`
          : kind === "mount"
            ? (spec as MountSpec).payloadKg
              ? `${(spec as MountSpec).payloadKg} kg`
              : labelOf(MOUNT_TYPES, (spec as MountSpec).type)
            : (spec as { name: string }).name;
  return (
    <li className="snap-start">
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        title={title}
        className={`flex h-full w-36 flex-col rounded-lg border p-3 text-left transition-[border-color,box-shadow] ${
          selected ? "border-accent bg-accent/10 shadow-glow" : "border-border hover:border-border-strong"
        }`}
      >
        <span className="flex items-center justify-between">
          <span className="font-mono text-base">{headline}</span>
          {badge && <span className="rounded-full bg-success/15 px-1.5 text-[10px] text-success">{badge}</span>}
        </span>
        <span className="mt-1 line-clamp-2 text-xs">{title}</span>
        <span className="mt-auto pt-1 font-mono text-[10px] text-muted">{subtitle}</span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------

function DetailsPanel({ category, spec }: { category: Category; spec: ConfigurationSpec }) {
  const [editing, setEditing] = useState(false);
  if (category === "telescope") return <TelescopeDetails spec={spec} />;
  const kind = category;
  const value = current(spec, kind);
  const entry = matchCatalog(kind, value);
  const prov: Provenance | undefined = entry ? "retrieved" : undefined;

  return (
    <section className="glass rounded-xl p-4" aria-label={`${kind} details`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow">{CATEGORIES.find((c) => c.id === kind)!.label} details</p>
          <h2 className="mt-1 font-semibold">{value ? (entry ? displayName(entry) : itemTitle(kind, value)) : "None selected"}</h2>
          {entry?.summary && <p className="mt-1 text-xs text-muted">{entry.summary}</p>}
        </div>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            {editing ? "Done" : "Edit values"}
          </Button>
        )}
      </div>
      {!value ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pick one from the list, or enter your own values.</p>
          <Button size="sm" onClick={() => (updateDraftSpec((s) => ({ ...s, [kind]: blank(kind) })), setEditing(true))}>
            Enter custom values
          </Button>
        </div>
      ) : editing ? (
        <AccessoryForm kind={kind} spec={value} />
      ) : (
        <dl className="divide-y divide-border rounded-lg border border-border">
          {specRows(kind, value).map(([label, v, calc]) => (
            <div key={label} className="flex items-center gap-2 px-3 py-2 text-sm">
              <dt className="flex-1 text-muted">{label}</dt>
              <dd className="font-mono tabular-nums">{v}</dd>
              {calc ? <ProvenanceBadge kind="calculated" /> : prov ? <ProvenanceBadge kind={prov} /> : <span className="text-[10px] uppercase tracking-wide text-subtle">Input</span>}
            </div>
          ))}
        </dl>
      )}
      {value && kind !== "eyepiece" && (
        <Button size="sm" variant="danger" className="mt-3" onClick={() => updateDraftSpec((s) => ({ ...s, [kind]: undefined }))}>
          Remove {kind === "barlow" ? "Barlow" : kind}
        </Button>
      )}
    </section>
  );
}

function blank(kind: AccessoryKind): AccessorySpec {
  switch (kind) {
    case "eyepiece":
      return { focalLengthMm: 20, apparentFovDeg: 60, barrelIn: 1.25 };
    case "camera":
      return { sensorWidthMm: 11.3, sensorHeightMm: 7.1, pixelSizeUm: 2.9, color: true };
    case "barlow":
      return { factor: 2, barrelIn: 1.25 };
    case "filter":
      return { name: "Custom filter", kind: "other" };
    case "mount":
      return { type: "alt_azimuth" };
  }
}

function specRows(kind: AccessoryKind, s: AccessorySpec): [string, string, boolean?][] {
  switch (kind) {
    case "eyepiece": {
      const e = s as import("@/modules/simulations/engine").EyepieceSpec;
      return [
        ["Focal length", `${e.focalLengthMm} mm`],
        ["Apparent field", `${e.apparentFovDeg}°`],
        ...(e.eyeReliefMm ? [["Eye relief", `${e.eyeReliefMm} mm`] as [string, string]] : []),
        ...(e.barrelIn ? [["Barrel size", `${e.barrelIn}″`] as [string, string]] : []),
        ...(e.fieldStopMm ? [["Field stop", `${e.fieldStopMm} mm`] as [string, string]] : []),
      ];
    }
    case "camera": {
      const c = s as import("@/modules/simulations/engine").CameraSpec;
      return [
        ["Sensor", `${c.sensorWidthMm} × ${c.sensorHeightMm} mm`],
        ["Pixel size", `${c.pixelSizeUm} µm`],
        ...(c.resolutionX && c.resolutionY ? [["Resolution", `${c.resolutionX} × ${c.resolutionY}`] as [string, string]] : []),
        ...(c.color !== undefined ? [["Sensor type", c.color ? "Colour" : "Monochrome"] as [string, string]] : []),
        ["Diagonal", `${Math.hypot(c.sensorWidthMm, c.sensorHeightMm).toFixed(1)} mm`, true],
      ];
    }
    case "barlow": {
      const b = s as import("@/modules/simulations/engine").BarlowSpec;
      return [["Magnification factor", `${b.factor}×`], ...(b.barrelIn ? [["Barrel size", `${b.barrelIn}″`] as [string, string]] : [])];
    }
    case "filter": {
      const f = s as import("@/modules/simulations/engine").FilterSpec;
      return [["Name", f.name], ["Type", f.kind ? FILTER_KIND_LABELS[f.kind] : "Unspecified"]];
    }
    case "mount": {
      const m = s as MountSpec;
      return [
        ["Type", labelOf(MOUNT_TYPES, m.type)],
        ...(m.payloadKg ? [["Rated payload", `${m.payloadKg} kg`] as [string, string]] : []),
        ["GoTo", m.goto ? "Yes" : "No"],
        ["Motorised tracking", m.tracking ? "Yes" : "No"],
      ];
    }
  }
}

/** Editing values makes this a custom item: the catalogue label no longer applies. */
function AccessoryForm({ kind, spec }: { kind: AccessoryKind; spec: AccessorySpec }) {
  return (
    <AccessorySpecFields
      kind={kind}
      spec={spec}
      onPatch={(p) =>
        updateDraftSpec((s) => {
          const next = { ...(s[kind] as object), ...p } as Record<string, unknown>;
          if (kind !== "filter") delete next.label;
          return { ...s, [kind]: next };
        })
      }
    />
  );
}

function TelescopeDetails({ spec }: { spec: ConfigurationSpec }) {
  const t = spec.telescope;
  const entry = getTelescopeEntry(spec.catalogRef);
  const linked = Boolean(spec.profileId);
  const r = telescopeOpticsSchema.safeParse(t);
  const err: Record<string, string> = {};
  if (!r.success) for (const i of r.error.issues) err[String(i.path[0])] ??= friendlyMessage(i.message);
  // Changing optics turns a catalogue telescope into a custom one.
  const setOptics = (p: Partial<typeof t>) =>
    updateDraftSpec((s) => {
      const { label: _l, ...rest } = s.telescope; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { ...s, catalogRef: undefined, telescope: { ...rest, ...p } };
    });
  const prov: Provenance | undefined = entry ? "retrieved" : undefined;

  return (
    <section className="glass space-y-3 rounded-xl p-4" aria-label="Telescope details">
      <div>
        <p className="eyebrow">Telescope details</p>
        <h2 className="mt-1 font-semibold">{t.label ?? "Custom telescope"}</h2>
        {entry && <p className="mt-1 text-xs text-muted">{entry.summary}</p>}
        {linked && <p className="mt-1 text-xs text-muted">Optics come from your equipment in My Observatory.</p>}
      </div>
      <SelectField<OpticalDesign>
        label="Optical design"
        value={t.opticalDesign ?? ""}
        placeholder="Select…"
        options={OPTICAL_DESIGNS}
        disabled={linked}
        onChange={(opticalDesign) => setOptics({ opticalDesign })}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Aperture" unit="mm" value={t.apertureMm} disabled={linked} error={err.apertureMm} onChange={(v) => setOptics({ apertureMm: v as number })} />
        <NumberField label="Focal length" unit="mm" value={t.focalLengthMm} disabled={linked} error={err.focalLengthMm} onChange={(v) => setOptics({ focalLengthMm: v as number })} />
      </div>
      {r.success && (
        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          <div className="flex items-center gap-2 px-3 py-2">
            <dt className="flex-1 text-muted">Focal ratio</dt>
            <dd className="font-mono">f/{(t.focalLengthMm / t.apertureMm).toFixed(1)}</dd>
            <ProvenanceBadge kind="calculated" />
          </div>
          <div className="flex items-center gap-2 px-3 py-2">
            <dt className="flex-1 text-muted">Dawes limit</dt>
            <dd className="font-mono">{(116 / t.apertureMm).toFixed(2)}″</dd>
            <ProvenanceBadge kind="calculated" />
          </div>
          {prov && entry && (
            <div className="flex items-center gap-2 px-3 py-2">
              <dt className="flex-1 text-muted">Focuser</dt>
              <dd className="font-mono">{entry.focuserBarrelIn}″</dd>
              <ProvenanceBadge kind={prov} />
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
