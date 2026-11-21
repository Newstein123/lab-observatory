"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { inputClass, RangeField, SelectField } from "@/components/ui/fields";
import { Icons } from "@/components/ui/icons";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { formatDateTime, formatTime, fromZonedInput, toZonedInput, zoneLabel } from "@/lib/time-zone";
import type { SkyEvaluation } from "@/modules/sky/conditions";
import { altitudeFn, bodyEvents, HORIZON_MOON, nightWindow } from "@/modules/sky/events";
import { moonPosition, nextLunarPhase, topocentric } from "@/modules/sky/moon";
import { searchSites } from "@/modules/sky/sites";
import { BORTLE, HAZE, nakedEyeLimit, type HazeLevel } from "@/modules/sky/sky-brightness";
import { TWILIGHT_LABEL, type Twilight } from "@/modules/sky/sun";
import { updateSkyPrefs, type SkyContext } from "@/modules/sky/use-sky-setting";
import { MoonPhaseIcon } from "./moon-phase-icon";

const SOURCE_LABEL: Record<string, string> = {
  natural: "natural sky glow",
  "light pollution": "light pollution",
  moonlight: "moonlight",
  twilight: "twilight",
};

export function SkyPanel({
  sky,
  evaluation,
  targetName,
  ideal,
  onIdealChange,
  compact = false,
  targetVisual,
}: {
  sky: SkyContext;
  evaluation?: SkyEvaluation;
  targetName?: string;
  ideal: boolean;
  onIdealChange?: (on: boolean) => void;
  /** Hide the per-target summary (e.g. on the Tonight page). */
  compact?: boolean;
  /** A small picture of the target for its summary tile. */
  targetVisual?: React.ReactNode;
}) {
  const { prefs, site, at } = sky;
  const tz = site.timeZone;

  return (
    <section className="glass space-y-4 rounded-2xl p-4" aria-label="Sky and location">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Icons.Pin className="size-[18px] text-accent" />
          Sky &amp; location
        </h2>
        {onIdealChange && <IdealSwitch on={ideal} onChange={onIdealChange} />}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <SitePicker siteName={site.kind === "dark-site" ? `${site.name} (dark site)` : site.name} country={site.country} />
        <TimePicker at={at} timeZone={tz} live={prefs.timeMode === "now"} />
      </div>

      {evaluation && <SkySummary evaluation={evaluation} sky={sky} targetName={compact ? undefined : targetName} targetVisual={targetVisual} ideal={ideal} />}

      <Conditions sky={sky} />
    </section>
  );
}

/**
 * The scene, kept in view next to the simulation: where, when, and the
 * ideal-conditions switch, with a one-line summary of the sky.
 */
export function SkyControls({
  sky,
  evaluation,
  targetName,
  targetVisual,
  ideal,
  onIdealChange,
}: {
  sky: SkyContext;
  evaluation: SkyEvaluation;
  targetName: string;
  targetVisual?: React.ReactNode;
  ideal: boolean;
  onIdealChange: (on: boolean) => void;
}) {
  const { prefs, site, at } = sky;
  const { moonPhase: phase, moon, target } = evaluation;
  const chip = "inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-surface-sunken/50 py-1 pl-1.5 pr-2.5";
  return (
    <section className="glass space-y-3 rounded-2xl p-4" aria-label="Sky and location">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Icons.Nebula className="size-[18px] text-accent" />
          Sky &amp; Time
        </h2>
        <IdealSwitch on={ideal} onChange={onIdealChange} />
      </div>
      <SitePicker siteName={site.kind === "dark-site" ? `${site.name} (dark site)` : site.name} country={site.country} bare />
      <TimePicker at={at} timeZone={site.timeZone} live={prefs.timeMode === "now"} bare />
      <ul aria-label="The sky now" className="flex flex-wrap gap-1.5 text-xs">
        <li className={chip} title={`${phase.name}, ${Math.round(phase.illuminated * 100)}% lit, ${moon.aboveHorizon ? "above" : "below"} the horizon`}>
          <MoonPhaseIcon illuminated={phase.illuminated} brightLimbDeg={moon.phase?.brightLimbZenithDeg ?? 90} size={18} />
          <span className="truncate">
            Moon {Math.round(phase.illuminated * 100)}% · {moon.aboveHorizon ? "up" : "down"}
          </span>
        </li>
        <li className={`${chip} ${target && !target.aboveHorizon ? "border-warning/40 text-warning" : ""}`}>
          {targetVisual}
          <span className="truncate">
            {targetName} {target ? (target.aboveHorizon ? `${target.apparentAltDeg.toFixed(0)}° ${target.direction}` : "down") : ""}
          </span>
        </li>
        <li className={chip} title={TWILIGHT_LABEL[evaluation.twilight]}>
          <SkyGradient twilight={evaluation.twilight} small />
          <span className="truncate">{ideal ? "Sky 21.9 (ideal)" : evaluation.twilight === "night" ? `Sky ${evaluation.sky.mag.toFixed(1)}` : TWILIGHT_LABEL[evaluation.twilight]}</span>
        </li>
      </ul>
    </section>
  );
}

