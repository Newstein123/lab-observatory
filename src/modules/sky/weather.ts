/**
 * Live conditions from Open-Meteo (https://open-meteo.com, free, no key):
 * cloud, humidity and winds from the forecast API, aerosol optical depth from
 * the air-quality API. RETRIEVED forecasts; seeing is ESTIMATED from winds.
 *
 * Privacy: only the site's coordinates, rounded to 0.1° (~11 km), are sent.
 */
import { z } from "zod";
import { seeingFromWind } from "./sky-brightness";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY = "https://air-quality-api.open-meteo.com/v1/air-quality";

const num = z.number().nullable();
const forecastSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    cloud_cover: z.array(num),
    relative_humidity_2m: z.array(num),
    wind_speed_10m: z.array(num),
    wind_speed_250hPa: z.array(num),
  }),
});
const airSchema = z.object({
  hourly: z.object({ time: z.array(z.string()), aerosol_optical_depth: z.array(num), pm2_5: z.array(num) }),
});

export interface HourlyWeather {
  /** Start of the hour (UTC). */
  time: Date;
  /** Cloud cover, 0…1. */
  cloud: number;
  humidity?: number;
  aod?: number;
  pm25?: number;
  surfaceWindMs?: number;
  jetWindMs?: number;
  /** Estimated zenith seeing, arcsec. */
  seeingArcsec: number;
}

export interface Forecast {
  latDeg: number;
  lonDeg: number;
  fetchedAt: Date;
  hours: HourlyWeather[];
}

/** Coordinates as sent: rounded to 0.1°. */
export const roundCoord = (deg: number) => Math.round(deg * 10) / 10;

/** Open-Meteo hourly times are "YYYY-MM-DDTHH:mm" in GMT when asked for timezone=GMT. */
const parseGmt = (s: string) => new Date(`${s}:00Z`);

export function parseForecast(forecastJson: unknown, airJson: unknown, at: { latDeg: number; lonDeg: number; fetchedAt: Date }): Forecast {
  const f = forecastSchema.parse(forecastJson).hourly;
  const air = airJson ? airSchema.safeParse(airJson) : undefined;
  const aq = new Map<number, { aod?: number; pm25?: number }>();
  if (air?.success) {
    air.data.hourly.time.forEach((t, i) =>
      aq.set(parseGmt(t).getTime(), { aod: air.data.hourly.aerosol_optical_depth[i] ?? undefined, pm25: air.data.hourly.pm2_5[i] ?? undefined }),
    );
  }
  const hours: HourlyWeather[] = [];
  f.time.forEach((t, i) => {
    const cloud = f.cloud_cover[i];
    if (cloud === null) return;
    const time = parseGmt(t);
    const surfaceWindMs = f.wind_speed_10m[i] ?? undefined;
    const jetWindMs = f.wind_speed_250hPa[i] ?? undefined;
    hours.push({
      time,
      cloud: Math.min(1, Math.max(0, cloud / 100)),
      humidity: f.relative_humidity_2m[i] ?? undefined,
      ...aq.get(time.getTime()),
      surfaceWindMs,
      jetWindMs,
      seeingArcsec: Math.round(seeingFromWind({ jetMs: jetWindMs, surfaceMs: surfaceWindMs }) * 10) / 10,
    });
  });
  return { ...at, hours };
}

/** The forecast hour nearest a time, if the forecast covers it (within 90 minutes). */
export function hourAt(forecast: Forecast, date: Date): HourlyWeather | undefined {
  let best: HourlyWeather | undefined;
  let bestD = Infinity;
  for (const h of forecast.hours) {
    const d = Math.abs(h.time.getTime() + 30 * 60_000 - date.getTime());
    if (d < bestD) {
      bestD = d;
      best = h;
    }
  }
  return bestD <= 90 * 60_000 ? best : undefined;
}

export async function fetchForecast(latDeg: number, lonDeg: number, signal?: AbortSignal): Promise<Forecast> {
  const lat = roundCoord(latDeg);
  const lon = roundCoord(lonDeg);
  const common = `latitude=${lat}&longitude=${lon}&timezone=GMT&past_days=1`;
  const [forecast, air] = await Promise.all([
    fetch(`${FORECAST}?${common}&forecast_days=7&wind_speed_unit=ms&hourly=cloud_cover,relative_humidity_2m,wind_speed_10m,wind_speed_250hPa`, { signal }).then((r) => {
      if (!r.ok) throw new Error(`Forecast unavailable (${r.status})`);
      return r.json();
    }),
    // Air quality is a bonus: haze falls back to humidity if it fails.
    fetch(`${AIR_QUALITY}?${common}&forecast_days=5&hourly=aerosol_optical_depth,pm2_5`, { signal })
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined),
  ]);
  return parseForecast(forecast, air, { latDeg: lat, lonDeg: lon, fetchedAt: new Date() });
}
