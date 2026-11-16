import type { CuratedTarget } from "@/modules/targets/catalogue";
import type { ReferenceImage } from "@/modules/targets/reference-images";
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
  { color, reference, blend = "screen" }: TargetDrawOptions,
): void {
  if (!reference) {
    drawTargetSchematic(ctx, target, majorPx, minorPx, { color });
    return;
  }
  const { image, meta } = reference;
  ctx.save();
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
