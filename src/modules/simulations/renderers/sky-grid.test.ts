import { describe, expect, it } from "vitest";
import { formatDec, formatRa, skyGrid } from "./sky-grid";

describe("RA/Dec grid", () => {
  it("formats coordinates to the grid step", () => {
    expect(formatRa(83.8221, 60)).toBe("5h35m");
    expect(formatRa(83.8221, 10)).toBe("5h35m17s");
    expect(formatDec(-5.3911, 600)).toBe("−5°23′");
    expect(formatDec(47.5, 3600)).toBe("+47°");
  });

  it("puts north up and east left, with RA lines spaced by cos δ", () => {
    // 1″ = 1 px; a 1200″ field around δ = +60°.
    const lines = skyGrid({ raDeg: 180, decDeg: 60, pxPerArcsec: 1, halfWidthPx: 600, halfHeightPx: 600 });
    const dec = lines.filter((l) => l.kind === "dec").sort((a, b) => a.pos - b.pos);
    const ra = lines.filter((l) => l.kind === "ra").sort((a, b) => a.pos - b.pos);
    expect(dec.length).toBeGreaterThanOrEqual(3);
    expect(ra.length).toBeGreaterThanOrEqual(3);
    // Higher declination is drawn higher (smaller y).
    expect(dec[0].label > dec[dec.length - 1].label).toBe(true);
    // Equal Dec steps are equal px apart; RA steps shrink by cos 60° = 0.5.
    const decGap = dec[1].pos - dec[0].pos;
    const raGap = ra[1].pos - ra[0].pos;
    expect(decGap).toBeGreaterThan(0);
    expect(raGap).toBeGreaterThan(0);
    // The leftmost RA line has the larger RA (east is left).
    expect(ra[0].label > ra[ra.length - 1].label).toBe(true);
  });

  it("follows the target when the view is panned", () => {
    const a = skyGrid({ raDeg: 10, decDeg: 0, pxPerArcsec: 0.5, halfWidthPx: 300, halfHeightPx: 300 });
    const b = skyGrid({ raDeg: 10, decDeg: 0, pxPerArcsec: 0.5, halfWidthPx: 300, halfHeightPx: 300, centreOffsetPx: { x: 40, y: -25 } });
    const decA = a.find((l) => l.kind === "dec")!;
    const decB = b.find((l) => l.kind === "dec" && l.label === decA.label);
    if (decB) expect(decB.pos - decA.pos).toBeCloseTo(-25, 6);
  });
});
