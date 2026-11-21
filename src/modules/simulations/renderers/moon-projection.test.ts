import { describe, expect, it } from "vitest";
import { moonOrientation, projectSelenographic } from "@/modules/sky/moon";
import { discTier, projectMoonDisc, type GreyMap } from "./moon-projection";

/** A synthetic map: black, with one bright 3°×3° square at (lat, lon). */
function mapWithSpot(lat: number, lon: number): GreyMap {
  const width = 720;
  const height = 360;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const la = 90 - (y + 0.5) / 2;
      const lo = -180 + (x + 0.5) / 2;
      if (Math.abs(la - lat) < 1.5 && Math.abs(lo - lon) < 1.5) data[y * width + x] = 255;
    }
  return { data, width, height };
}

describe("projectMoonDisc", () => {
  it("draws a map feature where projectSelenographic puts it", () => {
    const o = moonOrientation(new Date("2026-11-19T13:58:00Z"), { latDeg: 13.76, lonDeg: 100.5 });
    const flat = { ...o, axisPaDeg: 0 }; // the disc is drawn lunar-north-up
    const size = 400;
    const out = projectMoonDisc(mapWithSpot(-43.3, -11.2), o, size);
    // Centroid of the bright pixels.
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (out[(y * size + x) * 4] > 128) {
          sx += x + 0.5;
          sy += y + 0.5;
          n++;
        }
    expect(n).toBeGreaterThan(10);
    const p = projectSelenographic(-43.3, -11.2, flat);
    expect(sx / n).toBeCloseTo(size / 2 + p.x * (size / 2), -0.5);
    expect(sy / n).toBeCloseTo(size / 2 + p.y * (size / 2), -0.5);
  });

  it("leaves the corners transparent", () => {
    const out = projectMoonDisc(mapWithSpot(0, 0), { librationLatDeg: 0, librationLonDeg: 0 }, 64);
    expect(out[3]).toBe(0);
    expect(out[(32 * 64 + 32) * 4 + 3]).toBe(255);
  });

  it("picks a few resolution tiers", () => {
    expect(discTier(100)).toBe(256);
    expect(discTier(700)).toBe(1024);
    expect(discTier(5000)).toBe(2048);
  });
});
