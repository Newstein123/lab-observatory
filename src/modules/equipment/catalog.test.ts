import { describe, expect, it } from "vitest";
import { configurationSpecSchema, toSimulationInput } from "@/modules/configurations/models";
import { DEFAULT_CONFIGURATION } from "@/modules/configurations/presets";
import { simulate } from "@/modules/simulations/engine";
import { getTarget, toTargetExtent } from "@/modules/targets/catalogue";
import { CATALOGS, TELESCOPE_CATALOG } from "./catalog";
import { accessoryInputSchema, telescopeProfileInputSchema, type AccessoryKind } from "./models";

describe("equipment catalogue", () => {
  it("has unique ids across every category", () => {
    const ids = [...TELESCOPE_CATALOG.map((t) => t.id), ...Object.values(CATALOGS).flatMap((c) => c.map((e) => e.id))];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every telescope is a valid profile", () => {
    for (const t of TELESCOPE_CATALOG) {
      const r = telescopeProfileInputSchema.safeParse({
        name: t.model,
        status: "planned",
        opticalDesign: t.optics.opticalDesign,
        apertureMm: t.optics.apertureMm,
        focalLengthMm: t.optics.focalLengthMm,
        mountType: t.mountType,
        manufacturer: t.manufacturer,
        model: t.model,
      });
      expect(r.success, t.id).toBe(true);
    }
  });

  it("every accessory spec validates", () => {
    for (const [kind, items] of Object.entries(CATALOGS)) {
      for (const e of items) {
        const r = accessoryInputSchema.safeParse({ kind: kind as AccessoryKind, name: e.model, status: "owned", spec: e.spec });
        expect(r.success, `${kind}/${e.id}`).toBe(true);
      }
    }
  });

  it("the default configuration is valid", () => {
    expect(configurationSpecSchema.safeParse(DEFAULT_CONFIGURATION).success).toBe(true);
  });

  it("brand and model names never change a calculation", () => {
    const target = toTargetExtent(getTarget("saturn")!);
    for (const t of TELESCOPE_CATALOG) {
      const base = { ...DEFAULT_CONFIGURATION, telescope: t.optics, catalogRef: t.id };
      const anonymous = {
        ...base,
        catalogRef: undefined,
        telescope: { ...t.optics, label: "Something else entirely" },
        eyepiece: { ...base.eyepiece!, label: "Unbranded" },
      };
      for (const mode of ["eyepiece", "camera"] as const) {
        const req = { target, mode, conditions: { seeingArcsec: 2 }, exposure: { exposureS: 1, gain: 1 } };
        expect(simulate(toSimulationInput({ ...req, configuration: anonymous })).metrics).toEqual(
          simulate(toSimulationInput({ ...req, configuration: base })).metrics,
        );
      }
    }
  });
});
