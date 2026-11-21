"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { NumberField, Panel, RangeField, SelectField } from "@/components/ui/fields";
import { Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { friendlyMessage } from "@/lib/validation-messages";
import { toSimulationInput, type ConfigurationSpec } from "@/modules/configurations/models";
import { isDraftDirty, updateDraftSpec } from "@/modules/lab/draft";
import { useWorkingDraft } from "@/modules/lab/use-lab-draft";
import { getRepository } from "@/modules/persistence/client";
import { buildSession } from "@/modules/sessions/models";
import {
  simulate,
  SimulationInputError,
  type Metric,
  type SimulationMode,
  type SimulationResult,
  type TrackingMode,
} from "@/modules/simulations/engine";
import { METRIC_PRESENTATION } from "@/modules/simulations/presentation";
import { getTarget, toTargetExtent, type CuratedTarget } from "@/modules/targets/catalogue";
import { EYEPIECE_CATALOG } from "@/modules/equipment/catalog";
import { assessReach } from "@/modules/targets/reach";
import { ConfigurationPanel, type FieldErrors } from "./configuration-panel";
import { LabToolbar } from "./lab-toolbar";
import { MetricsPanel } from "./metrics-panel";
import { SimulationViewport, type ViewSettings } from "./simulation-viewport";
import { TargetInfo } from "./target-info";
import { TargetPicker } from "./target-picker";
import { TargetGlyph } from "./target-glyph";
import { useViewOptions } from "./view-options";
import { SnapshotDialog, ViewTools } from "./view-tools";
import { summarizeConfiguration } from "@/modules/configurations/models";
import { formatDateTime } from "@/lib/time-zone";
import { SkyControls, SkyDetails } from "./sky-panel";
import { formatTime } from "@/lib/time-zone";
import type { ViewAtmosphere, ViewPhase } from "@/modules/simulations/renderers/atmosphere";
import { equatorialOf } from "@/modules/sky/bodies";
import { datedTarget, evaluateSky, idealConditions } from "@/modules/sky/conditions";
import { compass, toHorizontal } from "@/modules/sky/coords";
import { altitudeFn, crossings, HORIZON_MOON, HORIZON_STAR, highest, nightInfo } from "@/modules/sky/events";
import { NATURAL_SKY } from "@/modules/sky/sky-brightness";
import { updateSkyPrefs, useSkyContext } from "@/modules/sky/use-sky-setting";

type Outcome = { result: SimulationResult; errors?: undefined } | { result?: undefined; errors: FieldErrors };

/** Reflect target, mode and saved configuration in the URL so the view can be linked to. */
function syncUrl(targetId: string, mode: SimulationMode, configId?: string) {
  const params = new URLSearchParams({ target: targetId, mode });
  if (configId) params.set("config", configId);
  window.history.replaceState(null, "", `?${params}`);
}

interface Props {
  initialTargetId?: string;
  initialMode?: SimulationMode;
  initialConfigId?: string;
}

export function LabWorkspace({ initialTargetId, initialMode = "eyepiece", initialConfigId }: Props) {
  const { draft, status } = useWorkingDraft(initialConfigId);
  if (!draft) {
    return (
      <div className="mx-auto grid grid-cols-[minmax(0,1fr)] max-w-[1500px] gap-4 px-4 py-6 lg:grid-cols-[300px_1fr]" aria-busy>
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }
  return (
    <Workspace
      config={draft.spec}
      draft={draft}
      missingConfig={status === "missing-config"}
      loadError={status === "error"}
      initialTargetId={initialTargetId}
      initialMode={initialMode}
    />
  );
}

function Workspace({
  config,
  draft,
  missingConfig,
  loadError,
  initialTargetId,
  initialMode,
}: {
  config: ConfigurationSpec;
  draft: NonNullable<ReturnType<typeof useWorkingDraft>["draft"]>;
  missingConfig: boolean;
  loadError: boolean;
  initialTargetId?: string;
  initialMode: SimulationMode;
}) {
  const [target, setTarget] = useState<CuratedTarget>(() => getTarget(initialTargetId ?? "") ?? getTarget("saturn")!);
  const [mode, setModeState] = useState<SimulationMode>(initialMode);
  const sky = useSkyContext();
  const [ideal, setIdeal] = useState(false);
  const [exposureS, setExposureS] = useState<number | undefined>(target.suggestedExposureS);
  const [gain, setGain] = useState(1);
  const [tracking, setTracking] = useState<TrackingMode>(config.mount && config.mount.tracking === false ? "none" : "sidereal");
  const [focusOffset, setFocusOffset] = useState(0);
  const [longExposureColor, setLongExposureColor] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const view = useViewOptions();
  // The telescope nudged off the target (arcsec); Centre puts it back.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  // A new target in the URL (e.g. from the header search) replaces the current one.
  const [urlTarget, setUrlTarget] = useState(initialTargetId);
  if (initialTargetId !== urlTarget) {
    setUrlTarget(initialTargetId);
    const t = getTarget(initialTargetId ?? "");
    if (t && t.id !== target.id) {
      setTarget(t);
      setExposureS(t.suggestedExposureS);
    }
  }
  const observedAt = sky.at.toISOString();
  const zoom = 2 ** zoomStep;
  const savedId = draft.saved?.id;

  // Keep the URL pointing at the saved configuration once there is one.
  useEffect(() => {
    if (savedId) syncUrl(target.id, mode, savedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  // --- The sky at this place and time ---
  const evaluation = useMemo(() => evaluateSky(sky.setting, target), [sky.setting, target]);
  const best = useMemo(() => idealConditions(sky.setting, target), [sky.setting, target]);
  // Planets and the Moon at their size and brightness for that date.
  const shownTarget = useMemo(() => datedTarget(target, evaluation.target), [target, evaluation.target]);
  const skyConditions = ideal ? best.conditions : evaluation.conditions;
  // "Atmospheric seeing" off in the view settings: optics only, as above the atmosphere.
  const conditions = view.display.seeing ? skyConditions : { ...skyConditions, seeingArcsec: undefined };
  const atmosphere: ViewAtmosphere = useMemo(
    () =>
      ideal
        ? { skyMag: NATURAL_SKY, source: "natural", extinctionMag: best.conditions.extinctionMag ?? 0, cloud: 0, altitudeDeg: best.altitudeDeg }
        : {
            skyMag: evaluation.sky.mag,
            source: evaluation.sky.dominant,
            extinctionMag: evaluation.conditions.extinctionMag ?? 0,
            cloud: sky.setting.weather.cloud,
            altitudeDeg: evaluation.target?.apparentAltDeg ?? 90,
          },
    [ideal, best, evaluation, sky.setting.weather.cloud],
  );
  const phase: ViewPhase | undefined = useMemo(() => {
    const p = evaluation.target?.phase;
    return p && { illuminated: p.illuminated, brightLimbDeg: p.brightLimbDeg, earthshine: target.id === "moon" };
  }, [evaluation.target?.phase, target.id]);

  const run = useCallback(
    (c: typeof conditions): Outcome => {
      try {
        const input = toSimulationInput({
          configuration: config,
          target: toTargetExtent(shownTarget),
          mode,
          conditions: c,
          exposure: { exposureS: exposureS as number, gain, ...(tracking === "none" ? { tracking } : {}) },
        });
        return { result: simulate(input) };
      } catch (e) {
        if (!(e instanceof SimulationInputError)) throw e;
        const errors: FieldErrors = {};
        for (const issue of e.issues) errors[issue.path] ??= friendlyMessage(issue.message);
        return { errors };
      }
    },
    [config, shownTarget, mode, exposureS, gain, tracking],
  );
  const conditionsKey = JSON.stringify(conditions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const outcome: Outcome = useMemo(() => run(conditions), [run, conditionsKey]);
  // With "ideal" on, also run tonight's real conditions to show what they cost.
  const realKey = JSON.stringify(evaluation.conditions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const realResult = useMemo(() => (ideal ? run(evaluation.conditions).result : undefined), [ideal, run, realKey]);

  // The other instrument's field, for the field-boundary layer.
  const otherField = useMemo(() => {
    const other: SimulationMode = mode === "eyepiece" ? "camera" : "eyepiece";
    try {
      const r = simulate(
        toSimulationInput({ configuration: config, target: toTargetExtent(shownTarget), mode: other, conditions: {}, exposure: other === "camera" ? { exposureS: 1, gain: 1 } : undefined }),
      );
      if (r.framing.shape === "circle") return { shape: "circle" as const, diameterArcsec: r.framing.fieldDiameterArcsec, label: "Eyepiece field" };
      return { shape: "rect" as const, widthArcsec: r.framing.fieldWidthArcsec, heightArcsec: r.framing.fieldHeightArcsec, label: "Camera frame" };
    } catch {
      return undefined;
    }
  }, [config, shownTarget, mode]);

  // When the target is down: when it rises, and when it is highest.
  const below = useMemo(() => {
    if (ideal || !evaluation.target || evaluation.target.aboveHorizon) return undefined;
    const site = sky.site;
    const alt = altitudeFn((d) => equatorialOf(target, d, site)!, site);
    const from = sky.at;
    const to = new Date(from.getTime() + 36 * 3_600_000);
    const rise = crossings(alt, target.id === "moon" ? HORIZON_MOON : HORIZON_STAR, from, to).rises[0];
    // The best time to look: highest while the sky is dark (or, for the Moon and
    // planets, after civil twilight), tonight or else tomorrow night.
    const bright = target.category === "moon" || target.category === "planet";
    let top: { at: Date; altDeg: number } | undefined;
    for (const day of [0, 1]) {
      const ni = nightInfo(new Date(from.getTime() + day * 86_400_000), site);
      const s = (bright ? ni.civilStart : ni.darkStart) ?? ni.civilStart ?? ni.sunset ?? ni.start;
      const e = (bright ? ni.civilEnd : ni.darkEnd) ?? ni.civilEnd ?? ni.sunrise ?? ni.end;
      const start = new Date(Math.max(s.getTime(), from.getTime()));
      if (e.getTime() <= start.getTime()) continue;
      const h = highest(alt, start, e);
      if (h.altDeg > 5) {
        top = h;
        break;
      }
    }
    const dir = (d: Date) => compass(toHorizontal(equatorialOf(target, d, site)!, site, d).azDeg);
    return { rise, riseDir: rise && dir(rise), top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideal, evaluation.target?.aboveHorizon, target, sky.site, Math.floor(sky.at.getTime() / 600_000)]);

  // Keep the last valid result visible (dimmed) while inputs are being edited.
  const [lastValid, setLastValid] = useState<SimulationResult | undefined>(outcome.result);
  if (outcome.result && outcome.result !== lastValid) setLastValid(outcome.result);
  const shown = outcome.result ?? lastValid;
  const errors = outcome.errors ?? {};

  const settings: ViewSettings = useMemo(
    () => ({ focusOffset, longExposureColor, zoom, gain, exposureS: exposureS ?? 0, filterKind: config.filter?.kind, observedAt, atmosphere, phase }),
    [focusOffset, longExposureColor, zoom, gain, exposureS, config.filter?.kind, observedAt, atmosphere, phase],
  );

  const chooseTarget = (t: CuratedTarget) => {
    setTarget(t);
    setPan({ x: 0, y: 0 });
    setExposureS(t.suggestedExposureS);
    syncUrl(t.id, mode, savedId);
  };
  const setMode = (m: SimulationMode) => {
    setModeState(m);
    setPan({ x: 0, y: 0 });
    syncUrl(target.id, m, savedId);
  };

  const saveSession = () =>
    getRepository().createSession(
      buildSession({
        configuration: config,
        configurationRef: draft.saved ? { id: draft.saved.id, version: draft.saved.version, modified: isDraftDirty(draft) } : undefined,
        target: shownTarget,
        mode,
        conditions,
        exposure: exposureS === undefined ? undefined : { exposureS, gain, ...(tracking === "none" ? { tracking } : {}) },
        view: {
          focusOffset,
          longExposureColor,
          zoom,
          observedAt,
          site: {
            name: sky.site.name,
            latDeg: Math.round(sky.site.latDeg * 10) / 10,
            lonDeg: Math.round(sky.site.lonDeg * 10) / 10,
            timeZone: sky.site.timeZone,
          },
          conditionsSource: ideal ? "ideal" : sky.source,
          skySource: atmosphere.source,
          cloud: atmosphere.cloud,
        },
      }),
    );

  const assess = useCallback(
    (t: CuratedTarget) => {
      const e = evaluateSky(sky.setting, t);
      return assessReach(datedTarget(t, e.target), config, mode, ideal ? idealConditions(sky.setting, t).reach : e.reach);
    },
    [config, mode, sky.setting, ideal],
  );
  const deepSky = Boolean(target.coordinatesJ2000);
  const missingComponent = errors.eyepiece ?? errors.camera;
  const compareHref = `/lab/compare?target=${target.id}&mode=${mode}${savedId ? `&a=${savedId}` : ""}`;

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-4 fill:h-[calc(100dvh-110px)]">
      {(missingConfig || loadError) && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {missingConfig
            ? "That configuration no longer exists. You are editing your current working setup."
            : "Saved configurations could not be loaded. You are editing your current working setup."}
        </p>
      )}
      <LabToolbar
        draft={draft}
        valid={Boolean(outcome.result)}
        onSaveSession={saveSession}
        sessionWait={!ideal && sky.waitingForLive ? "Waiting for the live weather…" : undefined}
        leading={<TargetGlyph target={target} size={52} className="hidden ring-1 ring-border-strong sm:flex" />}
        actions={
          <>
            <Link href="/lab/configure" className={buttonStyles({ size: "sm" })}>
              <Icons.Wrench className="size-4" />
              Equipment
            </Link>
            <Link href={compareHref} className={buttonStyles({ size: "sm" })}>
              Compare →
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_380px] fill:min-h-0 fill:flex-1 fill:grid-rows-[minmax(0,1fr)]">
        <aside className="order-2 flex flex-col lg:order-1 fill:min-h-0 fill:overflow-y-auto fill:[scrollbar-width:thin] [&>section]:flex-1">
          <ConfigurationPanel
            config={config}
            onChange={(c) => updateDraftSpec(c)}
            errors={errors}
            mode={mode === "camera" ? "imaging" : "visual"}
            onModeChange={(m) => setMode(m === "imaging" ? "camera" : "eyepiece")}
            focusOffset={focusOffset}
            onFocusOffsetChange={setFocusOffset}
          />
        </aside>

        <main className="order-1 flex min-w-0 flex-col gap-4 lg:order-2 fill:min-h-0">
          <TargetPicker value={target} onChange={chooseTarget} assess={assess} />

          <ViewCard
            mode={mode}
            onModeChange={setMode}
            result={shown}
            readout={mode === "eyepiece" ? <MagnificationPicker config={config} result={shown} /> : undefined}
            footer={
              mode === "eyepiece" ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <label htmlFor="focus-range">Focus</label>
                      <span title="Focus blur is illustrative. Seeing blur is estimated from the sky conditions." className="text-subtle">
                        <Icons.Info className="size-3.5" />
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <input
                        id="focus-range"
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={focusOffset}
                        onChange={(e) => setFocusOffset(Number(e.target.value))}
                        className="min-w-0 flex-1 accent-accent"
                      />
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                          focusOffset === 0 ? "border-success/40 bg-success/10 text-success" : "border-warning/40 bg-warning/10 text-warning"
                        }`}
                      >
                        {focusOffset === 0 ? <Icons.Check className="size-3.5" /> : <Icons.Warning className="size-3.5" />}
                        {focusOffset === 0 ? "In focus" : `${Math.round(focusOffset * 100)}% off`}
                      </span>
                    </div>
                  </div>
                  {deepSky && (
                    <div className="sm:border-l sm:border-border sm:pl-4">
                      <p className="mb-1.5 text-xs text-muted">View options</p>
                      <button
                        type="button"
                        aria-pressed={longExposureColor}
                        onClick={() => setLongExposureColor((v) => !v)}
                        title="Off: stars from star catalogues down to your telescope's limit, over the object in grey, as the eye sees it. On: the full survey photograph, with far more stars and colour than the eye sees."
                        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${
                          longExposureColor ? "border-accent bg-accent/20 text-foreground" : "border-border bg-surface-sunken/50 text-muted hover:text-foreground"
                        }`}
                      >
                        <Icons.Image className="size-4" />
                        Long-exposure photo
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                  <NumberField
                    label="Exposure"
                    unit="s"
                    step={0.001}
                    value={exposureS}
                    error={errors["exposure.exposureS"]}
                    onChange={setExposureS}
                    hint={`Suggested: ${target.suggestedExposureS} s`}
                  />
                  <RangeField label="Gain" min={1} max={64} step={1} value={gain} onChange={setGain} display={`${gain}×`} />
                  <SelectField<TrackingMode>
                    label="Tracking"
                    value={tracking}
                    onChange={setTracking}
                    options={[
                      { value: "sidereal", label: "Sidereal (motorised)" },
                      { value: "none", label: "None (sky drifts)" },
                    ]}
                  />
                  <RangeField label="Zoom (crop)" min={0} max={6} step={1} value={zoomStep} onChange={setZoomStep} display={`${zoom}×`} />
                </div>
              )
            }
          >
            {(maxSizePx) => shown ? (
              <SimulationViewport
                maxSizePx={maxSizePx}
                pan={pan}
                onPanChange={setPan}
                layers={view.layers}
                display={view.display}
                equatorial={evaluation.target?.eq ?? (target.coordinatesJ2000 ? { raDeg: target.coordinatesJ2000.raDeg, decDeg: target.coordinatesJ2000.decDeg } : undefined)}
                otherField={otherField}
                tools={
                  <ViewTools
                    centred={pan.x === 0 && pan.y === 0}
                    onCentre={() => setPan({ x: 0, y: 0 })}
                    onSnapshot={() => setSnapshotOpen(true)}
                    layers={view.layers}
                    setLayers={view.setLayers}
                    display={view.display}
                    setDisplay={view.setDisplay}
                    canGrid={Boolean(evaluation.target?.eq ?? target.coordinatesJ2000)}
                    otherFieldLabel={otherField?.label}
                  />
                }
                result={shown}
                target={shownTarget}
                settings={settings}
                stale={!outcome.result || shown.mode !== mode || shown.targetId !== target.id}
                badge={
                  ideal ? (
                    <span className="inline-flex items-center gap-1 rounded bg-accent-strong px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                      <Icons.Sparkles className="size-3" />
                      Ideal conditions
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-muted">
                      <Icons.Pin className="size-3" />
                      {sky.site.name} · {formatTime(sky.at, sky.site.timeZone)}
                    </span>
                  )
                }
                overlay={
                  below && (
                    <div className="max-w-xs rounded-xl bg-black/80 px-4 py-3 text-center text-sm">
                      <p className="font-medium">
                        {target.name} is below the horizon from {sky.site.name} at {formatTime(sky.at, sky.site.timeZone)}.
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {below.rise
                          ? `Rises ${formatTime(below.rise, sky.site.timeZone)} in the ${below.riseDir}${below.top ? `; best seen in the dark at ${formatTime(below.top.at, sky.site.timeZone)} (${Math.round(below.top.altDeg)}° up)` : ""}.`
                          : "It doesn't rise in the next day and a half from here."}
                      </p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        {below.top && (
                          <button
                            type="button"
                            onClick={() => updateSkyPrefs({ timeMode: "fixed", fixedAt: below.top!.at.toISOString() })}
                            className={buttonStyles({ size: "sm", variant: "primary" })}
                          >
                            Show it at {formatTime(below.top.at, sky.site.timeZone)}
                          </button>
                        )}
                        <button type="button" onClick={() => setIdeal(true)} className={buttonStyles({ size: "sm", variant: "ghost" })}>
                          Ideal conditions
                        </button>
                      </div>
                    </div>
                  )
                }
              />
            ) : (
              <p className="p-8 text-center text-sm text-danger">{missingComponent ?? "Check the configuration inputs."}</p>
            )}
          </ViewCard>
          <SnapshotDialog
            open={snapshotOpen}
            onClose={() => setSnapshotOpen(false)}
            display={view.display}
            fileName={`${target.id}-${mode}-${observedAt.slice(0, 16).replace(/[:T]/g, "-")}`}
            caption={[
              `${target.name}${target.designation ? ` (${target.designation})` : ""} · ${mode === "eyepiece" ? "Eyepiece" : "Camera"} view`,
              summarizeConfiguration(config),
              shown?.mode === "eyepiece" && shown.metrics.magnification
                ? `${Math.round(shown.metrics.magnification.value)}× · field ${METRIC_PRESENTATION.trueFov.format(shown.metrics.trueFov)}`
                : shown?.mode === "camera"
                  ? `${METRIC_PRESENTATION.imageScale.format(shown.metrics.imageScale)} · ${exposureS ?? 0} s at ${gain}× gain`
                  : "",
              `${sky.site.name} · ${formatDateTime(sky.at, sky.site.timeZone)}`,
              ideal ? "Ideal conditions (pristine dark sky, excellent seeing)" : `Sky ${evaluation.sky.mag.toFixed(1)} mag/″² · ${sky.source === "live" ? "live forecast" : "conditions set by hand"}`,
            ].filter(Boolean)}
            onSave={saveSession}
          />

        </main>

        {/*
          On wide screens this column takes the height the other two set
          (h-0 + min-h-full: it fills the row without making it taller), and
          the tab content scrolls inside it, so all three end level.
        */}
        <aside className="order-3 flex flex-col gap-4 lg:col-span-2 xl:col-span-1 xl:h-0 xl:min-h-full xl:overflow-y-auto xl:[scrollbar-width:thin]">
          <SkyControls
            sky={sky}
            evaluation={evaluation}
            targetName={target.name}
            targetVisual={<TargetGlyph target={target} size={18} />}
            ideal={ideal}
            onIdealChange={setIdeal}
          />
          {shown && <QuickResults result={shown} />}
          <SideTabs
            results={
              shown && (
                <div className="space-y-4">
                  {ideal && realResult && <IdealDelta ideal={shown} real={realResult} />}
                  <MetricsPanel result={shown} bare />
                </div>
              )
            }
            sky={<SkyDetails sky={sky} evaluation={evaluation} targetName={target.name} targetVisual={<TargetGlyph target={target} size={40} />} ideal={ideal} />}
            target={<TargetInfo target={shownTarget} positionOfDate={evaluation.target?.eq} />}
            warnings={shown?.warnings.length ?? 0}
          />
        </aside>
      </div>
    </div>
  );
}

/** Quick magnification change: every catalogue eyepiece, as the magnification it gives on this telescope. */
function MagnificationPicker({ config, result }: { config: ConfigurationSpec; result?: SimulationResult }) {
  const f = config.telescope.focalLengthMm;
  const barlow = config.barlow?.factor ?? 1;
  const current = config.eyepiece;
  const match = current && EYEPIECE_CATALOG.find((e) => JSON.stringify(e.spec) === JSON.stringify(current));
  const mag = result?.mode === "eyepiece" ? result.metrics.magnification : undefined;
  if (!f || !Number.isFinite(f)) return null;
  const options = [...EYEPIECE_CATALOG].sort((a, b) => b.spec.focalLengthMm - a.spec.focalLengthMm);
  return (
    <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-sunken/70 pl-3 text-xs text-muted">
      Magnification
      <select
        aria-label="Magnification (choose an eyepiece)"
        value={match?.id ?? "current"}
        onChange={(e) => {
          const entry = EYEPIECE_CATALOG.find((x) => x.id === e.target.value);
          if (entry) updateDraftSpec({ ...config, eyepiece: { ...entry.spec } });
        }}
        className="h-full max-w-36 cursor-pointer truncate rounded-r-lg bg-transparent pr-1 font-mono text-sm text-foreground outline-none"
      >
        {!match && <option value="current">{mag ? `${Math.round(mag.value)}×` : "—"} · custom</option>}
        {options.map((e) => (
          <option key={e.id} value={e.id}>
            {Math.round((f * barlow) / e.spec.focalLengthMm)}× · {e.spec.focalLengthMm} mm {e.spec.apparentFovDeg}°{e.manufacturer ? ` ${e.manufacturer}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

type SideTab = "results" | "sky" | "target";

/** Results, sky details and the target's facts, one at a time beside the view. */
function SideTabs({ results, sky, target, warnings }: { results: React.ReactNode; sky: React.ReactNode; target: React.ReactNode; warnings: number }) {
  const [tab, setTab] = useState<SideTab>("results");
  return (
    <div className="glass flex min-h-[320px] flex-col rounded-2xl p-2 xl:min-h-0 xl:flex-1">
      <Tabs<SideTab>
        label="Details"
        variant="segmented"
        className="flex w-full shrink-0 [&>button]:flex-1"
        value={tab}
        onChange={setTab}
        items={[
          {
            id: "results",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Icons.Chart className="size-4" />
                Results
                {warnings > 0 && (
                  <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-semibold text-warning" title={`${warnings} notes`}>
                    {warnings}
                  </span>
                )}
              </span>
            ),
          },
          { id: "sky", label: <span className="inline-flex items-center gap-1.5"><Icons.Moon className="size-4" />Sky</span> },
          { id: "target", label: <span className="inline-flex items-center gap-1.5"><Icons.Info className="size-4" />Target</span> },
        ]}
      />
      <div
        role="tabpanel"
        tabIndex={0}
        aria-label={tab === "results" ? "Results" : tab === "sky" ? "Sky" : "Target"}
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3 xl:[scrollbar-width:thin]"
      >
        {tab === "results" ? results : tab === "sky" ? sky : <div className="[&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0">{target}</div>}
      </div>
    </div>
  );
}

const QUICK_ICON: Record<string, (p: { className?: string }) => React.ReactNode> = {
  magnification: Icons.Search,
  trueFov: Icons.Cone,
  exitPupil: Icons.Aperture,
  imageScale: Icons.Grid,
  sensorFovWidth: Icons.Cone,
  sensorFovHeight: Icons.Cone,
};

/** The three headline numbers for the current mode, as large tiles. */
function QuickResults({ result }: { result: SimulationResult }) {
  const tiles: [string, Metric | undefined][] =
    result.mode === "eyepiece"
      ? [
          ["magnification", result.metrics.magnification],
          ["trueFov", result.metrics.trueFov],
          ["exitPupil", result.metrics.exitPupil],
        ]
      : [
          ["imageScale", result.metrics.imageScale],
          ["sensorFovWidth", result.metrics.sensorFovWidth],
          ["sensorFovHeight", result.metrics.sensorFovHeight],
        ];
  return (
    <Panel title="Quick results" icon={<Icons.Chart />} actions={<span className="font-mono text-[11px] text-muted">engine v{result.engineVersion}</span>}>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map(([key, m]) => {
          if (!m) return null;
          const p = METRIC_PRESENTATION[key as keyof typeof METRIC_PRESENTATION];
          const Icon = QUICK_ICON[key];
          return (
            <div key={key} title={`${p.label}: ${m.kind}`} className="flex flex-col rounded-xl border border-border bg-surface-sunken/60 px-3 py-2.5">
              <Icon className="size-5 text-accent" />
              <dt className="order-3 mt-0.5 text-[11px] leading-tight text-muted">{p.label}</dt>
              <dd className="order-2 mt-2 whitespace-nowrap font-mono text-lg font-medium tabular-nums sm:text-xl">{p.format(m)}</dd>
            </div>
          );
        })}
      </dl>
    </Panel>
  );
}

/**
 * The view's card: mode switch, headline readout, fullscreen and a PNG
 * the view's own tools. Children get the largest size to draw at.
 */
function ViewCard({
  mode,
  onModeChange,
  result,
  footer,
  readout: readoutNode,
  children,
}: {
  mode: SimulationMode;
  onModeChange: (m: SimulationMode) => void;
  result?: SimulationResult;
  /** Controls for the view (focus, exposure…), in their own card below it. */
  footer?: React.ReactNode;
  /** Replaces the headline readout (e.g. a magnification picker). */
  readout?: React.ReactNode;
  children: (maxSizePx: number | undefined) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [screen, setScreen] = useState(0);
  // Narrow screens: size the view so its controls stay on screen (320–560 px).
  const [fit, setFit] = useState(520);
  useEffect(() => {
    const onResize = () => setFit(Math.max(320, Math.min(560, window.innerHeight - 570)));
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Big screens (the "fill" layout): the workspace fills the window, so draw the view as large as
  // the space left in this card allows, after the credit lines under it.
  const slot = useRef<HTMLDivElement>(null);
  const [slotFit, setSlotFit] = useState<number>();
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const wide = window.matchMedia("(min-width: 1280px) and (min-height: 800px)");
    const measure = () => {
      if (!wide.matches) return setSlotFit(undefined);
      const content = el.firstElementChild as HTMLElement | null;
      const canvas = el.querySelector("canvas");
      const extras = content && canvas ? content.offsetHeight - canvas.offsetHeight : 40;
      const next = Math.round(Math.max(240, Math.min(1000, el.clientHeight - extras - 16)));
      setSlotFit((prev) => (prev !== undefined && Math.abs(prev - next) < 4 ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    wide.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", measure);
    };
  }, []);
  useEffect(() => {
    const onChange = () => {
      setFull(document.fullscreenElement === ref.current);
      setScreen(Math.min(window.innerWidth - 48, window.innerHeight - 150));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen())?.catch(() => {});
  const readout =
    result?.mode === "eyepiece"
      ? ["Magnification", result.metrics.magnification && METRIC_PRESENTATION.magnification.format(result.metrics.magnification)]
      : result?.mode === "camera"
        ? ["Image scale", result.metrics.imageScale && METRIC_PRESENTATION.imageScale.format(result.metrics.imageScale)]
        : undefined;
  const iconButton = "flex size-9 items-center justify-center rounded-lg border border-border bg-surface-sunken/70 text-muted transition-colors hover:border-border-strong hover:text-foreground";

  return (
    <>
    <div
      ref={ref}
      className={`glass flex min-h-0 flex-1 flex-col rounded-2xl bg-[radial-gradient(circle_at_50%_55%,rgba(81,98,255,0.10),transparent_60%)] p-3 sm:p-4 ${full ? "overflow-auto bg-background" : ""}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Tabs<SimulationMode>
          label="Simulation mode"
          variant="segmented"
          value={mode}
          onChange={onModeChange}
          items={[
            {
              id: "eyepiece",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icons.Eye className="size-4" />
                  Eyepiece view
                </span>
              ),
            },
            {
              id: "camera",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icons.Camera className="size-4" />
                  Camera view
                </span>
              ),
            },
          ]}
        />
        <div className="flex items-center gap-2">
          {readoutNode ?? (readout?.[1] && (
            <span className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface-sunken/70 px-3 text-xs text-muted sm:inline-flex">
              {readout[0]} <span className="font-mono text-sm text-foreground">{readout[1]}</span>
            </span>
          ))}
          <button type="button" onClick={toggleFull} className={iconButton} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
            <Icons.Expand className="size-[18px]" />
          </button>

        </div>
      </div>
      <div ref={slot} className="flex min-h-0 flex-1 [&>*]:my-auto">
        {children(full && screen > 0 ? screen : (slotFit ?? fit))}
      </div>
    </div>
    {footer && (
      <section aria-label="View controls" className="glass rounded-2xl px-4 py-3">
        {footer}
      </section>
    )}
    </>
  );
}

/** With "Ideal conditions" on: what tonight's real conditions cost, metric by metric. */
function IdealDelta({ ideal, real }: { ideal: SimulationResult; real: SimulationResult }) {
  const rows: [string, (p: { className?: string }) => React.ReactNode, Metric | undefined, Metric | undefined, (v: number) => string][] = [
    ["Faintest star", Icons.Star, ideal.metrics.limitingMagnitude, real.metrics.limitingMagnitude, (v) => `mag ${formatNumber(v, 1)}`],
    ["Sky", Icons.Sun, ideal.metrics.skyBrightness, real.metrics.skyBrightness, (v) => `${formatNumber(v, 1)} mag/″²`],
    ["Sharpest detail", Icons.Crosshair, ideal.metrics.effectiveResolution, real.metrics.effectiveResolution, (v) => `${formatNumber(v, 2)}″`],
    ["Dimming", Icons.Cone, ideal.metrics.extinction, real.metrics.extinction, (v) => `${formatNumber(v, 2)} mag`],
  ];
  return (
    <section className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-3" aria-label="Ideal conditions vs. your sky now">
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <Icons.Sparkles className="size-[18px] text-accent" />
        Ideal conditions vs. your sky now
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, Icon, a, b, fmt]) =>
          a && b ? (
            <div key={label} className="flex items-start gap-2.5">
              <Icon className="mt-1 size-5 shrink-0 text-accent" />
              <div className="min-w-0">
                <dt className="text-[11px] text-muted">{label}</dt>
                <dd className="font-mono text-[13px] tabular-nums">
                  {fmt(a.value)} <span className="text-muted">→</span> <span className="text-warning">{fmt(b.value)}</span>
                </dd>
              </div>
            </div>
          ) : null,
        )}
      </dl>
    </section>
  );
}
