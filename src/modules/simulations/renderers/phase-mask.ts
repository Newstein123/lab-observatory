/**
 * The lit part of a disc for a phase (CALCULATED geometry, ILLUSTRATIVE
 * shading): half the disc plus or minus half an ellipse whose width is
 * r·|cos(phase angle)|. The terminator is drawn soft; real crater shadows
 * along it are not modelled.
 */
import type { ViewPhase } from "./atmosphere";

/** Points of the lit outline for a unit disc with the bright limb towards +x. */
export function litOutline(illuminated: number, segments = 48): [number, number][] {
  const k = Math.min(1, Math.max(0, illuminated));
  // k = (1 + cos i) / 2 → cos i = 2k − 1: the terminator's half-width.
  const e = Math.abs(2 * k - 1);
  const side = k >= 0.5 ? -1 : 1; // gibbous bulges into the dark half, crescent into the lit half
  const pts: [number, number][] = [];
  for (let s = 0; s <= segments; s++) {
    const a = -Math.PI / 2 + (Math.PI * s) / segments;
    pts.push([Math.cos(a), Math.sin(a)]); // lit limb, top → bottom through +x
  }
  for (let s = 0; s <= segments; s++) {
    const a = Math.PI / 2 - (Math.PI * s) / segments;
    pts.push([side * e * Math.cos(a), Math.sin(a)]); // terminator, bottom → top
  }
  return pts;
}

/** Canvas rotation (radians, y down) that turns +x towards the bright limb. */
export function limbRotation(brightLimbDeg: number): number {
  const t = (brightLimbDeg * Math.PI) / 180;
  // Counter-clockwise from screen-up: direction (−sin t, −cos t) in canvas coordinates.
  return Math.atan2(-Math.cos(t), -Math.sin(t));
}

/**
 * Draw `paint` (which draws the full disc centred at 0,0) through the phase
 * mask, onto ctx at the origin. Drawn offscreen at the canvas's own pixel
 * density, then composited with the caller's blur, alpha and blend.
 */
export function drawPhased(
  ctx: CanvasRenderingContext2D,
  radiusPx: number,
  phase: ViewPhase,
  paint: (c: CanvasRenderingContext2D) => void,
  blend: GlobalCompositeOperation,
): void {
  const m = ctx.getTransform();
  const scale = Math.max(1, Math.hypot(m.a, m.b));
  const pad = 2;
  const sizeCss = radiusPx * 2 + pad * 2;
  // A disc larger than the canvas (the Moon at high power) is drawn only where
  // the canvas is: the offscreen layers match the canvas and keep its transform.
  const windowed = sizeCss * scale > Math.max(ctx.canvas.width, ctx.canvas.height);
  const w = windowed ? ctx.canvas.width : Math.max(4, Math.ceil(sizeCss * scale));
  const h = windowed ? ctx.canvas.height : w;
  const layer = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    if (x) {
      if (windowed) x.setTransform(m);
      else x.setTransform(scale, 0, 0, scale, w / 2, h / 2);
    }
    return [c, x] as const;
  };

  const [off, o] = layer();
  if (!o) return paint(ctx);
  paint(o);

  // Keep the lit part (soft terminator), plus a faint earthshine on the rest.
  const [mask, mk] = layer();
  if (!mk) return paint(ctx);
  mk.rotate(limbRotation(phase.brightLimbDeg));
  mk.filter = `blur(${Math.max(0.4, radiusPx * 0.012) * scale}px)`;
  mk.fillStyle = "#fff";
  mk.beginPath();
  const pts = litOutline(phase.illuminated);
  pts.forEach(([x, y], i) => (i ? mk.lineTo(x * (radiusPx + 1), y * (radiusPx + 1)) : mk.moveTo(x * (radiusPx + 1), y * (radiusPx + 1))));
  mk.closePath();
  mk.fill();

  const lit = document.createElement("canvas");
  lit.width = w;
  lit.height = h;
  const l = lit.getContext("2d");
  if (!l) return paint(ctx);
  if (phase.earthshine) {
    l.globalAlpha = 0.035;
    l.drawImage(off, 0, 0);
    l.globalAlpha = 1;
  }
  const masked = document.createElement("canvas");
  masked.width = w;
  masked.height = h;
  const mm = masked.getContext("2d");
  if (!mm) return paint(ctx);
  mm.drawImage(off, 0, 0);
  mm.globalCompositeOperation = "destination-in";
  mm.drawImage(mask, 0, 0);
  l.drawImage(masked, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = blend;
  if (windowed) {
    // Already in canvas pixels.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(lit, 0, 0);
  } else {
    ctx.drawImage(lit, -sizeCss / 2, -sizeCss / 2, sizeCss, sizeCss);
  }
  ctx.restore();
}
