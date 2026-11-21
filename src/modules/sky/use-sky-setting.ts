"use client";

/**
 * The observer's place, time and conditions, shared by the Lab pages and
 * remembered in this browser (localStorage, best effort). Live weather is
 * fetched from Open-Meteo when switched on.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { SkySetting, Weather } from "./conditions";
import { customSite, DEFAULT_SITE_ID, getSite, type ObservingSite } from "./sites";
import type { HazeLevel } from "./sky-brightness";
import { fetchForecast, hourAt, roundCoord, type Forecast, type HourlyWeather } from "./weather";

export interface SkyPrefs {
  siteId: string;
  /** Set when siteId is "custom". */
  custom?: { latDeg: number; lonDeg: number; name?: string; timeZone?: string };
  /** Light pollution override (default: the site's typical class). */
  bortle?: number;
  /** Use the live forecast for cloud, haze and seeing. */
  live: boolean;
  manual: { cloud: number; haze: HazeLevel; seeingArcsec: number };
  /** "now" follows the clock; "fixed" uses fixedAt. */
  timeMode: "now" | "fixed";
  fixedAt?: string;
}

export const DEFAULT_SKY_PREFS: SkyPrefs = {
  siteId: DEFAULT_SITE_ID,
  live: true,
  manual: { cloud: 0, haze: "light", seeingArcsec: 2 },
  timeMode: "now",
};

const KEY = "ue.sky.v1";
let current: SkyPrefs | undefined;
const listeners = new Set<() => void>();

function load(): SkyPrefs {
  if (current) return current;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SkyPrefs>) : {};
    current = { ...DEFAULT_SKY_PREFS, ...parsed, manual: { ...DEFAULT_SKY_PREFS.manual, ...parsed.manual } };
  } catch {
    current = DEFAULT_SKY_PREFS;
  }
  return current;
}

export function updateSkyPrefs(patch: Partial<SkyPrefs> | ((p: SkyPrefs) => Partial<SkyPrefs>)) {
  const prev = load();
  current = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or storage full: keep it for this page only.
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSkyPrefs(): SkyPrefs {
  return useSyncExternalStore(subscribe, load, () => DEFAULT_SKY_PREFS);
}

export function siteOf(prefs: SkyPrefs): ObservingSite {
  if (prefs.siteId === "custom" && prefs.custom) return customSite(prefs.custom.latDeg, prefs.custom.lonDeg, { name: prefs.custom.name, timeZone: prefs.custom.timeZone, bortle: prefs.bortle });
  return getSite(prefs.siteId) ?? getSite(DEFAULT_SITE_ID)!;
}

/** The current time, ticking each minute while `live`. */
export function useClock(live: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!live) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [live]);
  return now;
}

/* --- Live forecast, cached per rounded site for an hour --------------- */

const forecasts = new Map<string, { at: number; forecast?: Forecast; promise?: Promise<Forecast> }>();
const FRESH_MS = 60 * 60_000;

export type ForecastState = { status: "off" } | { status: "loading" } | { status: "ready"; forecast: Forecast } | { status: "error"; message: string };

// Stable objects, so consumers' memos don't change every render.
const OFF: ForecastState = { status: "off" };
const LOADING: ForecastState = { status: "loading" };

export function useForecast(site: ObservingSite, enabled: boolean): ForecastState {
  const key = `${roundCoord(site.latDeg)},${roundCoord(site.lonDeg)}`;
  const cached = forecasts.get(key);
  const fresh = cached?.forecast && Date.now() - cached.at < FRESH_MS ? cached.forecast : undefined;
  const [state, setState] = useState<{ key: string; s: ForecastState }>(() => ({ key, s: fresh ? { status: "ready", forecast: fresh } : LOADING }));

  useEffect(() => {
    if (!enabled) return;
    const entry = forecasts.get(key);
    if (entry?.forecast && Date.now() - entry.at < FRESH_MS) {
      setState({ key, s: { status: "ready", forecast: entry.forecast } });
      return;
    }
    let cancelled = false;
    setState({ key, s: LOADING });
    const promise = entry?.promise ?? fetchForecast(site.latDeg, site.lonDeg);
    forecasts.set(key, { at: Date.now(), promise });
    promise.then(
      (forecast) => {
        forecasts.set(key, { at: Date.now(), forecast });
        if (!cancelled) setState({ key, s: { status: "ready", forecast } });
      },
      (e: unknown) => {
        forecasts.delete(key);
        if (!cancelled) setState({ key, s: { status: "error", message: e instanceof Error ? e.message : "Forecast unavailable" } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, enabled, site.latDeg, site.lonDeg]);

  if (!enabled) return OFF;
  return state.key === key ? state.s : LOADING;
}

export interface SkyContext {
  prefs: SkyPrefs;
  site: ObservingSite;
  at: Date;
  setting: SkySetting;
  /** Where the cloud, haze and seeing came from. */
  source: "live" | "manual";
  forecast: ForecastState;
  /** The forecast hour in use (live). */
  hour?: HourlyWeather;
  /** Live was asked for but this time isn't covered (or the fetch failed). */
  liveUnavailable?: string;
  /** Live was asked for and is still loading: the manual values stand in for now. */
  waitingForLive: boolean;
}

export function useSkyContext(): SkyContext {
  const prefs = useSkyPrefs();
  const site = useMemo(() => siteOf(prefs), [prefs]);
  const now = useClock(prefs.timeMode === "now");
  const at = useMemo(() => {
    if (prefs.timeMode === "fixed" && prefs.fixedAt) {
      const d = new Date(prefs.fixedAt);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return now;
  }, [prefs.timeMode, prefs.fixedAt, now]);
  const forecast = useForecast(site, prefs.live);
  const hour = forecast.status === "ready" ? hourAt(forecast.forecast, at) : undefined;
  // Stable between clock ticks, so consumers re-plan only when the weather changes.
  const { cloud, haze, seeingArcsec } = prefs.manual;
  const manual = useMemo<Weather>(() => ({ cloud, haze, seeingArcsec }), [cloud, haze, seeingArcsec]);
  const live = useMemo<Weather | undefined>(
    () => hour && { cloud: hour.cloud, humidity: hour.humidity, aod: hour.aod, seeingArcsec: hour.seeingArcsec },
    [hour],
  );

  return useMemo(() => {
    const liveUnavailable =
      !prefs.live
        ? undefined
        : forecast.status === "error"
          ? `Live weather unavailable (${forecast.message}). Using your settings.`
          : forecast.status === "ready" && !hour
            ? "No forecast for this time (forecasts cover about a week). Using your settings."
            : undefined;
    const weather = live ?? manual;
    return {
      prefs,
      site,
      at,
      setting: { site, at, bortle: prefs.bortle ?? site.bortle, weather },
      source: live ? "live" : "manual",
      forecast,
      hour,
      liveUnavailable,
      waitingForLive: prefs.live && forecast.status === "loading",
    };
  }, [prefs, site, at, forecast, hour, manual, live]);
}
