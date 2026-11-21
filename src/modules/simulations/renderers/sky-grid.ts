/**
 * Lines of right ascension and declination across a small field, for the
 * coordinate-grid layer. Views are drawn north up, east left; over a field of
 * a few degrees the lines are straight to within a pixel, so they are drawn
 * as straight lines (RA lines spaced by cos δ).
 *
 * Coordinates: px from the view centre, x right (west), y down (south).
 */

export interface GridLine {
  /** "ra": a vertical line at `pos` (x); "dec": a horizontal line at `pos` (y). */
  kind: "ra" | "dec";
  pos: number;
  label: string;
}

const RA_STEPS_S = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
const DEC_STEPS_ARCSEC = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 18000];

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function formatRa(deg: number, stepS: number): string {
  const totalS = Math.round(mod(deg, 360) * 240);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return stepS >= 60 ? `${h}h${pad(m)}m` : `${h}h${pad(m)}m${pad(s)}s`;
}

export function formatDec(deg: number, stepArcsec: number): string {
  const sign = deg < 0 ? "−" : "+";
  const total = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (stepArcsec >= 3600) return `${sign}${d}°`;
  if (stepArcsec >= 60) return `${sign}${d}°${pad(m)}′`;
  return `${sign}${d}°${pad(m)}′${pad(s)}″`;
}

export function skyGrid({
  raDeg,
  decDeg,
  pxPerArcsec,
  centreOffsetPx = { x: 0, y: 0 },
  halfWidthPx,
  halfHeightPx,
  lines = 4,
}: {
  /** Position of the target (of date). */
  raDeg: number;
  decDeg: number;
  pxPerArcsec: number;
  /** Where the target is drawn relative to the view centre. */
  centreOffsetPx?: { x: number; y: number };
  halfWidthPx: number;
  halfHeightPx: number;
  /** About how many lines of each kind to fit across. */
  lines?: number;
}): GridLine[] {
  const out: GridLine[] = [];
  const cosDec = Math.max(0.02, Math.cos((decDeg * Math.PI) / 180));
  const spanArcsec = (2 * Math.max(halfWidthPx, halfHeightPx)) / pxPerArcsec;

  // Declination: horizontal lines, north (higher δ) up.
  const decStep = DEC_STEPS_ARCSEC.find((st) => st >= spanArcsec / lines) ?? DEC_STEPS_ARCSEC[DEC_STEPS_ARCSEC.length - 1];
  const decAt = (y: number) => decDeg - (y - centreOffsetPx.y) / pxPerArcsec / 3600;
  const decLo = Math.min(decAt(-halfHeightPx), decAt(halfHeightPx));
  const decHi = Math.max(decAt(-halfHeightPx), decAt(halfHeightPx));
  for (let k = Math.ceil((decLo * 3600) / decStep); k * decStep <= decHi * 3600; k++) {
    const dec = (k * decStep) / 3600;
    if (Math.abs(dec) > 90) continue;
    out.push({ kind: "dec", pos: centreOffsetPx.y - (dec - decDeg) * 3600 * pxPerArcsec, label: formatDec(dec, decStep) });
  }

  // Right ascension: vertical lines, increasing to the east (left). 1 s of time = 15″·cos δ on the sky.
  const raStep = RA_STEPS_S.find((st) => st * 15 * cosDec >= spanArcsec / lines) ?? RA_STEPS_S[RA_STEPS_S.length - 1];
  const raSecAt = (x: number) => raDeg * 240 - (x - centreOffsetPx.x) / pxPerArcsec / (15 * cosDec);
  const raLo = Math.min(raSecAt(-halfWidthPx), raSecAt(halfWidthPx));
  const raHi = Math.max(raSecAt(-halfWidthPx), raSecAt(halfWidthPx));
  for (let k = Math.ceil(raLo / raStep); k * raStep <= raHi; k++) {
    const raS = k * raStep;
    out.push({ kind: "ra", pos: centreOffsetPx.x - (raS - raDeg * 240) * 15 * cosDec * pxPerArcsec, label: formatRa(raS / 240, raStep) });
  }
  return out;
}
