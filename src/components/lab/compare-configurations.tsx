"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { RangeField, SelectField } from "@/components/ui/fields";
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

interface Source {
  key: string;
  label: string;
  spec: ConfigurationSpec;
  saved?: TelescopeConfiguration;
}

const DRAFT = "draft";

/** Normalise a URL value: a bare id means a saved configuration. */
function normaliseKey(v: string | undefined): string | undefined {
  if (!v) return undefined;
  if (v === DRAFT || v.startsWith("saved:") || v.startsWith("catalog:")) return v;
  return `saved:${v}`;
}

type Outcome = { result: SimulationResult; error?: undefined } | { result?: undefined; error: string };

function run(spec: ConfigurationSpec, target: CuratedTarget, mode: SimulationMode, seeing: number): Outcome {
  try {
    return {
      result: simulate(
        toSimulationInput({
          configuration: spec,
          target: toTargetExtent(target),
          mode,
          conditions: { seeingArcsec: seeing },
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
  const [seeing, setSeeing] = useState(2);
  const [aKey, setAKey] = useState<string | undefined>(normaliseKey(initialA));
  const [bKey, setBKey] = useState<string | undefined>(normaliseKey(initialB));
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const sources: Source[] = useMemo(() => {
    const list: Source[] = [];
    if (draft) list.push({ key: DRAFT, label: `Current Lab setup: ${draft.spec.name}`, spec: draft.spec, saved: draft.saved });
    if (saved.status === "ready") for (const c of saved.data) list.push({ key: `saved:${c.id}`, label: c.name, spec: c, saved: c });
    for (const t of TELESCOPE_CATALOG) list.push({ key: `catalog:${t.id}`, label: `Example: ${displayName(t)}`, spec: specFromCatalog(t) });
    return list;
  }, [draft, saved]);

  // Defaults: A = the Lab setup; B = a saved configuration, else a contrasting example.
  const find = (k?: string) => sources.find((s) => s.key === k);
  const a = find(aKey) ?? find(DRAFT) ?? sources[0];
  const fallbackB =
    sources.find((s) => s.key.startsWith("saved:") && s.key !== a?.key) ??
    find(a?.spec.telescope.opticalDesign === "catadioptric" ? "catalog:skywatcher-evostar-80ed" : "catalog:celestron-nexstar-8se");
  const b = find(bKey) ?? fallbackB;

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

  const outA = run(a.spec, target, mode, seeing);
  const outB = run(b.spec, target, mode, seeing);
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
            assess={(t) => worstReach(assessReach(t, a.spec, mode), assessReach(t, b.spec, mode))}
          />
        </div>
        <div className="w-full sm:w-56">
          <RangeField label="Seeing (FWHM)" min={0.5} max={5} step={0.1} value={seeing} onChange={setSeeing} display={`${formatNumber(seeing, 1)}″`} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <Side
          letter="A"
          source={a}
          sources={sources}
          outcome={outA}
          target={target}
          onPick={(k) => (setAKey(k), sync({ a: k }))}
          onSaved={(c) => (setAKey(`saved:${c.id}`), sync({ a: `saved:${c.id}` }))}
        />
        <Side
          letter="B"
          source={b}
          sources={sources}
          outcome={outB}
          target={target}
          onPick={(k) => (setBKey(k), sync({ b: k }))}
          onSaved={(c) => (setBKey(`saved:${c.id}`), sync({ b: `saved:${c.id}` }))}
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
  onPick,
  onSaved,
}: {
  letter: "A" | "B";
  source: Source;
  sources: Source[];
  outcome: Outcome;
  target: CuratedTarget;
  onPick: (key: string) => void;
  onSaved: (c: TelescopeConfiguration) => void;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const settings: ViewSettings = useMemo(
    () => ({ focusOffset: 0, longExposureColor: false, zoom: 1, gain: 1, exposureS: target.suggestedExposureS, filterKind: source.spec.filter?.kind }),
    [target, source.spec.filter?.kind],
  );

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const c = await getRepository().createConfiguration(source.spec);
      if (source.key === DRAFT) openSavedInDraft(c);
      onSaved(c);
      setMessage({ ok: true, text: `Saved “${c.name}” to My Observatory.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  };

  const openInLab = () => {
    if (source.key === DRAFT) return router.push("/lab/simulate");
    if (source.saved) return router.push(`/lab/simulate?config=${source.saved.id}`);
    startDraft(source.spec);
    router.push("/lab/simulate");
  };

  const isSaved = source.key.startsWith("saved:") || (source.key === DRAFT && Boolean(source.saved));

  return (
    <section className="glass flex min-w-0 flex-col rounded-xl p-4" aria-label={`Configuration ${letter}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-mono text-sm text-accent">{letter}</span>
        <div className="min-w-0 flex-1">
          <SelectField label={`Configuration ${letter}`} value={source.key} options={sources.map((s) => ({ value: s.key, label: s.label }))} onChange={onPick} />
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm font-medium">
        <span className="truncate">{source.spec.name}</span>
        <StatusChip status={source.spec.status} />
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
