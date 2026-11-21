/**
 * The Moon's disc as seen on a given night, made by projecting a global map
 * (equirectangular, longitude −180…180 left to right) orthographically for
 * the computed libration. Lunar north is up; the caller turns the disc by
 * the axis position angle. CALCULATED geometry from a RETRIEVED mosaic.
 *
 * Uses the same formulas as projectSelenographic / unprojectLunarNorthUp in
 * modules/sky/moon.ts, so labels placed with those land on the drawn features.
 */
import type { MoonOrientation } from "@/modules/sky/moon";

export interface GreyMap {
  /** Luminance, row-major from the north-west corner. */
  data: Uint8Array;
  width: number;
  height: number;
}

const D2R = Math.PI / 180;

/**
 * Fill `out` (RGBA, size × size) with the visible hemisphere. Outside the
 * disc is transparent; the limb is anti-aliased over one pixel.
 */
export function projectMoonDisc(
  map: GreyMap,
  o: Pick<MoonOrientation, "librationLatDeg" | "librationLonDeg">,
  size: number,
  out: Uint8ClampedArray = new Uint8ClampedArray(size * size * 4),
): Uint8ClampedArray {
  const { data, width: w, height: h } = map;
  const sb = Math.sin(o.librationLatDeg * D2R);
  const cb = Math.cos(o.librationLatDeg * D2R);
  const l0 = o.librationLonDeg * D2R;
  const half = size / 2;
  const xScale = w / (2 * Math.PI);
  const yScale = h / Math.PI;
  for (let py = 0; py < size; py++) {
    const yUp = -((py + 0.5 - half) / half);
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - half) / half;
      const rr = x * x + yUp * yUp;
      const i = (py * size + px) * 4;
      // Coverage of this pixel by the disc, for a soft limb.
      const edge = (1 - Math.sqrt(rr)) * half + 0.5;
      if (edge <= 0) {
        out[i + 3] = 0;
        continue;
      }
      const z = Math.sqrt(Math.max(0, 1 - rr));
      const lat = Math.asin(Math.max(-1, Math.min(1, yUp * cb + z * sb)));
      let lon = l0 + Math.atan2(x, z * cb - yUp * sb);
      if (lon > Math.PI) lon -= 2 * Math.PI;
      else if (lon < -Math.PI) lon += 2 * Math.PI;
      // Bilinear sample; longitude wraps, latitude clamps.
      const fx = (lon + Math.PI) * xScale - 0.5;
      const fy = (Math.PI / 2 - lat) * yScale - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = fx - x0;
      const ty = Math.max(0, Math.min(1, fy - y0));
      const xa = ((x0 % w) + w) % w;
      const xb = (xa + 1) % w;
      const v =
        (1 - ty) * ((1 - tx) * data[y0 * w + xa] + tx * data[y0 * w + xb]) + ty * ((1 - tx) * data[y1 * w + xa] + tx * data[y1 * w + xb]);
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = edge >= 1 ? 255 : Math.round(edge * 255);
    }
  }
  return out;
}

/** Disc resolution for a disc drawn `discDevicePx` across: a few tiers, so it is rebuilt rarely. */
export function discTier(discDevicePx: number): number {
  for (const t of [256, 512, 1024, 1536]) if (discDevicePx <= t) return t;
  return 2048;
}
