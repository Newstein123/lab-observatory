"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { NumberField, Panel, RangeField, SelectField } from "@/components/ui/fields";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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
import { assessReach } from "@/modules/targets/reach";
import { ConfigurationPanel, type FieldErrors } from "./configuration-panel";
import { LabToolbar } from "./lab-toolbar";
import { MetricsPanel } from "./metrics-panel";
import { SimulationViewport, type ViewSettings } from "./simulation-viewport";
import { TargetInfo } from "./target-info";
import { TargetPicker } from "./target-picker";

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
  const [seeingEnabled, setSeeingEnabled] = useState(true);
  const [seeingArcsec, setSeeingArcsec] = useState(2);
  const [exposureS, setExposureS] = useState<number | undefined>(target.suggestedExposureS);
  const [gain, setGain] = useState(1);
  const [tracking, setTracking] = useState<TrackingMode>(config.mount && config.mount.tracking === false ? "none" : "sidereal");
  const [focusOffset, setFocusOffset] = useState(0);
  const [longExposureColor, setLongExposureColor] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString());
  const zoom = 2 ** zoomStep;
  const savedId = draft.saved?.id;

  // Keep the URL pointing at the saved configuration once there is one.
  useEffect(() => {
    if (savedId) syncUrl(target.id, mode, savedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  const outcome: Outcome = useMemo(() => {
    try {
      const input = toSimulationInput({
        configuration: config,
        target: toTargetExtent(target),
        mode,
        conditions: seeingEnabled ? { seeingArcsec } : {},
        exposure: { exposureS: exposureS as number, gain, ...(tracking === "none" ? { tracking } : {}) },
      });
      return { result: simulate(input) };
    } catch (e) {
      if (!(e instanceof SimulationInputError)) throw e;
      const errors: FieldErrors = {};
      for (const issue of e.issues) errors[issue.path] ??= friendlyMessage(issue.message);
      return { errors };
    }
  }, [config, target, mode, seeingEnabled, seeingArcsec, exposureS, gain, tracking]);

  // Keep the last valid result visible (dimmed) while inputs are being edited.
  const [lastValid, setLastValid] = useState<SimulationResult | undefined>(outcome.result);
  if (outcome.result && outcome.result !== lastValid) setLastValid(outcome.result);
  const shown = outcome.result ?? lastValid;
  const errors = outcome.errors ?? {};

  const settings: ViewSettings = useMemo(
    () => ({ focusOffset, longExposureColor, zoom, gain, exposureS: exposureS ?? 0, filterKind: config.filter?.kind, observedAt }),
    [focusOffset, longExposureColor, zoom, gain, exposureS, config.filter?.kind, observedAt],
  );

  const chooseTarget = (t: CuratedTarget) => {
    setTarget(t);
    setExposureS(t.suggestedExposureS);
    syncUrl(t.id, mode, savedId);
  };
  const setMode = (m: SimulationMode) => {
    setModeState(m);
    syncUrl(target.id, m, savedId);
  };

  const saveSession = () =>
    getRepository().createSession(
      buildSession({
        configuration: config,
        configurationRef: draft.saved ? { id: draft.saved.id, version: draft.saved.version, modified: isDraftDirty(draft) } : undefined,
        target,
        mode,
        conditions: seeingEnabled ? { seeingArcsec } : {},
        exposure: exposureS === undefined ? undefined : { exposureS, gain, ...(tracking === "none" ? { tracking } : {}) },
        view: { focusOffset, longExposureColor, zoom, observedAt },
      }),
    );

  const assess = useCallback((t: CuratedTarget) => assessReach(t, config, mode), [config, mode]);
  const deepSky = Boolean(target.coordinatesJ2000);
  const missingComponent = errors.eyepiece ?? errors.camera;
  const compareHref = `/lab/compare?target=${target.id}&mode=${mode}${savedId ? `&a=${savedId}` : ""}`;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-4 py-6">
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
        actions={
          <>
            <Link href="/lab/configure" className={buttonStyles({ variant: "ghost", size: "sm" })}>
              Equipment
            </Link>
            <Link href={compareHref} className={buttonStyles({ size: "sm" })}>
              Compare →
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="order-2 lg:order-1">
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

        <main className="order-1 min-w-0 space-y-4 lg:order-2">
          <TargetPicker
            value={target}
            onChange={chooseTarget}
            assess={assess}
            toolbar={
              <Tabs<SimulationMode>
                label="Simulation mode"
                variant="segmented"
                value={mode}
                onChange={setMode}
                items={[
                  { id: "eyepiece", label: "Eyepiece view" },
                  { id: "camera", label: "Camera view" },
                ]}
              />
            }
          />

          <div className="glass rounded-2xl bg-[radial-gradient(circle_at_50%_45%,rgba(81,98,255,0.10),transparent_60%)] p-3 sm:p-5">
            {shown ? (
              <SimulationViewport
                result={shown}
                target={target}
                settings={settings}
                onObservedAtChange={setObservedAt}
                stale={!outcome.result || shown.mode !== mode || shown.targetId !== target.id}
              />
            ) : (
              <p className="p-8 text-center text-sm text-danger">{missingComponent ?? "Check the configuration inputs."}</p>
            )}
          </div>

          <Panel title="Observation controls">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={seeingEnabled} onChange={(e) => setSeeingEnabled(e.target.checked)} className="accent-accent" />
                  Include atmospheric seeing
                </label>
                {seeingEnabled && (
                  <RangeField
                    label="Seeing (FWHM)"
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={seeingArcsec}
                    onChange={setSeeingArcsec}
                    display={`${formatNumber(seeingArcsec, 1)}″`}
                  />
                )}
                {mode === "eyepiece" && (
                  <RangeField
                    label="Focus"
                    min={0}
                    max={1}
                    step={0.05}
                    value={focusOffset}
                    onChange={setFocusOffset}
                    display={focusOffset === 0 ? "In focus" : `${Math.round(focusOffset * 100)}% off`}
                  />
                )}
              </div>

              {mode === "eyepiece" ? (
                <div className="space-y-3">
                  {deepSky ? (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={longExposureColor}
                        onChange={(e) => setLongExposureColor(e.target.checked)}
                        className="mt-0.5 accent-accent"
                      />
                      <span>
                        Show the long-exposure photograph
                        <span className="block text-xs text-muted">
                          Off: stars from star catalogues down to your telescope&apos;s limit, over the object in grey, as the
                          eye sees it. On: the full survey photograph, with far more stars and colour than the eye sees.
                        </span>
                      </span>
                    </label>
                  ) : (
                    <p className="text-xs text-muted">Focus blur is illustrative. Seeing blur is estimated from the FWHM you set.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <NumberField
                    label="Exposure"
                    unit="s"
                    step={0.001}
                    value={exposureS}
                    error={errors["exposure.exposureS"]}
                    onChange={setExposureS}
                    hint={`Suggested for ${target.name}: ${target.suggestedExposureS} s`}
                  />
                  <RangeField label="Gain" min={1} max={64} step={1} value={gain} onChange={setGain} display={`${gain}×`} />
                  <SelectField<TrackingMode>
                    label="Tracking"
                    value={tracking}
                    onChange={setTracking}
                    options={[
                      { value: "sidereal", label: "Sidereal tracking (motorised mount)" },
                      { value: "none", label: "No tracking (sky drifts)" },
                    ]}
                  />
                  <RangeField label="Zoom (crop)" min={0} max={6} step={1} value={zoomStep} onChange={setZoomStep} display={`${zoom}×`} />
                </div>
              )}
            </div>
          </Panel>

          <TargetInfo target={target} />
        </main>

        <aside className="order-3 space-y-4 lg:col-span-2 xl:col-span-1">
          {shown && <KeyMetrics result={shown} />}
          {shown && <MetricsPanel result={shown} />}
        </aside>
      </div>
    </div>
  );
}

/** The three headline numbers for the current mode, as large tiles. */
function KeyMetrics({ result }: { result: SimulationResult }) {
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
    <dl className="grid grid-cols-3 gap-2 xl:grid-cols-1">
      {tiles.map(([key, m]) =>
        m ? (
          <div key={key} className="glass rounded-xl px-3 py-2.5">
            <dt className="flex items-center justify-between gap-1 text-[11px] text-muted">
              <span className="truncate">{METRIC_PRESENTATION[key as keyof typeof METRIC_PRESENTATION].label}</span>
              <span className="hidden sm:inline">
                <ProvenanceBadge kind={m.kind} />
              </span>
            </dt>
            <dd className="mt-0.5 font-mono text-xl tabular-nums sm:text-2xl">
              {METRIC_PRESENTATION[key as keyof typeof METRIC_PRESENTATION].format(m)}
            </dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}
