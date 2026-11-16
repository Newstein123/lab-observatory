import { describe, expect, it } from "vitest";
import { partAtCentre, visibleLabels } from "./ar-labels";

describe("AR part labels", () => {
  it("finds the part under the crosshair", () => {
    const pts = [
      { id: "tube", x: 100, y: 100 },
      { id: "focuser", x: 210, y: 190 },
    ];
    expect(partAtCentre(pts, 200, 200, 50)).toBe("focuser");
    expect(partAtCentre(pts, 400, 400, 50)).toBeUndefined();
  });

  it("hides tags that would overlap, keeping the priority ones", () => {
    const boxes = [
      { id: "tube", x: 200, y: 200, w: 80, h: 20 },
      { id: "finder", x: 210, y: 205, w: 80, h: 20 },
      { id: "tripod", x: 200, y: 400, w: 80, h: 20 },
    ];
    expect([...visibleLabels(boxes, 200, 200)].sort()).toEqual(["tripod", "tube"]);
    expect([...visibleLabels(boxes, 200, 200, ["finder"])].sort()).toEqual(["finder", "tripod"]);
  });
});
