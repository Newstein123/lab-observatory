import { describe, expect, it } from "vitest";
import { fromZonedInput, toZonedInput, zoneLabel, zoneOffsetMinutes } from "./time-zone";

describe("site time zones", () => {
  const at = new Date("2026-11-16T12:00:00Z");

  it("knows Bangkok is UTC+7 and Yangon UTC+6:30", () => {
    expect(zoneOffsetMinutes(at, "Asia/Bangkok")).toBe(420);
    expect(zoneLabel(at, "Asia/Yangon")).toBe("UTC+6:30");
  });

  it("round-trips wall-clock input in the site's zone", () => {
    expect(toZonedInput(at, "Asia/Bangkok")).toBe("2026-11-16T19:00");
    expect(fromZonedInput("2026-11-16T19:00", "Asia/Bangkok")!.toISOString()).toBe(at.toISOString());
    expect(fromZonedInput("2026-07-01T22:30", "Europe/London")!.toISOString()).toBe("2026-07-01T21:30:00.000Z");
  });

  it("rejects junk", () => {
    expect(fromZonedInput("tonight", "UTC")).toBeUndefined();
  });
});
