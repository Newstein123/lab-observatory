import { describe, expect, it } from "vitest";
import { moonOrientation, projectSelenographic, unprojectDisc } from "./moon";

describe("lunar orientation (Meeus ch. 53)", () => {
  // Example 53.a: 1992 April 12, 0h TD.
  const o = moonOrientation(new Date(Date.UTC(1992, 3, 12)));

  it("matches the libration of example 53.a", () => {
    expect(o.librationLonDeg).toBeCloseTo(-1.206, 1);
    expect(o.librationLatDeg).toBeCloseTo(4.194, 1);
  });

  it("matches the axis position angle of example 53.a", () => {
    expect(Math.abs(o.axisPaDeg - 15.08)).toBeLessThan(0.1);
  });

  it("matches the sub-solar point of example 53.a", () => {
    expect(Math.abs(o.subSolarLonDeg - 67.89)).toBeLessThan(0.15);
    expect(Math.abs(o.subSolarLatDeg - 1.46)).toBeLessThan(0.1);
  });

  it("keeps libration within its physical range over a year", () => {
    for (let d = 0; d < 365; d += 3) {
      const x = moonOrientation(new Date(Date.UTC(2026, 0, 1 + d)), { latDeg: 13.76, lonDeg: 100.5 });
      expect(Math.abs(x.librationLonDeg)).toBeLessThan(9);
      expect(Math.abs(x.librationLatDeg)).toBeLessThan(8);
    }
  });
});

describe("disc projection", () => {
  const o = moonOrientation(new Date("2026-11-19T13:58:00Z"), { latDeg: 13.76, lonDeg: 100.5 });

  it("round-trips selenographic coordinates", () => {
    for (const [lat, lon] of [[-43.31, -11.36], [9.62, -20.08], [51.62, -9.38], [0, 0], [-58, 40]]) {
      const p = projectSelenographic(lat, lon, o);
      expect(p.z).toBeGreaterThan(0);
      const back = unprojectDisc(p.x, p.y, o)!;
      expect(back.latDeg).toBeCloseTo(lat, 6);
      expect(back.lonDeg).toBeCloseTo(lon, 6);
    }
  });

  it("puts the sub-Earth point at the centre", () => {
    const p = projectSelenographic(o.librationLatDeg, o.librationLonDeg, o);
    expect(Math.hypot(p.x, p.y)).toBeLessThan(1e-9);
  });

  it("puts Mare Crisium (lunar east) on the sky-west side and Tycho in the south", () => {
    const flat = { ...o, axisPaDeg: 0, librationLatDeg: 0, librationLonDeg: 0 };
    expect(projectSelenographic(17, 59, flat).x).toBeGreaterThan(0.5); // screen right = sky west
    expect(projectSelenographic(-43.3, -11.4, flat).y).toBeGreaterThan(0.5); // canvas y down = south
  });

  it("hides the far side", () => {
    expect(projectSelenographic(0, 180, o).z).toBeLessThan(0);
  });
});
