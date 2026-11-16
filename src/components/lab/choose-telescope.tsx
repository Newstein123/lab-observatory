"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { SignInPrompt } from "@/components/auth/account-menu";
import { EquipmentViewer } from "@/components/equipment-3d";
import { Button, buttonStyles } from "@/components/ui/button";
import { inputClass, NumberField, SelectField } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, LoadingList } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { friendlyMessage } from "@/lib/validation-messages";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { MANUFACTURERS, TELESCOPE_CATALOG, displayName, type TelescopeCatalogEntry } from "@/modules/equipment/catalog";
import { labelOf, MOUNT_TYPES, OPTICAL_DESIGNS, type MountType, type TelescopeProfile } from "@/modules/equipment/models";
import { startDraft } from "@/modules/lab/draft";
import { defaultMount, specFromCatalog, specFromCustom, specFromProfile } from "@/modules/lab/start";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import { telescopeOpticsSchema, type OpticalDesign, type TelescopeOptics } from "@/modules/simulations/engine";
import { TubeSilhouette } from "./tube-silhouette";

export type ChooseTab = "catalog" | "custom" | "mine";

const fRatio = (o: TelescopeOptics) => (o.focalLengthMm / o.apertureMm).toFixed(1);


/** Telescopes per page of results. */
const PAGE_SIZE = 12;

type SortKey = "maker" | "aperture-desc" | "aperture-asc" | "focal-asc" | "focal-desc" | "ratio-asc";

const fRatioOf = (t: TelescopeCatalogEntry) => t.optics.focalLengthMm / t.optics.apertureMm;

const SORTS: Record<SortKey, { label: string; compare: (a: TelescopeCatalogEntry, b: TelescopeCatalogEntry) => number }> = {
  maker: { label: "Maker", compare: (a, b) => displayName(a).localeCompare(displayName(b)) },
  "aperture-desc": { label: "Largest aperture", compare: (a, b) => b.optics.apertureMm - a.optics.apertureMm },
  "aperture-asc": { label: "Smallest aperture", compare: (a, b) => a.optics.apertureMm - b.optics.apertureMm },
  "focal-asc": { label: "Shortest focal length (widest view)", compare: (a, b) => a.optics.focalLengthMm - b.optics.focalLengthMm },
  "focal-desc": { label: "Longest focal length (most magnification)", compare: (a, b) => b.optics.focalLengthMm - a.optics.focalLengthMm },
  "ratio-asc": { label: "Fastest focal ratio (imaging)", compare: (a, b) => fRatioOf(a) - fRatioOf(b) },
};

export function ChooseTelescope({ initialTab = "catalog" }: { initialTab?: ChooseTab }) {
  const [tab, setTab] = useState<ChooseTab>(initialTab);
  const router = useRouter();

  const begin = (spec: ConfigurationSpec) => {
    startDraft(spec);
    router.push("/lab/configure");
  };

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6">
      <header>
        <p className="eyebrow">Step 1</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose or create a telescope</h1>
        <p className="mt-1 text-sm text-muted">
          Manufacturer and model identify a telescope; every calculation uses its aperture and focal length.
        </p>
      </header>
      <Tabs<ChooseTab>
        label="How to start"
        value={tab}
        onChange={(t) => {
          setTab(t);
          window.history.replaceState(null, "", `?tab=${t}`);
        }}
        items={[
          { id: "catalog", label: "Catalog" },
          { id: "custom", label: "Custom build" },
          { id: "mine", label: "My equipment" },
        ]}
      />
      {tab === "catalog" && <CatalogTab onChoose={(t) => begin(specFromCatalog(t))} />}
      {tab === "custom" && <CustomTab onChoose={begin} />}
      {tab === "mine" && <MineTab onChoose={(p) => begin(specFromProfile(p))} />}
    </main>
  );
}

// ---------------------------------------------------------------------------

