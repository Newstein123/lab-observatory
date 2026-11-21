import { surfaceBrightness, type CuratedTarget } from "@/modules/targets/catalogue";
import { computeCameraLayout, type CameraLayout, type CameraResult } from "./layout";
import { gaussian, mulberry32 } from "./random";
import type { FilterKind } from "@/modules/simulations/engine";
import { applyTint, filterTint } from "./filter-tint";
import { drawSatellites, type SatelliteMark } from "./satellite-drawing";
import type { Satellite } from "@/modules/targets/satellites";
import { drawTarget, type LoadedReference } from "./target-drawing";
import { atmosphericDimming, horizonTint, type ViewAtmosphere, type ViewPhase } from "./atmosphere";
import { drawClouds } from "./clouds";
import { coreConcentration } from "@/modules/targets/reach";
import { cloudColour } from "./eyepiece-view";

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
  atmosphere?: ViewAtmosphere;
  phase?: ViewPhase;
  /** Turn the planet (and nothing else) so its pole sits at this position angle (see drawTarget). */
  bodyRotationDeg?: number;
  /** The telescope nudged off the target: where the target sits from the frame centre, CSS px. */
  panPx?: { x: number; y: number };
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
  { target, zoom, gain, exposureS, reference, filterKind, satellites, atmosphere, phase, bodyRotationDeg, panPx }: DrawCameraOptions,
): CameraDrawInfo {
  const layout = computeCameraLayout(result, displayWidthPx, {
    category: target.category,
    zoom,
    gain,
    exposureS,
    surfaceBrightness: surfaceBrightness(target),
    skyMag: atmosphere?.skyMag,
    coreConcentrationMag: coreConcentration(target),
  });
  const { renderWidthPx: w, renderHeightPx: h } = layout;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return layout;
  const info: CameraDrawInfo = { ...layout };

  octx.fillStyle = "#000";
  octx.fillRect(0, 0, w, h);
  const hidden = atmosphere !== undefined && atmosphere.altitudeDeg < 0;
  // The sensor loses light to the air and cloud. Unlike the eye it does not lose
  // contrast to a bright sky (that is subtracted); the sky's cost is its noise (layout).
  const air = atmosphere ? atmosphericDimming(target, atmosphere) : 1;
  // Below the horizon nothing reaches the sensor but sky.
  const level = hidden ? 0 : layout.level * (result.metrics.filterTransmission?.value ?? 1) * air;
  // Untracked drift (east–west, shown horizontally) in render pixels.
  const sensorPxAcross = layout.visibleWidthArcsec / result.metrics.imageScale.value;
  const trailPx = (result.metrics.trailPixels?.value ?? 0) * (w / sensorPxAcross);
  const steps = trailPx > 0.5 ? Math.min(MAX_TRAIL_STEPS, Math.ceil(trailPx)) : 1;
  octx.save();
  octx.filter = layout.blurPx > 0.05 ? `blur(${layout.blurPx.toFixed(2)}px)` : "none";
  octx.globalCompositeOperation = "lighter";
  for (let i = 0; i < steps; i++) {
    const dx = steps === 1 ? 0 : (i / (steps - 1) - 0.5) * trailPx;
    // Pan is in display px; the offscreen render may be smaller (one px per sensor px).
    const k = w / displayWidthPx;
    octx.setTransform(1, 0, 0, 1, w / 2 + dx + (panPx?.x ?? 0) * k, h / 2 + (panPx?.y ?? 0) * k);
    octx.globalAlpha = level / steps;
    // Additive, so the copies together carry the light of one exposure.
    if (!hidden) drawTarget(octx, target, layout.targetMajorPx, layout.targetMinorPx, { color: true, reference, blend: "lighter", phase, rotationDeg: bodyRotationDeg });
    if (satellites?.length && !hidden) {
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
  if (atmosphere) {
    applyTint(octx, horizonTint(atmosphere), w, h);
    drawClouds(octx, w, h, atmosphere.cloud, cloudColour(atmosphere).map((v) => v * Math.min(1, 0.3 + layout.skyLevel * 3)) as [number, number, number]);
  }
  applyTint(octx, filterTint(filterKind), w, h);

  if (layout.noiseSigma > 0 || layout.skyLevel > 0) {
    const img = octx.getImageData(0, 0, w, h);
    const d = img.data;
    const rand = mulberry32(NOISE_SEED);
    // Sky glow left after the usual background subtraction: warm for street light.
    const ped = (SKY_PEDESTAL + layout.skyLevel) * 255;
    const warm = atmosphere?.source === "light pollution" ? [1.1, 0.95, 0.8] : atmosphere?.source === "twilight" || atmosphere?.source === "moonlight" ? [0.85, 0.95, 1.15] : [1, 1, 1];
    for (let i = 0; i < d.length; i += 4) {
      const n = layout.noiseSigma > 0 ? gaussian(rand) * layout.noiseSigma * 255 : 0;
      d[i] = clampByte(d[i] + ped * warm[0] + n);
      d[i + 1] = clampByte(d[i + 1] + ped * warm[1] + n);
      d[i + 2] = clampByte(d[i + 2] + ped * warm[2] + n);
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
