import { describe, expect, it } from "vitest";
import { applyDrag, dragControlFor, facingYaw, toggleFor, type RigControls } from "./ar-controls";

const base: RigControls = {
  mode: "visual",
  topIn: true,
  barlowIn: false,
  filterIn: false,
  focusMm: 30,
  latitudeDeg: 30,
  polarAzimuthDeg: 0,
  raDeg: 90,
  decDeg: 84,
  counterweight: 0.5,
  altitudeDeg: 40,
  azimuthDeg: 0,
};

describe("AR controls", () => {
  it("maps parts to the right control for each mount", () => {
    expect(dragControlFor("focuser", "dobsonian")).toBe("focus");
    expect(dragControlFor("tube", "equatorial")).toBe("dec");
    expect(dragControlFor("tube", "alt_azimuth")).toBe("altitude");
    expect(dragControlFor("counterweight", "equatorial")).toBe("counterweight");
    expect(dragControlFor("latitude-adjuster", "equatorial")).toBe("latitude");
    expect(dragControlFor("dob-base", "dobsonian")).toBe("slew");
    expect(dragControlFor("tripod", "equatorial")).toBeUndefined();
    expect(dragControlFor("tube", undefined)).toBeUndefined();
  });

  it("taps take accessories in and out", () => {
    expect(toggleFor("eyepiece")).toBe("top");
    expect(toggleFor("camera")).toBe("top");
    expect(toggleFor("barlow")).toBe("barlow");
    expect(toggleFor("tube")).toBeUndefined();
  });

  it("drags move controls in the expected direction and stay in range", () => {
    expect(applyDrag(base, "focus", 100, 0).focusMm).toBeCloseTo(38);
    expect(applyDrag(base, "focus", 10_000, 0).focusMm).toBe(60);
    expect(applyDrag(base, "latitude", 0, -100).latitudeDeg).toBeCloseTo(35); // drag up raises it
    expect(applyDrag(base, "dec", 0, -1000).decDeg).toBe(90);
    expect(applyDrag(base, "counterweight", -1000, 0).counterweight).toBe(0);
  });

  it("wraps rotations around", () => {
    expect(applyDrag({ ...base, raDeg: 170 }, "ra", 40, 0).raDeg).toBeCloseTo(-170);
    expect(applyDrag({ ...base, azimuthDeg: -175 }, "slew", -25, 0).azimuthDeg).toBeCloseTo(175);
  });

  it("turns the rig so the viewer sees its side", () => {
    // Viewer due +X of the rig: the rig turns so the viewer sits at −33° in its frame.
    expect((facingYaw(0, 0, 2, 0) * 180) / Math.PI).toBeCloseTo(-33);
  });
});
