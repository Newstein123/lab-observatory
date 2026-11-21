import type { CuratedTarget } from "@/modules/targets/catalogue";
import type { ReferenceImage } from "@/modules/targets/reference-images";
import type { ViewPhase } from "./atmosphere";
import { drawPhased } from "./phase-mask";
import { drawTargetSchematic } from "./schematics";

/** A reference image that has finished loading, with its provenance. */
export interface LoadedReference {
  image: CanvasImageSource;
  meta: ReferenceImage;
}

export interface TargetDrawOptions {
  color: boolean;
  reference?: LoadedReference;
  /** How the image combines with what is already drawn. Default "screen". */
  blend?: GlobalCompositeOperation;
  /** Moon or planet phase: only the lit part is drawn. */
  phase?: ViewPhase;
  /**
   * Turn the body (its photo or drawing has north up) so its north pole points
   * this many degrees counter-clockwise from screen-up: the pole's position
   * angle when the view has celestial north up and east left. The phase is
   * already in sky terms and is not turned with it.
   */
  rotationDeg?: number;
}

/**
 * Draw the target centred at (0, 0), sized so its major axis spans `majorPx`.
 * Uses the reference image when available (scaled to the exact angular size),
 * otherwise the illustrative schematic. Blur, brightness and colour are set by
 * the caller through the canvas state (filter, globalAlpha).
 */
export function drawTarget(
  ctx: CanvasRenderingContext2D,
  target: CuratedTarget,
  majorPx: number,
  minorPx: number,
  { color, reference, blend = "screen", phase, rotationDeg }: TargetDrawOptions,
): void {
  if (phase && phase.illuminated < 0.995 && (target.category === "moon" || target.category === "planet")) {
    drawPhased(ctx, Math.max(majorPx / 2, 0.75), phase, (c) => drawTarget(c, target, majorPx, minorPx, { color, reference, blend: "source-over", rotationDeg }), blend);
    return;
  }
  // Canvas angles run clockwise (y down); position angles counter-clockwise here.
  const turn = rotationDeg ? (-rotationDeg * Math.PI) / 180 : 0;
  if (!reference) {
    ctx.save();
    if (turn) ctx.rotate(turn);
    drawTargetSchematic(ctx, target, majorPx, minorPx, { color });
    ctx.restore();
    return;
  }
  const { image, meta } = reference;
  ctx.save();
  if (turn) ctx.rotate(turn);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Light adds to the sky background: "screen" makes the image's black
  // background transparent instead of drawing a dark rectangle.
  ctx.globalCompositeOperation = blend;

  let w: number;
  let h: number;
  if (meta.kind === "body") {
    // Cropped to the body: image width ↔ catalogued major axis.
    w = Math.max(majorPx, 1);
    h = w * (meta.heightPx / meta.widthPx);
  } else {
    // Survey cutout: place by angular scale, centred on the target.
    const pxPerArcsec = majorPx / target.angularSize.majorAxisArcsec;
    w = meta.fieldWidthArcsec * pxPerArcsec;
    h = meta.fieldHeightArcsec * pxPerArcsec;
  }
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}
