/**
 * "What can I see tonight?": for each target, when it's up during the night,
 * its best time, and how it will look with this setup under these conditions
 * (and under ideal ones). Pure.
 */
import type { ConfigurationSpec } from "@/modules/configurations/models";
import type { SimulationMode } from "@/modules/simulations/engine";
import { TARGETS, type CuratedTarget } from "@/modules/targets/catalogue";
import { assessReach, type ReachAssessment } from "@/modules/targets/reach";
import { equatorialOf } from "./bodies";
import { evaluateSky, idealConditions, type SkySetting, type Weather } from "./conditions";
import { compass, toHorizontal } from "./coords";
import { altitudeFn, bodyEvents, HORIZON_MOON, HORIZON_STAR, highest, nightInfo, type NightInfo } from "./events";

/** Below this altitude a target is too low to be worth it. */
export const MIN_USEFUL_ALT = 15;

export type TonightGroup = "great" | "possible" | "not-tonight";

export interface TonightEntry {
  target: CuratedTarget;
  rise?: Date;
  set?: Date;
  /** Highest point during the night (dark hours for faint targets). */
  best?: { at: Date; altDeg: number; direction: string };
  reach: ReachAssessment;
  idealReach: ReachAssessment;
  group: TonightGroup;
  /** Why it isn't on tonight's list, if it isn't. */
  note?: string;
  /** Altitude through the night, for a sparkline. */
  curve: { t: number; altDeg: number }[];
}

export interface TonightPlan {
  night: NightInfo;
  /** The hours that count: fully dark if it gets dark, else sunset to sunrise. */
  from?: Date;
  to?: Date;
  entries: TonightEntry[];
}

const BRIGHT = (t: CuratedTarget) => t.category === "moon" || t.category === "planet";

/**
 * `weatherAt` gives the weather for another hour of the night (e.g. from the
 * forecast); without it the setting's weather applies all night.
 */
export function planTonight(
  setting: SkySetting,
  spec: ConfigurationSpec,
  mode: SimulationMode,
  targets: readonly CuratedTarget[] = TARGETS,
  weatherAt?: (d: Date) => Weather | undefined,
): TonightPlan {
  const { site } = setting;
  const night = nightInfo(setting.at, site);
  const twilightFrom = night.civilStart ?? night.sunset;
  const twilightTo = night.civilEnd ?? night.sunrise;
  const darkFrom = night.darkStart ?? twilightFrom;
  const darkTo = night.darkEnd ?? twilightTo;

  const entries = targets.map((target): TonightEntry => {
    const position = (d: Date) => equatorialOf(target, d, site)!;
    const alt = altitudeFn(position, site);
    // Planets and the Moon show well in twilight; faint targets need darkness.
    const from = BRIGHT(target) ? twilightFrom : darkFrom;
    const to = BRIGHT(target) ? twilightTo : darkTo;
    const ev = bodyEvents(alt, target.id === "moon" ? HORIZON_MOON : HORIZON_STAR, night.start, night.end);
    const curve: TonightEntry["curve"] = [];
    const curveFrom = night.sunset ?? twilightFrom;
    const curveTo = night.sunrise ?? twilightTo;
    if (curveFrom && curveTo) {
      const step = 30 * 60_000;
      for (let t = curveFrom.getTime() - 3_600_000; t <= curveTo.getTime() + 3_600_000; t += step) curve.push({ t, altDeg: alt(new Date(t)) });
    }
    const none = (note: string): TonightEntry => {
      const r: ReachAssessment = { reach: "out_of_reach", reasons: [note], cause: "sky" };
      return { target, rise: ev.rise, set: ev.set, reach: r, idealReach: assessReach(target, spec, mode, idealConditions(setting, target).reach), group: "not-tonight", note, curve };
    };
    if (!from || !to) return none("The Sun doesn't set tonight here.");
    const top = highest(alt, from, to);
    if (top.altDeg < MIN_USEFUL_ALT) return none(top.altDeg < 0 ? "Not above the horizon during the night." : `Only reaches ${Math.round(top.altDeg)}° during the night.`);

    const sky = evaluateSky({ ...setting, at: top.at, weather: weatherAt?.(top.at) ?? setting.weather }, target);
    const reach = assessReach(target, spec, mode, sky.reach);
    const idealReach = assessReach(target, spec, mode, idealConditions(setting, target).reach);
    const azDeg = toHorizontal(position(top.at), site, top.at).azDeg;
    return {
      target,
      rise: ev.rise,
      set: ev.set,
      best: { at: top.at, altDeg: top.altDeg, direction: compass(azDeg) },
      reach,
      idealReach,
      group: reach.reach === "good" ? "great" : reach.reach === "challenging" ? "possible" : "not-tonight",
      curve,
    };
  });

  const order: Record<TonightGroup, number> = { great: 0, possible: 1, "not-tonight": 2 };
  entries.sort((a, b) => order[a.group] - order[b.group] || (b.best?.altDeg ?? -90) - (a.best?.altDeg ?? -90));
  return { night, from: darkFrom, to: darkTo, entries };
}