function CatalogTab({ onChoose }: { onChoose: (t: TelescopeCatalogEntry) => void }) {
  const [query, setQuery] = useState("");
  const [maker, setMaker] = useState("");
  const [design, setDesign] = useState<OpticalDesign | "">("");
  const [mountType, setMountType] = useState<MountType | "">("");
  const [sort, setSort] = useState<SortKey>("maker");
  const [apMin, setApMin] = useState<number | undefined>();
  const [apMax, setApMax] = useState<number | undefined>();
  const [flMin, setFlMin] = useState<number | undefined>();
  const [flMax, setFlMax] = useState<number | undefined>();
  const [selectedId, setSelectedId] = useState<string>();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = TELESCOPE_CATALOG.filter(
      (t) =>
        (!q || `${displayName(t)} ${t.summary}`.toLowerCase().includes(q)) &&
        (!maker || t.manufacturer === maker) &&
        (!design || t.optics.opticalDesign === design) &&
        (!mountType || t.mountType === mountType) &&
        (apMin === undefined || Number.isNaN(apMin) || t.optics.apertureMm >= apMin) &&
        (apMax === undefined || Number.isNaN(apMax) || t.optics.apertureMm <= apMax) &&
        (flMin === undefined || Number.isNaN(flMin) || t.optics.focalLengthMm >= flMin) &&
        (flMax === undefined || Number.isNaN(flMax) || t.optics.focalLengthMm <= flMax),
    );
    return [...matches].sort(SORTS[sort].compare);
  }, [query, maker, design, mountType, sort, apMin, apMax, flMin, flMax]);

  // Back to page 1 whenever the filters or sort change (no effect needed: the
  // page is remembered together with the filters it belongs to).
  const filterKey = JSON.stringify([query, maker, design, mountType, sort, apMin, apMax, flMin, flMax]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = paging.key === filterKey ? Math.min(paging.page, pageCount) : 1;
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const listTop = useRef<HTMLDivElement>(null);
  const goToPage = (p: number) => {
    setPaging({ key: filterKey, page: Math.min(pageCount, Math.max(1, p)) });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    listTop.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const selected = results.find((t) => t.id === selectedId);
  const reset = () => {
    setQuery("");
    setMaker("");
    setDesign("");
    setMountType("");
    setApMin(undefined);
    setApMax(undefined);
    setFlMin(undefined);
    setFlMax(undefined);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_380px]">
      <aside className="glass h-fit space-y-4 rounded-xl p-4" aria-label="Filters">
        <div className="relative">
          <label htmlFor="catalog-search" className="sr-only">
            Search telescopes
          </label>
          <Icons.Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted" />
          <input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models"
            className={`${inputClass} pl-8`}
          />
        </div>
        <SelectField
          label="Manufacturer"
          value={maker}
          onChange={setMaker}
          options={[{ value: "", label: "All manufacturers" }, ...MANUFACTURERS.map((m) => ({ value: m, label: m }))]}
        />
        <SelectField<OpticalDesign | "">
          label="Optical design"
          value={design}
          onChange={setDesign}
          options={[{ value: "", label: "All designs" }, ...OPTICAL_DESIGNS]}
        />
        <SelectField<MountType | "">
          label="Mount"
          value={mountType}
          onChange={setMountType}
          options={[{ value: "", label: "All mounts" }, ...MOUNT_TYPES]}
        />
        <fieldset className="space-y-2">
          <legend className="text-xs text-muted">Aperture (mm)</legend>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Min" value={apMin} onChange={setApMin} />
            <NumberField label="Max" value={apMax} onChange={setApMax} />
          </div>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-xs text-muted">Focal length (mm)</legend>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Min" value={flMin} onChange={setFlMin} />
            <NumberField label="Max" value={flMax} onChange={setFlMax} />
          </div>
        </fieldset>
        <Button variant="ghost" size="sm" onClick={reset} className="w-full">
          Clear filters
        </Button>
      </aside>

      <section aria-label="Telescopes" className="min-w-0">
        <div ref={listTop} className="mb-3 flex scroll-mt-24 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" role="status">
            {results.length === 0
              ? `0 of ${TELESCOPE_CATALOG.length} telescopes`
              : pageCount > 1
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, results.length)} of ${results.length}${
                    results.length < TELESCOPE_CATALOG.length ? ` matches (${TELESCOPE_CATALOG.length} telescopes)` : " telescopes"
                  }`
                : `${results.length} of ${TELESCOPE_CATALOG.length} telescopes`}
          </p>
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-muted">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${inputClass} w-auto py-1 text-xs`}>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORTS[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {results.length === 0 ? (
          <EmptyState title="No telescopes match these filters" action={<Button size="sm" onClick={reset}>Clear filters</Button>}>
            Try a wider aperture or focal length range, or build a custom telescope.
          </EmptyState>
        ) : (
          <>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {pageResults.map((t) => {
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(t.id)}
                    className={`glass w-full rounded-xl p-4 text-left transition-[border-color,box-shadow] ${
                      active ? "border-accent shadow-glow" : "hover:border-border-strong"
                    }`}
                  >
                    <TubeSilhouette optics={t.optics} className="h-24 w-full" />
                    <p className="mt-2 text-xs text-muted">{t.manufacturer}</p>
                    <p className="font-medium">{t.model}</p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {t.optics.apertureMm} mm · {t.optics.focalLengthMm} mm · f/{fRatio(t.optics)}
                    </p>
                    <p className="mt-1 text-xs text-subtle">{labelOf(OPTICAL_DESIGNS, t.optics.opticalDesign)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
            <Pagination page={page} pageCount={pageCount} onPageChange={goToPage} label="Telescope results pages" className="mt-5" />
          </>
        )}
      </section>

      {/* Details: side panel on wide screens, below the list otherwise */}
      <aside className="lg:col-span-2 xl:col-span-1" aria-label="Selected telescope">
        {selected ? (
          <div className="glass sticky top-20 overflow-hidden rounded-xl">
            <EquipmentViewer
              item={{ kind: "telescope", optics: selected.optics, mount: defaultMount(selected.mountType, selected.otaWeightKg) }}
              label={`3D model of the ${displayName(selected)}`}
              className="h-72 border-b border-border bg-surface-sunken/40"
            />
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs text-muted">{selected.manufacturer}</p>
                <h2 className="text-lg font-semibold">{selected.model}</h2>
                <p className="mt-1 text-sm text-muted">{selected.summary}</p>
              </div>
              <SpecList
                rows={[
                  ["Optical design", labelOf(OPTICAL_DESIGNS, selected.optics.opticalDesign), "retrieved"],
                  ["Aperture", `${selected.optics.apertureMm} mm`, "retrieved"],
                  ["Focal length", `${selected.optics.focalLengthMm} mm`, "retrieved"],
                  ["Focal ratio", `f/${fRatio(selected.optics)}`, "calculated"],
                  ["Supplied mount", labelOf(MOUNT_TYPES, selected.mountType), "retrieved"],
                  ["Focuser", `${selected.focuserBarrelIn}″`, "retrieved"],
                  ...(selected.otaWeightKg ? [["Tube weight", `≈ ${selected.otaWeightKg} kg`, "estimated"] as const] : []),
                ]}
              />
              <p className="text-[11px] text-subtle">Published specifications, awaiting verification.</p>
              <Button variant="primary" className="w-full" onClick={() => onChoose(selected)}>
                Configure this telescope →
              </Button>
            </div>
          </div>
        ) : (
          <div className="glass hidden rounded-xl p-6 text-center text-sm text-muted xl:block">
            <Icons.Telescope className="mx-auto mb-2 size-8 text-accent" />
            Select a telescope to inspect it in 3D.
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function CustomTab({ onChoose }: { onChoose: (spec: ConfigurationSpec) => void }) {
  const [name, setName] = useState("");
  const [design, setDesign] = useState<OpticalDesign>("reflector");
  const [aperture, setAperture] = useState<number | undefined>(150);
  const [focal, setFocal] = useState<number | undefined>(750);
  const [mountType, setMountType] = useState<MountType>("equatorial");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");

  const parsed = telescopeOpticsSchema.safeParse({ apertureMm: aperture, focalLengthMm: focal, opticalDesign: design });
  const errors: Record<string, string> = {};
  if (!parsed.success) for (const i of parsed.error.issues) errors[String(i.path[0])] ??= friendlyMessage(i.message);
  const optics = parsed.success ? parsed.data : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form
        className="glass space-y-4 rounded-xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (optics) onChoose(specFromCustom({ name, optics, mountType, manufacturer, model }));
        }}
      >
        <h2 className="font-semibold">Optical specification</h2>
        <SelectField<OpticalDesign> label="Optical design" value={design} options={OPTICAL_DESIGNS} onChange={setDesign} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Aperture" unit="mm" value={aperture} onChange={setAperture} error={errors.apertureMm} />
          <NumberField label="Focal length" unit="mm" value={focal} onChange={setFocal} error={errors.focalLengthMm} />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          Focal ratio{" "}
          <span className="font-mono text-foreground">{optics ? `f/${fRatio(optics)}` : "—"}</span>
          <ProvenanceBadge kind="calculated" />
        </p>
        <SelectField<MountType> label="Mount type" value={mountType} options={MOUNT_TYPES} onChange={setMountType} />
        <h2 className="border-t border-border pt-4 font-semibold">
          Identification <span className="text-xs font-normal text-muted">(optional, not used in calculations)</span>
        </h2>
        <TextInput label="Configuration name" value={name} onChange={setName} placeholder={optics ? `Custom ${optics.apertureMm} mm f/${fRatio(optics)}` : ""} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Manufacturer" value={manufacturer} onChange={setManufacturer} />
          <TextInput label="Model" value={model} onChange={setModel} />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={!optics}>
          Configure this telescope →
        </Button>
      </form>
      <div className="glass min-h-80 overflow-hidden rounded-xl">
        {optics ? (
          <EquipmentViewer
            item={{ kind: "telescope", optics, mount: defaultMount(mountType) }}
            label={`3D preview of a custom ${optics.apertureMm} mm f/${fRatio(optics)} telescope`}
            className="h-full min-h-80 lg:min-h-[520px]"
          />
        ) : (
          <div className="flex h-full min-h-80 items-center justify-center p-6 text-sm text-muted">
            Enter a valid aperture and focal length to preview the telescope.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MineTab({ onChoose }: { onChoose: (p: TelescopeProfile) => void }) {
  const profiles = useOwnerQuery((r) => r.listProfiles(), []);
  if (profiles.status === "loading") return <LoadingList rows={3} />;
  if (profiles.status === "signed-out") return <SignInPrompt>Sign in to use the telescopes saved in My Observatory.</SignInPrompt>;
  if (profiles.status === "error") return <ErrorState message={profiles.error.message} />;
  if (profiles.data.length === 0)
    return (
      <EmptyState
        title="No telescopes in My Observatory yet"
        icon={<Icons.Telescope />}
        action={
          <Link href="/observatory/equipment" className={buttonStyles({ variant: "primary", size: "sm" })}>
            Add a telescope
          </Link>
        }
      >
        Add the telescopes you own or plan to buy, then build configurations from them.
      </EmptyState>
    );
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.data.map((p) => (
        <li key={p.id} className="glass flex flex-col rounded-xl p-4">
          <TubeSilhouette optics={p} className="h-24 w-full" />
          <p className="mt-2 flex items-center gap-2 font-medium">
            <span className="truncate">{p.name}</span>
            <StatusChip status={p.status} />
          </p>
          {(p.manufacturer || p.model) && <p className="text-xs text-muted">{[p.manufacturer, p.model].filter(Boolean).join(" ")}</p>}
          <p className="mt-1 font-mono text-xs text-muted">
            {p.apertureMm} mm · {p.focalLengthMm} mm · f/{fRatio(p)} · {labelOf(MOUNT_TYPES, p.mountType)}
          </p>
          <Button variant="primary" size="sm" className="mt-3 self-start" onClick={() => onChoose(p)}>
            Use this telescope →
          </Button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------

/** Label / value rows with provenance; rows without one are the user's own inputs. */
export function SpecList({ rows }: { rows: readonly (readonly [string, string, ("calculated" | "retrieved" | "estimated" | "illustrative")?])[] }) {
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map(([label, value, kind]) => (
        <div key={label} className="flex items-center gap-2 px-3 py-2 text-sm">
          <dt className="flex-1 text-muted">{label}</dt>
          <dd className="font-mono tabular-nums">{value}</dd>
          {kind ? <ProvenanceBadge kind={kind} /> : <span className="text-[10px] uppercase tracking-wide text-subtle">Input</span>}
        </div>
      ))}
    </dl>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = `ti-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      <input id={id} value={value} maxLength={100} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}
