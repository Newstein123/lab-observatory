import { describe, expect, it } from "vitest";
import { hourAt, parseForecast, roundCoord } from "./weather";

const forecast = {
  hourly: {
    time: ["2026-11-16T12:00", "2026-11-16T13:00", "2026-11-16T14:00"],
    cloud_cover: [100, 40, null],
    relative_humidity_2m: [63, 70, 75],
    wind_speed_10m: [1.9, 2.5, 3],
    wind_speed_250hPa: [2.1, 45, 30],
  },
};
const air = { hourly: { time: ["2026-11-16T12:00", "2026-11-16T13:00"], aerosol_optical_depth: [0.57, null], pm2_5: [40.4, 38] } };

describe("Open-Meteo weather", () => {
  const parsed = parseForecast(forecast, air, { latDeg: 13.8, lonDeg: 100.5, fetchedAt: new Date("2026-11-16T11:00:00Z") });

  it("parses hours, skipping gaps", () => {
    expect(parsed.hours).toHaveLength(2);
    expect(parsed.hours[0].time.toISOString()).toBe("2026-11-16T12:00:00.000Z");
    expect(parsed.hours[0].cloud).toBe(1);
    expect(parsed.hours[0].aod).toBe(0.57);
    expect(parsed.hours[1].aod).toBeUndefined();
  });

  it("estimates worse seeing under a strong jet stream", () => {
    expect(parsed.hours[1].seeingArcsec).toBeGreaterThan(parsed.hours[0].seeingArcsec);
  });

  it("picks the hour covering a time, and nothing outside the forecast", () => {
    expect(hourAt(parsed, new Date("2026-11-16T13:20:00Z"))!.cloud).toBe(0.4);
    expect(hourAt(parsed, new Date("2026-11-18T13:20:00Z"))).toBeUndefined();
  });

  it("works without air-quality data", () => {
    expect(parseForecast(forecast, undefined, { latDeg: 0, lonDeg: 0, fetchedAt: new Date() }).hours[0].aod).toBeUndefined();
  });

  it("rejects malformed data", () => {
    expect(() => parseForecast({ hourly: { time: "x" } }, undefined, { latDeg: 0, lonDeg: 0, fetchedAt: new Date() })).toThrow();
  });

  it("sends only coarse coordinates", () => {
    expect(roundCoord(13.75632)).toBe(13.8);
    expect(roundCoord(-0.04)).toBe(-0);
  });
});
