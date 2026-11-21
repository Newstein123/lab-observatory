import { surfaceBrightness, type CuratedTarget } from "@/modules/targets/catalogue";
import { computeEyepieceLayout, type EyepieceLayout, type EyepieceResult } from "./layout";
import { filterTransmission, type FilterKind } from "@/modules/simulations/engine";
import { applyTint, filterTint } from "./filter-tint";
import { drawSatellites, type SatelliteMark } from "./satellite-drawing";
import { drawStars, visibleStars, type Star, type StarFieldData } from "./stars";
import type { Satellite } from "@/modules/targets/satellites";
import { drawTarget, type LoadedReference } from "./target-drawing";
import { atmosphericDimming, deepSkyVisibility, horizonTint, skyColour, skyLevel, type ViewAtmosphere, type ViewPhase } from "./atmosphere";
import { drawClouds } from "./clouds";

export interface DrawEyepieceOptions {
  target: CuratedTarget;
  focusOffset: number;
  /**
   * Show long-exposure colour for deep-sky objects. Off by default: the
   * dark-adapted eye sees faint objects largely in grey (spec §5.3, §7).
   */
  longExposureColor: boolean;
  /** Reference image to draw instead of the schematic, when loaded. */
  reference?: LoadedReference;
  /** Filter in the light path: dims by the engine's transmission estimate and tints. */
  filterKind?: FilterKind;
  /**
   * "As seen by eye" mode for deep-sky targets: the survey image with its
   * stars removed (grey, faint parts suppressed) plus catalogue stars drawn
   * to the telescope's limiting magnitude with their real colours.
   */
  visual?: { object: LoadedReference; starField: { data: StarFieldData; stars: Star[] } };
  /** The planet's moons at the chosen time (planets only). */
  satellites?: Satellite[];
  /** Sky, air and cloud at the time and place; omitted for an ideal dark sky. */
  atmosphere?: ViewAtmosphere;
  /** Moon or planet phase. */
  phase?: ViewPhase;
  /** Turn the planet (and nothing else) so its pole sits at this position angle (see drawTarget). */
  bodyRotationDeg?: number;
  /** The telescope nudged off the target: where the target sits from the field centre, CSS px. */
  panPx?: { x: number; y: number };
}

export interface EyepieceDrawInfo extends EyepieceLayout {
  /** Catalogue stars drawn (visual mode only). */
  starsShown?: number;
  /** Faintest star magnitude shown (visual mode only). */
  starLimitMag?: number;
  /** Moons drawn, with offsets from the field centre (px). */
  satellites?: SatelliteMark[];
}

