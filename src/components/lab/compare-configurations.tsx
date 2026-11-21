"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Skeleton } from "@/components/ui/states";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { formatAngleArcsec, formatNumber } from "@/lib/format";
import { canPersist, signInHref, useAuth } from "@/modules/auth/use-auth";
import {
  summarizeConfiguration,
  toSimulationInput,
  type ConfigurationSpec,
  type TelescopeConfiguration,
} from "@/modules/configurations/models";
import { TELESCOPE_CATALOG, displayName } from "@/modules/equipment/catalog";
import { OPTICAL_DESIGNS } from "@/modules/equipment/models";
import { EquipmentPicker, type PickerOption } from "./equipment-picker";
import { AccessoryPicker } from "./configuration-panel";
import { openSavedInDraft, startDraft, useLabDraft } from "@/modules/lab/draft";
import { specFromCatalog } from "@/modules/lab/start";
import { getRepository } from "@/modules/persistence/client";
import { useOwnerQuery } from "@/modules/persistence/use-owner-query";
import {
  simulate,
  SimulationInputError,
  type Provenance,
  type SimulationMode,
  type SimulationResult,
} from "@/modules/simulations/engine";
import { getTarget, toTargetExtent, type CuratedTarget } from "@/modules/targets/catalogue";
import { assessReach, worstReach } from "@/modules/targets/reach";
import { TargetPicker } from "./target-picker";
import { SimulationViewport, type ViewSettings } from "./simulation-viewport";
import { SkyPanel } from "./sky-panel";
import type { ObservingConditions } from "@/modules/simulations/engine";
import type { ViewAtmosphere, ViewPhase } from "@/modules/simulations/renderers/atmosphere";
import { datedTarget, evaluateSky, idealConditions } from "@/modules/sky/conditions";
import { NATURAL_SKY } from "@/modules/sky/sky-brightness";
import { useSkyContext } from "@/modules/sky/use-sky-setting";

interface Source {
  key: string;
  label: string;
  spec: ConfigurationSpec;
  saved?: TelescopeConfiguration;
  /** How it shows in the picker. */
  group: string;
  eyebrow?: string;
  title: string;
}

/** Equipment changed on the Compare page for one side, tied to the setup it was made on. */
interface Edit {
  key: string;
  patch: Partial<ConfigurationSpec>;
}

/** The setup with this page's equipment changes applied (a new, unsaved variant). */
function withEdit(source: Source | undefined, edit: Edit | undefined): (Source & { edited: boolean }) | undefined {
  if (!source) return undefined;
  if (!edit || edit.key !== source.key) return { ...source, edited: false };
  return { ...source, spec: { ...source.spec, ...edit.patch }, saved: undefined, edited: true };
}

/** "203 mm · f/10.0 · SCT" for a picker card. */
function opticsLine(spec: ConfigurationSpec): string {
  const { apertureMm: a, focalLengthMm: f, opticalDesign } = spec.telescope;
  if (!a || !f) return summarizeConfiguration(spec);
  const design = OPTICAL_DESIGNS.find((d) => d.value === opticalDesign)?.label;
  return `${a} mm · f/${(f / a).toFixed(1)}${design ? ` · ${design}` : ""}`;
}

const DRAFT = "draft";

/** Normalise a URL value: a bare id means a saved configuration. */
function normaliseKey(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (v === DRAFT || v.startsWith("saved:") || v.startsWith("catalog:")) return v;
  return `saved:${v}`;
}

type Outcome = { result: SimulationResult; error?: undefined } | { result?: undefined; error: string };

function run(spec: ConfigurationSpec, target: CuratedTarget, mode: SimulationMode, conditions: ObservingConditions): Outcome {
  try {
    return {
      result: simulate(
        toSimulationInput({
          configuration: spec,
          target: toTargetExtent(target),
          mode,
          conditions,
          exposure: { exposureS: target.suggestedExposureS, gain: 1 },
        }),
      ),
    };
  } catch (e) {
    if (!(e instanceof SimulationInputError)) throw e;
    const missing = e.issues.find((i) => i.path === "eyepiece" || i.path === "camera");
    return { error: missing ? `This configuration has no ${missing.path}.` : "This configuration has invalid values." };
  }
}

interface Row {
  key: string;
  label: string;
  value: (r: SimulationResult, s: ConfigurationSpec, t: CuratedTarget) => number | undefined;
  format: (v: number) => string;
  kind: Provenance;
  /** How to read a larger value, for the plain-language hint. */
  higher?: string;
  lower?: string;
  modes?: SimulationMode[];
}

