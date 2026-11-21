"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { formatTime } from "@/lib/time-zone";
import { useWorkingDraft } from "@/modules/lab/use-lab-draft";
import type { SimulationMode } from "@/modules/simulations/engine";
import { evaluateSky } from "@/modules/sky/conditions";
import { planTonight, type TonightEntry, type TonightGroup } from "@/modules/sky/tonight";
import { updateSkyPrefs, useSkyContext } from "@/modules/sky/use-sky-setting";
import { hourAt } from "@/modules/sky/weather";
import { getTarget } from "@/modules/targets/catalogue";
import type { Reach } from "@/modules/targets/reach";
import { SkyPanel } from "./sky-panel";

const GROUPS: { id: TonightGroup; title: string; blurb: string }[] = [
  { id: "great", title: "Great tonight", blurb: "Well placed and should look good with your setup under these conditions." },
  { id: "possible", title: "Possible", blurb: "Up tonight but faint, low or washed out: worth a try." },
  { id: "not-tonight", title: "Not tonight", blurb: "Down all night, too low, or lost in the sky glow or cloud." },
];

const REACH_LABEL: Record<Reach, string> = { good: "Good", challenging: "Challenging", out_of_reach: "Out of reach" };
const REACH_TONE: Record<Reach, string> = {
  good: "border-success/40 bg-success/10 text-success",
  challenging: "border-warning/40 bg-warning/10 text-warning",
  out_of_reach: "border-border text-muted",
};

