import { describe, expect, it } from "vitest";
import { pageItems } from "./pagination";

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses the middle around the current page", () => {
    expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
  });

  it("shows a run of pages near either end", () => {
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    expect(pageItems(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });
});