const ROWS: Row[] = [
  { key: "aperture", label: "Aperture", value: (_, s) => s.telescope.apertureMm, format: (v) => `${formatNumber(v, 0)} mm`, kind: "calculated", higher: "gathers more light" },
  { key: "focal", label: "Focal length (effective)", value: (r) => r.metrics.effectiveFocalLength.value, format: (v) => `${formatNumber(v, 0)} mm`, kind: "calculated" },
  { key: "ratio", label: "Focal ratio", value: (r) => r.metrics.focalRatio.value, format: (v) => `f/${formatNumber(v, 1)}`, kind: "calculated", lower: "faster (brighter per pixel)" },
  { key: "mag", label: "Magnification", value: (r) => (r.mode === "eyepiece" ? r.metrics.magnification.value : undefined), format: (v) => `${formatNumber(v, 0)}×`, kind: "calculated", higher: "shows the target larger", modes: ["eyepiece"] },
  { key: "pupil", label: "Exit pupil", value: (r) => (r.mode === "eyepiece" ? r.metrics.exitPupil.value : undefined), format: (v) => `${formatNumber(v, 2)} mm`, kind: "calculated", higher: "brighter extended objects", modes: ["eyepiece"] },
  { key: "tfov", label: "True field of view", value: (r) => (r.mode === "eyepiece" ? r.metrics.trueFov.value * 3600 : undefined), format: (v) => formatAngleArcsec(v), kind: "calculated", higher: "wider field", modes: ["eyepiece"] },
  { key: "apparent", label: "Target size (apparent)", value: (r, _, t) => (r.mode === "eyepiece" ? t.angularSize.majorAxisArcsec * r.metrics.magnification.value : undefined), format: (v) => formatAngleArcsec(v), kind: "calculated", higher: "larger in the eyepiece", modes: ["eyepiece"] },
  { key: "scale", label: "Image scale", value: (r) => (r.mode === "camera" ? r.metrics.imageScale.value : undefined), format: (v) => `${formatNumber(v, 2)}″/px`, kind: "calculated", lower: "finer sampling", modes: ["camera"] },
  { key: "fov", label: "Sensor field", value: (r) => (r.mode === "camera" ? r.metrics.sensorFovWidth.value * 60 : undefined), format: (v) => formatAngleArcsec(v), kind: "calculated", higher: "wider field", modes: ["camera"] },
  { key: "onsensor", label: "Target on sensor", value: (r, _, t) => (r.mode === "camera" ? t.angularSize.majorAxisArcsec / r.metrics.imageScale.value : undefined), format: (v) => `${formatNumber(v, 0)} px`, kind: "calculated", higher: "more pixels across the target", modes: ["camera"] },
  { key: "dawes", label: "Dawes limit", value: (r) => r.metrics.dawesLimit.value, format: (v) => `${formatNumber(v, 2)}″`, kind: "estimated", lower: "finer detail in theory" },
  { key: "eff", label: "Effective resolution", value: (r) => r.metrics.effectiveResolution?.value, format: (v) => `${formatNumber(v, 2)}″`, kind: "estimated", lower: "finer detail under this seeing" },
];

