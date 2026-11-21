/** Wall-clock times in a given IANA time zone (the observing site's), independent of the browser's. */

function parts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Offset of the zone from UTC at that moment, minutes. */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const { y, mo, d, h, mi, s } = parts(date, timeZone);
  return Math.round((Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" in the zone, for <input type="datetime-local">. */
export function toZonedInput(date: Date, timeZone: string): string {
  const { y, mo, d, h, mi } = parts(date, timeZone);
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
}

/** The instant a "YYYY-MM-DDTHH:mm" wall-clock time in the zone refers to. */
export function fromZonedInput(value: string, timeZone: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return undefined;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Two passes settle the offset across DST changes.
  let t = asUtc - zoneOffsetMinutes(new Date(asUtc), timeZone) * 60_000;
  t = asUtc - zoneOffsetMinutes(new Date(t), timeZone) * 60_000;
  return new Date(t);
}

/** "21:14" in the zone. */
export function formatTime(date: Date | undefined, timeZone: string): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "Mon 17 Nov, 21:14" in the zone. */
export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** "UTC+7" style label. */
export function zoneLabel(date: Date, timeZone: string): string {
  const off = zoneOffsetMinutes(date, timeZone);
  const sign = off >= 0 ? "+" : "−";
  const a = Math.abs(off);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? `:${pad(a % 60)}` : ""}`;
}
