import { describe, expect, it } from "vitest";
import data from "@/modules/explorer/saturn/moons.json";
import check from "@/modules/explorer/saturn/moons.check.json";
import { planetPosition, SATURN_RADIUS_KM, SATURN_RING_RATIO } from "@/modules/sky/planets";
import { saturnMoons, type SaturnMoonData } from "./saturn-moons";

const RING_KM = SATURN_RADIUS_KM * SATURN_RING_RATIO;

describe("Saturn's moons vs JPL Horizons (independent astrometric positions)", () => {
  for (const c of check.checks) {
    it(`${c.moon} at ${c.utc}`, () => {
      const date = new Date(c.utc);
      const moons = saturnMoons(data as unknown as SaturnMoonData, date);
      const m = moons.find((x) => x.name.toLowerCase() === c.moon)!;
      const deltaKm = planetPosition("saturn", date).distanceAu * 149_597_870.7;
      const toArcsec = (units: number) => ((units * RING_KM) / deltaKm) * 206_264.806;
      const east = -toArcsec(m.x);
      const north = toArcsec(m.y);
      // Error budget: fit residual plus the planet theory's direction (~0.1″ scale here).
      const tol = c.moon === "hyperion" ? 8 : c.moon === "iapetus" ? 2 : 0.6;
      expect(Math.abs(east - c.eastArcsec), "east").toBeLessThan(tol);
      expect(Math.abs(north - c.northArcsec), "north").toBeLessThan(tol);
    });
  }
});
