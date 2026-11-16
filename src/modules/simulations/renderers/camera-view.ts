import { surfaceBrightness, type CuratedTarget } from "@/modules/targets/catalogue";
import { computeCameraLayout, type CameraLayout, type CameraResult } from "./layout";
import { gaussian, mulberry32 } from "./random";
import type { FilterKind } from "@/modules/simulations/engine";
import { applyTint, filterTint } from "./filter-tint";
import { drawSatellites, type SatelliteMark } from "./satellite-drawing";
import type { Satellite } from "@/modules/targets/satellites";
import { drawTarget, type LoadedReference } from "./target-drawing";

export interface DrawCameraOptions {
  target: CuratedTarget;
  zoom: number;
  gain: number;
  exposureS?: number;
  /** Reference image to draw instead of the schematic, when loaded. */
  reference?: LoadedReference;
  filterKind?: FilterKind;
  /** The planet's moons at the chosen time (planets only). */
  satellites?: Satellite[];
}

export interface CameraDrawInfo extends CameraLayout {
  /** Moons drawn, offsets from the frame centre in display px. */
  satellites?: SatelliteMark[];
}

/** Copies drawn along the drift direction to approximate an untracked smear. */
const MAX_TRAIL_STEPS = 64;

const SKY_PEDESTAL = 0.02;
const NOISE_SEED = 42;

/**
 * Draw the camera view. The target is rendered at (at most) sensor-pixel
 * resolution offscreen, noise is added per sensor pixel, then the frame is
 * scaled up without smoothing so under-sampling is visible when zoomed.
 */
export function drawCameraView(
  ctx: CanvasRenderingContext2D,
  result: CameraResult,
  displayWidthPx: number,
  { target, zoom, gain, exposureS, reference, filterKind, satellites }: DrawCameraOptions,
): CameraDrawInfo {
  const layout = computeCameraLayout(result, displayWidthPx, { category: target.category, zoom, gain, exposureS, surfaceBrightness: surfaceBrightness(target) });
  const { renderWidthPx: w, renderHeightPx: h } = layout;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return layout;
  const info: CameraDrawInfo = { ...layout };

  octx.fillStyle = "#000";
  octx.fillRect(0, 0, w, h);
  const level = layout.level * (result.metrics.filterTransmission?.value ?? 1);
  // Untracked drift (east–west, shown horizontally) in render pixels.
  const sensorPxAcross = layout.visibleWidthArcsec / result.metrics.imageScale.value;
  const trailPx = (result.metrics.trailPixels?.value ?? 0) * (w / sensorPxAcross);
  const steps = trailPx > 0.5 ? Math.min(MAX_TRAIL_STEPS, Math.ceil(trailPx)) : 1;
  octx.save();
  octx.filter = layout.blurPx > 0.05 ? `blur(${layout.blurPx.toFixed(2)}px)` : "none";
  octx.globalCompositeOperation = "lighter";
  for (let i = 0; i < steps; i++) {
    const dx = steps === 1 ? 0 : (i / (steps - 1) - 0.5) * trailPx;
    octx.setTransform(1, 0, 0, 1, w / 2 + dx, h / 2);
    octx.globalAlpha = level / steps;
    // Additive, so the copies together carry the light of one exposure.
    drawTarget(octx, target, layout.targetMajorPx, layout.targetMinorPx, { color: true, reference, blend: "lighter" });
    if (satellites?.length) {
      octx.save();
      octx.filter = "none";
      const marks = drawSatellites(octx, satellites, layout.targetMajorPx, {
        // A planetary exposure records moons easily; their brightness follows the image level.
        limitMag: 11,
        blurPx: layout.blurPx,
        fieldRadiusPx: Math.hypot(w, h),
        alphaScale: Math.min(1, level * 1.5) / steps,
      });
      octx.restore();
      if (i === 0) {
        const k = layout.displayWidthPx / w;
        info.satellites = marks.map((m) => ({ ...m, x: (m.x + dx) * k, y: m.y * k }));
      }
    }
  }
  octx.restore();
  applyTint(octx, filterTint(filterKind), w, h);

  if (layout.noiseSigma > 0) {
    const img = octx.getImageData(0, 0, w, h);
    const d = img.data;
    const rand = mulberry32(NOISE_SEED);
    for (let i = 0; i < d.length; i += 4) {
      const n = gaussian(rand) * layout.noiseSigma * 255;
      const ped = SKY_PEDESTAL * 255;
      d[i] = clampByte(d[i] + ped + n);
      d[i + 1] = clampByte(d[i + 1] + ped + n);
      d[i + 2] = clampByte(d[i + 2] + ped + n);
    }
    octx.putImageData(img, 0, 0);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, layout.displayWidthPx, layout.displayHeightPx);
  ctx.restore();

  return info;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
