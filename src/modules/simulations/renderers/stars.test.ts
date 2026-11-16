import { describe, expect, it } from "vitest";
import { decodeStars, perceivedSaturation, teffToRgb, visibleStars, type StarFieldData } from "./stars";

const field: StarFieldData = {
  targetId: "test",
  brightRadiusArcsec: 9000,
  faintRadiusArcsec: 2160,
  brightLimitMag: 11.5,
  faintLimitMag: 15,
  stars: [
    // ξ, η, V×100, Teff/10
    0, 0, 300, 350, // bright orange star at centre
    600, 0, 1000, 1000, // V 10, 600″ east
    0, 300, 1450, 600, // V 14.5, 300″ north
    0, 3000, 1300, 600, // V 13, beyond the faint coverage
  ],
};
const stars = decodeStars(field);
const opts = { limitMag: 13.5, pxPerArcsec: 0.1, fieldRadiusPx: 200, blurPx: 1, color: true };

describe("catalogue stars", () => {
  it("decodes the packed array", () => {
    expect(stars).toHaveLength(4);
    expect(stars[0]).toEqual({ xi: 0, eta: 0, v: 3, teff: 3500 });
  });

  it("shows only stars brighter than the limit and inside coverage and field", () => {
    const vis = visibleStars(field, stars, opts);
    expect(vis).toHaveLength(2); // V 14.5 too faint; V 13 outside faint coverage
    // East is to the left, north is up.
    expect(vis[1]).toMatchObject({ x: -60, y: -0 });
    expect(visibleStars(field, stars, { ...opts, limitMag: 15 })).toHaveLength(3);
  });

  it("brighter stars are larger and more opaque", () => {
    const [bright, faint] = visibleStars(field, stars, opts);
    expect(bright.radius).toBeGreaterThan(faint.radius);
    expect(bright.alpha).toBeGreaterThan(faint.alpha);
  });

  it("colour shows only for stars well above the limit, and is pale", () => {
    expect(perceivedSaturation(13, 13.5)).toBe(0);
    expect(perceivedSaturation(3, 13.5)).toBeCloseTo(0.65);
    const [bright, faint] = visibleStars(field, stars, opts);
    expect(bright.color[0]).toBeGreaterThan(bright.color[2]); // a cool star looks orange
    expect(faint.color).toEqual([255, 255, 255]);
    expect(visibleStars(field, stars, { ...opts, color: false })[0].color).toEqual([255, 255, 255]);
  });

  it("maps temperature to plausible colours", () => {
    const [r1, , b1] = teffToRgb(3000);
    const [r2, , b2] = teffToRgb(15000);
    expect(r1).toBeGreaterThan(b1);
    expect(b2).toBeGreaterThan(r2);
  });
});