/** Everything else about the sky: the summary tiles, light pollution and weather. */
export function SkyDetails({
  sky,
  evaluation,
  targetName,
  targetVisual,
  ideal,
}: {
  sky: SkyContext;
  evaluation: SkyEvaluation;
  targetName: string;
  targetVisual?: React.ReactNode;
  ideal: boolean;
}) {
  return (
    <section className="space-y-4" aria-label="Sky conditions">
      <SkySummary evaluation={evaluation} sky={sky} targetName={targetName} targetVisual={targetVisual} ideal={ideal} stacked />
      <Conditions sky={sky} stacked />
    </section>
  );
}

function IdealSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      title="Show the best case: a pristine dark sky, no Moon or cloud, excellent seeing, the target at its highest"
      className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-colors ${on ? "border-accent/60 bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"}`}
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-accent-strong" : "bg-surface-sunken ring-1 ring-border-strong"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      Ideal conditions
    </button>
  );
}

function SitePicker({ siteName, country, bare = false }: { siteName: string; country: string; bare?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [geoError, setGeoError] = useState<string>();
  const results = useMemo(() => searchSites(query, 8), [query]);

  const useMyLocation = () => {
    setGeoError(undefined);
    if (!navigator.geolocation) return setGeoError("Location isn't available in this browser.");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        updateSkyPrefs({
          siteId: "custom",
          custom: { latDeg: p.coords.latitude, lonDeg: p.coords.longitude, name: "My location", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          bortle: undefined,
        }),
      () => setGeoError("Couldn't get your location. Choose a city instead."),
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  return (
    <div className="relative space-y-1">
      <label htmlFor={id} className={bare ? "sr-only" : "block text-xs text-muted"}>
        Location
      </label>
      <div className="relative">
      {bare ? (
        <Icons.Pin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      ) : (
        <Icons.Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      )}
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        autoComplete="off"
        placeholder={`${siteName}${country ? `, ${country}` : ""}`}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={`${inputClass} pl-9 pr-36 placeholder:text-foreground`}
      />
      <button
        type="button"
        onClick={useMyLocation}
        className={`absolute right-1 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-accent hover:bg-accent/10 ${bare ? "border border-border-strong text-foreground" : ""}`}
      >
        <Icons.Locate className="size-3.5" />
        Use my location
      </button>
      </div>
      {open && results.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface-raised p-1 shadow-xl">
          {results.map((s) => (
            <li key={s.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  updateSkyPrefs({ siteId: s.id, bortle: undefined });
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/15"
              >
                <span>
                  {s.name}
                  <span className="text-muted">, {s.country}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted">{s.kind === "dark-site" ? "Dark site" : `Bortle ${s.bortle}`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {geoError && <p className="text-xs text-warning">{geoError}</p>}
    </div>
  );
}

function TimePicker({ at, timeZone, live, bare = false }: { at: Date; timeZone: string; live: boolean; bare?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={bare ? "sr-only" : "flex justify-between text-xs text-muted"}>
        <span>
          Date &amp; time <span className="text-subtle">({zoneLabel(at, timeZone)})</span>
        </span>
        {!bare && <NowControl live={live} />}
      </label>
      <div className="relative">
      <Icons.Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        id={id}
        type="datetime-local"
        value={toZonedInput(at, timeZone)}
        onChange={(e) => {
          const d = fromZonedInput(e.target.value, timeZone);
          if (d) updateSkyPrefs({ timeMode: "fixed", fixedAt: d.toISOString() });
        }}
        className={`${inputClass} pl-9 font-mono ${bare ? "pr-24" : ""}`}
      />
      {bare && (
        <span className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">{zoneLabel(at, timeZone)}</span>
      )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {bare && <NowControl live={live} chip />}
        {[
          ["Tonight 21:00", 21],
          ["Midnight", 24],
          ["Before dawn", 28],
        ].map(([label, hour]) => (
          <button
            key={label}
            type="button"
            className="rounded-full border border-border bg-surface-sunken/50 px-2.5 py-0.5 text-[11px] text-muted hover:border-accent/60 hover:text-foreground"
            onClick={() => {
              const base = toZonedInput(at, timeZone).slice(0, 10);
              const d = fromZonedInput(`${base}T00:00`, timeZone);
              if (d) updateSkyPrefs({ timeMode: "fixed", fixedAt: new Date(d.getTime() + (hour as number) * 3_600_000).toISOString() });
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NowControl({ live, chip = false }: { live: boolean; chip?: boolean }) {
  const cls = chip ? "rounded-full border px-2.5 py-0.5 text-[11px]" : "";
  return live ? (
    <span className={`inline-flex items-center gap-1 text-success ${chip ? `${cls} border-success/40` : ""}`}>
      <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
    </span>
  ) : (
    <button
      type="button"
      onClick={() => updateSkyPrefs({ timeMode: "now", fixedAt: undefined })}
      className={chip ? `${cls} border-accent/50 text-accent hover:bg-accent/10` : "text-accent hover:underline"}
    >
      Now
    </button>
  );
}

function SkySummary({
  evaluation,
  sky,
  targetName,
  targetVisual,
  ideal,
  stacked = false,
}: {
  evaluation: SkyEvaluation;
  sky: SkyContext;
  targetName?: string;
  targetVisual?: React.ReactNode;
  ideal: boolean;
  /** One tile per row (for a narrow side column). */
  stacked?: boolean;
}) {
  const { site, at } = sky;
  const tz = site.timeZone;
  const { moon, moonPhase: phase, target } = evaluation;
  const moonTimes = useMemo(() => {
    const { start, end } = nightWindow(at, site);
    const alt = altitudeFn((d) => {
      const m = moonPosition(d);
      return topocentric(m, m.distanceKm, site, d);
    }, site);
    const ev = bodyEvents(alt, HORIZON_MOON, start, end);
    return { rise: ev.rise, set: ev.set, full: nextLunarPhase(at, 180), next: nextLunarPhase(at, 0) };
    // Recompute per hour, not per tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, Math.floor(at.getTime() / 3_600_000)]);
  const nelm = nakedEyeLimit(evaluation.sky.mag);

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-2 ${stacked ? "" : "sm:grid-cols-3"}`}>
      <Tile label="Sky" visual={<SkyGradient twilight={evaluation.twilight} />}>
        <p className="font-medium">{TWILIGHT_LABEL[evaluation.twilight]}</p>
        <p className="text-xs text-muted">
          {formatDateTime(at, tz)} · Sun {evaluation.sunAltDeg.toFixed(0)}°
        </p>
      </Tile>
      <Tile
        label="Moon"
        visual={<MoonPhaseIcon illuminated={phase.illuminated} brightLimbDeg={moon.phase?.brightLimbZenithDeg ?? 90} size={40} label={`${phase.name}, ${Math.round(phase.illuminated * 100)}% lit, as it looks in the sky`} />}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {phase.name} · {Math.round(phase.illuminated * 100)}%
            </p>
            <p className="text-xs text-muted">
              {moon.aboveHorizon ? `Up ${moon.apparentAltDeg.toFixed(0)}° ${moon.direction}` : "Below the horizon"}
              {moonTimes.rise ? ` · rises ${formatTime(moonTimes.rise, tz)}` : ""}
              {moonTimes.set ? ` · sets ${formatTime(moonTimes.set, tz)}` : ""}
            </p>
            <p className="text-[11px] text-subtle">
              Full {formatDateTime(moonTimes.full, tz).replace(/,.*$/, "")} · New {formatDateTime(moonTimes.next, tz).replace(/,.*$/, "")}
            </p>
          </div>
        </div>
      </Tile>
      <Tile label={targetName ?? "Sky brightness"} visual={targetName ? targetVisual : undefined}>
        {targetName && target ? (
          <>
            <p className="font-medium">{target.aboveHorizon ? `${target.apparentAltDeg.toFixed(0)}° up, ${target.direction}` : "Below the horizon"}</p>
            <p className="text-xs text-muted">{target.airmass ? `Air mass ${target.airmass.toFixed(2)} · dimmed ${evaluation.conditions.extinctionMag?.toFixed(2)} mag` : "Pick another time, or see Tonight"}</p>
          </>
        ) : null}
        <p className="text-xs text-muted">
          {ideal ? "Ideal: pristine sky 21.9 mag/″²" : `Sky ${evaluation.sky.mag.toFixed(1)} mag/″², mostly ${SOURCE_LABEL[evaluation.sky.dominant]} · naked eye to mag ${nelm.toFixed(1)}`}
        </p>
      </Tile>
    </div>
  );
}

