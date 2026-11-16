export function formatNumber(value: number, digits: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Choose a readable angular unit: ″ below 1′, ′ below 1°, ° above. */
export function formatAngleArcsec(arcsec: number): string {
  if (arcsec >= 3600) return `${formatNumber(arcsec / 3600, 2)}°`;
  if (arcsec >= 60) return `${formatNumber(arcsec / 60, 1)}′`;
  return `${formatNumber(arcsec, arcsec < 10 ? 2 : 1)}″`;
}

/** Right ascension in degrees → "05h 35m 17.3s". */
export function formatRa(raDeg: number): string {
  const totalSeconds = (((raDeg % 360) + 360) % 360) / 15 * 3600;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}h ${pad(m)}m ${s.toFixed(1).padStart(4, "0")}s`;
}

/** Declination in degrees → "−05° 23′ 28″". */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "−" : "+";
  const abs = Math.abs(decDeg) * 3600;
  const d = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = Math.round(abs % 60);
  return `${sign}${pad(d)}° ${pad(m)}′ ${pad(s)}″`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** ISO timestamp → "14 Nov 2026, 19:40" in the viewer's time zone. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFormat.format(d);
}