export function CompareConfigurations({
  initialA,
  initialB,
  initialTargetId,
  initialMode = "eyepiece",
}: {
  initialA?: string;
  initialB?: string;
  initialTargetId?: string;
  initialMode?: SimulationMode;
}) {
  const { draft, hydrated } = useLabDraft();
  const saved = useOwnerQuery((r) => r.listConfigurations(), []);
  const [target, setTarget] = useState<CuratedTarget>(() => getTarget(initialTargetId ?? "") ?? getTarget("saturn")!);
  const [mode, setMode] = useState<SimulationMode>(initialMode);
  const sky = useSkyContext();
  const [ideal, setIdeal] = useState(false);
  const [aKey, setAKey] = useState<string | undefined>(normaliseKey(initialA));
  const [bKey, setBKey] = useState<string | undefined>(normaliseKey(initialB));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Equipment changed on this page, per side; dropped when that side's setup is changed.
  const [edits, setEdits] = useState<{ A?: Edit; B?: Edit }>({});

  const sources: Source[] = useMemo(() => {
    const list: Source[] = [];
    if (draft)
      list.push({ key: DRAFT, label: `Current Lab setup: ${draft.spec.name}`, spec: draft.spec, saved: draft.saved, group: "Current Lab setup", eyebrow: "Current Lab setup", title: draft.spec.name });
    if (saved.status === "ready")
      for (const c of saved.data) list.push({ key: `saved:${c.id}`, label: c.name, spec: c, saved: c, group: "My configurations", eyebrow: "My configuration", title: c.name });
    for (const t of [...TELESCOPE_CATALOG].sort((x, y) => x.manufacturer.localeCompare(y.manufacturer)))
      list.push({ key: `catalog:${t.id}`, label: `Example: ${displayName(t)}`, spec: specFromCatalog(t), group: t.manufacturer, eyebrow: t.manufacturer, title: t.model });
    return list;
  }, [draft, saved]);

  // Defaults: A = the Lab setup; B = a saved configuration, else a contrasting example.
  const find = (k?: string) => sources.find((s) => s.key === k);
  const aBase = find(aKey) ?? find(DRAFT) ?? sources[0];
  const fallbackB =
    sources.find((s) => s.key.startsWith("saved:") && s.key !== aBase?.key) ??
    find(aBase?.spec.telescope.opticalDesign === "catadioptric" ? "catalog:skywatcher-evostar-80ed" : "catalog:celestron-nexstar-8se");
  const bBase = find(bKey) ?? fallbackB;
  const a = withEdit(aBase, edits.A);
  const b = withEdit(bBase, edits.B);

  const sync = (next: { a?: string; b?: string; target?: string; mode?: string }) => {
    const p = new URLSearchParams({
      ...(a ? { a: a.key } : {}),
      ...(b ? { b: b.key } : {}),
      target: target.id,
      mode,
      ...Object.fromEntries(Object.entries(next).filter(([, v]) => v)),
    } as Record<string, string>);
    window.history.replaceState(null, "", `?${p}`);
  };

  // One sky for both setups.
  const evaluation = useMemo(() => evaluateSky(sky.setting, target), [sky.setting, target]);
  const best = useMemo(() => idealConditions(sky.setting, target), [sky.setting, target]);
  const shownTarget = useMemo(() => datedTarget(target, evaluation.target), [target, evaluation.target]);
  const conditions = ideal ? best.conditions : evaluation.conditions;
  const view = useMemo((): { atmosphere: ViewAtmosphere; phase?: ViewPhase; observedAt: string } => {
    const p = evaluation.target?.phase;
    return {
      observedAt: sky.at.toISOString(),
      phase: p && { illuminated: p.illuminated, brightLimbDeg: p.brightLimbDeg, earthshine: target.id === "moon" },
      atmosphere: ideal
        ? { skyMag: NATURAL_SKY, source: "natural", extinctionMag: best.conditions.extinctionMag ?? 0, cloud: 0, altitudeDeg: best.altitudeDeg }
        : {
            skyMag: evaluation.sky.mag,
            source: evaluation.sky.dominant,
            extinctionMag: evaluation.conditions.extinctionMag ?? 0,
            cloud: sky.setting.weather.cloud,
            altitudeDeg: evaluation.target?.apparentAltDeg ?? 90,
          },
    };
  }, [ideal, best, evaluation, sky.at, sky.setting.weather.cloud, target.id]);

  if (!hydrated || !a || !b || ((aKey?.startsWith("saved:") || bKey?.startsWith("saved:")) && saved.status === "loading")) {
    return (
      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-6" aria-busy>
        <Skeleton className="h-12" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </main>
    );
  }

  const outA = run(a.spec, shownTarget, mode, conditions);
  const outB = run(b.spec, shownTarget, mode, conditions);
  const reachSky = (t: CuratedTarget) => (ideal ? idealConditions(sky.setting, t).reach : evaluateSky(sky.setting, t).reach);
  const rows = ROWS.filter((r) => !r.modes || r.modes.includes(mode));

  return (
    <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Step 4</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Compare configurations</h1>
          <p className="mt-1 text-sm text-muted">Same target, same conditions, two setups side by side.</p>
        </div>
        <Tabs<SimulationMode>
          label="Simulation mode"
          variant="segmented"
          value={mode}
          onChange={(m) => (setMode(m), sync({ mode: m }))}
          items={[
            { id: "eyepiece", label: "Eyepiece view" },
            { id: "camera", label: "Camera view" },
          ]}
        />
      </header>

      <div className="glass flex flex-wrap items-start gap-x-6 gap-y-3 rounded-xl p-3">
        <div className="min-w-0 flex-1">
          <TargetPicker
            value={target}
            onChange={(t) => (setTarget(t), sync({ target: t.id }))}
            assess={(t) => {
              const s = reachSky(t);
              return worstReach(assessReach(t, a.spec, mode, s), assessReach(t, b.spec, mode, s));
            }}
          />
        </div>
      </div>

      <SkyPanel sky={sky} evaluation={evaluation} targetName={target.name} ideal={ideal} onIdealChange={setIdeal} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Side
          letter="A"
          source={a}
          sources={sources}
          outcome={outA}
          target={shownTarget}
          view={view}
          onPick={(k) => (setAKey(k), setEdits((e) => ({ ...e, A: undefined })), sync({ a: k }))}
          onSaved={(c) => (setAKey(`saved:${c.id}`), setEdits((e) => ({ ...e, A: undefined })), sync({ a: `saved:${c.id}` }))}
          mode={mode}
          onEdit={(patch) => setEdits((e) => ({ ...e, A: { key: aBase!.key, patch: { ...(e.A?.key === aBase!.key ? e.A.patch : {}), ...patch } } }))}
          onReset={() => setEdits((e) => ({ ...e, A: undefined }))}
        />
        <Side
          letter="B"
          source={b}
          sources={sources}
          outcome={outB}
          target={shownTarget}
          view={view}
          onPick={(k) => (setBKey(k), setEdits((e) => ({ ...e, B: undefined })), sync({ b: k }))}
          onSaved={(c) => (setBKey(`saved:${c.id}`), setEdits((e) => ({ ...e, B: undefined })), sync({ b: `saved:${c.id}` }))}
          mode={mode}
          onEdit={(patch) => setEdits((e) => ({ ...e, B: { key: bBase!.key, patch: { ...(e.B?.key === bBase!.key ? e.B.patch : {}), ...patch } } }))}
          onReset={() => setEdits((e) => ({ ...e, B: undefined }))}
        />
      </div>

      <section className="glass overflow-hidden rounded-xl" aria-label="Comparison">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="font-semibold">Configuration comparison</h2>
          <p className="text-xs text-muted">Untick a row to hide it.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-2 font-normal">Metric</th>
                <th className="px-4 py-2 font-normal">A</th>
                <th className="px-4 py-2 font-normal">B</th>
                <th className="px-4 py-2 font-normal">B compared with A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const va = outA.result ? row.value(outA.result, a.spec, target) : undefined;
                const vb = outB.result ? row.value(outB.result, b.spec, target) : undefined;
                const off = hidden.has(row.key);
                return (
                  <tr key={row.key} className={off ? "opacity-40" : ""}>
                    <td className="px-4 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={!off}
                          onChange={() =>
                            setHidden((h) => {
                              const n = new Set(h);
                              if (n.has(row.key)) n.delete(row.key);
                              else n.add(row.key);
                              return n;
                            })
                          }
                        />
                        {row.label}
                        <ProvenanceBadge kind={row.kind} />
                      </label>
                    </td>
                    {off ? (
                      <td colSpan={3} className="px-4 py-2 text-xs text-muted">
                        Hidden
                      </td>
                    ) : (
                      <>
                        <td className="px-4 py-2 font-mono tabular-nums">{va === undefined ? "—" : row.format(va)}</td>
                        <td className="px-4 py-2 font-mono tabular-nums">{vb === undefined ? "—" : row.format(vb)}</td>
                        <td className="px-4 py-2 text-xs text-muted">{difference(row, va, vb)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function difference(row: Row, a?: number, b?: number): React.ReactNode {
  if (a === undefined || b === undefined || a === 0) return "—";
  const ratio = b / a;
  if (Math.abs(ratio - 1) < 0.005) return "Same";
  const more = ratio > 1;
  const hint = more ? row.higher : row.lower;
  const otherHint = more ? row.lower : row.higher;
  const text = more ? `${formatNumber(ratio, 2)}× larger` : `${formatNumber(1 / ratio, 2)}× smaller`;
  return (
    <span>
      <span className={hint ? "text-success" : otherHint ? "text-warning" : "text-foreground"}>{text}</span>
      {(hint || otherHint) && <span className="text-muted"> · {hint ? `B ${hint}` : `A ${otherHint}`}</span>}
    </span>
  );
}

function Side({
  letter,
  source,
  sources,
  outcome,
  target,
  view,
  onPick,
  onSaved,
  mode,
  onEdit,
  onReset,
}: {
  letter: "A" | "B";
  source: Source & { edited: boolean };
  mode: SimulationMode;
  onEdit: (patch: Partial<ConfigurationSpec>) => void;
  onReset: () => void;
  sources: Source[];
  outcome: Outcome;
  target: CuratedTarget;
  view: Pick<ViewSettings, "atmosphere" | "phase" | "observedAt">;
  onPick: (key: string) => void;
  onSaved: (c: TelescopeConfiguration) => void;
}) {
  const auth = useAuth();
  const router = useRouter();
  const owned = useOwnerQuery((r) => r.listAccessories(), []).data ?? [];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const settings: ViewSettings = useMemo(
    () => ({ focusOffset: 0, longExposureColor: false, zoom: 1, gain: 1, exposureS: target.suggestedExposureS, filterKind: source.spec.filter?.kind, ...view }),
    [target, source.spec.filter?.kind, view],
  );

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      // An edited setup is saved as a new configuration ("… (variant)" when it came from a saved one).
      const spec = source.edited && source.key.startsWith("saved:") ? { ...source.spec, name: `${source.spec.name} (variant)`.slice(0, 100) } : source.spec;
      const c = await getRepository().createConfiguration(spec);
      if (source.key === DRAFT && !source.edited) openSavedInDraft(c);
      onSaved(c);
      setMessage({ ok: true, text: `Saved “${c.name}” to My Observatory.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  const openInLab = () => {
    if (source.key === DRAFT && !source.edited) return router.push("/lab/simulate");
    if (source.saved && !source.edited) return router.push(`/lab/simulate?config=${source.saved.id}`);
    startDraft(source.spec);
    router.push("/lab/simulate");
  };

  const isSaved = !source.edited && (source.key.startsWith("saved:") || (source.key === DRAFT && Boolean(source.saved)));

  return (
    <section className="glass flex min-w-0 flex-col rounded-xl p-4" aria-label={`Configuration ${letter}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-mono text-sm text-accent">{letter}</span>
        <div className="min-w-0 flex-1">
          <EquipmentPicker
            label={`Configuration ${letter}`}
            current={{ eyebrow: source.eyebrow, title: source.title, detail: opticsLine(source.spec), visual: { type: "telescope", optics: source.spec.telescope } }}
            selectedId={source.key}
            options={sources.map<PickerOption>((s) => ({
              id: s.key,
              group: s.group,
              eyebrow: s.eyebrow,
              title: s.title,
              detail: opticsLine(s.spec),
              visual: { type: "telescope", optics: s.spec.telescope },
            }))}
            onPick={onPick}
            footer={<>Real telescopes come with a typical eyepiece and camera; change them below after choosing.</>}
          />
        </div>
      </div>
      {/* The equipment for this side: changes apply here at once, as an unsaved variant. */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-3" aria-label={`Equipment for configuration ${letter}`} role="group">
        <AccessoryPicker kind={mode === "camera" ? "camera" : "eyepiece"} config={source.spec} owned={owned} set={onEdit} />
        <AccessoryPicker kind="barlow" config={source.spec} owned={owned} set={onEdit} />
        <AccessoryPicker kind="filter" config={source.spec} owned={owned} set={onEdit} />
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm font-medium">
        <span className="truncate">{source.spec.name}</span>
        <StatusChip status={source.spec.status} />
        {source.edited && (
          <>
            <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warning">Edited</span>
            <button type="button" onClick={onReset} className="text-xs font-normal text-accent hover:underline">
              Reset
            </button>
          </>
        )}
      </p>
      <p className="truncate text-xs text-muted">{summarizeConfiguration(source.spec)}</p>

      <div className="mt-3 flex-1 rounded-xl bg-black/40 p-2">
        {outcome.result ? (
          <SimulationViewport result={outcome.result} target={target} settings={settings} stale={false} maxSizePx={400} />
        ) : (
          <p className="p-10 text-center text-sm text-warning">{outcome.error}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isSaved ? (
          <span className="text-xs text-success">Saved in My Observatory</span>
        ) : canPersist(auth) ? (
          <Button size="sm" variant="primary" disabled={busy} onClick={save}>
            Save configuration {letter}
          </Button>
        ) : auth.mode === "supabase" && auth.status === "signed-out" ? (
          <Link href={signInHref()} className={buttonStyles({ size: "sm" })}>
            Sign in to save
          </Link>
        ) : null}
        <Button size="sm" onClick={openInLab}>
          Open in Lab
        </Button>
      </div>
      {message && (
        <p role="status" className={`mt-2 text-xs ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