export function TonightPlanner({ initialMode }: { initialMode: SimulationMode }) {
  // Your current Lab setup (a default one if you haven't made one yet).
  const { draft } = useWorkingDraft();
  const hydrated = Boolean(draft);
  const sky = useSkyContext();
  const [mode, setMode] = useState<SimulationMode>(initialMode);
  const [showAll, setShowAll] = useState(false);
  const spec = draft?.spec;
  const forecast = sky.forecast.status === "ready" ? sky.forecast.forecast : undefined;
  const { setting, site } = sky;
  // Re-plan when the hour (not every clock tick) or anything else changes.
  const hourKey = Math.floor(setting.at.getTime() / 3_600_000);
  const plan = useMemo(
    () => {
      if (!spec) return undefined;
      const weatherAt = sky.source === "live" && forecast ? (d: Date) => {
        const h = hourAt(forecast, d);
        return h && { cloud: h.cloud, humidity: h.humidity, aod: h.aod, seeingArcsec: h.seeingArcsec };
      } : undefined;
      return planTonight(setting, spec, mode, undefined, weatherAt);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, mode, hourKey, site, setting.bortle, setting.weather, forecast, sky.source],
  );
  const moonEval = useMemo(() => evaluateSky(setting, getTarget("moon")!), [setting]);

  if (!hydrated || !spec || !plan) {
    return (
      <main className="mx-auto max-w-[1200px] space-y-4 px-4 py-6" aria-busy>
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </main>
    );
  }

  const tz = site.timeZone;
  const { night } = plan;
  const cloudHours =
    forecast && night.sunset && night.sunrise
      ? forecast.hours.filter((h) => h.time.getTime() >= night.sunset!.getTime() - 3_600_000 && h.time.getTime() <= night.sunrise!.getTime())
      : [];

  return (
    <main className="mx-auto max-w-[1200px] space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Telescope Lab</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">What&apos;s up tonight</h1>
          <p className="mt-1 text-sm text-muted">
            From {site.name} with <span className="text-foreground">{spec.name}</span>: what&apos;s up, when, and how it will look.
          </p>
        </div>
        <Tabs<SimulationMode>
          label="Observing with"
          variant="segmented"
          value={mode}
          onChange={setMode}
          items={[
            { id: "eyepiece", label: "Eyepiece" },
            { id: "camera", label: "Camera" },
          ]}
        />
      </header>

      <SkyPanel sky={sky} evaluation={moonEval} ideal={false} compact />

      <section className="glass rounded-xl p-4" aria-label="The night">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Fact label="Sunset" value={formatTime(night.sunset, tz)} />
          <Fact label="Fully dark" value={night.darkStart && night.darkEnd ? `${formatTime(night.darkStart, tz)} – ${formatTime(night.darkEnd, tz)}` : "Never fully dark"} />
          <Fact label="Sunrise" value={formatTime(night.sunrise, tz)} />
          <Fact label="Moon" value={`${moonEval.moonPhase.name}, ${Math.round(moonEval.moonPhase.illuminated * 100)}% lit`} />
        </div>
        {cloudHours.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 flex items-center gap-2 text-xs text-muted">
              Cloud cover through the night <ProvenanceBadge kind="retrieved" />
            </p>
            <div className="flex h-12 items-end gap-0.5" role="img" aria-label={`Hourly cloud cover: ${cloudHours.map((h) => `${formatTime(h.time, tz)} ${Math.round(h.cloud * 100)}%`).join(", ")}`}>
              {cloudHours.map((h) => (
                <div key={h.time.toISOString()} className="flex flex-1 flex-col items-center gap-0.5" title={`${formatTime(h.time, tz)}: ${Math.round(h.cloud * 100)}% cloud`}>
                  <div className="w-full rounded-sm bg-foreground/35" style={{ height: `${Math.max(4, h.cloud * 40)}px` }} />
                </div>
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-subtle">
              <span>{formatTime(cloudHours[0].time, tz)}</span>
              <span>{formatTime(cloudHours[cloudHours.length - 1].time, tz)}</span>
            </div>
          </div>
        )}
      </section>

      {GROUPS.map((g) => {
        const all = plan.entries.filter((e) => e.group === g.id);
        if (all.length === 0) return null;
        const collapsed = g.id === "not-tonight" && !showAll;
        return (
          <section key={g.id} aria-label={g.title} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {g.title} <span className="text-sm font-normal text-muted">{all.length}</span>
              </h2>
              {g.id === "not-tonight" && (
                <button type="button" className="text-sm text-accent hover:underline" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Hide" : "Show"}
                </button>
              )}
            </div>
            <p className="text-xs text-muted">{g.blurb}</p>
            {!collapsed && (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
                {all.map((e) => (
                  <EntryCard key={e.target.id} entry={e} tz={tz} mode={mode} night={plan.night} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="text-xs text-subtle">
        Positions and times <ProvenanceBadge kind="calculated" /> for {site.name}. How each target looks is <ProvenanceBadge kind="estimated" /> from
        your setup, the sky brightness (light pollution, Moon, twilight), haze and cloud at its best time.
      </p>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-subtle">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function EntryCard({ entry: e, tz, mode, night }: { entry: TonightEntry; tz: string; mode: SimulationMode; night: { sunset?: Date; sunrise?: Date } }) {
  const best = e.best;
  return (
    <li className="glass flex flex-col gap-2 rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {e.target.name}
            {e.target.designation && <span className="ml-1.5 text-sm font-normal text-muted">{e.target.designation}</span>}
          </p>
          <p className="text-xs text-muted">
            {best ? `Best ${formatTime(best.at, tz)} · ${Math.round(best.altDeg)}° up in the ${best.direction}` : e.note}
            {e.rise && ` · rises ${formatTime(e.rise, tz)}`}
            {e.set && ` · sets ${formatTime(e.set, tz)}`}
          </p>
        </div>
        <Sparkline curve={e.curve} best={best?.at} night={night} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full border px-2 py-0.5 ${REACH_TONE[e.reach.reach]}`}>Tonight: {REACH_LABEL[e.reach.reach]}</span>
        <span className={`rounded-full border px-2 py-0.5 ${REACH_TONE[e.idealReach.reach]}`}>Ideal sky: {REACH_LABEL[e.idealReach.reach]}</span>
      </div>
      {e.reach.reasons[0] && <p className="text-xs text-muted">{e.reach.reasons[0]}</p>}
      {best && (
        <div>
          <Link
            href={`/lab/simulate?target=${e.target.id}&mode=${mode}`}
            onClick={() => updateSkyPrefs({ timeMode: "fixed", fixedAt: best.at.toISOString() })}
            className={buttonStyles({ size: "sm" })}
          >
            Simulate at {formatTime(best.at, tz)} →
          </Link>
        </div>
      )}
    </li>
  );
}

/** Altitude through the night: the horizon as a baseline, the best time marked. */
function Sparkline({ curve, best, night }: { curve: TonightEntry["curve"]; best?: Date; night: { sunset?: Date; sunrise?: Date } }) {
  if (curve.length < 2) return null;
  const w = 120;
  const h = 36;
  const t0 = curve[0].t;
  const t1 = curve[curve.length - 1].t;
  const x = (t: number) => ((t - t0) / (t1 - t0)) * w;
  const y = (alt: number) => h - 2 - (Math.max(-10, alt) + 10) * ((h - 4) / 100);
  const d = curve.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.altDeg).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      {night.sunset && night.sunrise && <rect x={x(night.sunset.getTime())} width={x(night.sunrise.getTime()) - x(night.sunset.getTime())} y={0} height={h} fill="rgba(81,98,255,0.08)" />}
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.2)" strokeDasharray="2 3" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-accent" />
      {best && <circle cx={x(best.getTime())} cy={y(curve.reduce((m, p) => (Math.abs(p.t - best.getTime()) < Math.abs(m.t - best.getTime()) ? p : m)).altDeg)} r={2.5} fill="#fff" />}
    </svg>
  );
}
