"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SimulationViewport, type ViewSettings } from "@/components/lab/simulation-viewport";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatAngleArcsec, formatNumber } from "@/lib/format";
import { toSimulationInput } from "@/modules/configurations/models";
import { DEFAULT_CONFIGURATION, EYEPIECE_PRESETS } from "@/modules/configurations/presets";
import { simulate } from "@/modules/simulations/engine";
import { getTarget, toTargetExtent } from "@/modules/targets/catalogue";

/**
 * A live, real-engine demo: the Moon through a 200 mm f/5 telescope with a
 * choice of eyepieces. Same calculations and renderer as the Telescope Lab.
 */

const MOON = getTarget("moon")!;
const SETTINGS: ViewSettings = { focusOffset: 0, longExposureColor: false, zoom: 1, gain: 1, exposureS: 0 };

export function EyepieceDemo() {
  const [eyepieceId, setEyepieceId] = useState("ep-25-50");
  const eyepiece = EYEPIECE_PRESETS.find((e) => e.id === eyepieceId)!;

  const result = useMemo(
    () =>
      simulate(
        toSimulationInput({
          configuration: { ...DEFAULT_CONFIGURATION, eyepiece: eyepiece.spec },
          target: toTargetExtent(MOON),
          mode: "eyepiece",
          conditions: { seeingArcsec: 2 },
        }),
      ),
    [eyepiece],
  );
  if (result.mode !== "eyepiece") return null;
  const m = result.metrics;

  return (
    <div className="glass rounded-2xl p-4 shadow-2xl shadow-black/50 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">The Moon · 200 mm f/5 Newtonian</p>
        <p className="text-xs text-muted">Live, using the Lab&apos;s engine</p>
      </div>

      <div className="mt-3 rounded-xl bg-black p-2">
        <SimulationViewport result={result} target={MOON} settings={SETTINGS} stale={false} />
      </div>

      <div role="group" aria-label="Eyepiece" className="mt-4 flex flex-wrap gap-1.5">
        {EYEPIECE_PRESETS.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={e.id === eyepieceId}
            onClick={() => setEyepieceId(e.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              e.id === eyepieceId
                ? "border-accent bg-accent/15 text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {e.spec.focalLengthMm} mm eyepiece
          </button>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Magnification" value={`${formatNumber(m.magnification.value, 0)}×`} />
        <Stat label="True field" value={formatAngleArcsec(m.trueFov.value * 3600)} />
        <Stat label="Exit pupil" value={`${formatNumber(m.exitPupil.value, 1)} mm`} />
      </dl>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
        <ProvenanceBadge kind="calculated" />
        <code className="font-mono">{m.magnification.formula}</code>
        <span>=</span>
        <span className="font-mono">
          {m.effectiveFocalLength.value} / {eyepiece.spec.focalLengthMm}
        </span>
      </p>
      <Link
        href="/lab/simulate?target=moon"
        className="mt-4 block rounded-lg border border-border-strong py-2 text-center text-sm transition-colors hover:border-accent"
      >
        Try your own setup →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-sunken/80 px-2 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-mono text-base tabular-nums">{value}</dd>
    </div>
  );
}