function Tile({ label, children, visual }: { label: string; children: React.ReactNode; visual?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface-sunken/50 px-3 py-2.5 text-sm">
      {visual && <div className="flex shrink-0 items-center">{visual}</div>}
      <div className="min-w-0">
        <p className="mb-0.5 text-[11px] uppercase tracking-wide text-subtle">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** The sky's colour near the horizon for each stage of twilight. */
const SKY_GRADIENT: Record<Twilight, string> = {
  day: "linear-gradient(180deg,#3d7fd6,#9cc8f2 70%,#e8f1fa)",
  civil: "linear-gradient(180deg,#2a3f86,#a56ab0 55%,#f4a65a 85%,#ffd38a)",
  nautical: "linear-gradient(180deg,#0c1438,#2c3577 55%,#c9704d 88%,#f0a35c)",
  astronomical: "linear-gradient(180deg,#05081c,#141c48 60%,#5a3a5c 88%,#a8603d)",
  night: "radial-gradient(1px 1px at 30% 30%,#fff,transparent),radial-gradient(1px 1px at 70% 55%,#fff,transparent),radial-gradient(1px 1px at 45% 75%,#cfd8ff,transparent),linear-gradient(180deg,#02030a,#0a1030)",
};

function SkyGradient({ twilight, small = false }: { twilight: Twilight; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={`block ring-1 ring-border ${small ? "size-4 rounded-full" : "h-10 w-12 rounded-lg"}`}
      style={{ background: SKY_GRADIENT[twilight] }}
    />
  );
}

function Conditions({ sky, stacked = false }: { sky: SkyContext; stacked?: boolean }) {
  const { prefs, site, source, hour, forecast, liveUnavailable, at } = sky;
  const bortle = prefs.bortle ?? site.bortle;
  const showManual = source === "manual";
  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-3 ${stacked ? "" : "sm:grid-cols-2"}`}>
        <SelectField<string>
          label={`Light pollution${prefs.bortle === undefined ? ` (typical for ${site.name})` : ""}`}
          value={String(bortle)}
          onChange={(v) => updateSkyPrefs({ bortle: Number(v) })}
          options={BORTLE.map((b) => ({ value: String(b.level), label: `Bortle ${b.level} · ${b.name} (${b.sqm.toFixed(1)})` }))}
        />
        <div className="space-y-1">
          <p className="text-xs text-muted">Weather</p>
          <div role="radiogroup" aria-label="Weather source" className="flex rounded-lg border border-border p-0.5 text-xs">
            {(
              [
                [true, "Live forecast"],
                [false, "Set by hand"],
              ] as const
            ).map(([live, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={prefs.live === live}
                onClick={() =>
                  updateSkyPrefs(
                    live
                      ? { live: true }
                      : // Start from the live values, so switching doesn't jump.
                        { live: false, manual: hour ? { cloud: Math.round(hour.cloud * 20) / 20, haze: hazeFromAod(hour.aod), seeingArcsec: hour.seeingArcsec } : prefs.manual },
                  )
                }
                className={`flex-1 rounded-md px-2 py-1.5 transition-colors ${prefs.live === live ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {prefs.live && (
        <div className="space-y-1 text-xs">
          {forecast.status === "loading" && <p className="text-muted">Getting the forecast…</p>}
          {hour && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ProvenanceBadge kind="retrieved" />
              <span>Cloud {Math.round(hour.cloud * 100)}%</span>
              {hour.humidity !== undefined && <span>Humidity {Math.round(hour.humidity)}%</span>}
              {hour.aod !== undefined && <span>Haze (AOD) {hour.aod.toFixed(2)}</span>}
              {hour.pm25 !== undefined && <span>PM2.5 {Math.round(hour.pm25)}</span>}
              <span>
                Seeing ~{hour.seeingArcsec.toFixed(1)}″ <span className="text-subtle">(est. from winds)</span>
              </span>
              <span className="text-subtle">for {formatTime(hour.time, site.timeZone)}</span>
            </p>
          )}
          {liveUnavailable && <p className="text-warning">{liveUnavailable}</p>}
          <p className="text-subtle">
            Forecast by{" "}
            <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Open-Meteo
            </a>
            . Only the location, rounded to about 10 km, is sent. {at < new Date(Date.now() - 86_400_000) ? "Past dates use your settings." : ""}
          </p>
        </div>
      )}

      {showManual && (
        <div className={`grid grid-cols-[minmax(0,1fr)] gap-3 ${stacked ? "" : "sm:grid-cols-3"}`}>
          <RangeField
            label="Cloud cover"
            min={0}
            max={1}
            step={0.05}
            value={prefs.manual.cloud}
            onChange={(v) => updateSkyPrefs((p) => ({ manual: { ...p.manual, cloud: v } }))}
            display={`${Math.round(prefs.manual.cloud * 100)}%`}
          />
          <SelectField<HazeLevel>
            label="Haze"
            value={prefs.manual.haze}
            onChange={(v) => updateSkyPrefs((p) => ({ manual: { ...p.manual, haze: v } }))}
            options={HAZE.map((h) => ({ value: h.id, label: h.name }))}
          />
          <RangeField
            label="Seeing (FWHM)"
            min={0.5}
            max={5}
            step={0.1}
            value={prefs.manual.seeingArcsec}
            onChange={(v) => updateSkyPrefs((p) => ({ manual: { ...p.manual, seeingArcsec: v } }))}
            display={`${prefs.manual.seeingArcsec.toFixed(1)}″`}
          />
        </div>
      )}
      <p className="text-xs text-subtle">
        Positions <ProvenanceBadge kind="calculated" /> · sky brightness, dimming and seeing <ProvenanceBadge kind="estimated" />.{" "}
        <Link href="/lab/tonight" className="text-accent hover:underline">
          What&apos;s up tonight →
        </Link>
      </p>
    </div>
  );
}

function hazeFromAod(aod: number | undefined): HazeLevel {
  if (aod === undefined) return "light";
  return aod < 0.09 ? "clear" : aod < 0.25 ? "light" : aod < 0.55 ? "hazy" : "heavy";
}