/** Draw the eyepiece view into a square canvas of logical size `sizePx`. */
export function drawEyepieceView(
  ctx: CanvasRenderingContext2D,
  result: EyepieceResult,
  sizePx: number,
  { target, focusOffset, longExposureColor, reference, filterKind, visual, satellites, atmosphere, phase, bodyRotationDeg, panPx }: DrawEyepieceOptions,
): EyepieceDrawInfo {
  const layout = computeEyepieceLayout(result, sizePx, { category: target.category, focusOffset, surfaceBrightness: surfaceBrightness(target) });
  const c = sizePx / 2;
  const faintObject = target.category === "nebula" || target.category === "galaxy";
  const color = !faintObject || longExposureColor;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sizePx, sizePx);

  // Field of view: the sky inside the field stop (darkened by a small exit pupil).
  const skyAtEye = result.metrics.skyBackgroundAtEye?.value ?? atmosphere?.skyMag;
  ctx.beginPath();
  ctx.arc(c, c, layout.fieldRadiusPx, 0, Math.PI * 2);
  ctx.fillStyle = atmosphere && skyAtEye !== undefined ? skyColour(skyAtEye, atmosphere.source) : "#05070c";
  ctx.fill();
  ctx.clip();

  ctx.translate(c + (panPx?.x ?? 0), c + (panPx?.y ?? 0));
  // Stars are catalogued around the target: reach as far as the field now extends from it.
  const panReach = Math.hypot(panPx?.x ?? 0, panPx?.y ?? 0);
  const info: EyepieceDrawInfo = { ...layout };
  const hidden = atmosphere !== undefined && atmosphere.altitudeDeg < 0;
  const air = atmosphere ? atmosphericDimming(target, atmosphere) * deepSkyVisibility(target, atmosphere.skyMag, atmosphere.extinctionMag) : 1;
  const transmission = (result.metrics.filterTransmission?.value ?? 1) * air;
  if (hidden) {
    // Below the horizon: only the sky (the viewport explains why).
  } else if (visual && !longExposureColor) {
    // The extended object, grey, through a visual threshold curve. Open clusters are
    // their stars; any glow in their survey image is photographic (e.g. the Pleiades'
    // reflection nebula), so it is left out.
    const openCluster = target.category === "cluster" && !/globular/i.test(target.subtype);
    if (!openCluster) drawVisualObject(ctx, target, layout, visual.object, layout.brightness * transmission);
    // Stars: a filter dims starlight (continuum) too, which lowers the limit.
    const starLoss = filterKind ? filterTransmission(filterKind, "cluster") : 1;
    const limitMag = result.metrics.limitingMagnitude.value + 2.5 * Math.log10(starLoss);
    const stars = visibleStars(visual.starField.data, visual.starField.stars, {
      limitMag,
      pxPerArcsec: layout.pxPerArcsec,
      fieldRadiusPx: layout.fieldRadiusPx + panReach,
      blurPx: layout.blurPx,
      color: true,
    });
    drawStars(ctx, stars);
    info.starsShown = stars.length;
    info.starLimitMag = limitMag;
    applyTint(ctx, filterTint(filterKind), ctx.canvas.width, ctx.canvas.height);
  } else {
    ctx.globalAlpha = layout.brightness * transmission;
    const filters = [layout.blurPx > 0.05 ? `blur(${layout.blurPx.toFixed(2)}px)` : "", color ? "" : "grayscale(1)"];
    ctx.filter = filters.filter(Boolean).join(" ") || "none";
    drawTarget(ctx, target, layout.targetMajorPx, layout.targetMinorPx, { color, reference, phase, rotationDeg: bodyRotationDeg });
    if (satellites?.length) {
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      // Moons are point-like: starlight rules, after any filter loss on their reflected sunlight.
      const loss = filterKind ? filterTransmission(filterKind, "cluster") : 1;
      info.satellites = drawSatellites(ctx, satellites, layout.targetMajorPx, {
        limitMag: result.metrics.limitingMagnitude.value + 2.5 * Math.log10(loss),
        blurPx: layout.blurPx,
        fieldRadiusPx: layout.fieldRadiusPx + panReach,
      });
    }
    applyTint(ctx, color ? filterTint(filterKind) : undefined, ctx.canvas.width, ctx.canvas.height);
  }
  if (atmosphere) {
    if (!hidden) applyTint(ctx, horizonTint(atmosphere), ctx.canvas.width, ctx.canvas.height);
    drawClouds(ctx, ctx.canvas.width, ctx.canvas.height, atmosphere.cloud, cloudColour(atmosphere, skyAtEye));
  }
  ctx.restore();

  // Field-stop edge.
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, layout.fieldRadiusPx, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(140,150,170,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  return info;
}

/**
 * Survey images use a logarithmic stretch, which lifts glow far fainter than
 * the eye can detect. This curve (ILLUSTRATIVE) drops everything below a
 * threshold above the sky and compresses the rest, so only the brighter
 * parts of a nebula or galaxy remain, as at the eyepiece.
 */
export const VISUAL_THRESHOLD = 0.4;
export const VISUAL_GAMMA = 1.8;

export function visualCurve(v: number): number {
  const x = Math.max(0, (v - VISUAL_THRESHOLD) / (1 - VISUAL_THRESHOLD));
  return Math.min(1, x) ** VISUAL_GAMMA;
}

function drawVisualObject(
  ctx: CanvasRenderingContext2D,
  target: CuratedTarget,
  layout: EyepieceLayout,
  object: LoadedReference,
  alpha: number,
) {
  const { width, height } = ctx.canvas;
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.setTransform(ctx.getTransform());
  octx.filter = [layout.blurPx > 0.05 ? `blur(${layout.blurPx.toFixed(2)}px)` : "", "grayscale(1)"].join(" ");
  drawTarget(octx, target, layout.targetMajorPx, layout.targetMinorPx, { color: false, reference: object });
  const img = octx.getImageData(0, 0, width, height);
  const d = img.data;
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(visualCurve(i / 255) * 255);
  for (let i = 0; i < d.length; i += 4) {
    const v = lut[d[i]];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

/** Cloud colour: lit orange-grey by a city, a dark silhouette under a dark sky. */
export function cloudColour(a: ViewAtmosphere, skyAtEye = a.skyMag): [number, number, number] {
  const lit = Math.min(1, skyLevel(skyAtEye) * 2.2);
  const glow = a.source === "light pollution" ? [205, 165, 130] : a.source === "twilight" ? [150, 160, 185] : [150, 155, 170];
  return [0, 1, 2].map((i) => Math.round(14 + (glow[i] - 14) * lit)) as [number, number, number];
}
