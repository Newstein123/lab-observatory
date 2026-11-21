import { describe, expect, it } from "vitest";
import type { ConfigurationSpec } from "@/modules/configurations/models";
import { planTonight } from "./tonight";
import { customSite, getSite } from "./sites";

const spec = {
  name: "8-inch",
  status: "owned",
  telescope: { label: "200/1000", apertureMm: 200, focalLengthMm: 1000 },
  eyepiece: { label: "25 mm", focalLengthMm: 25, apparentFovDeg: 52 },
} as unknown as ConfigurationSpec;

describe("tonight planner", () => {
  const bangkok = getSite("bangkok")!;
  const plan = planTonight({ site: bangkok, at: new Date("2026-11-16T12:00:00Z"), bortle: 9, weather: { cloud: 0, haze: "light", seeingArcsec: 2 } }, spec, "eyepiece");
  const entry = (id: string) => plan.entries.find((e) => e.target.id === id)!;

  it("Jupiter and the Orion Nebula are on the list from Bangkok in November", () => {
    expect(entry("jupiter").group).toBe("great");
    expect(entry("m42").group).not.toBe("not-tonight");
    expect(entry("m42").best!.altDeg).toBeGreaterThan(60);
  });

  it("far-northern and faint targets are not", () => {
    expect(entry("m101").group).toBe("not-tonight");
  });

  it("ideal conditions are never worse than tonight's", () => {
    const rank = { good: 0, challenging: 1, out_of_reach: 2 };
    for (const e of plan.entries) if (e.best) expect(rank[e.idealReach.reach]).toBeLessThanOrEqual(rank[e.reach.reach]);
  });

  it("lists the best first and gives a curve for each target", () => {
    expect(plan.entries[0].group).toBe("great");
    expect(entry("saturn").curve.length).toBeGreaterThan(20);
  });

  it("a cloudy night puts everything out", () => {
    const cloudy = planTonight({ site: bangkok, at: new Date("2026-11-16T12:00:00Z"), bortle: 9, weather: { cloud: 1, haze: "light", seeingArcsec: 2 } }, spec, "eyepiece");
    expect(cloudy.entries.every((e) => e.group === "not-tonight" || e.target.category === "moon")).toBe(true);
  });

  it("in polar night the Moon and planets are still planned (the Sun never rises)", () => {
    const svalbard = customSite(78.2, 15.6, { name: "Longyearbyen", timeZone: "Arctic/Longyearbyen", bortle: 2 });
    const polar = planTonight({ site: svalbard, at: new Date("2026-12-21T12:00:00Z"), bortle: 2, weather: { cloud: 0, haze: "light", seeingArcsec: 2 } }, spec, "eyepiece");
    for (const e of polar.entries) expect(e.note ?? "", e.target.id).not.toMatch(/Sun doesn't set/);
    expect(polar.entries.some((e) => e.target.category === "planet" && e.group !== "not-tonight")).toBe(true);
  });

  it("under the midnight Sun nothing is planned", () => {
    const svalbard = customSite(78.2, 15.6, { name: "Longyearbyen", timeZone: "Arctic/Longyearbyen", bortle: 2 });
    const summer = planTonight({ site: svalbard, at: new Date("2026-06-21T12:00:00Z"), bortle: 2, weather: { cloud: 0, haze: "light", seeingArcsec: 2 } }, spec, "eyepiece");
    expect(summer.entries.every((e) => e.group === "not-tonight")).toBe(true);
  });
});
