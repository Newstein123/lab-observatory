import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { arPath, decodeArParams, toArSetup } from "./ar-link";

const decodePath = (path: string) => decodeArParams(new URLSearchParams(path.split("?")[1]));

describe("AR links", () => {
  it("references catalogue equipment by id, keeping the link short", () => {
    const path = arPath(toArSetup(DEFAULT_CONFIGURATION, "visual"));
    expect(path).toContain("t=skywatcher-explorer-200p");
    expect(path).toContain("m=skywatcher-heq5-pro");
    expect(path).toContain("e=ep-25-50");
    expect(path).not.toContain("c="); // the camera isn't shown in visual mode
    expect(path.length).toBeLessThan(140);
  });

  it("round-trips catalogue setups exactly", () => {
    for (const mode of ["visual", "imaging"] as const) {
      const setup = toArSetup(DEFAULT_CONFIGURATION, mode);
      expect(decodePath(arPath(setup))).toEqual(setup);
    }
  });

  it("round-trips custom equipment through its numbers", () => {
    const setup = toArSetup(
      {
        name: "Backyard 280 mm",
        telescope: { apertureMm: 280, focalLengthMm: 2800, opticalDesign: "refractor" },
        mount: { type: "equatorial", payloadKg: 20, goto: true, tracking: true },
        eyepiece: { focalLengthMm: 17.5, apparentFovDeg: 70, barrelIn: 2, eyeReliefMm: 19 },
        barlow: { factor: 2.5 },
        filter: { name: "my uhc", kind: "uhc" },
      },
      "visual",
    );
    const back = decodePath(arPath(setup))!;
    expect(back.telescope).toEqual(setup.telescope);
    expect(back.mount).toEqual(setup.mount);
    expect(back.eyepiece).toEqual(setup.eyepiece);
    expect(back.barlow).toEqual(setup.barlow);
    expect(back.filter?.kind).toBe("uhc");
    expect(back.name).toBe("Backyard 280 mm");
  });

  it("keeps non-ASCII names", () => {
    const setup = toArSetup({ ...DEFAULT_CONFIGURATION, name: "LX90 8″ · ☾" }, "imaging");
    expect(decodePath(arPath(setup))?.name).toBe("LX90 8″ · ☾");
  });

  it("drops fields the AR model doesn't need", () => {
    const setup = toArSetup({ ...DEFAULT_CONFIGURATION, ...{ notes: "private" } } as typeof DEFAULT_CONFIGURATION, "visual");
    expect(arPath(setup)).not.toContain("private");
  });

  it("rejects damaged or impossible links", () => {
    expect(decodeArParams(new URLSearchParams(""))).toBeUndefined();
    expect(decodeArParams(new URLSearchParams("t=no-such-telescope"))).toBeUndefined();
    expect(decodeArParams(new URLSearchParams("t=-5,1000,n"))).toBeUndefined();
    expect(decodeArParams({ t: "200,1000,n", e: "999999,9" })).toBeUndefined();
  });
});
