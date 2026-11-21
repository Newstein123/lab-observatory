/**
 * Patchy cloud over the view (ILLUSTRATIVE): smooth seeded noise thresholded
 * by the cloud cover, so more cover means more of the field is hidden. Over a
 * city the cloud glows with reflected street light; at a dark site it's a
 * dark silhouette.
 */
import { mulberry32 } from "./random";

const N = 48;
const cache = new Map<number, Float32Array>();

/** Smooth value noise on an N×N grid (a few octaves), values 0…1. */
function noiseField(seed: number): Float32Array {
  const hit = cache.get(seed);
  if (hit) return hit;
  const out = new Float32Array(N * N);
  const rand = mulberry32(seed);
  let total = 0;
  for (const [cells, weight] of [
    [4, 0.55],
    [8, 0.3],
    [16, 0.15],
  ] as const) {
    const g = Array.from({ length: (cells + 1) * (cells + 1) }, () => rand());
    const at = (x: number, y: number) => g[y * (cells + 1) + x];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * cells;
        const fy = (y / N) * cells;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const sx = (fx - x0) ** 2 * (3 - 2 * (fx - x0));
        const sy = (fy - y0) ** 2 * (3 - 2 * (fy - y0));
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
        const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
        out[y * N + x] += weight * (top * (1 - sy) + bottom * sy);
      }
    }
    total += weight;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  cache.set(seed, out);
  return out;
}

/** Opacity of the cloud at a noise value for a cover (0…1). */
export function cloudOpacity(noise: number, cover: number): number {
  if (cover <= 0) return 0;
  if (cover >= 1) return 0.97;
  // The noise is roughly 0.25…0.75; map cover to a threshold over that range.
  const threshold = 0.75 - cover * 0.5;
  const t = Math.min(1, Math.max(0, (noise - threshold + 0.06) / 0.12));
  return 0.97 * t * t * (3 - 2 * t);
}

/** Paint the cloud layer over the current clip (canvas pixels, identity transform). */
export function drawClouds(ctx: CanvasRenderingContext2D, width: number, height: number, cover: number, rgb: [number, number, number], seed = 7): void {
  if (cover <= 0.02) return;
  const field = noiseField(seed);
  const tile = document.createElement("canvas");
  tile.width = tile.height = N;
  const t = tile.getContext("2d");
  if (!t) return;
  const img = t.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = Math.round(cloudOpacity(field[i], cover) * 255);
  }
  t.putImageData(img, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tile, 0, 0, width, height);
  ctx.restore();
}
